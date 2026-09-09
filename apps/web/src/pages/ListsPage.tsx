import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
  Fab,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ListDto } from "@genesis-lists/shared";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export function ListsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [active, setActive] = useState<ListDto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.lists();
      setLists(data.lists);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load lists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    try {
      const list = await api.createList(nameInput.trim());
      setCreateOpen(false);
      setNameInput("");
      setLists((prev) => [...prev, list]);
      navigate(`/lists/${list.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
    }
  }

  async function handleRename() {
    if (!active) return;
    try {
      const updated = await api.renameList(active.id, nameInput.trim());
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setRenameOpen(false);
      setActive(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Rename failed");
    }
  }

  async function handleDelete() {
    if (!active) return;
    try {
      await api.deleteList(active.id);
      setLists((prev) => prev.filter((l) => l.id !== active.id));
      setDeleteOpen(false);
      setActive(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Genesis Lists
          </Typography>
          <Typography variant="body2" sx={{ mr: 1, opacity: 0.9 }}>
            {user?.username}
          </Typography>
          <Button color="inherit" onClick={() => void logout()}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : lists.length === 0 ? (
          <Stack spacing={2} alignItems="center" py={8}>
            <Typography variant="h6">No lists yet</Typography>
            <Typography color="text.secondary" textAlign="center">
              Create a shopping list to get started.
            </Typography>
            <Button
              onClick={() => {
                setNameInput("");
                setCreateOpen(true);
              }}
            >
              New list
            </Button>
          </Stack>
        ) : (
          <List>
            {lists.map((list) => (
              <ListItemButton
                key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText primary={list.name} />
                <IconButton
                  edge="end"
                  aria-label="list actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive(list);
                    setMenuAnchor(e.currentTarget);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="create list"
        sx={{ position: "fixed", bottom: 24, right: 24 }}
        onClick={() => {
          setNameInput("");
          setCreateOpen(true);
        }}
      >
        <AddIcon />
      </Fab>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setNameInput(active?.name ?? "");
            setRenameOpen(true);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New list</DialogTitle>
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
          <Button variant="text" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!nameInput.trim()}>
            Create
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
          <Typography>
            “{active?.name}” and all its items will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button color="error" onClick={() => void handleDelete()}>
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
