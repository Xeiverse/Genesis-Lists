package uk.co.xeiverse.genesislists.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import uk.co.xeiverse.genesislists.data.api.ApiException
import uk.co.xeiverse.genesislists.data.api.AuthConfigDto
import uk.co.xeiverse.genesislists.data.api.GenesisApiClient
import uk.co.xeiverse.genesislists.data.api.HealthDto
import uk.co.xeiverse.genesislists.data.api.ListDto
import uk.co.xeiverse.genesislists.data.api.ListItemDto
import uk.co.xeiverse.genesislists.data.api.ListItemPreviewDto
import uk.co.xeiverse.genesislists.data.api.UpdateItemBody
import uk.co.xeiverse.genesislists.data.api.UserDto
import uk.co.xeiverse.genesislists.data.db.CacheDao
import uk.co.xeiverse.genesislists.data.db.ItemEntity
import uk.co.xeiverse.genesislists.data.db.ListEntity
import uk.co.xeiverse.genesislists.data.prefs.PersistentCookieJar
import uk.co.xeiverse.genesislists.data.prefs.ServerSettingsStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class OfflineMutationException(
    message: String = "You are offline. Changes require a network connection.",
) : Exception(message)

/**
 * Repository: server is source of truth. Room is an offline READ cache only.
 * Mutations require network and then refresh the cache.
 */
class ListsRepository(
    private val api: GenesisApiClient,
    private val dao: CacheDao,
    private val settings: ServerSettingsStore,
    private val cookieJar: PersistentCookieJar,
    private val connectivity: ConnectivityMonitor,
    private val json: Json = GenesisApiClient.defaultJson,
) {
    fun observeLists(): Flow<List<ListDto>> =
        dao.observeLists().map { entities -> entities.map { it.toDto(json) } }

    fun observeItems(listId: String): Flow<List<ListItemDto>> =
        dao.observeItems(listId).map { rows -> rows.map { it.toDto() } }

    fun observeList(listId: String): Flow<ListDto?> =
        dao.observeList(listId).map { it?.toDto(json) }

    fun isOnline(): Boolean = connectivity.isOnline()

    fun getBaseUrl(): String? = settings.baseUrl

    fun setBaseUrl(url: String) {
        settings.baseUrl = normalizeBaseUrl(url)
    }

    suspend fun checkHealth(url: String? = null): HealthDto {
        val previous = settings.baseUrl
        if (url != null) settings.baseUrl = normalizeBaseUrl(url)
        return try {
            api.health().also {
                if (it.status != "ok") {
                    throw ApiException(503, "UNHEALTHY", "Server health status: ${it.status}")
                }
            }
        } catch (e: Exception) {
            if (url != null) settings.baseUrl = previous
            throw e
        }
    }

    suspend fun authConfig(): AuthConfigDto = api.authConfig()

    suspend fun me(): UserDto = api.me()

    suspend fun login(username: String, password: String): UserDto {
        requireOnline()
        val user = api.login(username, password)
        refreshLists()
        return user
    }

    suspend fun register(username: String, password: String): UserDto {
        requireOnline()
        val user = api.register(username, password)
        refreshLists()
        return user
    }

    suspend fun logout() {
        try {
            if (isOnline()) api.logout()
        } finally {
            cookieJar.clear()
            dao.clearAll()
        }
    }

    suspend fun changePassword(current: String, newPassword: String) {
        requireOnline()
        api.changePassword(current, newPassword)
    }

    /**
     * Pull sync: replace list index cache with server payload.
     * Returns cached lists when offline (no throw).
     */
    suspend fun refreshLists(): List<ListDto> {
        if (!isOnline()) {
            return dao.getLists().map { it.toDto(json) }
        }
        val lists = api.lists()
        mergeListsCache(lists)
        return lists
    }

    suspend fun refreshItems(listId: String): List<ListItemDto> {
        if (!isOnline()) {
            return dao.getItems(listId).map { it.toDto() }
        }
        val items = api.items(listId)
        mergeItemsCache(listId, items)
        return items
    }

    /** Testable merge: server lists replace local index; orphan lists removed. */
    suspend fun mergeListsCache(lists: List<ListDto>) {
        dao.replaceAllLists(lists.map { it.toEntity(json) })
    }

    /** Testable merge: server items replace that list's item rows. */
    suspend fun mergeItemsCache(listId: String, items: List<ListItemDto>) {
        dao.replaceItemsForList(listId, items.map { it.toEntity() })
    }

    suspend fun createList(name: String): ListDto {
        requireOnline()
        val created = api.createList(name)
        refreshLists()
        return created
    }

    suspend fun renameList(id: String, name: String): ListDto {
        requireOnline()
        val updated = api.renameList(id, name)
        refreshLists()
        return updated
    }

    suspend fun deleteList(id: String) {
        requireOnline()
        api.deleteList(id)
        dao.deleteListItems(id)
        dao.deleteList(id)
        refreshLists()
    }

    suspend fun createItem(listId: String, text: String): ListItemDto {
        requireOnline()
        val item = api.createItem(listId, text)
        refreshItems(listId)
        refreshLists()
        return item
    }

    suspend fun updateItem(id: String, listId: String, body: UpdateItemBody): ListItemDto {
        requireOnline()
        val item = api.updateItem(id, body)
        refreshItems(listId)
        refreshLists()
        return item
    }

    suspend fun deleteItem(id: String, listId: String) {
        requireOnline()
        api.deleteItem(id)
        refreshItems(listId)
        refreshLists()
    }

    suspend fun clearChecked(listId: String) {
        requireOnline()
        api.clearChecked(listId)
        refreshItems(listId)
        refreshLists()
    }

    fun requireOnline() {
        if (!isOnline()) throw OfflineMutationException()
    }

    fun hasSession(): Boolean = cookieJar.hasSessionCookie()

    companion object {
        fun normalizeBaseUrl(url: String): String {
            var u = url.trim().trimEnd('/')
            if (!u.startsWith("http://") && !u.startsWith("https://")) {
                u = "https://$u"
            }
            return u
        }
    }
}

fun interface ConnectivityMonitor {
    fun isOnline(): Boolean
}

class AndroidConnectivityMonitor(context: Context) : ConnectivityMonitor {
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    override fun isOnline(): Boolean {
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}

private fun ListDto.toEntity(json: Json) = ListEntity(
    id = id,
    name = name,
    createdAt = createdAt,
    updatedAt = updatedAt,
    itemCount = itemCount,
    isOwner = isOwner,
    ownerUsername = ownerUsername,
    previewJson = json.encodeToString(previewItems),
)

private fun ListEntity.toDto(json: Json) = ListDto(
    id = id,
    name = name,
    createdAt = createdAt,
    updatedAt = updatedAt,
    previewItems = runCatching {
        json.decodeFromString<List<ListItemPreviewDto>>(previewJson)
    }.getOrDefault(emptyList()),
    itemCount = itemCount,
    isOwner = isOwner,
    ownerUsername = ownerUsername,
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

private fun ItemEntity.toDto() = ListItemDto(
    id = id,
    listId = listId,
    text = text,
    checked = checked,
    position = position,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
