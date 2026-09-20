package uk.co.xeiverse.genesislists.data.api

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorBody(
    val error: ApiErrorDetail,
)

@Serializable
data class ApiErrorDetail(
    val code: String,
    val message: String,
)

@Serializable
data class HealthDto(
    val status: String,
    val version: String? = null,
    val schemaVersion: Int? = null,
)

@Serializable
data class RegistrationStatusDto(
    val open: Boolean,
)

@Serializable
data class OidcPublicConfigDto(
    val enabled: Boolean = false,
    val buttonText: String = "Login with OAuth",
    val autoLaunch: Boolean = false,
    /** Present and true when the server supports Android Custom Tabs ticket handoff. */
    val mobileLogin: Boolean? = null,
)

@Serializable
data class AuthConfigDto(
    val registrationOpen: Boolean = false,
    val passwordLoginEnabled: Boolean = true,
    val oidc: OidcPublicConfigDto = OidcPublicConfigDto(),
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val authProviders: List<String> = emptyList(),
)

@Serializable
data class ListItemPreviewDto(
    val id: String,
    val text: String,
    val checked: Boolean,
)

@Serializable
data class ListDto(
    val id: String,
    val name: String,
    val createdAt: String,
    val updatedAt: String,
    val previewItems: List<ListItemPreviewDto> = emptyList(),
    val itemCount: Int = 0,
    val isOwner: Boolean = true,
    val ownerName: String = "",
)

@Serializable
data class ListsResponse(
    val lists: List<ListDto>,
)

@Serializable
data class ListItemDto(
    val id: String,
    val listId: String,
    val text: String,
    val checked: Boolean,
    val position: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class ItemsResponse(
    val items: List<ListItemDto>,
)

@Serializable
data class CredentialsBody(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterBody(
    val email: String,
    val password: String,
    val name: String? = null,
)

@Serializable
data class NameBody(
    val name: String,
)

@Serializable
data class TextBody(
    val text: String,
)

@Serializable
data class UpdateItemBody(
    val text: String? = null,
    val checked: Boolean? = null,
    val position: Int? = null,
)

@Serializable
data class ChangePasswordBody(
    val currentPassword: String,
    val newPassword: String,
)

@Serializable
data class MobileExchangeBody(
    val ticket: String,
)

class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
) : Exception(message)

object OAuthDeepLink {
    const val SCHEME = "uk.co.xeiverse.genesislists"
    const val HOST = "oauth-callback"

    const val CLEARTEXT_SECURE_COOKIE_HINT =
        "This server sets Secure cookies (COOKIE_SECURE=true) but the app is using HTTP. Use an HTTPS URL, or set COOKIE_SECURE=false for local HTTP and recreate the container."

    fun oidcStartUrl(baseUrl: String): String =
        "${baseUrl.trimEnd('/')}/api/auth/oidc/start?client=android"

    /** Skip re-exchange when a session already exists (stale deep-link after recreation). */
    fun shouldExchangeOidcTicket(hasSession: Boolean, ticket: String?): Boolean =
        !ticket.isNullOrBlank() && !hasSession

    fun oidcFailureMessage(baseUrl: String?, reason: String? = null): String =
        when (reason) {
            "email_unverified" ->
                "The identity provider did not mark your email as verified. Verify it in Authentik, or set OIDC_REQUIRE_EMAIL_VERIFIED=false if you trust this IdP."
            else -> if (baseUrlLooksHttp(baseUrl)) {
                "OIDC sign-in failed. If this is a local HTTP server, COOKIE_SECURE must be false (recreate the container). On production, use the HTTPS origin in the app."
            } else {
                "OIDC sign-in failed"
            }
        }

    fun baseUrlLooksHttp(baseUrl: String?): Boolean =
        baseUrl?.trim()?.startsWith("http://", ignoreCase = true) == true

    fun parse(uriString: String): Result {
        // Avoid android.net.Uri so JVM unit tests can run without Robolectric.
        val trimmed = uriString.trim()
        val schemeSep = trimmed.indexOf("://")
        if (schemeSep <= 0) return Result.Ignored
        val scheme = trimmed.substring(0, schemeSep)
        if (scheme != SCHEME) return Result.Ignored
        val rest = trimmed.substring(schemeSep + 3)
        val queryStart = rest.indexOf('?')
        val authorityAndPath = if (queryStart >= 0) rest.substring(0, queryStart) else rest
        val host = authorityAndPath.substringBefore('/').substringBefore(':')
        if (host != HOST) return Result.Ignored
        val query = if (queryStart >= 0) rest.substring(queryStart + 1) else ""
        val params = query.split('&')
            .filter { it.isNotEmpty() }
            .mapNotNull { part ->
                val eq = part.indexOf('=')
                if (eq < 0) part to ""
                else {
                    val key = java.net.URLDecoder.decode(part.substring(0, eq), Charsets.UTF_8)
                    val value = java.net.URLDecoder.decode(part.substring(eq + 1), Charsets.UTF_8)
                    key to value
                }
            }
            .toMap()
        val error = params["error"]
        val reason = params["reason"]?.takeIf { it.isNotBlank() }
        if (!error.isNullOrBlank()) {
            return Result.Error(error, reason)
        }
        val ticket = params["ticket"]
        if (!ticket.isNullOrBlank()) {
            return Result.Ticket(ticket)
        }
        return Result.Error("oidc", reason ?: "missing_ticket")
    }

    sealed class Result {
        data object Ignored : Result()
        data class Ticket(val ticket: String) : Result()
        data class Error(val code: String, val reason: String? = null) : Result()
    }
}
