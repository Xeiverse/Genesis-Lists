import { FormEvent, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { passwordSchema, usernameSchema } from "@genesis-lists/shared";
import { ApiError } from "../api";
import { AppMark } from "../AppMark";
import { useAuth } from "../auth";

function usernameErrorMessage(value: string): string | null {
  const result = usernameSchema.safeParse(value);
  if (result.success) return null;
  const code = result.error.issues[0]?.code;
  if (code === "too_small" || code === "too_big") {
    return "Username must be 3–32 characters.";
  }
  return "Username may only contain letters, numbers, underscore, and hyphen.";
}

function passwordErrorMessage(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  if (result.success) return null;
  const code = result.error.issues[0]?.code;
  if (code === "too_big") {
    return "Password must be at most 128 characters.";
  }
  return "Password must be at least 8 characters.";
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const nextUsernameError = usernameErrorMessage(username);
    const nextPasswordError = passwordErrorMessage(password);
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextUsernameError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await register(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
        <Stack spacing={2} component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <AppMark size={56} />
            <Typography variant="subtitle1" component="p">
              Genesis Lists
            </Typography>
          </Stack>
          <Typography variant="h5" component="h1">
            Create account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Username 3–32 chars (letters, numbers, _ -). Password min 8 characters.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(null);
            }}
            autoComplete="username"
            required
            fullWidth
            error={Boolean(usernameError)}
            helperText={usernameError ?? "3–32 characters: letters, numbers, _ and -"}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            autoComplete="new-password"
            required
            fullWidth
            error={Boolean(passwordError)}
            helperText={passwordError ?? "At least 8 characters"}
          />
          <Button type="submit" disabled={submitting} fullWidth>
            Register
          </Button>
          <Box>
            <Link component={RouterLink} to="/login">
              Already have an account?
            </Link>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
