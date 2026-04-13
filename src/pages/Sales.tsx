import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Download, TrendingUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/kinyarwanda";
import {
  DAILY_CUSTOMER_PAYMENTS_PREFIX,
  DAILY_NEW_DEBT_PREFIX,
  getDateKeyFromIso,
  isDateInFilter,
} from "@/lib/reporting";
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
  const [filter, setFilter] = useState<FilterOption>("all");
  const [summary, setSummary] = useState({
    receivedTotal: 0,
    unpaidDebt: 0,
    expectedTotal: 0,
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);

    try {
      const [
        { data: salesData, error: salesError },
        { data: settingsData, error: settingsError },
      ] = await Promise.all([
        supabase.from("sales").select("sale_price, quantity, created_at"),
        supabase.from("app_settings").select("setting_key, setting_value"),
      ]);

      if (salesError) throw salesError;
      if (settingsError) throw settingsError;

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

      (salesData ?? []).forEach((sale) => {
        const dateKey = getDateKeyFromIso(sale.created_at);
        const entry = getOrCreate(dateKey);
        entry.salesTotal += (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0);
      });

      (settingsData ?? []).forEach((setting) => {
        const value = Number(setting.setting_value) || 0;

        if (setting.setting_key.startsWith(DAILY_CUSTOMER_PAYMENTS_PREFIX)) {
          const dateKey = setting.setting_key.replace(DAILY_CUSTOMER_PAYMENTS_PREFIX, "");
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

      const result: DailyReport[] = Object.values(dailyMap)
        .filter((entry) => isDateInFilter(entry.date, filter, now))
        .map((entry) => {
          const unpaidDebt = Math.max(entry.newDebt - entry.debtsPaid, 0);
          const totalDebtForDay = entry.debtsPaid + unpaidDebt;

          return {
            date: entry.date,
            debtsPaid: entry.debtsPaid,
            salesTotal: entry.salesTotal,
            unpaidDebt,
            receivedTotal: entry.salesTotal + entry.debtsPaid,
            expectedTotal: entry.salesTotal + totalDebtForDay,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      setReports(result);
      setSummary({
        receivedTotal: result.reduce((sum, report) => sum + report.receivedTotal, 0),
        unpaidDebt: result.reduce((sum, report) => sum + report.unpaidDebt, 0),
        expectedTotal: result.reduce((sum, report) => sum + report.expectedTotal, 0),
      });
    } catch (error) {
      console.error("Fetch reports error:", error);
      toast.error("Habaye ikosa mu gufata raporo");
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
    window.addEventListener("focus", refreshReports);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("paymentMade", refreshReports as EventListener);
      window.removeEventListener("newDebtAdded", refreshReports as EventListener);
      window.removeEventListener("focus", refreshReports);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchReports]);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return `${WEEKDAY_LABELS[date.getDay()]}, ${date.getDate()} ${
      MONTH_LABELS[date.getMonth()]
    } ${date.getFullYear()}`;
  };

  const deleteTodayData = async () => {
    const confirmed = window.confirm(
      "Ugiye gusiba amafaranga yose y'uyu munsi, harimo sales n'inyandiko z'ideni. Uzi neza?"
    );
    if (!confirmed) return;

    try {
      const todayKey = getDateKeyFromIso(new Date().toISOString());
      const start = new Date(`${todayKey}T00:00:00`);
      const end = new Date(`${todayKey}T23:59:59.999`);

      const { error: salesError } = await supabase
        .from("sales")
        .delete()
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (salesError) throw salesError;

      const { data: settings, error: settingsError } = await supabase
        .from("app_settings")
        .select("setting_key");

      if (settingsError) throw settingsError;

      const todayDebtKeys = (settings ?? [])
        .map((s) => s.setting_key)
        .filter(
          (key) =>
            key.startsWith(DAILY_CUSTOMER_PAYMENTS_PREFIX + todayKey) ||
            key.startsWith(DAILY_NEW_DEBT_PREFIX + todayKey)
        );

      if (todayDebtKeys.length > 0) {
        const { error: settingsDeleteError } = await supabase
          .from("app_settings")
          .delete()
          .in("setting_key", todayDebtKeys);

        if (settingsDeleteError) throw settingsDeleteError;
      }

      toast.success("Amakuru y'uyu munsi yasibwe neza");
      await fetchReports();
    } catch (error) {
      console.error("Delete today data error:", error);
      toast.error("Habaye ikibazo mu gusiba data y'uyu munsi");
    }
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Raporo yamanitswe ✨");
  };

  const isToday = (dateStr: string) => dateStr === getDateKeyFromIso(new Date().toISOString());

  const filterTitle = useMemo(
    () =>
      ({
        today: "Raporo y'uyu munsi",
        week: "Raporo y'iki cyumweru",
        month: "Raporo y'uku kwezi",
        all: "Raporo rusange",
      })[filter],
    [filter]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadCSV} disabled={reports.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>

            <Button variant="destructive" onClick={deleteTodayData}>
              <Trash2 className="mr-2 h-4 w-4" />
              Siba Uyu Munsi
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Raporo y'Amafaranga</h1>
              <p className="mt-1 text-sm text-slate-600">
                Reba amafaranga y'ubucuruzi, ideni ryishyuwe, n'ayo ugitegereje kwakira.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600">{filterTitle}</span>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                className="text-xs whitespace-nowrap"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                <TrendingUp className="h-4 w-4" />
                Igiteranyo Gitegerejwe
              </div>
              <div className="text-2xl font-bold">{formatCurrency(summary.expectedTotal)}</div>
              <div className="mt-2 text-xs text-slate-400">{reports.length} iminsi yanditswe</div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Amafaranga yinjijwe</div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatCurrency(summary.receivedTotal)}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Ideni ritarishyurwa</div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatCurrency(summary.unpaidDebt)}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
              Gutegereza...
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
              Nta makuru ahari
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.date}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{formatDateLabel(report.date)}</h3>
                        {isToday(report.date) && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                            Uyu munsi
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Igiteranyo cyose: {formatCurrency(report.expectedTotal)}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-500">Amafaranga yinjijwe</div>
                      <div className="text-lg font-bold text-slate-900">
                        {formatCurrency(report.receivedTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">Ubucuruzi</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(report.salesTotal)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">Ideni ryishyuwe</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(report.debtsPaid)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">Ideni ritarishyurwa</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(report.unpaidDebt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;