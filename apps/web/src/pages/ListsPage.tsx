import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import type { ListDto } from "@genesis-lists/shared";
import { api, ApiError } from "../api";
import { AppMark } from "../AppMark";
import { useAuth } from "../auth";
import { ShareListDialog } from "../ShareListDialog";

export function ListsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  const filteredLists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter(
      (list) =>
        list.name.toLowerCase().includes(q) ||
        list.previewItems.some((item) => item.text.toLowerCase().includes(q)),
    );
  }, [lists, query]);

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

  async function handleLeave() {
    if (!active) return;
    try {
      await api.leaveList(active.id);
      setLists((prev) => prev.filter((l) => l.id !== active.id));
      setLeaveOpen(false);
      setActive(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Leave failed");
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <AppMark size={32} inverted />
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1.5 }}>
            Genesis Lists
          </Typography>
          <IconButton
            color="inherit"
            onClick={(e) => setAccountAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={
              user?.name ? `Account menu for ${user.name}` : "Account menu"
            }
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "primary.dark",
                fontSize: "0.875rem",
              }}
            >
              {(user?.name?.[0] ?? "?").toUpperCase()}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 2, pb: 10, maxWidth: 960 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search lists"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search lists"
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

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
        ) : filteredLists.length === 0 ? (
          <Stack spacing={1} alignItems="center" py={8}>
            <Typography variant="h6">No matching lists</Typography>
            <Typography color="text.secondary" textAlign="center">
              Try a different search term.
            </Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              columnCount: { xs: 1, sm: 2, md: 3 },
              columnGap: 2,
            }}
          >
            {filteredLists.map((list) => (
              <Card
                key={list.id}
                variant="outlined"
                sx={{
                  mb: 2,
                  breakInside: "avoid",
                  display: "inline-block",
                  width: "100%",
                  verticalAlign: "top",
                }}
              >
                <Box sx={{ position: "relative" }}>
                  <IconButton
                    size="small"
                    aria-label="list actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(list);
                      setMenuAnchor(e.currentTarget);
                    }}
                    sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                  <CardActionArea onClick={() => navigate(`/lists/${list.id}`)}>
                    <CardContent sx={{ pr: 5 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        {list.name}
                      </Typography>
                      {!list.isOwner && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mb: 0.75 }}
                        >
                          Shared by {list.ownerName}
                        </Typography>
                      )}
                      {list.previewItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Empty list
                        </Typography>
                      ) : (
                        <Stack spacing={0.25}>
                          {list.previewItems.map((item) => (
                            <Typography
                              key={item.id}
                              variant="body2"
                              sx={{
                                textDecoration: item.checked ? "line-through" : "none",
                                opacity: item.checked ? 0.6 : 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.text}
                            </Typography>
                          ))}
                          {list.itemCount > list.previewItems.length && (
                            <Typography variant="caption" color="text.secondary">
                              +{list.itemCount - list.previewItems.length} more
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Container>

      <Fab
        variant="extended"
        color="primary"
        aria-label="New list"
        sx={{ position: "fixed", bottom: 24, right: 24 }}
        onClick={() => {
          setNameInput("");
          setCreateOpen(true);
        }}
      >
        <AddIcon sx={{ mr: 1 }} />
        New list
      </Fab>

      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            navigate("/settings");
          }}
        >
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            void logout();
          }}
        >
          Log out
        </MenuItem>
      </Menu>

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
        {active?.isOwner ? (
          <>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setShareOpen(true);
              }}
            >
              Share
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setDeleteOpen(true);
              }}
            >
              Delete
            </MenuItem>
          </>
        ) : (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setLeaveOpen(true);
            }}
          >
            Leave list
          </MenuItem>
        )}
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

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <DialogTitle>Leave list?</DialogTitle>
        <DialogContent>
          <Typography>
            You will lose access to “{active?.name}” until the owner shares it with you again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setLeaveOpen(false)}>
            Cancel
          </Button>
          <Button color="error" onClick={() => void handleLeave()}>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      <ShareListDialog
        open={shareOpen}
        listId={active?.id ?? null}
        ownerName={active?.ownerName ?? user?.name ?? ""}
        currentUserId={user?.id}
        onClose={() => setShareOpen(false)}
        onError={setError}
      />

      <Snackbar open={Boolean(error)} autoHideDuration={4000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
