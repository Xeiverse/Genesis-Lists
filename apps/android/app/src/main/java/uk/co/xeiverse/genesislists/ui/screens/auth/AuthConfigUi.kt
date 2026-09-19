package uk.co.xeiverse.genesislists.ui.screens.auth

import uk.co.xeiverse.genesislists.data.api.AuthConfigDto
import uk.co.xeiverse.genesislists.data.api.OidcPublicConfigDto

/** Pure helpers for AuthScreen OIDC / password visibility. */
object AuthConfigUi {
    enum class OidcPresentation {
        Hidden,
        Button,
        UpgradeMessage,
    }

    fun oidcPresentation(config: AuthConfigDto?): OidcPresentation {
        if (config == null) return OidcPresentation.Hidden
        val oidc = config.oidc
        if (!oidc.enabled) return OidcPresentation.Hidden
        return if (oidc.mobileLogin == true) {
            OidcPresentation.Button
        } else {
            OidcPresentation.UpgradeMessage
        }
    }

    fun showPasswordForm(config: AuthConfigDto?): Boolean =
        config != null && config.passwordLoginEnabled

    fun oidcButtonText(oidc: OidcPublicConfigDto?): String =
        oidc?.buttonText?.takeIf { it.isNotBlank() } ?: "Login with OAuth"

    fun registrationOpen(config: AuthConfigDto?): Boolean =
        config?.registrationOpen == true
}
