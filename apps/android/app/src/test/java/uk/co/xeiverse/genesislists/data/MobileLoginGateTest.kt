package uk.co.xeiverse.genesislists.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import uk.co.xeiverse.genesislists.data.api.OidcPublicConfigDto

class MobileLoginGateTest {
    @Test
    fun mobileLogin_true_allowsOidcButton() {
        val oidc = OidcPublicConfigDto(enabled = true, mobileLogin = true)
        assertTrue(oidc.enabled && oidc.mobileLogin == true)
    }

    @Test
    fun mobileLogin_missing_blocksOidcButton() {
        val oidc = OidcPublicConfigDto(enabled = true, mobileLogin = null)
        assertFalse(oidc.mobileLogin == true)
        assertTrue(oidc.enabled && oidc.mobileLogin != true)
    }

    @Test
    fun mobileLogin_false_blocksOidcButton() {
        val oidc = OidcPublicConfigDto(enabled = true, mobileLogin = false)
        assertFalse(oidc.mobileLogin == true)
    }

    @Test
    fun defaultButtonText_isLoginWithOAuth() {
        assertTrue(OidcPublicConfigDto().buttonText == "Login with OAuth")
    }
}
