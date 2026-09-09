import { FormEvent, useCallback, useEffect, useState } from "react";
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
  ListItemText,
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editItem, setEditItem] = useState<ListItemDto | null>(null);
  const [editText, setEditText] = useState("");
  const [nameInput, setNameInput] = useState("");

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

  async function saveEdit() {
    if (!editItem) return;
    try {
      const updated = await api.updateItem(editItem.id, { text: editText.trim() });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setEditItem(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Edit failed");
    }
  }

  async function removeItem(item: ListItemDto) {
    try {
      await api.deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function handleRename() {
    try {
      const updated = await api.renameList(id, nameInput.trim());
      setTitle(updated.name);
      setRenameOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rename failed");
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
          <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
            {title}
          </Typography>
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
            {items.map((item) => (
              <ListItem key={item.id} disablePadding sx={{ pr: 6 }}>
                <ListItemIcon sx={{ minWidth: 42 }}>
                  <Checkbox
                    edge="start"
                    checked={item.checked}
                    onChange={() => void toggle(item)}
                    inputProps={{ "aria-label": `toggle ${item.text}` }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  onClick={() => {
                    setEditItem(item);
                    setEditText(item.text);
                  }}
                  sx={{
                    textDecoration: item.checked ? "line-through" : "none",
                    opacity: item.checked ? 0.6 : 1,
                    cursor: "pointer",
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
            ))}
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
            setNameInput(title);
            setRenameOpen(true);
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

      <Dialog open={Boolean(editItem)} onClose={() => setEditItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit item</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Text"
            fullWidth
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setEditItem(null)}>
            Cancel
          </Button>
          <Button onClick={() => void saveEdit()} disabled={!editText.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rename list</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleRename()} disabled={!nameInput.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

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
