package uk.co.xeiverse.genesislists.ui.screens.detail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.material3.LocalContentColor
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.OfflineMutationException
import uk.co.xeiverse.genesislists.data.api.ListItemDto
import uk.co.xeiverse.genesislists.data.api.UpdateItemBody

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
    var deleteListOpen by remember { mutableStateOf(false) }
    var clearCheckedOpen by remember { mutableStateOf(false) }
    var editingTitle by remember { mutableStateOf(false) }
    var titleDraft by remember { mutableStateOf(TextFieldValue("")) }
    var editingItemId by remember { mutableStateOf<String?>(null) }
    var editDraft by remember { mutableStateOf(TextFieldValue("")) }
    var skipTitleBlurSave by remember { mutableStateOf(false) }
    var skipItemBlurSave by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val titleFocusRequester = remember { FocusRequester() }
    val itemFocusRequester = remember { FocusRequester() }

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

    LaunchedEffect(editingTitle) {
        if (editingTitle) {
            titleFocusRequester.requestFocus()
        }
    }

    LaunchedEffect(editingItemId) {
        if (editingItemId != null) {
            itemFocusRequester.requestFocus()
        }
    }

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

    fun startTitleEdit() {
        if (!online) return
        val name = list?.name.orEmpty()
        skipTitleBlurSave = false
        titleDraft = TextFieldValue(name, TextRange(0, name.length))
        editingTitle = true
    }

    fun commitTitleEdit() {
        val name = titleDraft.text.trim()
        val current = list?.name.orEmpty()
        if (name.isEmpty() || name == current) {
            editingTitle = false
            titleDraft = TextFieldValue("")
            focusManager.clearFocus()
            keyboardController?.hide()
            return
        }
        gateOnline {
            repository.renameList(listId, name)
            editingTitle = false
            titleDraft = TextFieldValue("")
            focusManager.clearFocus()
            keyboardController?.hide()
        }
    }

    fun startItemEdit(item: ListItemDto) {
        if (!online) return
        if (editingItemId != null && editingItemId != item.id) {
            // Commit the previous row before switching.
            val previousId = editingItemId!!
            val text = editDraft.text.trim()
            val previous = items.find { it.id == previousId }
            if (previous != null && text.isNotEmpty() && text != previous.text) {
                gateOnline {
                    repository.updateItem(previousId, listId, UpdateItemBody(text = text))
                }
            }
        }
        skipItemBlurSave = false
        editDraft = TextFieldValue(item.text, TextRange(0, item.text.length))
        editingItemId = item.id
    }

    fun cancelItemEdit() {
        skipItemBlurSave = true
        editingItemId = null
        editDraft = TextFieldValue("")
        focusManager.clearFocus()
        keyboardController?.hide()
    }

    fun commitItemEdit() {
        val id = editingItemId ?: return
        val text = editDraft.text.trim()
        val current = items.find { it.id == id }?.text.orEmpty()
        if (text.isEmpty() || text == current) {
            editingItemId = null
            editDraft = TextFieldValue("")
            focusManager.clearFocus()
            keyboardController?.hide()
            return
        }
        gateOnline {
            repository.updateItem(id, listId, UpdateItemBody(text = text))
            editingItemId = null
            editDraft = TextFieldValue("")
            focusManager.clearFocus()
            keyboardController?.hide()
        }
    }

    fun submitNewItem() {
        val text = newText.trim()
        if (text.isEmpty() || !online) return
        gateOnline {
            repository.createItem(listId, text)
            newText = ""
            focusManager.clearFocus()
            keyboardController?.hide()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        if (editingTitle) {
                            BasicTextField(
                                value = titleDraft,
                                onValueChange = { titleDraft = it },
                                singleLine = true,
                                textStyle = MaterialTheme.typography.titleLarge.copy(
                                    color = LocalContentColor.current,
                                ),
                                cursorBrush = SolidColor(LocalContentColor.current),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(
                                    onDone = {
                                        skipTitleBlurSave = true
                                        commitTitleEdit()
                                    },
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .focusRequester(titleFocusRequester)
                                    .onFocusChanged { state ->
                                        if (!state.isFocused && editingTitle) {
                                            if (skipTitleBlurSave) {
                                                skipTitleBlurSave = false
                                            } else {
                                                commitTitleEdit()
                                            }
                                        }
                                    },
                            )
                        } else {
                            Text(
                                list?.name ?: "List",
                                modifier = if (online) {
                                    Modifier.clickable(onClick = { startTitleEdit() })
                                } else {
                                    Modifier
                                },
                                maxLines = 1,
                            )
                        }
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
                    if (list?.isOwner != false) {
                        IconButton(onClick = { menuOpen = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
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
                .padding(padding)
                .imePadding(),
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
                            isEditing = editingItemId == item.id,
                            editText = editDraft,
                            focusRequester = itemFocusRequester,
                            onToggle = {
                                gateOnline {
                                    repository.updateItem(
                                        item.id,
                                        listId,
                                        UpdateItemBody(checked = !item.checked),
                                    )
                                }
                            },
                            onStartEdit = { startItemEdit(item) },
                            onEditTextChange = { editDraft = it },
                            onCommit = {
                                skipItemBlurSave = true
                                commitItemEdit()
                            },
                            onBlurCommit = {
                                if (skipItemBlurSave) {
                                    skipItemBlurSave = false
                                } else {
                                    commitItemEdit()
                                }
                            },
                            onDelete = {
                                if (editingItemId == item.id) cancelItemEdit()
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
                                    isEditing = editingItemId == item.id,
                                    editText = editDraft,
                                    focusRequester = itemFocusRequester,
                                    onToggle = {
                                        gateOnline {
                                            repository.updateItem(
                                                item.id,
                                                listId,
                                                UpdateItemBody(checked = false),
                                            )
                                        }
                                    },
                                    onStartEdit = { startItemEdit(item) },
                                    onEditTextChange = { editDraft = it },
                                    onCommit = {
                                        skipItemBlurSave = true
                                        commitItemEdit()
                                    },
                                    onBlurCommit = {
                                        if (skipItemBlurSave) {
                                            skipItemBlurSave = false
                                        } else {
                                            commitItemEdit()
                                        }
                                    },
                                    onDelete = {
                                        if (editingItemId == item.id) cancelItemEdit()
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
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submitNewItem() }),
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = { submitNewItem() },
                    enabled = online && newText.trim().isNotEmpty(),
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add")
                }
            }
        }
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
                            if (editingItemId != null &&
                                items.find { it.id == editingItemId }?.checked == true
                            ) {
                                cancelItemEdit()
                            }
                        }
                    },
                ) { Text("Clear") }
            },
            dismissButton = {
                TextButton(onClick = { clearCheckedOpen = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun ItemRow(
    item: ListItemDto,
    enabled: Boolean,
    dimmed: Boolean = false,
    isEditing: Boolean,
    editText: TextFieldValue,
    focusRequester: FocusRequester,
    onToggle: () -> Unit,
    onStartEdit: () -> Unit,
    onEditTextChange: (TextFieldValue) -> Unit,
    onCommit: () -> Unit,
    onBlurCommit: () -> Unit,
    onDelete: () -> Unit,
) {
    val textColor = if (dimmed) {
        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f)
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    val textStyle = MaterialTheme.typography.bodyLarge.copy(
        color = textColor,
        textDecoration = if (item.checked && !isEditing) TextDecoration.LineThrough else null,
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = item.checked,
            onCheckedChange = { if (enabled) onToggle() },
            enabled = enabled,
        )
        if (isEditing) {
            BasicTextField(
                value = editText,
                onValueChange = onEditTextChange,
                singleLine = true,
                textStyle = textStyle,
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onCommit() }),
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp)
                    .focusRequester(focusRequester)
                    .onFocusChanged { state ->
                        if (!state.isFocused && isEditing) {
                            onBlurCommit()
                        }
                    },
            )
        } else {
            Text(
                item.text,
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp)
                    .then(
                        if (enabled) Modifier.clickable(onClick = onStartEdit) else Modifier,
                    ),
                textDecoration = if (item.checked) TextDecoration.LineThrough else null,
                color = textColor,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
        if (enabled) {
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete item")
            }
        }
    }
}
