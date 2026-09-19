package uk.co.xeiverse.genesislists.data

import java.net.URI

/**
 * App-layer cleartext policy. Network Security Config must permit cleartext globally
 * because Android XML cannot express RFC1918 CIDRs; this gate rejects public HTTP hosts.
 */
object ServerUrlPolicy {
    const val CLEARTEXT_REJECTED =
        "HTTP is only allowed for private LAN hosts (e.g. 192.168.x.x, 10.x.x.x), " +
            "localhost, the Android emulator (10.0.2.2), or .local names. Use HTTPS otherwise."

    fun normalizeAndValidate(url: String): String {
        val normalized = ListsRepository.normalizeBaseUrl(url)
        requireCleartextAllowed(normalized)
        return normalized
    }

    fun requireCleartextAllowed(url: String) {
        val uri = try {
            URI(url)
        } catch (_: Exception) {
            throw IllegalArgumentException("Invalid server URL")
        }
        val scheme = uri.scheme?.lowercase()
        if (scheme == "https") return
        if (scheme != "http") {
            throw IllegalArgumentException("Server URL must start with http:// or https://")
        }
        val host = uri.host?.lowercase()?.trim()
            ?: throw IllegalArgumentException("Invalid server URL")
        if (!allowsCleartextHost(host)) {
            throw IllegalArgumentException(CLEARTEXT_REJECTED)
        }
    }

    fun allowsCleartextHost(host: String): Boolean {
        val h = host.lowercase().trim()
        if (h == "localhost" || h == "127.0.0.1" || h == "::1" || h == "10.0.2.2") {
            return true
        }
        if (h.endsWith(".local")) return true
        return isPrivateOrLinkLocalIpv4(h)
    }

    private fun isPrivateOrLinkLocalIpv4(host: String): Boolean {
        val parts = host.split('.')
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 }) return false
        val a = octets[0]
        val b = octets[1]
        return when {
            a == 10 -> true
            a == 172 && b in 16..31 -> true
            a == 192 && b == 168 -> true
            a == 169 && b == 254 -> true
            else -> false
        }
    }
}
