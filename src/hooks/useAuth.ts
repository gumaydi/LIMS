import { useContext } from "react";
import { AuthStateContext, type AuthState } from "../auth/auth-state";

export function useAuth(): AuthState {
  const context = useContext(AuthStateContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return context;
}
