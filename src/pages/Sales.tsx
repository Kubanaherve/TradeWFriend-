import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Download, TrendingUp, Trash2, Wallet, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/kinyarwanda";
import { getDateKeyFromIso, isDateInFilter } from "@/lib/reporting";
import { toast } from "sonner";
import { useI18n } from "@/contexts/LanguageContext";

type FilterOption = "today" | "week" | "month" | "all";

interface DailyReport {
  date: string;
  debtsPaid: number;
  salesTotal: number;
  unpaidDebt: number;
  receivedTotal: number;
  expectedTotal: number;
  newDebt: number;
}

interface DailyAccumulator {
  date: string;
  debtsPaid: number;
  salesTotal: number;
  newDebt: number;
}

const ReportsPage = () => {
  const navigate = useNavigate();
  const { t, language } = useI18n();

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [summary, setSummary] = useState({
    receivedTotal: 0,
    unpaidDebt: 0,
    expectedTotal: 0,
    salesTotal: 0,
    debtsPaid: 0,
    newDebt: 0,
  });

  const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
    { value: "today", label: t("reports.filterToday") },
    { value: "week", label: t("reports.filterWeek") },
    { value: "month", label: t("reports.filterMonth") },
    { value: "all", label: t("reports.filterAll") },
  ];

  const fetchReports = useCallback(async () => {
    setLoading(true);

    try {
      const [salesResponse, debtItemsResponse, debtPaymentsResponse] = await Promise.all([
        (supabase as any).from("sales").select("sale_price, quantity, created_at"),
        (supabase as any).from("debt_items").select("total_price, date_taken"),
        (supabase as any).from("debt_payments").select("amount_paid, paid_at"),
      ]);

      if (salesResponse.error) throw salesResponse.error;
      if (debtItemsResponse.error) throw debtItemsResponse.error;
      if (debtPaymentsResponse.error) throw debtPaymentsResponse.error;

      const salesData = (salesResponse.data ?? []) as Array<{
        sale_price: number;
        quantity: number;
        created_at: string;
      }>;

      const debtItemsData = (debtItemsResponse.data ?? []) as Array<{
        total_price: number;
        date_taken: string;
      }>;

      const debtPaymentsData = (debtPaymentsResponse.data ?? []) as Array<{
        amount_paid: number;
        paid_at: string;
      }>;

      const dailyMap: Record<string, DailyAccumulator> = {};

      const getOrCreate = (date: string): DailyAccumulator => {
        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            debtsPaid: 0,
            salesTotal: 0,
            newDebt: 0,
          };
        }
        return dailyMap[date];
      };

      salesData.forEach((sale) => {
        const dateKey = getDateKeyFromIso(sale.created_at);
        const entry = getOrCreate(dateKey);
        entry.salesTotal += (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0);
      });

      debtItemsData.forEach((item) => {
        const dateKey = getDateKeyFromIso(item.date_taken);
        const entry = getOrCreate(dateKey);
        entry.newDebt += Number(item.total_price) || 0;
      });

      debtPaymentsData.forEach((payment) => {
        const dateKey = getDateKeyFromIso(payment.paid_at);
        const entry = getOrCreate(dateKey);
        entry.debtsPaid += Number(payment.amount_paid) || 0;
      });

      const now = new Date();

      const result: DailyReport[] = Object.values(dailyMap)
        .filter((entry) => isDateInFilter(entry.date, filter, now))
        .map((entry) => {
          const unpaidDebt = Math.max(entry.newDebt - entry.debtsPaid, 0);

          return {
            date: entry.date,
            debtsPaid: entry.debtsPaid,
            salesTotal: entry.salesTotal,
            unpaidDebt,
            receivedTotal: entry.salesTotal + entry.debtsPaid,
            expectedTotal: entry.salesTotal + entry.newDebt,
            newDebt: entry.newDebt,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      setReports(result);

      setSummary({
        receivedTotal: result.reduce((sum, report) => sum + report.receivedTotal, 0),
        unpaidDebt: result.reduce((sum, report) => sum + report.unpaidDebt, 0),
        expectedTotal: result.reduce((sum, report) => sum + report.expectedTotal, 0),
        salesTotal: result.reduce((sum, report) => sum + report.salesTotal, 0),
        debtsPaid: result.reduce((sum, report) => sum + report.debtsPaid, 0),
        newDebt: result.reduce((sum, report) => sum + report.newDebt, 0),
      });
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast.error(t("reports.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const refreshReports = () => {
      void fetchReports();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void fetchReports();
      }
    };

    window.addEventListener("paymentMade", refreshReports as EventListener);
    window.addEventListener("newDebtAdded", refreshReports as EventListener);
    window.addEventListener("debtDeleted", refreshReports as EventListener);
    window.addEventListener("clientDeleted", refreshReports as EventListener);
    window.addEventListener("factoryReset", refreshReports as EventListener);
    window.addEventListener("focus", refreshReports);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("paymentMade", refreshReports as EventListener);
      window.removeEventListener("newDebtAdded", refreshReports as EventListener);
      window.removeEventListener("debtDeleted", refreshReports as EventListener);
      window.removeEventListener("clientDeleted", refreshReports as EventListener);
      window.removeEventListener("factoryReset", refreshReports as EventListener);
      window.removeEventListener("focus", refreshReports);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchReports]);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString(
      language === "fr" ? "fr-FR" : language === "en" ? "en-GB" : "rw-RW",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  };

  const deleteTodayData = async () => {
    const confirmed = window.confirm(t("reports.deleteTodayConfirm"));
    if (!confirmed) return;

    try {
      const todayKey = getDateKeyFromIso(new Date().toISOString());
      const start = new Date(`${todayKey}T00:00:00.000Z`);
      const end = new Date(`${todayKey}T23:59:59.999Z`);

      const tasks = await Promise.allSettled([
        (supabase as any)
          .from("sales")
          .delete()
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),

        (supabase as any)
          .from("debt_items")
          .delete()
          .gte("date_taken", start.toISOString())
          .lte("date_taken", end.toISOString()),

        (supabase as any)
          .from("debt_payments")
          .delete()
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString()),
      ]);

      const failed = tasks.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        throw new Error("Some delete operations failed");
      }

      toast.success(t("reports.todayDeleted"));

      window.dispatchEvent(new CustomEvent("debtDeleted"));
      window.dispatchEvent(new CustomEvent("paymentMade"));
      window.dispatchEvent(new CustomEvent("newDebtAdded"));
      window.dispatchEvent(new CustomEvent("factoryReset"));

      await fetchReports();
    } catch (error) {
      console.error("Delete today data error:", error);
      toast.error(t("reports.deleteTodayFailed"));
    }
  };

  const downloadCSV = () => {
    const header = [
      t("reports.csvDate"),
      t("reports.csvSales"),
      t("reports.csvNewDebt"),
      t("reports.csvDebtPaid"),
      t("reports.csvUnpaidDebt"),
      t("reports.csvReceived"),
      t("reports.csvExpected"),
    ].join(",");

    const rows = reports
      .map(
        (report) =>
          `${report.date},${report.salesTotal},${report.newDebt},${report.debtsPaid},${report.unpaidDebt},${report.receivedTotal},${report.expectedTotal}`
      )
      .join("\n");

    const blob = new Blob([header + "\n" + rows], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports-${getDateKeyFromIso(new Date().toISOString())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t("reports.csvDownloaded"));
  };

  const isToday = (dateStr: string) =>
    dateStr === getDateKeyFromIso(new Date().toISOString());

  const filterTitle = useMemo(
    () =>
      ({
        today: t("reports.filterTitleToday"),
        week: t("reports.filterTitleWeek"),
        month: t("reports.filterTitleMonth"),
        all: t("reports.filterTitleAll"),
      })[filter],
    [filter, t]
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900"
      style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/35 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-300/25 to-transparent blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold text-slate-900">
                {t("reports.title")}
              </h1>
              <p className="text-[11px] text-slate-500">{t("reports.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadCSV}
              disabled={reports.length === 0}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>

            <Button
              variant="destructive"
              onClick={deleteTodayData}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("reports.deleteToday")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-10">
        <div className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("reports.title")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("reports.realDataNote")}</p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600">{filterTitle}</span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                className="h-9 whitespace-nowrap rounded-xl text-xs font-semibold"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                <TrendingUp className="h-4 w-4" />
                {t("reports.expectedTotal")}
              </div>
              <div className="text-xl font-bold">{formatCurrency(summary.expectedTotal)}</div>
              <div className="mt-2 text-xs text-slate-400">
                {reports.length} {t("reports.daysRecorded")}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Wallet className="h-4 w-4" />
                {t("reports.receivedMoney")}
              </div>
              <div className="text-lg font-bold text-slate-900">
                {formatCurrency(summary.receivedTotal)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <ReceiptText className="h-4 w-4" />
                {t("reports.unpaidDebt")}
              </div>
              <div className="text-lg font-bold text-slate-900">
                {formatCurrency(summary.unpaidDebt)}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/70 bg-white/95 p-8 text-center text-slate-500 shadow-sm">
            {t("common.loading")}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-white/70 bg-white/95 p-8 text-center text-slate-500 shadow-sm">
            {t("reports.noData")}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.date}
                className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-slate-900">
                        {formatDateLabel(report.date)}
                      </h3>
                      {isToday(report.date) && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          {t("reports.today")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {t("reports.totalForDay")}: {formatCurrency(report.expectedTotal)}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-sm text-slate-500">{t("reports.receivedMoney")}</div>
                    <div className="text-lg font-bold text-slate-900">
                      {formatCurrency(report.receivedTotal)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{t("reports.sales")}</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(report.salesTotal)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{t("reports.newDebt")}</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(report.newDebt)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{t("reports.debtPaid")}</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(report.debtsPaid)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{t("reports.unpaidDebt")}</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(report.unpaidDebt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportsPage;