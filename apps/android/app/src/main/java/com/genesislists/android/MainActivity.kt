package com.genesislists.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.genesislists.android.data.ListsRepository
import com.genesislists.android.ui.navigation.Routes
import com.genesislists.android.ui.screens.auth.AuthScreen
import com.genesislists.android.ui.screens.detail.ListDetailScreen
import com.genesislists.android.ui.screens.lists.ListsHomeScreen
import com.genesislists.android.ui.screens.server.ServerSetupScreen
import com.genesislists.android.ui.screens.settings.SettingsScreen
import com.genesislists.android.ui.theme.GenesisListsTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repo = (application as GenesisListsApp).container.repository
        setContent {
            GenesisListsTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    GenesisApp(repository = repo)
                }
            }
        }
    }
}

@Composable
fun GenesisApp(repository: ListsRepository) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val start = when {
        repository.getBaseUrl().isNullOrBlank() -> Routes.ServerSetup.route
        else -> Routes.Auth.route
    }

    // Pull sync on resume when online
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME &&
                repository.isOnline() &&
                repository.hasSession() &&
                !repository.getBaseUrl().isNullOrBlank()
            ) {
                scope.launch {
                    runCatching { repository.refreshLists() }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    NavHost(navController = navController, startDestination = start) {
        composable(Routes.ServerSetup.route) {
            ServerSetupScreen(
                repository = repository,
                onConnected = {
                    navController.navigate(Routes.Auth.route) {
                        popUpTo(Routes.ServerSetup.route) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.Auth.route) {
            AuthScreen(
                repository = repository,
                onAuthenticated = {
                    navController.navigate(Routes.Lists.route) {
                        popUpTo(Routes.Auth.route) { inclusive = true }
                    }
                },
                onChangeServer = {
                    navController.navigate(Routes.ServerSetup.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.Lists.route) {
            ListsHomeScreen(
                repository = repository,
                onOpenList = { id -> navController.navigate(Routes.ListDetail.create(id)) },
                onSettings = { navController.navigate(Routes.Settings.route) },
                onLoggedOut = {
                    navController.navigate(Routes.Auth.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(
            route = Routes.ListDetail.route,
            arguments = listOf(navArgument("listId") { type = NavType.StringType }),
        ) { entry ->
            val listId = entry.arguments?.getString("listId").orEmpty()
            ListDetailScreen(
                listId = listId,
                repository = repository,
                onBack = { navController.popBackStack() },
                onDeleted = {
                    navController.popBackStack()
                },
            )
        }
        composable(Routes.Settings.route) {
            SettingsScreen(
                repository = repository,
                onBack = { navController.popBackStack() },
                onLoggedOut = {
                    navController.navigate(Routes.Auth.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onServerChanged = {
                    // stay on settings; session cookies may no longer match new host
                },
            )
        }
    }
}
