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
    val buttonText: String = "Sign in with SSO",
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
    val username: String,
    val email: String? = null,
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
    val ownerUsername: String = "",
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
    val username: String,
    val password: String,
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

class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
) : Exception(message)
