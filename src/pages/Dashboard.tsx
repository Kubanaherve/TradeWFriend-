import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
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
      bgClass: "bg-gradient-to-br from-primary to-navy-light",
      description: t("navigation.addDebt"),
    },
    {
      icon: List,
      label: t("navigation.debtList"),
      path: "/debts",
      bgClass: "bg-gradient-to-br from-secondary to-gold-light",
      textDark: true,
      description: t("debts.title"),
    },
    {
      icon: TrendingUp,
      label: t("navigation.salesTracking"),
      path: "/sales",
      bgClass: "bg-gradient-to-br from-navy-light to-primary",
      description: t("sales.title"),
    },
    {
      icon: Package,
      label: t("navigation.inventory"),
      path: "/inventory",
      bgClass: "bg-gradient-to-br from-gold-light to-secondary",
      textDark: true,
      description: t("inventory.subtitle"),
    },
    {
      icon: Users,
      label: t("navigation.customers"),
      path: "/clients",
      bgClass: "bg-gradient-to-br from-emerald-500 to-teal-600",
      description: t("clients.subtitle"),
    },
    {
      icon: Bell,
      label: t("navigation.messages"),
      path: "/inbox",
      bgClass: "bg-gradient-to-br from-rose-500 to-orange-500",
      description: t("notifications.debtMessages"),
    },
    {
      icon: Settings,
      label: t("navigation.settings"),
      path: "/settings",
      bgClass: "bg-gradient-to-br from-slate-600 to-slate-700",
      description: t("settings.subtitle"),
    },
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-muted to-background"
      style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
    >
      <header className="glass-card sticky top-0 z-50 rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt={t("common.appName")} className="h-10 w-10 object-contain" />
            <div className="min-w-0">
              <h1
                className="truncate text-sm font-bold text-foreground"
                style={{ fontSize: "14px", fontWeight: 600 }}
              >
                {businessSettings.businessName || t("common.appName")}
              </h1>
              <p
                className="truncate text-[10px] text-muted-foreground"
                style={{ fontSize: "11px", color: "#64748b" }}
              >
                {t("dashboard.welcome")}, {profile?.displayName || "User"}! 📊
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/install")}
              className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
              title={t("dashboard.installApp")}
              style={{ fontSize: "12px" }}
            >
              <Download size={16} />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
              style={{ fontSize: "12px" }}
            >
              <LogOut size={16} /> {t("dashboard.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-4 pb-8">
        {loadingStats ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="glass-card animate-fade-in p-4"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(239,68,68,0.1)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50"
                    style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)" }}
                  >
                    <DollarSign size={16} className="text-red-600" />
                  </div>
                  <span
                    className="text-[10px] text-muted-foreground"
                    style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
                  >
                    {t("dashboard.totalUnpaid")}
                  </span>
                </div>
                <p
                  className="text-lg font-bold text-red-600"
                  style={{ fontSize: "18px", fontWeight: 700 }}
                >
                  {formatCurrency(stats.totalDebt)}
                </p>
              </div>

              <div
                className="glass-card animate-fade-in p-4"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(37,99,235,0.1)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)" }}
                  >
                    <Users size={16} className="text-primary" style={{ color: "#2563eb" }} />
                  </div>
                  <span
                    className="text-[10px] text-muted-foreground"
                    style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
                  >
                    {t("dashboard.totalCustomers")}
                  </span>
                </div>
                <p
                  className="text-lg font-bold text-primary"
                  style={{ fontSize: "18px", fontWeight: 700, color: "#2563eb" }}
                >
                  {stats.totalCustomers}
                </p>
              </div>
            </div>

            <div
              className="glass-card p-4"
              style={{
                background: "rgba(255,255,255,0.95)",
                border: "2px solid rgba(34,197,94,0.25)",
                boxShadow: "0 4px 12px rgba(34,197,94,0.1)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
                >
                  <TrendingUp size={16} className="text-green-600" />
                </div>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
                >
                  {t("dashboard.todaySales")}
                </span>
              </div>
              <p
                className="text-lg font-bold text-green-600"
                style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a" }}
              >
                {formatCurrency(stats.todayRevenue)}
              </p>
            </div>

            <div
              className="glass-card p-4"
              style={{
                background: "rgba(255,255,255,0.95)",
                border: "2px solid rgba(239,68,68,0.2)",
                boxShadow: "0 4px 12px rgba(239,68,68,0.1)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)" }}
                >
                  <DollarSign size={16} className="text-red-600" />
                </div>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
                >
                  {t("dashboard.todayDebt")}
                </span>
              </div>
              <p
                className="text-lg font-bold text-red-600"
                style={{ fontSize: "18px", fontWeight: 700, color: "#dc2626" }}
              >
                {formatCurrency(stats.todayDebt)}
              </p>
            </div>

            <div
              className="glass-card animate-fade-in p-4"
              style={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid rgba(59,130,246,0.1)",
                boxShadow: "0 4px 12px rgba(59,130,246,0.08)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)" }}
                >
                  <TrendingUp size={16} className="text-blue-600" />
                </div>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}
                >
                  {t("dashboard.totalSales")}
                </span>
              </div>
              <p
                className="text-lg font-bold text-blue-600"
                style={{ fontSize: "18px", fontWeight: 700, color: "#2563eb" }}
              >
                {formatCurrency(stats.totalSales)}
              </p>
            </div>

            <div
              className="gold-glow relative col-span-2 overflow-hidden rounded-3xl p-4 animate-fade-in"
              style={{
                background: "linear-gradient(135deg,#1e1b4b,#312e81)",
                border: "1px solid rgba(168,85,247,0.3)",
                boxShadow: "0 8px 32px rgba(168,85,247,0.2)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20" />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p
                    className="text-xs text-primary-foreground/70"
                    style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}
                  >
                    {t("dashboard.target")} 🎯
                  </p>
                  <p
                    className="text-lg font-semibold text-white"
                    style={{ fontSize: "18px", fontWeight: 600 }}
                  >
                    {businessSettings.targetCapital && businessSettings.targetCapital > 0
                      ? formatCurrency(businessSettings.targetCapital)
                      : t("dashboard.setTargetInSettings")}
                  </p>

                  <div className="mt-4">
                    <div
                      className="h-3 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000 ease-out"
                        style={{
                          width: `${
                            businessSettings.targetCapital && businessSettings.targetCapital > 0
                              ? Math.min((stats.totalSales / businessSettings.targetCapital) * 100, 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div
                      className="mt-2 flex justify-between text-[10px] text-white/70"
                      style={{ fontSize: "11px" }}
                    >
                      <span>
                        {businessSettings.targetCapital && businessSettings.targetCapital > 0
                          ? `${Math.min(
                              (stats.totalSales / businessSettings.targetCapital) * 100,
                              100
                            ).toFixed(1)}%`
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

                  <p
                    className="mt-2 text-[10px] text-primary-foreground/50"
                    style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}
                  >
                    {t("dashboard.connectedCapital")}: {formatCurrency(businessSettings.initialCapital)}
                  </p>
                </div>

                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <Gem size={24} style={{ color: "#fbbf24" }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {menuItems.map((item, index) => (
                <button
                  key={item.path + index}
                  onClick={() => navigate(item.path)}
                  className={`${item.bgClass} rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]`}
                  style={{
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                      item.textDark ? "bg-foreground/10" : "bg-white/20"
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={item.textDark ? "text-foreground" : "text-white"}
                    />
                  </div>
                  <h3
                    className={`mb-1 text-sm font-semibold ${
                      item.textDark ? "text-foreground" : "text-white"
                    }`}
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {item.label}
                  </h3>
                  <p
                    className={`text-[10px] ${
                      item.textDark ? "text-foreground/60" : "text-white/70"
                    }`}
                    style={{ fontSize: "11px", fontWeight: 400 }}
                  >
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-4">
              <ChangePinCard />

              {isOwner ? (
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                    {t("dashboard.ownerControl")}
                  </p>
                  <p className="text-sm text-slate-700">{t("dashboard.ownerControlText")}</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-blue-700">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={18} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em]">
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
      </main>
    </div>
  );
};

export default DashboardPage;