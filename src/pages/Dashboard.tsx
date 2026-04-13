// DashboardPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/store/AppStore";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  List,
  TrendingUp,
  DollarSign,
  LogOut,
  Gem,
  Users,
  Package,
  Download,
  Settings,
  Bell,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { ChangePinCard } from "@/components/ChangePinCard";

/* ─── Styles ───────────────────────────────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: "relative" as const,
    overflow: "hidden",
  },
  blob1: {
    position: "absolute" as const,
    top: -120,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  blob2: {
    position: "absolute" as const,
    bottom: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  card: {
    background: "white",
    borderRadius: 28,
    boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    position: "relative" as const,
    zIndex: 1,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 32px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.2)",
  },
  appName: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center" as const,
    letterSpacing: "-0.5px",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center" as const,
    marginBottom: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statCard: {
    background: "#f8fafc",
    borderRadius: 16,
    padding: "16px",
    border: "1px solid #e2e8f0",
    textAlign: "center" as const,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  menuGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    marginTop: 24,
  },
  menuItem: {
    background: "#f8fafc",
    borderRadius: 16,
    padding: "20px 16px",
    border: "1px solid #e2e8f0",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.2s",
    textDecoration: "none",
    color: "inherit",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "linear-gradient(135deg,#0f172a,#1e40af)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    color: "white",
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 12,
    color: "#64748b",
  },
};

interface DashboardStats {
  totalSales: number;
  totalDebt: number;
  totalPayments: number;
  todayRevenue: number;
  todayDebt: number;
  totalCustomers: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();
  const { totalSales, totalDebt, totalPayments, todayRevenue, todayDebt, isLoading: transactionsLoading, loadTransactions } = useAppStore();
  const isOwner = profile?.role === "owner";

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalUnpaid = totalDebt;
  const stats: DashboardStats = {
    totalSales,
    totalDebt,
    totalPayments,
    todayRevenue,
    todayDebt,
    totalCustomers,
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCustomerCount = async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });

      if (!error) {
        setTotalCustomers(count ?? 0);
      }
    };

    void loadTransactions();
    void fetchCustomerCount();
  }, [isAuthenticated, loadTransactions]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshDashboard = () => {
      setIsRefreshing(true);
      Promise.all([loadTransactions()])
        .finally(() => setIsRefreshing(false));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshDashboard();
    };

    window.addEventListener("paymentMade", refreshDashboard);
    window.addEventListener("newDebtAdded", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("paymentMade", refreshDashboard);
      window.removeEventListener("newDebtAdded", refreshDashboard);
      window.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, loadTransactions]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const menuItems = [
    { icon: Plus, label: labels.addDebt, path: "/add-debt", bgClass: "bg-gradient-to-br from-primary to-navy-light", description: "Ongeraho umukiriya" },
    { icon: List, label: labels.debtList, path: "/debts", bgClass: "bg-gradient-to-br from-secondary to-gold-light", textDark: true, description: "Reba abakiriya bose" },
    { icon: TrendingUp, label: labels.salesTracking, path: "/sales", bgClass: "bg-gradient-to-br from-navy-light to-primary", description: "Kurikiranira ibigurishwa" },
    { icon: Package, label: labels.inventoryTitle, path: "/inventory", bgClass: "bg-gradient-to-br from-gold-light to-secondary", textDark: true, description: labels.inventorySubtitle },
    { icon: Users, label: "Abakiriya", path: "/clients", bgClass: "bg-gradient-to-br from-emerald-500 to-teal-600", description: "Amakuru y'abakiriya" },
    { icon: Bell, label: "Ubutumwa", path: "/inbox", bgClass: "bg-gradient-to-br from-rose-500 to-orange-500", description: "Ubutumwa bw'amadeni" },
    { icon: Settings, label: "Settings", path: "/settings", bgClass: "bg-gradient-to-br from-slate-600 to-slate-700", description: "Business settings & reset" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background" style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-foreground" style={{ fontSize: '14px', fontWeight: 600 }}>{businessSettings.businessName}</h1>
              <p className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#64748b' }}>
                {labels.welcome}, {profile?.displayName || 'User'}! 📊
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/install")} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors" title="Install App" style={{ fontSize: '12px' }}>
              <Download size={16} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors" style={{ fontSize: '12px' }}>
              <LogOut size={16} /> {labels.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-8 space-y-6 max-w-lg mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {/* Total Unpaid */}
          <div className="glass-card p-4 animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)' }}>
                <DollarSign size={16} className="text-red-600" />
              </div>
              <span className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{labels.totalUnpaid}</span>
            </div>
            <p className="text-lg font-bold text-red-600" style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(stats.totalDebt)}</p>
          </div>

          {/* Total Customers */}
          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                <Users size={16} className="text-primary" style={{ color: '#2563eb' }} />
              </div>
              <span className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{labels.customers}</span>
            </div>
            <p className="text-lg font-bold text-primary" style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>{stats.totalCustomers}</p>
          </div>
        </div>

       {/* TODAY SALES */}
        <div className="glass-card p-4 border-2 border-green-400/30" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '2px solid rgba(34, 197, 94, 0.25)', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Ibyo wacuruje uyu munsi</span>
          </div>
          <p className="text-lg font-bold text-green-600" style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>
            {formatCurrency(stats.todayRevenue)}
          </p>
        </div>

        {/* TODAY DEBT */}
        <div className="glass-card p-4 border-2 border-red-400/20" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '2px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)' }}>
              <DollarSign size={16} className="text-red-600" />
            </div>
            <span className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Ideni ryose watanze uyu munsi</span>
          </div>
          <p className="text-lg font-bold text-red-600" style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
            {formatCurrency(stats.todayDebt)}
          </p>
        </div>

        {/* Total Sales Card */}
        <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(59, 130, 246, 0.1)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] text-muted-foreground" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{labels.totalSales}</span>
          </div>
          <p className="text-lg font-bold text-blue-600" style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(stats.totalSales)}</p>
        </div>

        {/* Profit / Goal Card */}
        <div className="glass-card-dark p-4 animate-fade-in gold-glow col-span-2 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '1px solid rgba(168, 85, 247, 0.3)', boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2)' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 animate-gradient-x" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <p className="text-xs text-primary-foreground/70" style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>Intego Yawe 🎯</p>
              <p className="text-lg font-semibold text-white" style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                {businessSettings.targetCapital && businessSettings.targetCapital > 0
                  ? formatCurrency(businessSettings.targetCapital)
                  : "Set a target in Settings"}
              </p>

              <div className="mt-4">
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px' }}>
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000 ease-out"
                    style={{
                      width: `${businessSettings.targetCapital && businessSettings.targetCapital > 0
                        ? Math.min((stats.totalSales / businessSettings.targetCapital) * 100, 100)
                        : 0
                      }%`,
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-white/70" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  <span>
                    {businessSettings.targetCapital && businessSettings.targetCapital > 0
                      ? `${Math.min((stats.totalSales / businessSettings.targetCapital) * 100, 100).toFixed(1)}%`
                      : "No target"
                    }
                  </span>
                  <span>
                    {businessSettings.targetCapital && businessSettings.targetCapital > 0
                      ? `Hasigaye ${formatCurrency(Math.max(businessSettings.targetCapital - stats.totalSales, 0))}`
                      : "Add goal in Settings"
                    }
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-primary-foreground/50 mt-2" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Connected capital: {formatCurrency(businessSettings.initialCapital)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <Gem size={24} className="text-secondary" style={{ color: '#fbbf24' }} />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {menuItems.map((item, index) => (
            <button key={item.path + index} onClick={() => navigate(item.path)} className={`${item.bgClass} p-4 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-premium active:scale-[0.98] animate-fade-in`} style={{ animationDelay: `${0.3 + index * 0.1}s`, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div className={`w-10 h-10 rounded-xl ${item.textDark ? 'bg-foreground/10' : 'bg-white/20'} flex items-center justify-center mb-3`} style={{ background: item.textDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <item.icon size={20} className={item.textDark ? 'text-foreground' : 'text-white'} />
              </div>
              <h3 className={`text-sm font-semibold mb-1 ${item.textDark ? 'text-foreground' : 'text-white'}`} style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</h3>
              <p className={`text-[10px] ${item.textDark ? 'text-foreground/60' : 'text-white/70'}`} style={{ fontSize: '11px', fontWeight: 400 }}>{item.description}</p>
            </button>
          ))}
        </div>

        {/* Settings & Permissions */}
        <div className="pt-4 space-y-3">
          <ChangePinCard />
          {isOwner ? (
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500 mb-2">Owner control</p>
              <p className="text-sm text-slate-700">
                All factory reset and employee management actions are available from Settings.
                This dashboard only shows your real-time financial summary.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-blue-700">
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]">Umukozi</p>
                  <p className="text-sm">Nta burenganzira bwo gukora factory reset cyangwa guhindura konti.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Modals --- */}
    </div>
  );
};

export default DashboardPage;