package uk.co.xeiverse.genesislists.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.data.ListsRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProxyHeadersScreen(
    repository: ListsRepository,
    onBack: () -> Unit,
) {
    val rows = remember {
        val existing = repository.getCustomProxyHeaders().entries.map { it.key to it.value }
        mutableStateListOf<Pair<String, String>>().also { list ->
            if (existing.isEmpty()) {
                list.add("" to "")
            } else {
                list.addAll(existing)
            }
        }
    }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    fun saveAndMaybeBack(pop: Boolean) {
        repository.setCustomProxyHeaderRows(rows.toList())
        scope.launch {
            snackbar.showSnackbar("Headers saved")
            if (pop) onBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Custom proxy headers") },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            repository.setCustomProxyHeaderRows(rows.toList())
                            onBack()
                        },
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { rows.add("" to "") }) {
                        Icon(Icons.Default.Add, contentDescription = "Add header")
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
                .padding(16.dp),
        ) {
            Text(
                "Headers are sent with every API request (for reverse-proxy auth). " +
                    "Empty names are discarded on save. Session cookies are unchanged.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                itemsIndexed(rows, key = { index, _ -> index }) { index, row ->
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            OutlinedTextField(
                                value = row.first,
                                onValueChange = { name ->
                                    rows[index] = name to rows[index].second
                                },
                                label = { Text("Header name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(8.dp))
                            OutlinedTextField(
                                value = row.second,
                                onValueChange = { value ->
                                    rows[index] = rows[index].first to value
                                },
                                label = { Text("Header value") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        IconButton(
                            onClick = {
                                rows.removeAt(index)
                                if (rows.isEmpty()) rows.add("" to "")
                            },
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Remove header")
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { saveAndMaybeBack(pop = true) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save")
            }
        }
    }
}
