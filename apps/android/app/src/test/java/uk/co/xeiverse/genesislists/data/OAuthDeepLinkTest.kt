package uk.co.xeiverse.genesislists.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import uk.co.xeiverse.genesislists.data.api.OAuthDeepLink

class OAuthDeepLinkTest {
    @Test
    fun parse_ticket() {
        val result = OAuthDeepLink.parse(
            "uk.co.xeiverse.genesislists://oauth-callback?ticket=abc-123",
        )
        assertTrue(result is OAuthDeepLink.Result.Ticket)
        assertEquals("abc-123", (result as OAuthDeepLink.Result.Ticket).ticket)
    }

    @Test
    fun parse_error() {
        val result = OAuthDeepLink.parse(
            "uk.co.xeiverse.genesislists://oauth-callback?error=oidc",
        )
        assertTrue(result is OAuthDeepLink.Result.Error)
        assertEquals("oidc", (result as OAuthDeepLink.Result.Error).code)
    }

    @Test
    fun parse_ignored_for_other_schemes() {
        assertEquals(
            OAuthDeepLink.Result.Ignored,
            OAuthDeepLink.parse("https://example.com/oauth-callback?ticket=x"),
        )
    }

    @Test
    fun oidcStartUrl_appendsClientAndroid() {
        assertEquals(
            "https://lists.example.com/api/auth/oidc/start?client=android",
            OAuthDeepLink.oidcStartUrl("https://lists.example.com/"),
        )
    }
}
