import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ListItemDto } from "@genesis-lists/shared";
import { api, ApiError } from "../api";

export function ListDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("List");
  const [items, setItems] = useState<ListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipBlurSave = useRef(false);
  const skipTitleBlurSave = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listsRes, itemsRes] = await Promise.all([api.lists(), api.items(id)]);
      const list = listsRes.lists.find((l) => l.id === id);
      if (!list) {
        setError("List not found");
        navigate("/");
        return;
      }
      setTitle(list.name);
      setItems(itemsRes.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    try {
      const item = await api.createItem(id, text);
      setItems((prev) => [...prev, item]);
      setNewText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Add failed");
    }
  }

  async function toggle(item: ListItemDto) {
    try {
      const updated = await api.updateItem(item.id, { checked: !item.checked });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  function startEdit(item: ListItemDto) {
    skipBlurSave.current = false;
    setEditingId(item.id);
    setEditText(item.text);
  }

  function cancelEdit() {
    skipBlurSave.current = true;
    setEditingId(null);
    setEditText("");
  }

  async function commitEdit() {
    if (!editingId) return;
    const item = items.find((i) => i.id === editingId);
    const text = editText.trim();
    if (!item || !text || text === item.text) {
      setEditingId(null);
      setEditText("");
      return;
    }
    try {
      const updated = await api.updateItem(editingId, { text });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setEditingId(null);
      setEditText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Edit failed");
    }
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      skipBlurSave.current = true;
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function startTitleEdit() {
    skipTitleBlurSave.current = false;
    setTitleDraft(title);
    setEditingTitle(true);
  }

  function cancelTitleEdit() {
    skipTitleBlurSave.current = true;
    setEditingTitle(false);
    setTitleDraft("");
  }

  async function commitTitleEdit() {
    const name = titleDraft.trim();
    if (!name || name === title) {
      setEditingTitle(false);
      setTitleDraft("");
      return;
    }
    try {
      const updated = await api.renameList(id, name);
      setTitle(updated.name);
      setEditingTitle(false);
      setTitleDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rename failed");
    }
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      skipTitleBlurSave.current = true;
      void commitTitleEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
    }
  }

  async function removeItem(item: ListItemDto) {
    try {
      await api.deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (editingId === item.id) {
        setEditingId(null);
        setEditText("");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function handleDeleteList() {
    try {
      await api.deleteList(id);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/")} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          {editingTitle ? (
            <TextField
              inputRef={titleInputRef}
              size="small"
              fullWidth
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={onTitleKeyDown}
              onBlur={() => {
                if (skipTitleBlurSave.current) {
                  skipTitleBlurSave.current = false;
                  return;
                }
                void commitTitleEdit();
              }}
              aria-label="List name"
              variant="standard"
              sx={{
                flexGrow: 1,
                mr: 1,
                "& .MuiInputBase-input": {
                  color: "inherit",
                  typography: "h6",
                  py: 0.5,
                },
                "& .MuiInput-underline:before": { borderBottomColor: "rgba(255,255,255,0.42)" },
                "& .MuiInput-underline:hover:before": { borderBottomColor: "rgba(255,255,255,0.7)" },
                "& .MuiInput-underline:after": { borderBottomColor: "inherit" },
              }}
            />
          ) : (
            <Typography
              variant="h6"
              sx={{ flexGrow: 1, cursor: "pointer" }}
              noWrap
              onClick={startTitleEdit}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startTitleEdit();
                }
              }}
              aria-label="Edit list name"
            >
              {title}
            </Typography>
          )}
          <IconButton
            color="inherit"
            aria-label="list menu"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ flex: 1, py: 1 }}>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : items.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No items yet. Add something below.
          </Typography>
        ) : (
          <List>
            {items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ pr: 6, alignItems: "center", minHeight: 48 }}>
                  <ListItemIcon sx={{ minWidth: 42 }}>
                    <Checkbox
                      edge="start"
                      checked={item.checked}
                      onChange={() => void toggle(item)}
                      inputProps={{ "aria-label": `toggle ${item.text}` }}
                    />
                  </ListItemIcon>
                  <TextField
                    inputRef={isEditing ? editInputRef : undefined}
                    variant="standard"
                    fullWidth
                    value={isEditing ? editText : item.text}
                    onChange={(e) => {
                      if (isEditing) setEditText(e.target.value);
                    }}
                    onClick={() => {
                      if (!isEditing) startEdit(item);
                    }}
                    onFocus={() => {
                      if (!isEditing) startEdit(item);
                    }}
                    onKeyDown={isEditing ? onEditKeyDown : undefined}
                    onBlur={() => {
                      if (!isEditing) return;
                      if (skipBlurSave.current) {
                        skipBlurSave.current = false;
                        return;
                      }
                      void commitEdit();
                    }}
                    InputProps={{
                      readOnly: !isEditing,
                      disableUnderline: !isEditing,
                    }}
                    inputProps={{
                      "aria-label": isEditing ? `Edit ${item.text}` : item.text,
                    }}
                    sx={{
                      mr: 1,
                      minHeight: 40,
                      justifyContent: "center",
                      "& .MuiInputBase-root": {
                        minHeight: 40,
                      },
                      "& .MuiInputBase-input": {
                        cursor: isEditing ? "text" : "pointer",
                        py: 1,
                        textDecoration: item.checked && !isEditing ? "line-through" : "none",
                        opacity: item.checked && !isEditing ? 0.6 : 1,
                      },
                    }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label={`delete ${item.text}`}
                      onClick={() => void removeItem(item)}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </Container>

      <Box
        component="form"
        onSubmit={(e) => void addItem(e)}
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          position: "sticky",
          bottom: 0,
        }}
      >
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add item"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            aria-label="New item text"
          />
          <Button type="submit" disabled={!newText.trim()}>
            Add
          </Button>
        </Stack>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            startTitleEdit();
          }}
        >
          Rename list
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
        >
          Delete list
        </MenuItem>
      </Menu>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete list?</DialogTitle>
        <DialogContent>
          <Typography>“{title}” and all its items will be permanently deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button color="error" onClick={() => void handleDeleteList()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(error)} autoHideDuration={4000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
