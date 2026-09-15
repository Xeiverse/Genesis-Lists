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
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canChangePassword = user?.authProviders.includes("local") ?? false;
  const providersLabel =
    user?.authProviders
      .map((p) => (p === "local" ? "password" : "OIDC"))
      .join(", ") ?? "";

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
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2} component="form" onSubmit={(e) => void handleSubmit(e)}>
            <Typography variant="subtitle1" fontWeight={600}>
              Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Signed in as <strong>{user?.username}</strong>
            </Typography>
            {user?.email ? (
              <Typography variant="body2" color="text.secondary">
                Email: {user.email}
              </Typography>
            ) : null}
            {providersLabel ? (
              <Typography variant="body2" color="text.secondary">
                Sign-in methods: {providersLabel}
              </Typography>
            ) : null}

            {canChangePassword ? (
              <>
                <Typography variant="subtitle1" fontWeight={600} pt={1}>
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
    </Box>
  );
}
