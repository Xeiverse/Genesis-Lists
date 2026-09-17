import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  DISPLAY_NAME_UNSAFE_CHARS_MESSAGE,
  displayNameSchema,
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

  const canChangePassword = user?.authProviders.includes("local") ?? false;
  const providersLabel =
    user?.authProviders
      .map((p) => (p === "local" ? "password" : "OIDC"))
      .join(", ") ?? "";
  const nameChanged = name.trim() !== (user?.name ?? "");

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
