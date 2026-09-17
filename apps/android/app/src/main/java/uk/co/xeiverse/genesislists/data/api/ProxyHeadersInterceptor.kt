package uk.co.xeiverse.genesislists.data.api

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Applies custom proxy headers from a live provider on every request.
 * Additive to cookie-session auth; values are never logged.
 */
class ProxyHeadersInterceptor(
    private val headersProvider: () -> Map<String, String>,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val headers = headersProvider()
        if (headers.isEmpty()) {
            return chain.proceed(chain.request())
        }
        val builder = chain.request().newBuilder()
        for ((name, value) in headers) {
            builder.header(name, value)
        }
        return chain.proceed(builder.build())
    }
}
