import { useCallback, useEffect, useState, type MouseEvent } from "react";
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
  Menu,
  MenuItem,
  Paper,
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

function ListTile({
  list,
  onOpen,
  onMenuOpen,
}: {
  list: ListDto;
  onOpen: () => void;
  onMenuOpen: (e: MouseEvent<HTMLElement>) => void;
}) {
  const remaining = list.itemCount - list.previewItems.length;

  return (
    <Paper
      elevation={0}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      sx={{
        p: 2,
        height: "100%",
        cursor: "pointer",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        transition: "background-color 0.15s ease",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={0.5}>
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {list.name}
        </Typography>
        <IconButton
          size="small"
          aria-label="list actions"
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(e);
          }}
          sx={{ mt: -0.5, mr: -0.5 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>

      {list.previewItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No items yet
        </Typography>
      ) : (
        <Stack spacing={0.25} sx={{ minHeight: 0 }}>
          {list.previewItems.map((item) => (
            <Typography
              key={item.id}
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: item.checked ? "line-through" : "none",
                opacity: item.checked ? 0.65 : 1,
              }}
            >
              {item.text}
            </Typography>
          ))}
          {remaining > 0 && (
            <Typography variant="caption" color="text.disabled">
              +{remaining} more
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}

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

      <Container maxWidth="md" sx={{ py: 2, pb: 10 }}>
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
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            {lists.map((list) => (
              <ListTile
                key={list.id}
                list={list}
                onOpen={() => navigate(`/lists/${list.id}`)}
                onMenuOpen={(e) => {
                  setActive(list);
                  setMenuAnchor(e.currentTarget);
                }}
              />
            ))}
          </Box>
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
