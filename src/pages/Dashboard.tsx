import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/layout/AppShell";
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
import logo from "@/assets/logo.png";
import { ChangePinCard } from "@/components/ChangePinCard";
import { formatCurrency } from "@/lib/kinyarwanda";

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
  const { profile, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();
  const { t } = useI18n();

  const isOwner = profile?.role === "owner";

  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalDebt: 0,
    totalPayments: 0,
    todayRevenue: 0,
    todayDebt: 0,
    totalCustomers: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayDateKey = useMemo(() => new Date().toISOString().split("T")[0], []);

  const fetchDashboardStats = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoadingStats(true);

    try {
      const [salesResponse, customersResponse, debtItemsResponse, debtPaymentsResponse] =
        await Promise.all([
          (supabase as any).from("sales").select("sale_price, quantity, created_at"),
          (supabase as any).from("customers").select("id"),
          (supabase as any).from("debt_items").select("total_price, date_taken"),
          (supabase as any).from("debt_payments").select("amount_paid, paid_at"),
        ]);

      if (salesResponse.error) throw salesResponse.error;
      if (customersResponse.error) throw customersResponse.error;
      if (debtItemsResponse.error) throw debtItemsResponse.error;
      if (debtPaymentsResponse.error) throw debtPaymentsResponse.error;

      const sales = (salesResponse.data ?? []) as Array<{
        sale_price: number;
        quantity: number;
        created_at: string;
      }>;

      const customers = (customersResponse.data ?? []) as Array<{ id: string }>;

      const debtItems = (debtItemsResponse.data ?? []) as Array<{
        total_price: number;
        date_taken: string;
      }>;

      const debtPayments = (debtPaymentsResponse.data ?? []) as Array<{
        amount_paid: number;
        paid_at: string;
      }>;

      const totalSales = sales.reduce(
        (sum, sale) => sum + (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0),
        0
      );

      const todayRevenue = sales
        .filter((sale) => sale.created_at?.startsWith(todayDateKey))
        .reduce(
          (sum, sale) => sum + (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0),
          0
        );

      const totalDebtGiven = debtItems.reduce(
        (sum, item) => sum + (Number(item.total_price) || 0),
        0
      );

      const todayDebt = debtItems
        .filter((item) => item.date_taken?.startsWith(todayDateKey))
        .reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

      const totalPayments = debtPayments.reduce(
        (sum, payment) => sum + (Number(payment.amount_paid) || 0),
        0
      );

      const totalDebt = Math.max(totalDebtGiven - totalPayments, 0);

      setStats({
        totalSales,
        totalDebt,
        totalPayments,
        todayRevenue,
        todayDebt,
        totalCustomers: customers.length,
      });
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [isAuthenticated, todayDateKey]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    void fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshDashboard = () => {
      setIsRefreshing(true);
      fetchDashboardStats().finally(() => setIsRefreshing(false));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDashboard();
      }
    };

    window.addEventListener("paymentMade", refreshDashboard);
    window.addEventListener("newDebtAdded", refreshDashboard);
    window.addEventListener("debtDeleted", refreshDashboard);
    window.addEventListener("clientDeleted", refreshDashboard);
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("paymentMade", refreshDashboard);
      window.removeEventListener("newDebtAdded", refreshDashboard);
      window.removeEventListener("debtDeleted", refreshDashboard);
      window.removeEventListener("clientDeleted", refreshDashboard);
      window.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, fetchDashboardStats]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const menuItems = [
    {
      icon: Plus,
      label: t("navigation.addDebt"),
      path: "/add-debt",
      bgClass: "from-primary to-navy-light",
      textClass: "text-white",
      description: t("navigation.addDebt"),
    },
    {
      icon: List,
      label: t("navigation.debtList"),
      path: "/debts",
      bgClass: "from-secondary to-gold-light",
      textClass: "text-slate-900",
      description: t("debts.title"),
    },
    {
      icon: TrendingUp,
      label: t("navigation.salesTracking"),
      path: "/sales",
      bgClass: "from-navy-light to-primary",
      textClass: "text-white",
      description: t("sales.title"),
    },
    {
      icon: Package,
      label: t("navigation.inventory"),
      path: "/inventory",
      bgClass: "from-gold-light to-secondary",
      textClass: "text-slate-900",
      description: t("inventory.subtitle"),
    },
    {
      icon: Users,
      label: t("navigation.customers"),
      path: "/clients",
      bgClass: "from-emerald-500 to-teal-600",
      textClass: "text-white",
      description: t("clients.subtitle"),
    },
    {
      icon: Bell,
      label: t("navigation.messages"),
      path: "/inbox",
      bgClass: "from-rose-500 to-orange-500",
      textClass: "text-white",
      description: t("notifications.debtMessages"),
    },
    {
      icon: Settings,
      label: t("navigation.settings"),
      path: "/settings",
      bgClass: "from-slate-600 to-slate-700",
      textClass: "text-white",
      description: t("settings.subtitle"),
    },
  ];

  const progress =
    businessSettings.targetCapital && businessSettings.targetCapital > 0
      ? Math.min((stats.totalSales / businessSettings.targetCapital) * 100, 100)
      : 0;

  return (
    <AppShell
      title={businessSettings.businessName || t("common.appName")}
      subtitle={`${t("dashboard.welcome")}, ${profile?.displayName || "User"}! 📊`}
      showBack={false}
      showHome={false}
      contentClassName="pt-2 md:pt-3"
      headerRight={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/install")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
            title={t("dashboard.installApp")}
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
            title={t("dashboard.logout")}
          >
            <LogOut size={16} />
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex justify-center pb-1">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <img src={logo} alt={t("common.appName")} className="h-10 w-10 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {businessSettings.businessName || t("common.appName")}
              </p>
              <p className="truncate text-xs text-slate-500">
                {isOwner ? t("dashboard.ownerControl") : t("dashboard.employeeAccess")}
              </p>
            </div>
          </div>
        </div>

        {loadingStats ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-red-100">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                    <DollarSign size={16} className="text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {t("dashboard.totalUnpaid")}
                  </span>
                </div>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(stats.totalDebt)}
                </p>
              </div>

              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Users size={16} className="text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {t("dashboard.totalCustomers")}
                  </span>
                </div>
                <p className="text-xl font-bold text-blue-600">{stats.totalCustomers}</p>
              </div>

              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-green-100">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50">
                    <TrendingUp size={16} className="text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {t("dashboard.todaySales")}
                  </span>
                </div>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(stats.todayRevenue)}
                </p>
              </div>

              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
                    <DollarSign size={16} className="text-rose-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {t("dashboard.todayDebt")}
                  </span>
                </div>
                <p className="text-xl font-bold text-rose-600">
                  {formatCurrency(stats.todayDebt)}
                </p>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-blue-100">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                  <TrendingUp size={16} className="text-blue-600" />
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {t("dashboard.totalSales")}
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.totalSales)}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-5 text-white shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-indigo-500/15" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-white/80">
                    {t("dashboard.target")} 🎯
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {businessSettings.targetCapital && businessSettings.targetCapital > 0
                      ? formatCurrency(businessSettings.targetCapital)
                      : t("dashboard.setTargetInSettings")}
                  </p>

                  <div className="mt-4">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-col gap-1 text-xs text-white/75 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {businessSettings.targetCapital && businessSettings.targetCapital > 0
                          ? `${progress.toFixed(1)}%`
                          : t("dashboard.setTargetInSettings")}
                      </span>
                      <span>
                        {businessSettings.targetCapital && businessSettings.targetCapital > 0
                          ? `${t("dashboard.remaining")} ${formatCurrency(
                              Math.max(businessSettings.targetCapital - stats.totalSales, 0)
                            )}`
                          : t("dashboard.addGoalInSettings")}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-white/60">
                    {t("dashboard.connectedCapital")}:{" "}
                    {formatCurrency(businessSettings.initialCapital)}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                  <Gem size={24} className="text-amber-300" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {menuItems.map((item, index) => (
                <button
                  key={item.path + index}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`rounded-[24px] bg-gradient-to-br ${item.bgClass} p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]`}
                  style={{
                    boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                      item.textClass === "text-white" ? "bg-white/20" : "bg-slate-900/10"
                    }`}
                  >
                    <item.icon size={20} className={item.textClass} />
                  </div>

                  <h3 className={`mb-1 text-sm font-semibold ${item.textClass}`}>
                    {item.label}
                  </h3>

                  <p
                    className={`text-[11px] ${
                      item.textClass === "text-white" ? "text-white/75" : "text-slate-700/70"
                    }`}
                  >
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-1">
              <ChangePinCard />

              {isOwner ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {t("dashboard.ownerControl")}
                  </p>
                  <p className="text-sm text-slate-700">{t("dashboard.ownerControlText")}</p>
                </div>
              ) : (
                <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-4 text-blue-700">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={18} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]">
                        {t("dashboard.employeeAccess")}
                      </p>
                      <p className="text-sm">{t("dashboard.employeeNotice")}</p>
                    </div>
                  </div>
                </div>
              )}

              {isRefreshing && (
                <p className="text-center text-xs text-slate-500">{t("common.loading")}</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default DashboardPage;