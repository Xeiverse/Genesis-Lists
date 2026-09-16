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

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_BASE_URL = "base_url"

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
