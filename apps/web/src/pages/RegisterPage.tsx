import { FormEvent, useEffect, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  type AuthConfigDto,
} from "@genesis-lists/shared";
import { ApiError, api } from "../api";
import { AppMark } from "../AppMark";
import { useAuth } from "../auth";

function emailErrorMessage(value: string): string | null {
  const result = emailSchema.safeParse(value);
  if (result.success) return null;
  const code = result.error.issues[0]?.code;
  if (code === "too_big") {
    return "Email must be at most 254 characters.";
  }
  return "Enter a valid email address.";
}

function nameErrorMessage(value: string): string | null {
  if (value.trim() === "") return null;
  return displayNameSchema.safeParse(value).success
    ? null
    : "Display name must be at most 64 characters.";
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<AuthConfigDto | null>(null);

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
            oidc: { enabled: false, buttonText: "Sign in with OIDC", autoLaunch: false },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const nextEmailError = emailErrorMessage(email);
    const nextNameError = nameErrorMessage(name);
    const nextPasswordError = passwordErrorMessage(password);
    setEmailError(nextEmailError);
    setNameError(nextNameError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextNameError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await register(email, password, name.trim() || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const registrationAllowed =
    config != null && config.registrationOpen && config.passwordLoginEnabled;

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
          {config === null ? (
            <Stack alignItems="center" py={2}>
              <CircularProgress size={28} />
            </Stack>
          ) : registrationAllowed ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Sign in with your email address. Password min 8 characters.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                autoComplete="email"
                required
                fullWidth
                error={Boolean(emailError)}
                helperText={emailError ?? "You will use this to sign in"}
              />
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
                helperText={
                  nameError ??
                  "Optional. What others see when sharing; defaults to the part before the @"
                }
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
            </>
          ) : (
            <Alert severity="info">
              {!config.passwordLoginEnabled
                ? "Password registration is disabled. Sign in with your identity provider instead."
                : "Registration is closed. Ask the person who runs this server to open it if you need an account."}
            </Alert>
          )}
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
