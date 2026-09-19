package uk.co.xeiverse.genesislists.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ServerUrlPolicyTest {

    @Test
    fun https_alwaysAllowed() {
        ServerUrlPolicy.requireCleartextAllowed("https://lists.example.com")
        ServerUrlPolicy.requireCleartextAllowed("https://192.168.1.1")
    }

    @Test
    fun http_allowsPrivateLanAndLocal() {
        listOf(
            "http://192.168.1.10:3000",
            "http://10.0.0.5",
            "http://172.16.0.1",
            "http://172.31.255.255",
            "http://169.254.1.1",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://10.0.2.2:3000",
            "http://nas.local",
        ).forEach { ServerUrlPolicy.requireCleartextAllowed(it) }
    }

    @Test
    fun http_rejectsPublicHosts() {
        listOf(
            "http://lists.example.com",
            "http://8.8.8.8",
            "http://172.32.0.1",
            "http://11.0.0.1",
        ).forEach { url ->
            try {
                ServerUrlPolicy.requireCleartextAllowed(url)
                fail("expected rejection for $url")
            } catch (e: IllegalArgumentException) {
                assertTrue(e.message!!.contains("HTTP is only allowed"))
            }
        }
    }

    @Test
    fun allowsCleartextHost_helpers() {
        assertTrue(ServerUrlPolicy.allowsCleartextHost("192.168.0.1"))
        assertTrue(ServerUrlPolicy.allowsCleartextHost("printer.local"))
        assertFalse(ServerUrlPolicy.allowsCleartextHost("example.com"))
    }

    @Test
    fun normalizeAndValidate_addsHttps() {
        assertEquals(
            "https://lists.example.com",
            ServerUrlPolicy.normalizeAndValidate("lists.example.com/"),
        )
    }
}
