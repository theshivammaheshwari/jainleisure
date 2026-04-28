import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardStatsProvider } from "@/contexts/DashboardStatsContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import FirmsPage from "@/pages/FirmsPage";
import ClientsPage from "@/pages/ClientsPage";
import LedgerPage from "@/pages/LedgerPage";
import AuditPage from "@/pages/AuditPage";
import BackupPage from "@/pages/BackupPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => (
  <AppLayout requireAdmin={adminOnly}>{children}</AppLayout>
);

const AuthRedirect = () => {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role) return <Navigate to="/" replace />;
  return <LoginPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DashboardStatsProvider>
            <Routes>
              <Route path="/login" element={<AuthRedirect />} />
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/firms" element={<ProtectedRoute><FirmsPage /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
              <Route path="/ledger" element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute adminOnly><AuditPage /></ProtectedRoute>} />
              <Route path="/backup" element={<ProtectedRoute adminOnly><BackupPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardStatsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
