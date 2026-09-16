package uk.co.xeiverse.genesislists.ui.screens.server

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.api.ApiException
import uk.co.xeiverse.genesislists.ui.components.BrandMark
import kotlinx.coroutines.launch

@Composable
fun ServerSetupScreen(
    repository: ListsRepository,
    onConnected: () -> Unit,
) {
    var url by remember { mutableStateOf(repository.getBaseUrl().orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BrandMark(size = 64.dp)
        Spacer(Modifier.height(16.dp))
        Text("Genesis Lists", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            "Enter your self-hosted server URL",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = url,
            onValueChange = {
                url = it
                error = null
                success = null
            },
            label = { Text("Server base URL") },
            placeholder = { Text("https://lists.example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Prefer HTTPS. HTTP is allowed for private LAN hosts only.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                scope.launch {
                    busy = true
                    error = null
                    success = null
                    try {
                        val health = repository.checkHealth(url)
                        success = "Connected · ${health.version ?: "ok"}"
                        onConnected()
                    } catch (e: ApiException) {
                        error = e.message
                    } catch (e: Exception) {
                        error = e.message ?: "Could not reach server"
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = !busy && url.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (busy) CircularProgressIndicator(
                modifier = Modifier.height(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            ) else Text("Connect")
        }
        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
        success?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.primary)
        }
    }
}
