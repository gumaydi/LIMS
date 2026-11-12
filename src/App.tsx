import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/RouteGuards";
import { ActivityPage } from "./pages/ActivityPage";
import { BorrowingFormPage } from "./pages/BorrowingFormPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { ItemFormPage } from "./pages/ItemFormPage";
import { LoginPage } from "./pages/LoginPage";
import { ReturnsPage } from "./pages/ReturnsPage";
import { StaffDetailPage } from "./pages/StaffDetailPage";
import { StaffManagementPage } from "./pages/StaffManagementPage";
import { NotFoundPage, UnauthorizedPage } from "./pages/StatusPages";

function ShellRoute({ role }: { role?: "ADMIN" | "STAFF" }) {
  return <ProtectedRoute role={role}><AppShell /></ProtectedRoute>;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ShellRoute />}>
      <Route path="/" element={<Navigate to="/inventory" replace />} />
      <Route path="/admin" element={<ProtectedRoute role="ADMIN"><DashboardPage /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute role="STAFF"><DashboardPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/borrowings/new" element={<BorrowingFormPage />} />
      <Route path="/returns" element={<ReturnsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/inventory/new" element={<ProtectedRoute role="ADMIN"><ItemFormPage /></ProtectedRoute>} />
      <Route path="/inventory/:id/edit" element={<ProtectedRoute role="ADMIN"><ItemFormPage /></ProtectedRoute>} />
      <Route path="/staff-management" element={<ProtectedRoute role="ADMIN"><StaffManagementPage /></ProtectedRoute>} />
      <Route path="/staff-management/:id" element={<ProtectedRoute role="ADMIN"><StaffDetailPage /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute role="ADMIN"><ActivityPage /></ProtectedRoute>} />
    </Route>
    <Route path="/unauthorized" element={<UnauthorizedPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
