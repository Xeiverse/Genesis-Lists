package uk.co.xeiverse.genesislists.data.prefs

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/**
 * Persists OkHttp cookies (notably `genesis_session`) in EncryptedSharedPreferences.
 */
class PersistentCookieJar(
    private val prefs: SharedPreferences,
) : CookieJar {

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val key = hostKey(url)
        val existing = loadForHost(key).associateBy { it.name }.toMutableMap()
        for (cookie in cookies) {
            if (cookie.expiresAt < System.currentTimeMillis() || cookie.value.isEmpty()) {
                existing.remove(cookie.name)
            } else {
                existing[cookie.name] = cookie
            }
        }
        prefs.edit().putStringSet(key, existing.values.map { serialize(it) }.toSet()).apply()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val key = hostKey(url)
        val now = System.currentTimeMillis()
        val valid = loadForHost(key).filter { it.expiresAt >= now && it.matches(url) }
        if (valid.size != loadForHost(key).size) {
            prefs.edit().putStringSet(key, valid.map { serialize(it) }.toSet()).apply()
        }
        return valid
    }

    /** True when a Secure session cookie was stored but will not be sent on this HTTP URL. */
    fun sessionCookieBlockedOnCleartext(url: HttpUrl): Boolean =
        loadForHost(hostKey(url)).any {
            it.name == SESSION_COOKIE && it.secure && !url.isHttps
        }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun hasSessionCookie(): Boolean {
        return prefs.all.keys
            .filterIsInstance<String>()
            .flatMap { loadForHost(it) }
            .any { it.name == SESSION_COOKIE && it.expiresAt >= System.currentTimeMillis() }
    }

    private fun loadForHost(key: String): List<Cookie> {
        val raw = prefs.getStringSet(key, emptySet()) ?: emptySet()
        return raw.mapNotNull { deserialize(it) }
    }

    private fun hostKey(url: HttpUrl): String = "cookies:${url.host}"

    companion object {
        const val SESSION_COOKIE = "genesis_session"
        private const val PREFS_NAME = "genesis_cookie_jar"

        fun create(context: Context): PersistentCookieJar {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            return PersistentCookieJar(prefs)
        }

        fun serialize(cookie: Cookie): String {
            return listOf(
                cookie.name,
                cookie.value,
                cookie.expiresAt.toString(),
                cookie.domain,
                cookie.path,
                cookie.secure.toString(),
                cookie.httpOnly.toString(),
                cookie.persistent.toString(),
                cookie.hostOnly.toString(),
            ).joinToString("\u0001")
        }

        fun deserialize(raw: String): Cookie? {
            val parts = raw.split("\u0001")
            if (parts.size < 9) return null
            return try {
                val builder = Cookie.Builder()
                    .name(parts[0])
                    .value(parts[1])
                    .expiresAt(parts[2].toLong())
                    .path(parts[4])
                if (parts[8].toBoolean()) {
                    builder.hostOnlyDomain(parts[3])
                } else {
                    builder.domain(parts[3])
                }
                if (parts[5].toBoolean()) builder.secure()
                if (parts[6].toBoolean()) builder.httpOnly()
                builder.build()
            } catch (_: Exception) {
                null
            }
        }
    }
}

class ServerSettingsStore(
    private val prefs: SharedPreferences,
) {
    constructor(context: Context) : this(encryptedPrefs(context, "genesis_server_settings"))

    var baseUrl: String?
        get() = prefs.getString(KEY_BASE_URL, null)?.trim()?.takeIf { it.isNotEmpty() }
        set(value) {
            prefs.edit().putString(KEY_BASE_URL, value?.trim()?.trimEnd('/')).apply()
        }

    var customProxyHeaders: Map<String, String>
        get() {
            val raw = prefs.getString(KEY_CUSTOM_HEADERS, null) ?: return emptyMap()
            return runCatching { decodeHeadersJson(raw) }.getOrDefault(emptyMap())
        }
        set(value) {
            val sanitized = sanitizeHeaders(value)
            if (sanitized.isEmpty()) {
                prefs.edit().remove(KEY_CUSTOM_HEADERS).apply()
            } else {
                prefs.edit().putString(KEY_CUSTOM_HEADERS, encodeHeadersJson(sanitized)).apply()
            }
        }

    fun clear() {
        // Clears server URL and custom headers. Logout must not call this.
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_CUSTOM_HEADERS = "custom_proxy_headers"

        private val json = kotlinx.serialization.json.Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        fun encodeHeadersJson(headers: Map<String, String>): String =
            json.encodeToString(kotlinx.serialization.serializer(), headers)

        fun decodeHeadersJson(raw: String): Map<String, String> =
            json.decodeFromString(kotlinx.serialization.serializer(), raw)

        /**
         * Trim keys/values; drop empty keys; drop names with CR/LF or ':';
         * later duplicate keys win (map overwrite).
         */
        fun sanitizeHeaders(input: Map<String, String>): Map<String, String> {
            val out = linkedMapOf<String, String>()
            for ((rawName, rawValue) in input) {
                val name = rawName.trim()
                val value = rawValue.trim()
                if (name.isEmpty()) continue
                if (name.contains('\r') || name.contains('\n') || name.contains(':')) continue
                if (value.contains('\r') || value.contains('\n')) continue
                out[name] = value
            }
            return out
        }

        /** Sanitize editable rows (name/value pairs); empty names discarded. */
        fun sanitizeHeaderRows(rows: List<Pair<String, String>>): Map<String, String> =
            sanitizeHeaders(rows.associate { it.first to it.second })

        private fun encryptedPrefs(context: Context, name: String): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            return EncryptedSharedPreferences.create(
                context,
                name,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
