package uk.co.xeiverse.genesislists.ui.screens.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.OfflineMutationException
import uk.co.xeiverse.genesislists.data.api.ListItemDto
import uk.co.xeiverse.genesislists.data.api.UpdateItemBody
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListDetailScreen(
    listId: String,
    repository: ListsRepository,
    onBack: () -> Unit,
    onDeleted: () -> Unit,
) {
    val list by repository.observeList(listId).collectAsState(initial = null)
    val items by repository.observeItems(listId).collectAsState(initial = emptyList())
    var refreshing by remember { mutableStateOf(false) }
    var online by remember { mutableStateOf(repository.isOnline()) }
    var newText by remember { mutableStateOf("") }
    var tickedExpanded by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var deleteListOpen by remember { mutableStateOf(false) }
    var clearCheckedOpen by remember { mutableStateOf(false) }
    var draftName by remember { mutableStateOf("") }
    var editingItem by remember { mutableStateOf<ListItemDto?>(null) }
    var editText by remember { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    fun refresh() {
        scope.launch {
            refreshing = true
            online = repository.isOnline()
            try {
                repository.refreshItems(listId)
                repository.refreshLists()
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: "Refresh failed")
            } finally {
                refreshing = false
            }
        }
    }

    LaunchedEffect(listId) { refresh() }

    val openItems = remember(items) { items.filter { !it.checked }.sortedBy { it.position } }
    val tickedItems = remember(items) { items.filter { it.checked }.sortedBy { it.position } }

    fun gateOnline(action: suspend () -> Unit) {
        scope.launch {
            try {
                action()
            } catch (e: OfflineMutationException) {
                snackbar.showSnackbar(e.message ?: "Offline")
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: "Failed")
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(list?.name ?: "List")
                        if (!online) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CloudOff, null, modifier = Modifier.height(14.dp))
                                Text(" Offline · cached", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Rename") },
                            onClick = {
                                menuOpen = false
                                draftName = list?.name.orEmpty()
                                renameOpen = true
                            },
                        )
                        if (list?.isOwner != false) {
                            DropdownMenuItem(
                                text = { Text("Delete list") },
                                onClick = {
                                    menuOpen = false
                                    deleteListOpen = true
                                },
                            )
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { refresh() },
                modifier = Modifier.weight(1f),
            ) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (items.isEmpty()) {
                        item {
                            Text(
                                "No items yet",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 24.dp),
                            )
                        }
                    }
                    items(openItems, key = { it.id }) { item ->
                        ItemRow(
                            item = item,
                            enabled = online,
                            onToggle = {
                                gateOnline {
                                    repository.updateItem(
                                        item.id,
                                        listId,
                                        UpdateItemBody(checked = !item.checked),
                                    )
                                }
                            },
                            onEdit = {
                                editingItem = item
                                editText = item.text
                            },
                            onDelete = {
                                gateOnline { repository.deleteItem(item.id, listId) }
                            },
                        )
                    }
                    if (tickedItems.isNotEmpty()) {
                        item {
                            Spacer(Modifier.height(12.dp))
                            HorizontalDivider()
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                TextButton(onClick = { tickedExpanded = !tickedExpanded }) {
                                    Icon(
                                        if (tickedExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = null,
                                    )
                                    Text("${tickedItems.size} ticked")
                                }
                                Spacer(Modifier.weight(1f))
                                TextButton(
                                    onClick = { clearCheckedOpen = true },
                                    enabled = online,
                                ) { Text("Clear") }
                            }
                        }
                        if (tickedExpanded) {
                            items(tickedItems, key = { "t-${it.id}" }) { item ->
                                ItemRow(
                                    item = item,
                                    enabled = online,
                                    dimmed = true,
                                    onToggle = {
                                        gateOnline {
                                            repository.updateItem(
                                                item.id,
                                                listId,
                                                UpdateItemBody(checked = false),
                                            )
                                        }
                                    },
                                    onEdit = {
                                        editingItem = item
                                        editText = item.text
                                    },
                                    onDelete = {
                                        gateOnline { repository.deleteItem(item.id, listId) }
                                    },
                                )
                            }
                        }
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = newText,
                    onValueChange = { newText = it },
                    label = { Text(if (online) "Add item" else "Offline — viewing only") },
                    singleLine = true,
                    enabled = online,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = {
                        val text = newText.trim()
                        if (text.isEmpty()) return@IconButton
                        gateOnline {
                            repository.createItem(listId, text)
                            newText = ""
                        }
                    },
                    enabled = online && newText.trim().isNotEmpty(),
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add")
                }
            }
        }
    }

    if (renameOpen) {
        AlertDialog(
            onDismissRequest = { renameOpen = false },
            title = { Text("Rename list") },
            text = {
                OutlinedTextField(
                    value = draftName,
                    onValueChange = { draftName = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        gateOnline {
                            repository.renameList(listId, draftName.trim())
                            renameOpen = false
                        }
                    },
                    enabled = draftName.trim().isNotEmpty(),
                ) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { renameOpen = false }) { Text("Cancel") }
            },
        )
    }

    if (deleteListOpen) {
        AlertDialog(
            onDismissRequest = { deleteListOpen = false },
            title = { Text("Delete list?") },
            text = { Text("This cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        gateOnline {
                            repository.deleteList(listId)
                            onDeleted()
                        }
                    },
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteListOpen = false }) { Text("Cancel") }
            },
        )
    }

    if (clearCheckedOpen) {
        AlertDialog(
            onDismissRequest = { clearCheckedOpen = false },
            title = { Text("Clear ticked items?") },
            text = { Text("All checked items will be deleted.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        gateOnline {
                            repository.clearChecked(listId)
                            clearCheckedOpen = false
                        }
                    },
                ) { Text("Clear") }
            },
            dismissButton = {
                TextButton(onClick = { clearCheckedOpen = false }) { Text("Cancel") }
            },
        )
    }

    editingItem?.let { item ->
        AlertDialog(
            onDismissRequest = { editingItem = null },
            title = { Text("Edit item") },
            text = {
                OutlinedTextField(
                    value = editText,
                    onValueChange = { editText = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        gateOnline {
                            repository.updateItem(
                                item.id,
                                listId,
                                UpdateItemBody(text = editText.trim()),
                            )
                            editingItem = null
                        }
                    },
                    enabled = editText.trim().isNotEmpty(),
                ) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { editingItem = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun ItemRow(
    item: ListItemDto,
    enabled: Boolean,
    dimmed: Boolean = false,
    onToggle: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = item.checked,
            onCheckedChange = { if (enabled) onToggle() },
            enabled = enabled,
        )
        Text(
            item.text,
            modifier = Modifier
                .weight(1f)
                .padding(end = 8.dp)
                .then(
                    if (enabled) {
                        Modifier
                    } else {
                        Modifier
                    },
                ),
            textDecoration = if (item.checked) TextDecoration.LineThrough else null,
            color = if (dimmed) {
                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f)
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            style = MaterialTheme.typography.bodyLarge,
        )
        if (enabled) {
            TextButton(onClick = onEdit) { Text("Edit") }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete item")
            }
        }
    }
}
