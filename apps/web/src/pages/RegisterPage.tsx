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
import { useAuth } from "../auth";
import { ApiError } from "../api";

export function RegisterPage() {
  const { user, register } = useAuth();
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
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
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
            autoComplete="new-password"
            required
            fullWidth
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
