package uk.co.xeiverse.genesislists.ui.navigation

sealed class Routes(val route: String) {
    data object ServerSetup : Routes("server_setup")
    data object Auth : Routes("auth")
    data object Lists : Routes("lists")
    data object ListDetail : Routes("list/{listId}") {
        fun create(listId: String) = "list/$listId"
    }
    data object Settings : Routes("settings")
    data object ProxyHeaders : Routes("proxy_headers")
}
