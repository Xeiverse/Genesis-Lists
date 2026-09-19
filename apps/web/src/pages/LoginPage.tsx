import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AuthConfigDto } from "@genesis-lists/shared";
import { ApiError, api } from "../api";
import { AppMark } from "../AppMark";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<AuthConfigDto | null>(null);

  const oidcError = searchParams.get("error") === "oidc";
  const autoLaunchParam = searchParams.get("autoLaunch");

  useEffect(() => {
    let cancelled = false;
    api
      .authConfig()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({
            registrationOpen: false,
            passwordLoginEnabled: true,
            oidc: { enabled: false, buttonText: "Login with OAuth", autoLaunch: false, mobileLogin: true },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldAutoLaunch = useMemo(() => {
    if (!config?.oidc.enabled || user) return false;
    if (autoLaunchParam === "0") return false;
    // Failed callback lands on ?error=oidc — do not immediately restart OIDC.
    if (oidcError && autoLaunchParam !== "1") return false;
    if (autoLaunchParam === "1") return true;
    return config.oidc.autoLaunch;
  }, [config, user, autoLaunchParam, oidcError]);

  useEffect(() => {
    if (!shouldAutoLaunch) return;
    window.location.assign("/api/auth/oidc/start");
  }, [shouldAutoLaunch]);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!config || shouldAutoLaunch) {
    return (
      <Container maxWidth="xs" sx={{ py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            {shouldAutoLaunch ? "Redirecting to sign-in…" : "Loading…"}
          </Typography>
        </Stack>
      </Container>
    );
  }

  const showPassword = config.passwordLoginEnabled;
  const showOidc = config.oidc.enabled;
  const showRegister = config.registrationOpen && config.passwordLoginEnabled;

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
          {(error || oidcError) && (
            <Alert severity="error">
              {error ?? "Sign-in with the identity provider failed. Try again."}
            </Alert>
          )}
          {showPassword && (
            <>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
            </>
          )}
          {showPassword && showOidc && <Divider>or</Divider>}
          {showOidc && (
            <Button
              component="a"
              href="/api/auth/oidc/start"
              variant={showPassword ? "outlined" : "contained"}
              fullWidth
            >
              {config.oidc.buttonText}
            </Button>
          )}
          {!showPassword && !showOidc && (
            <Alert severity="warning">
              No sign-in methods are configured on this server.
            </Alert>
          )}
          {showRegister && (
            <Box>
              <Link component={RouterLink} to="/register">
                Create an account
              </Link>
            </Box>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
