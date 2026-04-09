// DashboardPage.tsx
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
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
  Save,
  Download,
  Trash2,
  Bell
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

  const [stats, setStats] = useState<DashboardStats>(loadCachedStats);

  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showResetMoneyModal, setShowResetMoneyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  const [capitalInput, setCapitalInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingMoney, setIsResettingMoney] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);

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

  const handleSaveCapital = async () => {
    if (!capitalInput || parseFloat(capitalInput) < 0) {
      toast.error("Andika amafaranga meza");
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", "total_capital")
        .maybeSingle();

      if (existing) {
        await supabase.from("app_settings").update({ setting_value: capitalInput }).eq("setting_key", "total_capital");
      } else {
        await supabase.from("app_settings").insert({ setting_key: "total_capital", setting_value: capitalInput });
      }

      toast.success("Capital yahinduwe neza ✨");
      setShowCapitalModal(false);
      fetchStats();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleFactoryReset = async () => {
    setIsFactoryResetting(true);
    try {
      await supabase.from("sales").delete();
      await supabase.from("app_settings").update({ setting_value: "0" }).in("setting_key", ["total_capital", "total_paid"]);
      toast.success("Database yasubijwe ku ntangiriro, abakiriya, debts n'ibicuruzwa byabitswe ✨");
      setShowFactoryResetModal(false);
      fetchStats();
    } catch (error) {
      console.error("Factory reset error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsFactoryResetting(false);
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
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-foreground">{labels.appName}</h1>
              <p className="text-[10px] text-muted-foreground">
                {labels.welcome}, {profile?.display_name || 'User'}! 💎
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/install")} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors" title="Install App">
              <Download size={16} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} /> {labels.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-8 space-y-6 max-w-lg mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {/* Total Unpaid */}
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><DollarSign size={16} className="text-red-600" /></div>
              <span className="text-[10px] text-muted-foreground">{labels.totalUnpaid}</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalUnpaid)}</p>
          </div>

          {/* Total Customers */}
          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Users size={16} className="text-primary" /></div>
              <span className="text-[10px] text-muted-foreground">{labels.customers}</span>
            </div>
            <p className="text-lg font-bold text-primary">{stats.totalCustomers}</p>
          </div>
        </div>

       {/* TODAY SALES */}
        <div className="glass-card p-4 border-2 border-green-400/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] text-muted-foreground">Ibyo wacuruje uyu munsi</span>
          </div>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(stats.todaySales)}
          </p>
        </div>

        {/* TODAY DEBT */}
        <div className="glass-card p-4 border-2 border-red-400/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <DollarSign size={16} className="text-red-600" />
            </div>
            <span className="text-[10px] text-muted-foreground">Ideni ryose watanze uyu munsi</span>
          </div>
          <p className="text-lg font-bold text-red-600">
            {formatCurrency(stats.todayDebt)}
          </p>
        </div>

        {/* Total Sales Card */}
        <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><TrendingUp size={16} className="text-blue-600" /></div>
            <span className="text-[10px] text-muted-foreground">{labels.totalSales}</span>
          </div>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalSales)}</p>
        </div>

        {/* Profit / Goal Card */}
        <div className="glass-card-dark p-4 animate-fade-in gold-glow col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 animate-gradient-x" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-primary-foreground/70">Intego Yawe 💎</p>
              <p className="text-lg font-semibold text-white">RWF 15,930,050</p>
              <div className="mt-3">
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min((stats.totalSales / 15930050) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-white/70">
                  <span>{((stats.totalSales / 15930050) * 100).toFixed(1)}%</span>
                  <span>Hasigaye {formatCurrency(Math.max(15930050 - stats.totalSales, 0))}</span>
                </div>
              </div>
              <p className="text-[10px] text-primary-foreground/50 mt-2">
                Umaze kugeraho: {formatCurrency(stats.totalSales)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center animate-pulse">
              <Gem size={24} className="text-secondary" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {menuItems.map((item, index) => (
            <button key={item.path + index} onClick={() => navigate(item.path)} className={`${item.bgClass} p-4 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-premium active:scale-[0.98] animate-fade-in`} style={{ animationDelay: `${0.3 + index * 0.1}s` }}>
              <div className={`w-10 h-10 rounded-xl ${item.textDark ? 'bg-foreground/10' : 'bg-white/20'} flex items-center justify-center mb-3`}>
                <item.icon size={20} className={item.textDark ? 'text-foreground' : 'text-white'} />
              </div>
              <h3 className={`text-sm font-semibold mb-1 ${item.textDark ? 'text-foreground' : 'text-white'}`}>{item.label}</h3>
              <p className={`text-[10px] ${item.textDark ? 'text-foreground/60' : 'text-white/70'}`}>{item.description}</p>
            </button>
          ))}
        </div>

        {/* Settings Section */}
        <div className="pt-4 space-y-3">
          <ChangePinCard />

          <Button onClick={() => setShowResetMoneyModal(true)} variant="outline" className="w-full border-warning/50 text-warning hover:bg-warning/10">
            <DollarSign size={16} className="mr-2" /> Siba amafaranga yinjijwe (Reset Money)
          </Button>

          <Button onClick={() => setShowResetModal(true)} variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
            <Trash2 size={16} className="mr-2" /> {labels.resetAll} (Restock)
          </Button>

          {/* Neon Acknowledgment */}
          <div className="mt-6 flex justify-center">
            <div className="glass-card-neon p-3 px-4 rounded-xl text-center">
              <p className="neon-text-dark font-bold text-sm md:text-base animate-neon-flicker">
                Iyi app yakozwe na Friend Herve KUBANA
              </p>
            </div>
          </div> 
        </div>
      </main>

      {/* --- Modals --- */}
      {/* Capital Modal */}
      <Dialog open={showCapitalModal} onOpenChange={setShowCapitalModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Hindura Capital</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Amafaranga yose waguzemo bijoux (Total Capital)</label>
              <Input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)} placeholder="0" className="bg-muted/50 input-glow text-lg" inputMode="numeric" autoFocus />
              <p className="text-[10px] text-muted-foreground mt-1.5">Andika amafaranga yose waguze isaha, bijoux, n'ibindi byose ugurisha</p>
            </div>

            {capitalInput && (
              <div className="glass-card p-3 bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Capital:</span>
                  <span className="font-medium">{formatCurrency(parseFloat(capitalInput || "0"))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{labels.totalSales}:</span>
                  <span className="font-medium">{formatCurrency(stats.totalSales)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className="font-medium">{formatCurrency(stats.totalSales - parseFloat(capitalInput || "0"))}</span>
                </div>
              </div>
            )}

            <Button onClick={handleSaveCapital} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : <><Save size={16} className="mr-2" /> Save</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Factory Reset Modal */}
      <Dialog open={showFactoryResetModal} onOpenChange={setShowFactoryResetModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base">Factory Reset</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">Ibi bizasiba byose muri database, ushobora gutangira ukundi</p>
          <div className="flex gap-2">
            <Button onClick={handleFactoryReset} disabled={isFactoryResetting} variant="destructive" className="flex-1">{isFactoryResetting ? "Processing..." : "Yes, reset"}</Button>
            <Button onClick={() => setShowFactoryResetModal(false)} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;