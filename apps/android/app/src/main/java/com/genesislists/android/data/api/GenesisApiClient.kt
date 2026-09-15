package com.genesislists.android.data.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.CookieJar
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class GenesisApiClient(
    private val baseUrlProvider: () -> String?,
    private val client: OkHttpClient,
    private val json: Json = defaultJson,
) {
    suspend fun health(): HealthDto = get("/api/health")

    suspend fun authConfig(): AuthConfigDto = get("/api/auth/config")

    suspend fun registration(): RegistrationStatusDto = get("/api/auth/registration")

    suspend fun me(): UserDto = get("/api/auth/me")

    suspend fun login(username: String, password: String): UserDto =
        post("/api/auth/login", encode(CredentialsBody(username, password)))

    suspend fun register(username: String, password: String): UserDto =
        post("/api/auth/register", encode(CredentialsBody(username, password)))

    suspend fun logout() {
        postEmpty("/api/auth/logout")
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        postEmpty(
            "/api/auth/change-password",
            encode(ChangePasswordBody(currentPassword, newPassword)),
        )
    }

    suspend fun lists(): List<ListDto> = get<ListsResponse>("/api/lists").lists

    suspend fun createList(name: String): ListDto = post("/api/lists", encode(NameBody(name)))

    suspend fun renameList(id: String, name: String): ListDto =
        patch("/api/lists/$id", encode(NameBody(name)))

    suspend fun deleteList(id: String) {
        delete("/api/lists/$id")
    }

    suspend fun items(listId: String): List<ListItemDto> =
        get<ItemsResponse>("/api/lists/$listId/items").items

    suspend fun createItem(listId: String, text: String): ListItemDto =
        post("/api/lists/$listId/items", encode(TextBody(text)))

    suspend fun updateItem(id: String, body: UpdateItemBody): ListItemDto =
        patch("/api/items/$id", encode(body))

    suspend fun deleteItem(id: String) {
        delete("/api/items/$id")
    }

    suspend fun clearChecked(listId: String) {
        delete("/api/lists/$listId/items/checked")
    }

    private inline fun <reified T> encode(value: T): RequestBody =
        json.encodeToString(value).toRequestBody(JSON_MEDIA)

    private suspend inline fun <reified T> get(path: String): T =
        execute(path, "GET")

    private suspend inline fun <reified T> post(path: String, body: RequestBody): T =
        execute(path, "POST", body)

    private suspend inline fun <reified T> patch(path: String, body: RequestBody): T =
        execute(path, "PATCH", body)

    private suspend fun postEmpty(path: String, body: RequestBody? = null) {
        execute<Unit>(path, "POST", body, allowEmpty = true)
    }

    private suspend fun delete(path: String) {
        execute<Unit>(path, "DELETE", allowEmpty = true)
    }

    private suspend inline fun <reified T> execute(
        path: String,
        method: String,
        body: RequestBody? = null,
        allowEmpty: Boolean = false,
    ): T = withContext(Dispatchers.IO) {
        val base = baseUrlProvider()?.trimEnd('/')
            ?: throw ApiException(0, "NO_SERVER", "Server URL is not configured")
        val reqBuilder = Request.Builder().url("$base$path")
        when (method) {
            "GET" -> reqBuilder.get()
            "DELETE" -> reqBuilder.delete()
            "POST" -> reqBuilder.post(body ?: ByteArray(0).toRequestBody(null))
            "PATCH" -> reqBuilder.patch(body ?: ByteArray(0).toRequestBody(null))
            else -> reqBuilder.method(method, body)
        }
        client.newCall(reqBuilder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val err = runCatching { json.decodeFromString<ApiErrorBody>(raw) }.getOrNull()
                throw ApiException(
                    response.code,
                    err?.error?.code ?: "INTERNAL_ERROR",
                    err?.error?.message ?: (response.message.ifBlank { "HTTP ${response.code}" }),
                )
            }
            if (response.code == 204 || (allowEmpty && raw.isBlank())) {
                @Suppress("UNCHECKED_CAST")
                return@use Unit as T
            }
            if (T::class == Unit::class) {
                @Suppress("UNCHECKED_CAST")
                return@use Unit as T
            }
            json.decodeFromString<T>(raw)
        }
    }

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

        val defaultJson = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
            isLenient = true
        }

        fun buildOkHttp(cookieJar: CookieJar): OkHttpClient =
            OkHttpClient.Builder()
                .cookieJar(cookieJar)
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
    }
}
