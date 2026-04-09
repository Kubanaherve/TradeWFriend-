import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/kinyarwanda";
import {
  DAILY_CUSTOMER_PAYMENTS_PREFIX,
  DAILY_NEW_DEBT_PREFIX,
  getDateKeyFromIso,
  isDateInFilter,
} from "@/lib/reporting";
import { ArrowLeft, Calendar, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type FilterOption = "today" | "week" | "month" | "all";

interface DailyReport {
  date: string;
  debtsPaid: number;
  salesTotal: number;
  unpaidDebt: number;
  receivedTotal: number;
  expectedTotal: number;
}

interface DailyAccumulator {
  date: string;
  debtsPaid: number;
  salesTotal: number;
  newDebt: number;
}

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "today", label: "Uyu munsi" },
  { value: "week", label: "Icyumweru" },
  { value: "month", label: "Ukwezi" },
  { value: "all", label: "Byose" },
];

const WEEKDAY_LABELS = [
  "Ku Cyumweru",
  "Kuwa Mbere",
  "Kuwa Kabiri",
  "Kuwa Gatatu",
  "Kuwa Kane",
  "Kuwa Gatanu",
  "Kuwa Gatandatu",
];

const MONTH_LABELS = [
  "Mutarama",
  "Gashyantare",
  "Werurwe",
  "Mata",
  "Gicurasi",
  "Kamena",
  "Nyakanga",
  "Kanama",
  "Nzeri",
  "Ukwakira",
  "Ugushyingo",
  "Ukuboza",
];

const ReportsPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    receivedTotal: 0,
    unpaidDebt: 0,
    expectedTotal: 0,
  });
  const [filter, setFilter] = useState<FilterOption>("all");

  const fetchReports = useCallback(async () => {
    setLoading(true);

    try {
      const [{ data: salesData, error: salesError }, { data: settingsData, error: settingsError }] =
        await Promise.all([
          supabase.from("sales").select("sale_price, quantity, created_at"),
          supabase.from("app_settings").select("setting_key, setting_value"),
        ]);

      if (salesError) throw salesError;
      if (settingsError) throw settingsError;

      const dailyMap: Record<string, DailyAccumulator> = {};

      const getOrCreate = (date: string) => {
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

      (salesData || []).forEach((sale) => {
        const dateKey = getDateKeyFromIso(sale.created_at);
        const entry = getOrCreate(dateKey);
        entry.salesTotal +=
          (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0);
      });

      (settingsData || []).forEach((setting) => {
        const value = Number(setting.setting_value) || 0;

        if (setting.setting_key.startsWith(DAILY_CUSTOMER_PAYMENTS_PREFIX)) {
          const dateKey = setting.setting_key.replace(
            DAILY_CUSTOMER_PAYMENTS_PREFIX,
            ""
          );
          const entry = getOrCreate(dateKey);
          entry.debtsPaid += value;
        }

        if (setting.setting_key.startsWith(DAILY_NEW_DEBT_PREFIX)) {
          const dateKey = setting.setting_key.replace(DAILY_NEW_DEBT_PREFIX, "");
          const entry = getOrCreate(dateKey);
          entry.newDebt += value;
        }
      });

      const now = new Date();
      const result = Object.values(dailyMap)
        .filter((entry) => isDateInFilter(entry.date, filter, now))
        .map<DailyReport>((entry) => {
          const remainingDebt = Math.max(entry.newDebt - entry.debtsPaid, 0);
          // total debts = debts already paid + remaining unpaid debts
          const totalDebts = entry.debtsPaid + remainingDebt;

          return {
            date: entry.date,
            debtsPaid: entry.debtsPaid,
            salesTotal: entry.salesTotal,
            unpaidDebt: remainingDebt,
            receivedTotal: entry.salesTotal + entry.debtsPaid,
            expectedTotal: entry.salesTotal + totalDebts,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      setReports(result);
      setSummary({
        receivedTotal: result.reduce(
          (sum, report) => sum + report.receivedTotal,
          0
        ),
        unpaidDebt: result.reduce(
          (sum, report) => sum + report.unpaidDebt,
          0
        ),
        expectedTotal: result.reduce(
          (sum, report) => sum + report.expectedTotal,
          0
        ),
      });
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast.error("Habaye ikosa mu gufata raporo");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const refreshReports = () => {
      fetchReports();
    };

    window.addEventListener("paymentMade", refreshReports);
    window.addEventListener("newDebtAdded", refreshReports);
    window.addEventListener("focus", refreshReports);
    document.addEventListener("visibilitychange", refreshReports);

    return () => {
      window.removeEventListener("paymentMade", refreshReports);
      window.removeEventListener("newDebtAdded", refreshReports);
      window.removeEventListener("focus", refreshReports);
      document.removeEventListener("visibilitychange", refreshReports);
    };
  }, [fetchReports]);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return `${WEEKDAY_LABELS[date.getDay()]}, ${date.getDate()} ${
      MONTH_LABELS[date.getMonth()]
    } ${date.getFullYear()}`;
  };

  const downloadCSV = () => {
    const header =
      "Itariki,Amafaranga y'Ubucuruzi,Amafaranga y'Ideni Ryishyuwe,Ideni Ritarishyurwa,Igiteranyo Cyinjiye,Igiteranyo Gitegerejwe\n";
    const rows = reports
      .map(
        (report) =>
          `${report.date},${report.salesTotal},${report.debtsPaid},${report.unpaidDebt},${report.receivedTotal},${report.expectedTotal}`
      )
      .join("\n");

    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `raporo-${getDateKeyFromIso(new Date().toISOString())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Raporo yamanitswe ✨");
  };

  const isToday = (dateStr: string) =>
    dateStr === getDateKeyFromIso(new Date().toISOString());

  const filterTitle = {
    today: "Raporo y'uyu munsi",
    week: "Raporo y'iki cyumweru",
    month: "Raporo y'uku kwezi",
    all: "Raporo rusange",
  }[filter];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold">Raporo y'Amafaranga</h1>
        </div>
        <Button
          onClick={downloadCSV}
          size="sm"
          className="btn-navy h-8 px-3 text-xs gap-1"
        >
          <Download size={14} />
          CSV
        </Button>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{filterTitle}</h2>
          <p className="text-xs text-muted-foreground">
            Reba amafaranga y'ubucuruzi, ideni ryishyuwe, n'ayo ugitegereje kwakira.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              onClick={() => setFilter(option.value)}
              className="text-xs whitespace-nowrap"
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="glass-card-dark p-4 gold-glow">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-secondary" />
            <span className="text-xs text-primary-foreground/70">
              Igiteranyo Gitegerejwe
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(summary.expectedTotal)}
          </p>
          <p className="text-[10px] text-primary-foreground/50 mt-1">
            {reports.length} iminsi yanditswe
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground">Amafaranga yinjijwe</p>
            <p className="text-sm font-bold text-green-700">
              {formatCurrency(summary.receivedTotal)}
            </p>
          </div>

          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground">Ideni ritarishyurwa</p>
            <p className="text-sm font-bold text-red-700">
              {formatCurrency(summary.unpaidDebt)}
            </p>
          </div>

          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground">Igiteranyo cyose</p>
            <p className="text-sm font-bold text-blue-700">
              {formatCurrency(summary.expectedTotal)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Gutegereza...
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nta makuru ahari
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.date}
                className={`glass-card p-4 space-y-3 ${
                  isToday(report.date) ? "border-2 border-green-400/60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-xs font-semibold">
                      {formatDateLabel(report.date)}
                      {isToday(report.date) && (
                        <span className="ml-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                          Uyu munsi
                        </span>
                      )}
                    </span>
                  </div>

                  <span className="text-sm font-bold text-blue-600">
                    {formatCurrency(report.expectedTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-[10px] text-green-500">Amafaranga yinjijwe</p>
                    <p className="text-sm font-bold text-green-700">
                      {formatCurrency(report.receivedTotal)}
                    </p>
                  </div>

                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-[10px] text-red-500">Ideni ritarishyurwa</p>
                    <p className="text-sm font-bold text-red-700">
                      {formatCurrency(report.unpaidDebt)}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-[10px] text-blue-500">Igiteranyo cyose</p>
                    <p className="text-sm font-bold text-blue-700">
                      {formatCurrency(report.expectedTotal)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <div>Ubucuruzi: {formatCurrency(report.salesTotal)}</div>
                  <div>Ideni ryishyuwe: {formatCurrency(report.debtsPaid)}</div>
                  <div>Ideni ryo kuri uwo munsi: {formatCurrency(report.unpaidDebt)}</div>
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
