package uk.co.xeiverse.genesislists.ui.screens.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.api.UserDto
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    repository: ListsRepository,
    onBack: () -> Unit,
    onLoggedOut: () -> Unit,
    onServerChanged: () -> Unit,
) {
    var user by remember { mutableStateOf<UserDto?>(null) }
    var serverUrl by remember { mutableStateOf(repository.getBaseUrl().orEmpty()) }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        user = runCatching { repository.me() }.getOrNull()
    }

    val hasLocal = user?.authProviders?.contains("local") == true

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text("Account", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(user?.username ?: "—", style = MaterialTheme.typography.bodyLarge)
            user?.email?.takeIf { it.isNotBlank() }?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                "Providers: ${user?.authProviders?.joinToString().orEmpty().ifBlank { "—" }}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("Server", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Base URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    scope.launch {
                        try {
                            repository.checkHealth(serverUrl)
                            snackbar.showSnackbar("Server saved")
                            onServerChanged()
                        } catch (e: Exception) {
                            snackbar.showSnackbar(e.message ?: "Could not reach server")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Save & verify") }
            Spacer(Modifier.height(8.dp))
            Text(
                "HTTPS preferred. Cleartext HTTP is only for private LAN self-hosts.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("Change password", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            if (!hasLocal) {
                Text(
                    "Password change is unavailable for OIDC-only accounts.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it },
                    label = { Text("Current password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("New password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Confirm new password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        scope.launch {
                            if (newPassword != confirmPassword) {
                                snackbar.showSnackbar("New passwords do not match")
                                return@launch
                            }
                            try {
                                repository.changePassword(currentPassword, newPassword)
                                currentPassword = ""
                                newPassword = ""
                                confirmPassword = ""
                                snackbar.showSnackbar("Password updated")
                            } catch (e: Exception) {
                                snackbar.showSnackbar(e.message ?: "Failed")
                            }
                        }
                    },
                    enabled = currentPassword.isNotEmpty() && newPassword.length >= 8,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Update password") }
            }

            Spacer(Modifier.height(24.dp))
            OutlinedButton(
                onClick = {
                    scope.launch {
                        repository.logout()
                        onLoggedOut()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Log out") }
        }
    }
}
