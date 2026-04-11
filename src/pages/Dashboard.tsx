// DashboardPage.tsx
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import {
  DAILY_CUSTOMER_PAYMENTS_PREFIX,
  DAILY_NEW_DEBT_PREFIX, // Ongeraho iyi kugira ngo dufate ideni rishya neza
  getDateKeyFromIso,
} from "@/lib/reporting";
import {
  buildDebtAlerts,
  notifyDebtAlerts,
  notifyIfInactiveForTenHours,
  recordAppActivity,
  type DebtAlertCustomer,
} from "@/lib/debtAlerts";
import { useAuth } from "@/contexts/AuthContext";
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
  Trash2,
  Settings,
  Bell,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  totalUnpaid: number;
  totalCustomers: number;
  totalSales: number;
  todaySales: number;
  todayDebt: number;
}

// 🚀 PRO CACHE MEMORY: Yerekana imibare ako kanya 
const loadCachedStats = (): DashboardStats => {
  const cached = localStorage.getItem("dashboard_stats_cache");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Cache parsing error", e);
    }
  }
  return { totalUnpaid: 0, totalCustomers: 0, totalSales: 0, todaySales: 0, todayDebt: 0 };
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();
  const isOwner = profile?.role === 'owner';

  const [stats, setStats] = useState<DashboardStats>(loadCachedStats);

  const [showResetMoneyModal, setShowResetMoneyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResettingMoney, setIsResettingMoney] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 🚀 Logic ihuje neza n'iya ReportsPage.tsx kugira imibare ibe kimwe 100%
  const fetchStats = useCallback(async () => {
    try {
      const todayKey = getDateKeyFromIso(new Date().toISOString());

      const [
        { data: salesData, error: salesError },
        { data: customers, error: customersError },
        { data: settingsData, error: settingsError },
      ] = await Promise.all([
        supabase.from("sales").select("sale_price, quantity, created_at"),
        supabase.from("customers").select("id, name, phone, amount, is_paid, created_at, due_date"),
        supabase.from("app_settings").select("setting_key, setting_value"),
      ]);

      if (salesError) throw salesError;
      if (customersError) throw customersError;
      if (settingsError) throw settingsError;

      // 1. Ubucuruzi (Sales Table)
      let salesTotalAllTime = 0;
      let salesTodayOnly = 0;

      (salesData || []).forEach((sale) => {
        const saleAmount = (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0);
        salesTotalAllTime += saleAmount;
        if (getDateKeyFromIso(sale.created_at) === todayKey) {
          salesTodayOnly += saleAmount;
        }
      });

      // 2. Abakiriya (Customers Table)
      const totalUnpaid = (customers || []).reduce((sum, customer) => {
        return customer.is_paid ? sum : sum + Number(customer.amount || 0);
      }, 0);
      const totalCustomers = (customers || []).length;

      // 3. Settings (Total Paid, Debts Paid Today, New Debt Today)
      const settingsMap = (settingsData || []).reduce<Record<string, number>>(
        (acc, row) => {
          acc[row.setting_key] = Number(row.setting_value) || 0;
          return acc;
        },
        {}
      );

      const totalPaidAllTime = settingsMap["total_paid"] || 0;
      const debtsPaidToday = settingsMap[`${DAILY_CUSTOMER_PAYMENTS_PREFIX}${todayKey}`] || 0;
      
      // 🚀 Efficient & accurate: calculate today's debt directly from database
      let newDebtToday = 0;

      (customers || []).forEach((customer) => {
        if (
          !customer.is_paid &&
          getDateKeyFromIso(customer.created_at) === todayKey
        ) {
          newDebtToday += Number(customer.amount || 0);
        }
      });

      // 4. Kuvanga imibare
      const newStats = {
        totalUnpaid,
        totalCustomers,
        totalSales: salesTotalAllTime + totalPaidAllTime,
        todaySales: salesTodayOnly + debtsPaidToday, // Ibyo wacuruje + Ideni ryishyuwe uyu munsi
        todayDebt: newDebtToday, // Ideni watanze uyu munsi
      };

      // 🚀 Save state and Update Cache Instantly
      setStats(newStats);
      localStorage.setItem("dashboard_stats_cache", JSON.stringify(newStats));

      await notifyDebtAlerts(buildDebtAlerts((customers || []) as DebtAlertCustomer[]));
    } catch (error) {
      console.error("Fetch stats error:", error);
    }
  }, []);

  // Handle Authentication and Mount
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
      return;
    }
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated, authLoading, navigate, fetchStats, location.pathname]);

  // 🚀 Auto-Reload Events: Iyi code ituma ihita yi-reloada ugiye mu yindi page ukagaruka cyangwa ukoze action
  useEffect(() => {
    if (!isAuthenticated) return;

    notifyIfInactiveForTenHours();
    recordAppActivity();

    const handleAutoRefresh = () => {
      recordAppActivity();
      fetchStats(); 
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleAutoRefresh();
      }
    };

    // Buri gihe hishyuwe cyangwa ideni rishyizwemo, hitamo kuvugurura imibare ako kanya
    window.addEventListener("paymentMade", handleAutoRefresh);
    window.addEventListener("newDebtAdded", handleAutoRefresh);
    window.addEventListener("focus", handleAutoRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("paymentMade", handleAutoRefresh);
      window.removeEventListener("newDebtAdded", handleAutoRefresh);
      window.removeEventListener("focus", handleAutoRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, fetchStats]);


  const handleResetMoney = async () => {
    setIsResettingMoney(true);
    try {
      await supabase.from("app_settings").update({ setting_value: "0" }).eq("setting_key", "total_capital");
      await supabase.from("app_settings").update({ setting_value: "0" }).eq("setting_key", "total_paid");
      toast.success("Amafaranga yose yinjijwe yasubijwe kuri 0 ✨");
      setShowResetMoneyModal(false);
      fetchStats();
    } catch (error) {
      console.error("Reset money error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsResettingMoney(false);
    }
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      await supabase.from("sales").delete();
      await supabase.from("app_settings").update({ setting_value: "0" }).in("setting_key", ["total_capital", "total_paid"]);
      await supabase.from("customers").update({ is_paid: false, paid_at: null }).eq("is_paid", true);
      toast.success(labels.resetSuccess + " ✨");
      setShowResetModal(false);
      fetchStats();
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsResetting(false);
    }
  };

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
                {labels.welcome}, {profile?.display_name || 'User'}! 📊
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
            <p className="text-lg font-bold text-red-600" style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(stats.totalUnpaid)}</p>
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
            {formatCurrency(stats.todaySales)}
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

        {/* Settings Section */}
        {isOwner ? (
          <div className="pt-4 space-y-3">
            <ChangePinCard />
            <Button onClick={() => setShowResetMoneyModal(true)} variant="outline" className="w-full border-warning/50 text-warning">
              <DollarSign size={16} className="mr-2" /> Siba amafaranga (Owner Only)
            </Button>
            <Button onClick={() => setShowResetModal(true)} variant="outline" className="w-full border-destructive/50 text-destructive">
              <Trash2 size={16} className="mr-2" /> {labels.resetAll} (Owner Only)
            </Button>

            {/* Neon Acknowledgment */}
            <div className="mt-6 flex justify-center">
              <div className="glass-card-neon p-3 px-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(168, 85, 247, 0.3)', boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2)' }}>
                <p className="neon-text-dark font-bold text-sm md:text-base animate-neon-flicker" style={{ fontSize: '14px', fontWeight: 700, color: '#e879f9', textShadow: '0 0 10px rgba(232, 121, 249, 0.5)' }}>
                  Iyi app yakozwe na Friend Herve KUBANA
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3 text-blue-700">
            <ShieldAlert size={20} />
            <p className="text-xs font-medium">Uruhare rwawe ni 'Umukozi'. Uburenganzira bwo gusiba bufunitse.</p>
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      {/* Reset Money Modal */}
      <Dialog open={showResetMoneyModal} onOpenChange={setShowResetMoneyModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base">Siba amafaranga yinjijwe</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">Ibi bizasiba amafaranga yose yinjijwe (capital na total paid)</p>
          <div className="flex gap-2">
            <Button onClick={handleResetMoney} disabled={isResettingMoney} variant="destructive" className="flex-1">{isResettingMoney ? "Processing..." : "Yes, reset"}</Button>
            <Button onClick={() => setShowResetMoneyModal(false)} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset All Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base">{labels.resetAll}</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">Ibi bizasiba ibicuruzwa byose, abakiriya, debts n'amafaranga yinjijwe</p>
          <div className="flex gap-2">
            <Button onClick={handleResetAll} disabled={isResetting} variant="destructive" className="flex-1">{isResetting ? "Processing..." : "Yes, reset"}</Button>
            <Button onClick={() => setShowResetModal(false)} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DashboardPage;