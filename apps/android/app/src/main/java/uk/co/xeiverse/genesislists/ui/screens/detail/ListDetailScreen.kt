package uk.co.xeiverse.genesislists.ui.screens.detail

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
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
import androidx.compose.material3.ScaffoldDefaults
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
    var requestTitleFocus by remember { mutableStateOf(false) }
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

    LaunchedEffect(requestTitleFocus) {
        if (requestTitleFocus) {
            titleFocusRequester.requestFocus()
            requestTitleFocus = false
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

    fun endTitleEditUi() {
        editingTitle = false
        titleDraft = TextFieldValue("")
        focusManager.clearFocus()
        keyboardController?.hide()
    }

    fun startTitleEdit() {
        if (!online || editingTitle) return
        val name = list?.name.orEmpty()
        skipTitleBlurSave = true
        titleDraft = TextFieldValue(name, TextRange(0, name.length))
        editingTitle = true
        requestTitleFocus = true
    }

    fun commitTitleEdit() {
        if (!editingTitle) return
        val name = titleDraft.text.trim()
        val current = list?.name.orEmpty()
        // Exit edit mode immediately so a slow rename cannot wipe a later session.
        endTitleEditUi()
        if (name.isEmpty() || name == current) return
        gateOnline { repository.renameList(listId, name) }
    }

    fun cancelTitleEdit() {
        skipTitleBlurSave = true
        endTitleEditUi()
    }

    fun endItemEditUi() {
        editingItemId = null
        editDraft = TextFieldValue("")
        focusManager.clearFocus()
        keyboardController?.hide()
    }

    fun persistItemText(id: String, text: String) {
        val current = items.find { it.id == id }?.text.orEmpty()
        if (text.isEmpty() || text == current) return
        gateOnline {
            repository.updateItem(id, listId, UpdateItemBody(text = text))
        }
    }

    fun startItemEdit(item: ListItemDto) {
        if (!online || editingItemId == item.id) return
        if (editingItemId != null) {
            // Ignore dispose/unfocus from the outgoing field; it must not commit the new row.
            skipItemBlurSave = true
            val previousId = editingItemId!!
            val text = editDraft.text.trim()
            persistItemText(previousId, text)
        }
        skipItemBlurSave = true
        editDraft = TextFieldValue(item.text, TextRange(0, item.text.length))
        editingItemId = item.id
    }

    fun commitItemEdit() {
        val id = editingItemId ?: return
        val text = editDraft.text.trim()
        // Exit immediately with a snapshot so in-flight work cannot clear a newer edit.
        endItemEditUi()
        persistItemText(id, text)
    }

    fun cancelItemEdit() {
        skipItemBlurSave = true
        endItemEditUi()
    }

    fun submitNewItem() {
        val text = newText.trim()
        if (text.isEmpty() || !online) return
        gateOnline {
            repository.createItem(listId, text)
            newText = ""
            // Keep focus + IME so the next item can be typed immediately.
        }
    }

    BackHandler(enabled = editingTitle || editingItemId != null) {
        if (editingTitle) {
            cancelTitleEdit()
        } else {
            cancelItemEdit()
        }
    }

    val titleValue = if (editingTitle) {
        titleDraft
    } else {
        TextFieldValue(list?.name ?: "List")
    }

    Scaffold(
        contentWindowInsets = ScaffoldDefaults.contentWindowInsets.exclude(WindowInsets.ime),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        BasicTextField(
                            value = titleValue,
                            onValueChange = { if (editingTitle) titleDraft = it },
                            singleLine = true,
                            readOnly = !editingTitle || !online,
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
                                .semantics {
                                    contentDescription = if (editingTitle) {
                                        "Edit list name"
                                    } else {
                                        list?.name ?: "List"
                                    }
                                }
                                .then(
                                    if (online && !editingTitle) {
                                        Modifier.clickable(
                                            onClick = { startTitleEdit() },
                                            onClickLabel = "edit list name",
                                        )
                                    } else {
                                        Modifier
                                    },
                                )
                                .onFocusChanged { state ->
                                    if (state.isFocused) {
                                        if (online && !editingTitle) {
                                            startTitleEdit()
                                        }
                                        skipTitleBlurSave = false
                                    } else if (editingTitle && !skipTitleBlurSave) {
                                        commitTitleEdit()
                                    } else if (skipTitleBlurSave) {
                                        skipTitleBlurSave = false
                                    }
                                },
                        )
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
                                startTitleEdit()
                            },
                            enabled = online,
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
                        BoundItemRow(
                            item = item,
                            enabled = online,
                            dimmed = false,
                            editingItemId = editingItemId,
                            editDraft = editDraft,
                            itemFocusRequester = itemFocusRequester,
                            skipItemBlurSave = skipItemBlurSave,
                            onSkipItemBlurSaveChange = { skipItemBlurSave = it },
                            onToggleChecked = {
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
                            onCancelEdit = { cancelItemEdit() },
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
                                BoundItemRow(
                                    item = item,
                                    enabled = online,
                                    dimmed = true,
                                    editingItemId = editingItemId,
                                    editDraft = editDraft,
                                    itemFocusRequester = itemFocusRequester,
                                    skipItemBlurSave = skipItemBlurSave,
                                    onSkipItemBlurSaveChange = { skipItemBlurSave = it },
                                    onToggleChecked = {
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
                                    onCancelEdit = { cancelItemEdit() },
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
private fun BoundItemRow(
    item: ListItemDto,
    enabled: Boolean,
    dimmed: Boolean,
    editingItemId: String?,
    editDraft: TextFieldValue,
    itemFocusRequester: FocusRequester,
    skipItemBlurSave: Boolean,
    onSkipItemBlurSaveChange: (Boolean) -> Unit,
    onToggleChecked: () -> Unit,
    onStartEdit: () -> Unit,
    onEditTextChange: (TextFieldValue) -> Unit,
    onCommit: () -> Unit,
    onCancelEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val isEditing = editingItemId == item.id
    ItemRow(
        item = item,
        enabled = enabled,
        dimmed = dimmed,
        isEditing = isEditing,
        editText = editDraft,
        focusRequester = itemFocusRequester,
        onToggle = onToggleChecked,
        onStartEdit = onStartEdit,
        onEditTextChange = onEditTextChange,
        onFocused = {
            // Only the active editor may clear the skip flag (avoids a new focus clearing
            // it before the outgoing row's blur runs).
            if (editingItemId == item.id) {
                onSkipItemBlurSaveChange(false)
            }
        },
        onCommit = onCommit,
        onBlurCommit = {
            // Ignore stale blur from a previous row after switching editors.
            if (editingItemId == item.id) {
                if (skipItemBlurSave) {
                    onSkipItemBlurSaveChange(false)
                } else {
                    onCommit()
                }
            }
        },
        onDelete = {
            if (editingItemId == item.id) onCancelEdit()
            onDelete()
        },
    )
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
    onFocused: () -> Unit,
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
    val fieldValue = if (isEditing) editText else TextFieldValue(item.text)

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = item.checked,
            onCheckedChange = { if (enabled) onToggle() },
            enabled = enabled,
        )
        BasicTextField(
            value = fieldValue,
            onValueChange = { if (isEditing) onEditTextChange(it) },
            singleLine = true,
            readOnly = !isEditing || !enabled,
            textStyle = textStyle,
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onCommit() }),
            modifier = Modifier
                .weight(1f)
                .padding(end = 8.dp)
                .then(if (isEditing) Modifier.focusRequester(focusRequester) else Modifier)
                .semantics {
                    contentDescription = if (isEditing) {
                        "Edit ${item.text}"
                    } else {
                        item.text
                    }
                }
                .then(
                    if (enabled && !isEditing) {
                        Modifier.clickable(
                            onClick = onStartEdit,
                            onClickLabel = "edit",
                        )
                    } else {
                        Modifier
                    },
                )
                .onFocusChanged { state ->
                    if (state.isFocused) {
                        if (enabled && !isEditing) {
                            onStartEdit()
                        }
                        onFocused()
                    } else if (isEditing) {
                        onBlurCommit()
                    }
                },
        )
        if (enabled) {
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete item")
            }
        }
    }
}
