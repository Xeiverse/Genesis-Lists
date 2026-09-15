import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { UserDirectoryDto } from "@genesis-lists/shared";
import { api, ApiError } from "./api";

type ShareListDialogProps = {
  open: boolean;
  listId: string | null;
  ownerUsername: string;
  ownerUserId?: string;
  onClose: () => void;
  onError: (message: string) => void;
};

export function ShareListDialog({
  open,
  listId,
  ownerUsername,
  ownerUserId,
  onClose,
  onError,
}: ShareListDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserDirectoryDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string | undefined>(
    ownerUserId,
  );

  useEffect(() => {
    if (!open || !listId) return;

    let cancelled = false;
    setLoading(true);
    setQuery("");

    void (async () => {
      try {
        const [usersRes, membersRes] = await Promise.all([
          api.users(),
          api.listMembers(listId),
        ]);
        if (cancelled) return;
        setUsers(usersRes.users);
        const owner =
          ownerUserId ??
          usersRes.users.find((u) => u.username === ownerUsername)?.id;
        setResolvedOwnerId(owner);
        setSelected(new Set(membersRes.members.map((m) => m.userId)));
      } catch (e) {
        if (!cancelled) {
          onError(e instanceof ApiError ? e.message : "Failed to load users");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally omit onClose/onError — callers pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listId, ownerUsername, ownerUserId]);

  const otherUsers = useMemo(() => {
    return users
      .filter((u) => u.id !== resolvedOwnerId)
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [users, resolvedOwnerId]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return otherUsers;
    return otherUsers.filter((u) => u.username.toLowerCase().includes(q));
  }, [otherUsers, query]);

  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSave() {
    if (!listId) return;
    setSaving(true);
    try {
      await api.setListMembers(listId, [...selected]);
      onClose();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Failed to update sharing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share list</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <>
            <ListItem
              disablePadding
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ width: 36, height: 36, fontSize: "0.875rem" }}>
                  {ownerUsername[0]?.toUpperCase() ?? "?"}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={ownerUsername}
                secondary="Owner"
              />
              <Checkbox edge="end" checked disabled />
            </ListItem>

            <TextField
              size="small"
              fullWidth
              placeholder="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search users"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {filteredUsers.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={2}>
                {otherUsers.length === 0
                  ? "No other users on this instance yet."
                  : "No matching users."}
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 320, overflow: "auto" }}>
                <List dense disablePadding>
                  {filteredUsers.map((u) => {
                    const checked = selected.has(u.id);
                    return (
                      <ListItemButton
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        dense
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{ width: 36, height: 36, fontSize: "0.875rem" }}
                          >
                            {u.username[0]?.toUpperCase() ?? "?"}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={u.username} />
                        <Checkbox
                          edge="end"
                          checked={checked}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleUser(u.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          inputProps={{
                            "aria-label": `Share with ${u.username}`,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
