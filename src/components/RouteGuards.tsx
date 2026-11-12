import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Role } from "../types";
import { LoadingIndicator } from "./LoadingIndicator";

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: Role }) {
  const { loading, profile } = useAuth();
  const location = useLocation();
  if (loading) return <main className="center-screen"><LoadingIndicator label="Memulihkan sesi..." /></main>;
  if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && profile.role !== role) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
