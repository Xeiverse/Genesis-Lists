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
import { ApiError } from "../api";
import { AppMark } from "../AppMark";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <AppMark size={56} />
            <Typography variant="subtitle1" component="p">
              Genesis Lists
            </Typography>
          </Stack>
          <Typography variant="h5" component="h1">
            Sign in
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
          />
          <Button type="submit" disabled={submitting} fullWidth>
            Sign in
          </Button>
          <Box>
            <Link component={RouterLink} to="/register">
              Create an account
            </Link>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
