package uk.co.xeiverse.genesislists.data

import android.content.SharedPreferences
import uk.co.xeiverse.genesislists.data.api.GenesisApiClient
import uk.co.xeiverse.genesislists.data.api.ListDto
import uk.co.xeiverse.genesislists.data.api.ListItemDto
import uk.co.xeiverse.genesislists.data.api.ListItemPreviewDto
import uk.co.xeiverse.genesislists.data.db.CacheDao
import uk.co.xeiverse.genesislists.data.db.ItemEntity
import uk.co.xeiverse.genesislists.data.db.ListEntity
import uk.co.xeiverse.genesislists.data.prefs.PersistentCookieJar
import uk.co.xeiverse.genesislists.data.prefs.ServerSettingsStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ListsRepositoryTest {

    private val json = GenesisApiClient.defaultJson

    private fun sampleList(
        id: String,
        name: String,
        updatedAt: String = "2026-01-01T00:00:00.000Z",
    ) = ListDto(
        id = id,
        name = name,
        createdAt = updatedAt,
        updatedAt = updatedAt,
        previewItems = listOf(
            ListItemPreviewDto(id = "$id-p1", text = "milk", checked = false),
        ),
        itemCount = 1,
        isOwner = true,
        ownerName = "alice",
    )

    private fun sampleItem(id: String, listId: String, text: String) =
        ListItemDto(
            id = id,
            listId = listId,
            text = text,
            checked = false,
            position = 0,
            createdAt = "2026-01-01T00:00:00.000Z",
            updatedAt = "2026-01-01T00:00:00.000Z",
        )

    private fun ListDto.toEntity() = ListEntity(
        id = id,
        name = name,
        createdAt = createdAt,
        updatedAt = updatedAt,
        itemCount = itemCount,
        isOwner = isOwner,
        ownerName = ownerName,
        previewJson = json.encodeToString(previewItems),
    )

    private fun ListItemDto.toEntity() = ItemEntity(
        id = id,
        listId = listId,
        text = text,
        checked = checked,
        position = position,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    @Test
    fun mergeListsCache_replacesIndexAndDropsOrphans() = runTest {
        val dao = InMemoryCacheDao()
        val repo = repository(dao, online = true)

        dao.replaceAllLists(
            listOf(
                sampleList("a", "Keep").toEntity(),
                sampleList("orphan", "Gone").toEntity(),
            ),
        )
        dao.replaceItemsForList(
            "orphan",
            listOf(sampleItem("orphan-item", "orphan", "stale text").toEntity()),
        )
        dao.replaceItemsForList(
            "a",
            listOf(sampleItem("a-item", "a", "keep me").toEntity()),
        )

        repo.mergeListsCache(
            listOf(
                sampleList("a", "Keep renamed"),
                sampleList("b", "New"),
            ),
        )

        val ids = dao.getLists().map { it.id }.toSet()
        assertEquals(setOf("a", "b"), ids)
        assertEquals("Keep renamed", dao.getList("a")?.name)
        assertFalse(ids.contains("orphan"))
        assertEquals(emptyList<ItemEntity>(), dao.getItems("orphan"))
        assertEquals(setOf("a-item"), dao.getItems("a").map { it.id }.toSet())
    }

    @Test
    fun mergeItemsCache_replacesOnlyThatList() = runTest {
        val dao = InMemoryCacheDao()
        val repo = repository(dao, online = true)

        dao.replaceItemsForList(
            "list-1",
            listOf(
                sampleItem("i1", "list-1", "old").toEntity(),
                sampleItem("gone", "list-1", "remove me").toEntity(),
            ),
        )
        dao.replaceItemsForList(
            "list-2",
            listOf(sampleItem("other", "list-2", "stay").toEntity()),
        )

        repo.mergeItemsCache(
            "list-1",
            listOf(
                sampleItem("i1", "list-1", "updated"),
                sampleItem("i2", "list-1", "new"),
            ),
        )

        assertEquals(setOf("i1", "i2"), dao.getItems("list-1").map { it.id }.toSet())
        assertEquals(setOf("other"), dao.getItems("list-2").map { it.id }.toSet())
        assertEquals("updated", dao.getItems("list-1").first { it.id == "i1" }.text)
    }

    @Test
    fun offline_blocksMutations() = runTest {
        val repo = repository(InMemoryCacheDao(), online = false)
        try {
            repo.requireOnline()
            fail("expected OfflineMutationException")
        } catch (_: OfflineMutationException) {
        }
        try {
            repo.createList("Nope")
            fail("expected OfflineMutationException")
        } catch (_: OfflineMutationException) {
        }
    }

    @Test
    fun offline_refreshLists_returnsCacheWithoutThrowing() = runTest {
        val dao = InMemoryCacheDao()
        dao.replaceAllLists(listOf(sampleList("cached", "From cache").toEntity()))
        val repo = repository(dao, online = false)

        val result = repo.refreshLists()
        assertEquals(1, result.size)
        assertEquals("cached", result.first().id)
        assertEquals("From cache", result.first().name)
    }

    @Test
    fun normalizeBaseUrl_addsHttpsAndTrimsSlash() {
        assertEquals(
            "https://lists.example.com",
            ListsRepository.normalizeBaseUrl("lists.example.com/"),
        )
        assertEquals(
            "http://192.168.1.10:3000",
            ListsRepository.normalizeBaseUrl("http://192.168.1.10:3000/"),
        )
    }

    @Test
    fun changeServerUrl_clearsSessionAndCacheWhenHostChanges() = runTest {
        val dao = InMemoryCacheDao()
        val cookiePrefs = InMemorySharedPreferences()
        val cookieJar = PersistentCookieJar(cookiePrefs)
        val settings = ServerSettingsStore(InMemorySharedPreferences())
        settings.baseUrl = "https://old.example.com"
        settings.customProxyHeaders = mapOf("X-Proxy" to "keep")

        dao.replaceAllLists(listOf(sampleList("cached", "Old host").toEntity()))
        val url = "https://old.example.com/".toHttpUrl()
        cookieJar.saveFromResponse(
            url,
            listOf(
                Cookie.Builder()
                    .name(PersistentCookieJar.SESSION_COOKIE)
                    .value("session-old")
                    .domain("old.example.com")
                    .path("/")
                    .expiresAt(System.currentTimeMillis() + 86_400_000)
                    .build(),
            ),
        )
        assertTrue(cookieJar.hasSessionCookie())

        val server = okhttp3.mockwebserver.MockWebServer()
        server.enqueue(
            okhttp3.mockwebserver.MockResponse()
                .setBody("""{"status":"ok","version":"test"}""")
                .addHeader("Content-Type", "application/json"),
        )
        server.start()
        try {
            val base = "http://127.0.0.1:${server.port}"
            val client = GenesisApiClient(
                baseUrlProvider = { settings.baseUrl },
                client = GenesisApiClient.buildOkHttp(cookieJar),
            )
            val repo = ListsRepository(
                api = client,
                dao = dao,
                settings = settings,
                cookieJar = cookieJar,
                connectivity = ConnectivityMonitor { true },
            )

            val result = repo.changeServerUrl(base)
            assertTrue(result.sessionInvalidated)
            assertEquals("ok", result.health.status)
            assertFalse(cookieJar.hasSessionCookie())
            assertTrue(dao.getLists().isEmpty())
            assertEquals(mapOf("X-Proxy" to "keep"), settings.customProxyHeaders)
            assertEquals(base, settings.baseUrl)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun changeServerUrl_sameHostKeepsSessionAndCache() = runTest {
        val dao = InMemoryCacheDao()
        val cookieJar = PersistentCookieJar(InMemorySharedPreferences())
        val settings = ServerSettingsStore(InMemorySharedPreferences())
        val server = okhttp3.mockwebserver.MockWebServer()
        server.enqueue(
            okhttp3.mockwebserver.MockResponse()
                .setBody("""{"status":"ok","version":"test"}""")
                .addHeader("Content-Type", "application/json"),
        )
        server.start()
        try {
            val base = "http://127.0.0.1:${server.port}"
            settings.baseUrl = base
            dao.replaceAllLists(listOf(sampleList("cached", "Keep").toEntity()))
            cookieJar.saveFromResponse(
                "$base/".toHttpUrl(),
                listOf(
                    Cookie.Builder()
                        .name(PersistentCookieJar.SESSION_COOKIE)
                        .value("session-keep")
                        .hostOnlyDomain("127.0.0.1")
                        .path("/")
                        .expiresAt(System.currentTimeMillis() + 86_400_000)
                        .build(),
                ),
            )

            val client = GenesisApiClient(
                baseUrlProvider = { settings.baseUrl },
                client = GenesisApiClient.buildOkHttp(cookieJar),
            )
            val repo = ListsRepository(
                api = client,
                dao = dao,
                settings = settings,
                cookieJar = cookieJar,
                connectivity = ConnectivityMonitor { true },
            )

            val result = repo.changeServerUrl("$base/")
            assertFalse(result.sessionInvalidated)
            assertTrue(cookieJar.hasSessionCookie())
            assertEquals(1, dao.getLists().size)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun cookieSerialization_roundTrip() {
        val url = "https://lists.example.com/api/auth/login".toHttpUrl()
        val cookie = Cookie.Builder()
            .name(PersistentCookieJar.SESSION_COOKIE)
            .value("abc123")
            .domain("lists.example.com")
            .path("/")
            .expiresAt(System.currentTimeMillis() + 86_400_000)
            .httpOnly()
            .secure()
            .build()
        val restored = PersistentCookieJar.deserialize(PersistentCookieJar.serialize(cookie))!!
        assertEquals(cookie.name, restored.name)
        assertEquals(cookie.value, restored.value)
        assertEquals(cookie.domain, restored.domain)
        assertTrue(restored.matches(url))
    }

    private fun repository(dao: CacheDao, online: Boolean): ListsRepository {
        val client = GenesisApiClient(
            baseUrlProvider = { "https://example.test" },
            client = GenesisApiClient.buildOkHttp(CookieJar.NO_COOKIES),
        )
        return ListsRepository(
            api = client,
            dao = dao,
            settings = ServerSettingsStore(InMemorySharedPreferences()),
            cookieJar = PersistentCookieJar(InMemorySharedPreferences()),
            connectivity = ConnectivityMonitor { online },
        )
    }
}

class InMemoryCacheDao : CacheDao {
    private val lists = MutableStateFlow<List<ListEntity>>(emptyList())
    private val items = MutableStateFlow<List<ItemEntity>>(emptyList())

    override fun observeLists(): Flow<List<ListEntity>> = lists
    override suspend fun getLists(): List<ListEntity> = lists.value
    override fun observeList(id: String): Flow<ListEntity?> =
        lists.map { rows -> rows.find { it.id == id } }

    override suspend fun getList(id: String): ListEntity? = lists.value.find { it.id == id }
    override fun observeItems(listId: String): Flow<List<ItemEntity>> =
        items.map { rows -> rows.filter { it.listId == listId }.sortedBy { it.position } }

    override suspend fun getItems(listId: String): List<ItemEntity> =
        items.value.filter { it.listId == listId }.sortedBy { it.position }

    override suspend fun upsertLists(lists: List<ListEntity>) {
        val map = this.lists.value.associateBy { it.id }.toMutableMap()
        lists.forEach { map[it.id] = it }
        this.lists.value = map.values.toList()
    }

    override suspend fun upsertItems(items: List<ItemEntity>) {
        val map = this.items.value.associateBy { it.id }.toMutableMap()
        items.forEach { map[it.id] = it }
        this.items.value = map.values.toList()
    }

    override suspend fun deleteListsNotIn(ids: List<String>) {
        lists.value = lists.value.filter { it.id in ids }
    }

    override suspend fun deleteItemsNotInLists(listIds: List<String>) {
        items.value = items.value.filter { it.listId in listIds }
    }

    override suspend fun clearLists() {
        lists.value = emptyList()
    }

    override suspend fun deleteItemsForList(listId: String) {
        items.value = items.value.filterNot { it.listId == listId }
    }

    override suspend fun deleteItemsNotIn(listId: String, ids: List<String>) {
        items.value = items.value.filterNot { it.listId == listId && it.id !in ids }
    }

    override suspend fun deleteList(id: String) {
        lists.value = lists.value.filterNot { it.id == id }
    }

    override suspend fun deleteListItems(listId: String) = deleteItemsForList(listId)

    override suspend fun clearItems() {
        items.value = emptyList()
    }

    override suspend fun replaceAllLists(lists: List<ListEntity>) {
        if (lists.isEmpty()) {
            clearLists()
            clearItems()
        } else {
            val ids = lists.map { it.id }
            upsertLists(lists)
            deleteListsNotIn(ids)
            deleteItemsNotInLists(ids)
        }
    }

    override suspend fun replaceItemsForList(listId: String, items: List<ItemEntity>) {
        if (items.isEmpty()) {
            deleteItemsForList(listId)
        } else {
            upsertItems(items)
            deleteItemsNotIn(listId, items.map { it.id })
        }
    }

    override suspend fun clearAll() {
        clearItems()
        clearLists()
    }
}

class InMemorySharedPreferences : SharedPreferences {
    private val data = mutableMapOf<String, Any?>()

    override fun getAll(): MutableMap<String, *> = data
    override fun getString(key: String?, defValue: String?): String? =
        data[key] as String? ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
        (data[key] as Set<String>?)?.toMutableSet() ?: defValues

    override fun getInt(key: String?, defValue: Int) = data[key] as Int? ?: defValue
    override fun getLong(key: String?, defValue: Long) = data[key] as Long? ?: defValue
    override fun getFloat(key: String?, defValue: Float) = data[key] as Float? ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean) = data[key] as Boolean? ?: defValue
    override fun contains(key: String?) = data.containsKey(key)
    override fun edit(): SharedPreferences.Editor = Editor()
    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    private inner class Editor : SharedPreferences.Editor {
        private val pending = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clearAll = false

        override fun putString(key: String?, value: String?) = apply { pending[key!!] = value }
        override fun putStringSet(key: String?, values: MutableSet<String>?) =
            apply { pending[key!!] = values?.toSet() }

        override fun putInt(key: String?, value: Int) = apply { pending[key!!] = value }
        override fun putLong(key: String?, value: Long) = apply { pending[key!!] = value }
        override fun putFloat(key: String?, value: Float) = apply { pending[key!!] = value }
        override fun putBoolean(key: String?, value: Boolean) = apply { pending[key!!] = value }
        override fun remove(key: String?) = apply { removals.add(key!!) }
        override fun clear() = apply { clearAll = true }
        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearAll) data.clear()
            removals.forEach { data.remove(it) }
            data.putAll(pending)
        }
    }
}
