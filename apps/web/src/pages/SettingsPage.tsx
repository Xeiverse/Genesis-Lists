import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  DISPLAY_NAME_UNSAFE_CHARS_MESSAGE,
  displayNameSchema,
  type ApiTokenDto,
} from "@genesis-lists/shared";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tokens, setTokens] = useState<ApiTokenDto[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokenName, setTokenName] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenCreating, setTokenCreating] = useState(false);
  const [newTokenPlaintext, setNewTokenPlaintext] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const canChangePassword = user?.authProviders.includes("local") ?? false;
  const providersLabel =
    user?.authProviders
      .map((p) => (p === "local" ? "password" : "OIDC"))
      .join(", ") ?? "";
  const nameChanged = name.trim() !== (user?.name ?? "");

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const res = await api.tokens();
      setTokens(res.tokens);
    } catch {
      setTokenError("Failed to load API tokens");
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError(null);

    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(
        parsed.error.issues[0]?.code === "custom"
          ? DISPLAY_NAME_UNSAFE_CHARS_MESSAGE
          : "Display name must be 1–64 characters.",
      );
      return;
    }

    setNameSaving(true);
    try {
      await updateProfile(parsed.data);
      setName(parsed.data);
      setToast("Display name updated.");
    } catch (err) {
      setNameError(
        err instanceof ApiError ? err.message : "Failed to update display name",
      );
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateToken(e: FormEvent) {
    e.preventDefault();
    setTokenError(null);
    setNewTokenPlaintext(null);

    const trimmed = tokenName.trim();
    if (!trimmed) {
      setTokenError("Give this token a name.");
      return;
    }

    setTokenCreating(true);
    try {
      const created = await api.createToken(trimmed);
      setTokenName("");
      setNewTokenPlaintext(created.token);
      setTokens((prev) => [
        {
          id: created.id,
          name: created.name,
          createdAt: created.createdAt,
          lastUsedAt: created.lastUsedAt,
        },
        ...prev,
      ]);
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Failed to create token");
    } finally {
      setTokenCreating(false);
    }
  }

  async function handleRevokeToken(id: string) {
    setTokenError(null);
    setRevokingId(id);
    try {
      await api.deleteToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setToast("Token revoked.");
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Failed to revoke token");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyToken() {
    if (!newTokenPlaintext) return;
    try {
      await navigator.clipboard.writeText(newTokenPlaintext);
      setToast("Token copied to clipboard.");
    } catch {
      setToast("Copy failed — select the token and copy manually.");
    }
  }

  function formatWhen(iso: string | null) {
    if (!iso) return "Never";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/")} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Settings
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper sx={{ p: 3, mb: 2 }}>
          <Stack spacing={2} component="form" onSubmit={(e) => void handleNameSubmit(e)}>
            <Typography variant="subtitle1" fontWeight={600}>
              Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Signed in as <strong>{user?.email}</strong>
            </Typography>
            {providersLabel ? (
              <Typography variant="body2" color="text.secondary">
                Sign-in methods: {providersLabel}
              </Typography>
            ) : null}

            <TextField
              label="Display name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              autoComplete="name"
              fullWidth
              error={Boolean(nameError)}
              helperText={nameError ?? "The name other people see when you share a list"}
            />
            <Box>
              <Button type="submit" disabled={nameSaving || !nameChanged}>
                Save name
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3, mb: 2 }}>
          <Stack spacing={2} component="form" onSubmit={(e) => void handleCreateToken(e)}>
            <Typography variant="subtitle1" fontWeight={600}>
              API tokens
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Personal access tokens authenticate scripts and voice assistants with{" "}
              <code>Authorization: Bearer</code> on list and item APIs. The secret is shown
              once when you create a token.
            </Typography>

            {tokenError && (
              <Alert severity="error" onClose={() => setTokenError(null)}>
                {tokenError}
              </Alert>
            )}

            {newTokenPlaintext && (
              <Alert
                severity="warning"
                action={
                  <IconButton
                    color="inherit"
                    size="small"
                    aria-label="copy token"
                    onClick={() => void copyToken()}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                }
              >
                Copy this token now — it will not be shown again:
                <Box
                  component="code"
                  sx={{
                    display: "block",
                    mt: 1,
                    wordBreak: "break-all",
                    fontSize: "0.85rem",
                  }}
                >
                  {newTokenPlaintext}
                </Box>
              </Alert>
            )}

            <TextField
              label="Token name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Genesis voice"
              fullWidth
              helperText="A label so you can tell tokens apart later"
            />
            <Box>
              <Button type="submit" disabled={tokenCreating || !tokenName.trim()}>
                Create token
              </Button>
            </Box>

            {tokensLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading tokens…
              </Typography>
            ) : tokens.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No tokens yet.
              </Typography>
            ) : (
              <List dense disablePadding>
                {tokens.map((t) => (
                  <ListItem
                    key={t.id}
                    disableGutters
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label={`revoke ${t.name}`}
                        disabled={revokingId === t.id}
                        onClick={() => void handleRevokeToken(t.id)}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={t.name}
                      secondary={`Created ${formatWhen(t.createdAt)} · Last used ${formatWhen(t.lastUsedAt)}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2} component="form" onSubmit={(e) => void handleSubmit(e)}>
            {canChangePassword ? (
              <>
                <Typography variant="subtitle1" fontWeight={600}>
                  Change password
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  New password must be at least 8 characters.
                </Typography>

                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <TextField
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" disabled={submitting || !currentPassword || !newPassword}>
                  Update password
                </Button>
              </>
            ) : (
              <Alert severity="info">
                This account signs in with an identity provider. Password change is not available.
              </Alert>
            )}
          </Stack>
        </Paper>
      </Container>

      <Snackbar open={success} autoHideDuration={4000} onClose={() => setSuccess(false)}>
        <Alert severity="success" onClose={() => setSuccess(false)}>
          Password updated. Other sessions were signed out.
        </Alert>
      </Snackbar>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
      >
        <Alert severity="success" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
