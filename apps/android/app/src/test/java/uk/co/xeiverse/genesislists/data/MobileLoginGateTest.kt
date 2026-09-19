package uk.co.xeiverse.genesislists.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import uk.co.xeiverse.genesislists.data.api.AuthConfigDto
import uk.co.xeiverse.genesislists.data.api.OidcPublicConfigDto
import uk.co.xeiverse.genesislists.ui.screens.auth.AuthConfigUi

class MobileLoginGateTest {
    @Test
    fun mobileLogin_true_showsOidcButton() {
        val config = AuthConfigDto(
            oidc = OidcPublicConfigDto(enabled = true, mobileLogin = true),
        )
        assertEquals(AuthConfigUi.OidcPresentation.Button, AuthConfigUi.oidcPresentation(config))
    }

    @Test
    fun mobileLogin_missing_showsUpgrade() {
        val config = AuthConfigDto(
            oidc = OidcPublicConfigDto(enabled = true, mobileLogin = null),
        )
        assertEquals(
            AuthConfigUi.OidcPresentation.UpgradeMessage,
            AuthConfigUi.oidcPresentation(config),
        )
    }

    @Test
    fun mobileLogin_false_showsUpgrade() {
        val config = AuthConfigDto(
            oidc = OidcPublicConfigDto(enabled = true, mobileLogin = false),
        )
        assertEquals(
            AuthConfigUi.OidcPresentation.UpgradeMessage,
            AuthConfigUi.oidcPresentation(config),
        )
    }

    @Test
    fun configNull_hidesOidc() {
        assertEquals(AuthConfigUi.OidcPresentation.Hidden, AuthConfigUi.oidcPresentation(null))
        assertFalse(AuthConfigUi.showPasswordForm(null))
    }

    @Test
    fun oidcDisabled_hidesOidc() {
        val config = AuthConfigDto(
            oidc = OidcPublicConfigDto(enabled = false, mobileLogin = true),
        )
        assertEquals(AuthConfigUi.OidcPresentation.Hidden, AuthConfigUi.oidcPresentation(config))
    }

    @Test
    fun showPasswordForm_respectsFlag() {
        assertTrue(
            AuthConfigUi.showPasswordForm(
                AuthConfigDto(passwordLoginEnabled = true),
            ),
        )
        assertFalse(
            AuthConfigUi.showPasswordForm(
                AuthConfigDto(passwordLoginEnabled = false),
            ),
        )
    }
}
