package uk.co.xeiverse.genesislists.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import okhttp3.CookieJar
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import uk.co.xeiverse.genesislists.data.api.GenesisApiClient
import uk.co.xeiverse.genesislists.data.api.RegisterBody
import uk.co.xeiverse.genesislists.data.api.UpdateItemBody

class GenesisApiClientJsonTest {

    private val json = GenesisApiClient.defaultJson

    @Test
    fun updateItemBody_tickOnlyOmitsUnsetFields() {
        assertEquals(
            """{"checked":true}""",
            json.encodeToString(UpdateItemBody(checked = true)),
        )
        assertEquals(
            """{"checked":false}""",
            json.encodeToString(UpdateItemBody(checked = false)),
        )
    }

    @Test
    fun updateItemBody_textOnlyOmitsUnsetFields() {
        assertEquals(
            """{"text":"Milk"}""",
            json.encodeToString(UpdateItemBody(text = "Milk")),
        )
    }

    @Test
    fun registerBody_omitsNullName() {
        assertEquals(
            """{"email":"a@example.com","password":"password1"}""",
            json.encodeToString(RegisterBody("a@example.com", "password1")),
        )
    }

    @Test
    fun updateItem_tickSendsCheckedOnly() = runTest {
        val server = MockWebServer()
        server.enqueue(
            MockResponse()
                .setBody(
                    """{"id":"i1","listId":"l1","text":"Milk","checked":true,"position":0,""" +
                        """"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}""",
                )
                .addHeader("Content-Type", "application/json"),
        )
        server.start()
        try {
            val client = GenesisApiClient(
                baseUrlProvider = { "http://127.0.0.1:${server.port}" },
                client = GenesisApiClient.buildOkHttp(CookieJar.NO_COOKIES),
            )
            client.updateItem("i1", UpdateItemBody(checked = true))
            val recorded = server.takeRequest()
            assertEquals("PATCH", recorded.method)
            assertEquals("/api/items/i1", recorded.path)
            assertEquals("""{"checked":true}""", recorded.body.readUtf8())
        } finally {
            server.shutdown()
        }
    }
}
