package uk.co.xeiverse.genesislists.data

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import uk.co.xeiverse.genesislists.data.api.ProxyHeadersInterceptor
import uk.co.xeiverse.genesislists.data.prefs.ServerSettingsStore

class ProxyHeadersTest {

    @Test
    fun sanitizeHeaders_trimsAndDropsEmptyKeys() {
        val cleaned = ServerSettingsStore.sanitizeHeaders(
            mapOf(
                "  CF-Access-Client-Id  " to " id-value ",
                "" to "ignored",
                "   " to "also-ignored",
                "X-Api-Key" to "secret",
            ),
        )
        assertEquals("id-value", cleaned["CF-Access-Client-Id"])
        assertEquals("secret", cleaned["X-Api-Key"])
        assertEquals(2, cleaned.size)
    }

    @Test
    fun sanitizeHeaders_rejectsCrLfAndColonInName() {
        val cleaned = ServerSettingsStore.sanitizeHeaders(
            mapOf(
                "Bad\nName" to "x",
                "Also:Bad" to "y",
                "Good" to "ok",
                "BadValue" to "has\rbreak",
            ),
        )
        assertEquals(mapOf("Good" to "ok"), cleaned)
    }

    @Test
    fun sanitizeHeaderRows_discardsBlankNames() {
        val map = ServerSettingsStore.sanitizeHeaderRows(
            listOf(
                "" to "nope",
                " Authorization " to " Bearer token ",
                "X-Custom" to "1",
            ),
        )
        assertEquals("Bearer token", map["Authorization"])
        assertEquals("1", map["X-Custom"])
        assertEquals(2, map.size)
    }

    @Test
    fun store_roundTripsCustomProxyHeaders() {
        val prefs = InMemorySharedPreferences()
        val store = ServerSettingsStore(prefs)
        store.customProxyHeaders = mapOf(
            " CF-Access-Client-Id " to " abc ",
            "" to "drop-me",
        )
        assertEquals(mapOf("CF-Access-Client-Id" to "abc"), store.customProxyHeaders)

        store.customProxyHeaders = emptyMap()
        assertTrue(store.customProxyHeaders.isEmpty())
        assertFalse(prefs.contains("custom_proxy_headers"))
    }

    @Test
    fun store_baseUrlAndHeadersIndependent() {
        val store = ServerSettingsStore(InMemorySharedPreferences())
        store.baseUrl = "https://lists.example.com"
        store.customProxyHeaders = mapOf("X-Api-Key" to "k")
        assertEquals("https://lists.example.com", store.baseUrl)
        assertEquals(mapOf("X-Api-Key" to "k"), store.customProxyHeaders)
    }

    @Test
    fun encodeDecodeHeadersJson_roundTrip() {
        val original = mapOf("A" to "1", "B" to "2")
        val json = ServerSettingsStore.encodeHeadersJson(original)
        assertEquals(original, ServerSettingsStore.decodeHeadersJson(json))
    }

    @Test
    fun interceptor_addsLiveHeadersToEachRequest() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody("ok"))
        server.enqueue(MockResponse().setBody("ok"))
        server.start()
        try {
            val live = mutableMapOf("X-Proxy" to "v1")
            val client = OkHttpClient.Builder()
                .addInterceptor(ProxyHeadersInterceptor { live.toMap() })
                .build()

            client.newCall(Request.Builder().url(server.url("/a")).build()).execute().close()
            assertEquals("v1", server.takeRequest().getHeader("X-Proxy"))

            live["X-Proxy"] = "v2"
            live["Authorization"] = "Bearer t"
            client.newCall(Request.Builder().url(server.url("/b")).build()).execute().close()
            val second = server.takeRequest()
            assertEquals("v2", second.getHeader("X-Proxy"))
            assertEquals("Bearer t", second.getHeader("Authorization"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun interceptor_skipsWhenEmpty() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody("ok"))
        server.start()
        try {
            val client = OkHttpClient.Builder()
                .addInterceptor(ProxyHeadersInterceptor { emptyMap() })
                .build()
            client.newCall(Request.Builder().url(server.url("/")).build()).execute().close()
            val recorded = server.takeRequest()
            assertEquals(null, recorded.getHeader("X-Proxy"))
        } finally {
            server.shutdown()
        }
    }
}
