package com.genesislists.android.ui.screens.lists

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genesislists.android.data.ListsRepository
import com.genesislists.android.data.OfflineMutationException
import com.genesislists.android.data.api.ListDto
import com.genesislists.android.data.api.UserDto
import com.genesislists.android.ui.components.BrandMark
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListsHomeScreen(
    repository: ListsRepository,
    onOpenList: (String) -> Unit,
    onSettings: () -> Unit,
    onLoggedOut: () -> Unit,
) {
    val lists by repository.observeLists().collectAsState(initial = emptyList())
    var user by remember { mutableStateOf<UserDto?>(null) }
    var search by remember { mutableStateOf("") }
    var refreshing by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var online by remember { mutableStateOf(repository.isOnline()) }
    var createOpen by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<ListDto?>(null) }
    var deleteTarget by remember { mutableStateOf<ListDto?>(null) }
    var draftName by remember { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    fun refresh() {
        scope.launch {
            refreshing = true
            online = repository.isOnline()
            try {
                repository.refreshLists()
                if (repository.isOnline()) {
                    user = runCatching { repository.me() }.getOrNull()
                }
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: "Refresh failed")
            } finally {
                refreshing = false
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { refresh() }

    val filtered = remember(lists, search) {
        val q = search.trim().lowercase()
        if (q.isEmpty()) lists
        else lists.filter { list ->
            list.name.lowercase().contains(q) ||
                list.previewItems.any { it.text.lowercase().contains(q) }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandMark(size = 32.dp, inverted = true)
                        Spacer(Modifier.padding(6.dp))
                        Column {
                            Text("Genesis Lists")
                            if (!online) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.CloudOff,
                                        contentDescription = null,
                                        modifier = Modifier.height(14.dp),
                                    )
                                    Text(
                                        " Offline · cached",
                                        style = MaterialTheme.typography.labelSmall,
                                    )
                                }
                            }
                        }
                    }
                },
                actions = {
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                    IconButton(
                        onClick = {
                            scope.launch {
                                repository.logout()
                                onLoggedOut()
                            }
                        },
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Log out")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (!repository.isOnline()) {
                        scope.launch {
                            snackbar.showSnackbar("You are offline. Creating lists requires a network connection.")
                        }
                    } else {
                        draftName = ""
                        createOpen = true
                    }
                },
            ) {
                Icon(Icons.Default.Add, contentDescription = "New list")
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Search lists") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { refresh() },
                modifier = Modifier.fillMaxSize(),
            ) {
                when {
                    loading && lists.isEmpty() -> Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) { CircularProgressIndicator() }

                    lists.isEmpty() -> Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No lists yet", style = MaterialTheme.typography.titleMedium)
                            Text(
                                if (online) "Tap + to create your first list"
                                else "Connect to the network to create lists",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    filtered.isEmpty() -> Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("No matching lists")
                    }

                    else -> LazyVerticalStaggeredGrid(
                        columns = StaggeredGridCells.Adaptive(160.dp),
                        contentPadding = PaddingValues(16.dp),
                        verticalItemSpacing = 12.dp,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(filtered, key = { it.id }) { list ->
                            ListCard(
                                list = list,
                                onOpen = { onOpenList(list.id) },
                                onRename = {
                                    if (!repository.isOnline()) {
                                        scope.launch {
                                            snackbar.showSnackbar("You are offline. Changes require a network connection.")
                                        }
                                    } else {
                                        draftName = list.name
                                        renameTarget = list
                                    }
                                },
                                onDelete = {
                                    if (!repository.isOnline()) {
                                        scope.launch {
                                            snackbar.showSnackbar("You are offline. Changes require a network connection.")
                                        }
                                    } else if (list.isOwner) {
                                        deleteTarget = list
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (createOpen || renameTarget != null) {
        val isRename = renameTarget != null
        AlertDialog(
            onDismissRequest = { createOpen = false; renameTarget = null },
            title = { Text(if (isRename) "Rename list" else "New list") },
            text = {
                OutlinedTextField(
                    value = draftName,
                    onValueChange = { draftName = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            try {
                                if (isRename) {
                                    repository.renameList(renameTarget!!.id, draftName.trim())
                                } else {
                                    repository.createList(draftName.trim())
                                }
                                createOpen = false
                                renameTarget = null
                            } catch (e: OfflineMutationException) {
                                snackbar.showSnackbar(e.message ?: "Offline")
                            } catch (e: Exception) {
                                snackbar.showSnackbar(e.message ?: "Failed")
                            }
                        }
                    },
                    enabled = draftName.trim().isNotEmpty(),
                ) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { createOpen = false; renameTarget = null }) {
                    Text("Cancel")
                }
            },
        )
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete list?") },
            text = { Text("“${target.name}” and its items will be permanently deleted.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            try {
                                repository.deleteList(target.id)
                                deleteTarget = null
                            } catch (e: Exception) {
                                snackbar.showSnackbar(e.message ?: "Delete failed")
                            }
                        }
                    },
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun ListCard(
    list: ListDto,
    onOpen: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        ),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    list.name,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "List menu")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Rename") },
                            onClick = { menuOpen = false; onRename() },
                            leadingIcon = { Icon(Icons.Default.Edit, null) },
                        )
                        if (list.isOwner) {
                            DropdownMenuItem(
                                text = { Text("Delete") },
                                onClick = { menuOpen = false; onDelete() },
                                leadingIcon = { Icon(Icons.Default.Delete, null) },
                            )
                        }
                    }
                }
            }
            if (!list.isOwner && list.ownerUsername.isNotBlank()) {
                Text(
                    "Shared by ${list.ownerUsername}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(8.dp))
            list.previewItems.take(8).forEach { preview ->
                Text(
                    preview.text,
                    style = MaterialTheme.typography.bodySmall,
                    textDecoration = if (preview.checked) TextDecoration.LineThrough else null,
                    color = if (preview.checked) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            val more = list.itemCount - list.previewItems.size
            if (more > 0) {
                Text(
                    "+$more more",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
