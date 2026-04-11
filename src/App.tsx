import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PinVerificationModal } from "./components/PinVerificationModal";
import { Suspense, lazy } from "react";

// Lazy loading pages for performance
const AuthPage = lazy(() => import("./pages/Auth"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const AddDebtPage = lazy(() => import("./pages/AddDebt"));
const DebtsPage = lazy(() => import("./pages/Debts"));
const SalesPage = lazy(() => import("./pages/Sales"));
const InventoryPage = lazy(() => import("./pages/Inventory"));
const InstallPage = lazy(() => import("./pages/Install"));
const ClientsPage = lazy(() => import("./pages/Clients"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * FIXED: This now uses 'isLoading' and 'isAuthenticated' 
 * to match your specific AuthContextType.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth(); // Changed from session/loading
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
        <Route path="/" element={<AuthPage />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/add-debt" element={<ProtectedRoute><AddDebtPage /></ProtectedRoute>} />
        <Route path="/debts" element={<ProtectedRoute><DebtsPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        
        {/* Utils */}
        <Route path="/install" element={<InstallPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Toaster />
            <Sonner position="top-center" richColors closeButton />
            <PinVerificationModal />
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;