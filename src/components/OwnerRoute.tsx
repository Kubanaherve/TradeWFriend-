import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldX } from "lucide-react";

interface OwnerRouteProps {
  children: React.ReactNode;
  /** If true, shows a "no access" page instead of redirecting */
  showDenied?: boolean;
}

/**
 * Wraps a route so only the owner can access it.
 * Employees are redirected to /debts (their main page).
 */
const OwnerRoute = ({ children, showDenied = false }: OwnerRouteProps) => {
  const { isAuthenticated, isOwner, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isOwner) {
    if (showDenied) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-5">
            <ShieldX size={40} className="text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Ntabwo wemerewe</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Ubu buhinga bwemewe gusa na nyir'ubucuruzi. Watumanahaye ubufasha? Baza umuyobozi.
          </p>
          <a href="/debts" className="text-primary text-sm underline">
            Garuka ku madeni
          </a>
        </div>
      );
    }
    return <Navigate to="/debts" replace />;
  }

  return <>{children}</>;
};

export default OwnerRoute;