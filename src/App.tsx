import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppStoreProvider } from "./store/AppStore";
import { PinVerificationModal } from "./components/PinVerificationModal";
import { Suspense, lazy, type ReactNode } from "react";
import { LanguageProvider } from "./contexts/LanguageContext";

// Lazy loading pages for performance
const AuthPage       = lazy(() => import("./pages/Auth"));
const DashboardPage  = lazy(() => import("./pages/Dashboard"));
const AddDebtPage    = lazy(() => import("./pages/AddDebt"));
const DebtsPage      = lazy(() => import("./pages/Debts"));
const SalesPage      = lazy(() => import("./pages/Sales"));     // NEW POS sales page
const ReportsPage    = lazy(() => import("./pages/Reports"));   // renamed from old Sales page
const InventoryPage  = lazy(() => import("./pages/Inventory"));
const InstallPage    = lazy(() => import("./pages/Install"));
const ClientsPage    = lazy(() => import("./pages/Clients"));
const InboxPage      = lazy(() => import("./pages/Inbox"));
const SettingsPage   = lazy(() => import("./pages/Settings"));
const EmployeesPage  = lazy(() => import("./pages/Employees"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const OwnerRoute     = lazy(() => import("./components/OwnerRoute"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
        </div>
      }
    >
      <Routes>
        {/* Public */}
        <Route path="/"        element={<AuthPage />} />
        <Route path="/install" element={<InstallPage />} />

        {/* Protected — all roles */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-debt"
          element={
            <ProtectedRoute>
              <AddDebtPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/debts"
          element={
            <ProtectedRoute>
              <DebtsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />

        {/* Protected — owner only */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <ReportsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <ClientsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbox"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <InboxPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <SettingsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <EmployeesPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppStoreProvider>
                <Toaster />
                <Sonner position="top-center" richColors closeButton />
                <PinVerificationModal />
                <AppRoutes />
              </AppStoreProvider>
            </AuthProvider>
          </BrowserRouter>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
