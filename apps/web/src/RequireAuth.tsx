import { Navigate, Outlet } from "react-router-dom";
import { CircularProgress, Stack } from "@mui/material";
import { useAuth } from "./auth";

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="100dvh">
        <CircularProgress />
      </Stack>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
