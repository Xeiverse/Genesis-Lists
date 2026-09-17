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
    val buttonText: String = "Sign in with OIDC",
    val autoLaunch: Boolean = false,
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

    fun oidcStartUrl(baseUrl: String): String =
        "${baseUrl.trimEnd('/')}/api/auth/oidc/start?client=android"

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
        if (!error.isNullOrBlank()) {
            return Result.Error(error)
        }
        val ticket = params["ticket"]
        if (!ticket.isNullOrBlank()) {
            return Result.Ticket(ticket)
        }
        return Result.Error("oidc")
    }

    sealed class Result {
        data object Ignored : Result()
        data class Ticket(val ticket: String) : Result()
        data class Error(val code: String) : Result()
    }
}
