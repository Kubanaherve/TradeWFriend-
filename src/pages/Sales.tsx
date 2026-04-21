import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Package,
  TrendingUp,
  Plus,
  Minus,
  Search,
  ChevronDown,
  Receipt,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  X,
  Download,
  Trash2,
  FileText,
  ArrowRight,
  Hash,
  DollarSign,
  CheckCircle2,
  Clock,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { formatCurrency } from "@/lib/kinyarwanda";
import {
  createCsvBlob,
  saveBlobWithPicker,
  exportCsvType,
} from "@/lib/fileExport";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
}

interface SaleRecord {
  id: string;
  sale_number: string | null;
  item_id: string | null;
  item_name: string | null;
  quantity: number;
  cost_price: number;
  unit_price: number;
  sale_price: number;
  notes: string | null;
  created_at: string;
}

type DateFilter = "today" | "week" | "month" | "all";

const FILTER_LABELS: Record<DateFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

const padNumber = (n: number) => String(n).padStart(3, "0");

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const getDateRange = (filter: DateFilter) => {
  const now = new Date();
  let start = new Date();

  switch (filter) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
      start = new Date("2000-01-01T00:00:00.000Z");
      break;
  }

  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
};

const StockBadge = ({ qty }: { qty: number }) => {
  if (qty <= 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
        Out of stock
      </span>
    );
  }

  if (qty <= 5) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        {qty} left
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      {qty} in stock
    </span>
  );
};

const SalesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();

  const businessName = businessSettings.businessName?.trim() || "Business";
  const isOwner = profile?.role === "owner";

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);

  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const [itemSearch, setItemSearch] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const selectorRef = useRef<HTMLDivElement>(null);
  const fetchSalesAbort = useRef<AbortController | null>(null);
  const fetchInvAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isSaleModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSaleModalOpen(false);
        setSelectorOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSaleModalOpen]);

  const resetSaleForm = useCallback(() => {
    setSelectedItem(null);
    setQty(1);
    setNotes("");
    setItemSearch("");
    setSelectorOpen(false);
  }, []);

  const openSaleModal = () => {
    resetSaleForm();
    setIsSaleModalOpen(true);
  };

  const closeSaleModal = () => {
    setIsSaleModalOpen(false);
    setSelectorOpen(false);
  };

  const normalizeSalesRows = (rows: any[]): SaleRecord[] => {
    return (rows ?? []).map((row: any) => {
      const quantity = Number(row.quantity ?? 0);
      const salePrice = Number(row.sale_price ?? 0);
      const costPrice = Number(row.cost_price ?? 0);
      const unitPrice =
        row.unit_price != null
          ? Number(row.unit_price ?? 0)
          : quantity > 0
          ? salePrice / quantity
          : 0;

      return {
        id: String(row.id),
        sale_number: row.sale_number ?? null,
        item_id: row.item_id ?? null,
        item_name: row.item_name ?? "Sale",
        quantity,
        cost_price: costPrice,
        unit_price: unitPrice,
        sale_price: salePrice,
        notes: row.notes ?? null,
        created_at: String(row.created_at ?? new Date().toISOString()),
      };
    });
  };

  const fetchInventory = useCallback(async () => {
    fetchInvAbort.current?.abort();
    fetchInvAbort.current = new AbortController();

    setLoadingInventory(true);

    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price")
        .order("item_name", { ascending: true });

      if (error) throw error;

      const mapped: InventoryItem[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        item_name: String(row.item_name ?? ""),
        quantity: Number(row.quantity ?? 0),
        cost_price: Number(row.cost_price ?? 0),
        unit_price: Number(row.cost_price ?? 0),
      }));

      setInventory(mapped);

      setSelectedItem((prev) => {
        if (!prev) return null;
        const updated = mapped.find((item) => item.id === prev.id);
        return updated ?? null;
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetchInventory error:", err);
      toast.error(err?.message || "Failed to load inventory.");
      setInventory([]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchSales = useCallback(
    async (filter: DateFilter = dateFilter) => {
      fetchSalesAbort.current?.abort();
      fetchSalesAbort.current = new AbortController();

      setLoadingSales(true);

      try {
        const { start, end } = getDateRange(filter);

        const { data, error } = await (supabase as any)
          .from("sales")
          .select(
            "id, sale_number, item_id, item_name, quantity, cost_price, unit_price, sale_price, notes, created_at"
          )
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setSales(normalizeSalesRows(data ?? []));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("fetchSales error:", err);
        toast.error(err?.message || JSON.stringify(err) || "Failed to load sales.");
        setSales([]);
      } finally {
        setLoadingSales(false);
      }
    },
    [dateFilter]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchInventory();
    void fetchSales(dateFilter);
  }, [isAuthenticated, fetchInventory, fetchSales, dateFilter]);

  useEffect(() => {
    const refresh = () => {
      void fetchInventory();
      void fetchSales(dateFilter);
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("factoryReset", refresh as EventListener);
    window.addEventListener("salesDeleted", refresh as EventListener);
    window.addEventListener("newSaleRecorded", refresh as EventListener);
    window.addEventListener("inventoryUpdated", refresh as EventListener);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("factoryReset", refresh as EventListener);
      window.removeEventListener("salesDeleted", refresh as EventListener);
      window.removeEventListener("newSaleRecorded", refresh as EventListener);
      window.removeEventListener("inventoryUpdated", refresh as EventListener);
    };
  }, [dateFilter, fetchInventory, fetchSales]);

  useEffect(() => {
    return () => {
      fetchSalesAbort.current?.abort();
      fetchInvAbort.current?.abort();
    };
  }, []);

  const generateSaleNumber = useCallback(async (): Promise<string> => {
    try {
      const { data, error } = await (supabase as any)
        .from("sales")
        .select("sale_number")
        .not("sale_number", "is", null)
        .order("sale_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let next = 1;

      if (data?.length && data[0]?.sale_number) {
        const parts = String(data[0].sale_number).split("-");
        const n = parseInt(parts[1] ?? "0", 10);
        if (!Number.isNaN(n)) next = n + 1;
      }

      return `SALE-${padNumber(next)}`;
    } catch {
      return `SALE-${Date.now().toString().slice(-6)}`;
    }
  }, []);

  const handleSave = async () => {
    if (!selectedItem) {
      toast.error("Please select an item.");
      return;
    }

    if (qty <= 0) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    if (qty > selectedItem.quantity) {
      toast.error(`Only ${selectedItem.quantity} units in stock.`);
      return;
    }

    setSaving(true);

    try {
      const costPrice = Number(selectedItem.cost_price ?? 0);
      const unitPrice = Number(selectedItem.unit_price ?? selectedItem.cost_price ?? 0);
      const salePrice = unitPrice * qty;
      const createdAt = new Date().toISOString();
      const saleNumber = await generateSaleNumber();

      const { error: insertError } = await (supabase as any)
        .from("sales")
        .insert({
          sale_number: saleNumber,
          item_id: selectedItem.id,
          item_name: selectedItem.item_name,
          quantity: qty,
          cost_price: costPrice,
          unit_price: unitPrice,
          sale_price: salePrice,
          notes: notes.trim() || null,
          created_at: createdAt,
          date_sold: createdAt.split("T")[0],
          added_by: profile?.phone ?? null,
        });

      if (insertError) throw insertError;

      const newQty = Math.max(selectedItem.quantity - qty, 0);

      const { error: invError } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", selectedItem.id);

      if (invError) {
        console.error("Inventory update failed:", invError);
        toast.warning("Sale saved, but stock count could not update.");
      } else {
        toast.success(`Sale saved — ${formatCurrency(salePrice)}`);
      }

      resetSaleForm();
      closeSaleModal();

      window.dispatchEvent(new CustomEvent("newSaleRecorded"));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));

      await Promise.allSettled([fetchInventory(), fetchSales(dateFilter)]);
    } catch (err: any) {
      console.error("Save sale error:", err);
      toast.error(err?.message || JSON.stringify(err) || "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = useCallback(async () => {
    if (sales.length === 0) {
      toast.error("No sales to export.");
      return;
    }

    try {
      const lines = ['"Date","Sale #","Item","Qty","Cost Price","Unit Price","Total","Notes"'];

      sales.forEach((s) => {
        lines.push(
          `"${new Date(s.created_at).toLocaleString()}","${s.sale_number ?? "—"}","${s.item_name ?? "—"}","${s.quantity}","${s.cost_price}","${s.unit_price}","${s.sale_price}","${s.notes ?? ""}"`
        );
      });

      lines.push(
        "",
        `"TOTAL","","","","","",${sales.reduce((a, s) => a + Number(s.sale_price || 0), 0)},""`
      );

      const blob = createCsvBlob(lines);

      await saveBlobWithPicker(
        blob,
        `${businessName}-sales-${dateFilter}-${new Date().toISOString().split("T")[0]}.csv`,
        {
          fileType: exportCsvType,
          fallbackMimeType: "text/csv;charset=utf-8;",
        }
      );

      toast.success("CSV exported.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("CSV export error:", err);
      toast.error("Export failed.");
    }
  }, [businessName, dateFilter, sales]);

  const handleExportHTML = useCallback(async () => {
    if (sales.length === 0) {
      toast.error("No sales to export.");
      return;
    }

    try {
      const total = sales.reduce((a, s) => a + Number(s.sale_price || 0), 0);
      const avg = sales.length ? total / sales.length : 0;

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${businessName} Sales Report</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}
h1{text-align:center;color:#0f172a}
.summary{background:#f8fafc;padding:14px;border-radius:12px;margin:20px 0;border:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#0f172a;color:#fff;padding:10px;text-align:left}
td{padding:10px;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#fafafa}
.footer{text-align:center;margin-top:30px;font-size:12px;color:#64748b}
</style>
</head>
<body>
<h1>${businessName} Sales Report</h1>
<div class="summary">
<p><strong>Period:</strong> ${FILTER_LABELS[dateFilter]}</p>
<p><strong>Total Revenue:</strong> ${formatCurrency(total)}</p>
<p><strong>Transactions:</strong> ${sales.length}</p>
<p><strong>Average Sale:</strong> ${formatCurrency(avg)}</p>
</div>
<table>
<thead>
<tr>
<th>Date</th>
<th>Sale #</th>
<th>Item</th>
<th>Qty</th>
<th>Cost Price</th>
<th>Unit Price</th>
<th>Total</th>
<th>Notes</th>
</tr>
</thead>
<tbody>
${sales
  .map(
    (s) => `
<tr>
<td>${new Date(s.created_at).toLocaleString()}</td>
<td>${s.sale_number ?? "—"}</td>
<td>${s.item_name ?? "—"}</td>
<td>${s.quantity}</td>
<td>${formatCurrency(s.cost_price)}</td>
<td>${formatCurrency(s.unit_price)}</td>
<td><strong>${formatCurrency(s.sale_price)}</strong></td>
<td>${s.notes ?? ""}</td>
</tr>`
  )
  .join("")}
</tbody>
</table>
<div class="footer">
<p>Generated ${new Date().toLocaleString()} · ${businessName}</p>
</div>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });

      await saveBlobWithPicker(
        blob,
        `${businessName}-sales-report-${dateFilter}-${new Date().toISOString().split("T")[0]}.html`,
        {
          fallbackMimeType: "text/html;charset=utf-8;",
        }
      );

      toast.success("Report exported.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("HTML export error:", err);
      toast.error("Export failed.");
    }
  }, [businessName, dateFilter, sales]);

  const handleDeleteAll = useCallback(async () => {
    if (!isOwner) {
      toast.error("Only the owner can delete all sales.");
      return;
    }

    if (!window.confirm("Permanently delete ALL sales?")) return;
    if (!window.confirm("This cannot be undone. Continue?")) return;

    setDeleting(true);

    try {
      const { error } = await (supabase as any)
        .from("sales")
        .delete()
        .not("id", "is", null);

      if (error) throw error;

      setSales([]);
      window.dispatchEvent(new CustomEvent("salesDeleted"));
      toast.success("All sales deleted.");
    } catch (err) {
      console.error("Delete sales error:", err);
      toast.error("Failed to delete sales.");
    } finally {
      setDeleting(false);
    }
  }, [isOwner]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();

    if (!q) return inventory.slice(0, 12);

    return inventory
      .filter((item) => item.item_name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [inventory, itemSearch]);

  const maxQty = selectedItem?.quantity ?? 0;
  const unitPrice = selectedItem?.unit_price ?? 0;
  const totalPrice = unitPrice * qty;
  const stockOk = !!selectedItem && qty > 0 && qty <= maxQty;

  const totalRevenue = useMemo(
    () => sales.reduce((a, s) => a + Number(s.sale_price ?? 0), 0),
    [sales]
  );

  const totalItems = useMemo(
    () => sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0),
    [sales]
  );

  const avgSale = sales.length ? totalRevenue / sales.length : 0;

  return (
    <AppShell
      title="Sales"
      subtitle={`${businessName} sales center`}
      showBack
      showHome
      contentClassName="pt-2 md:pt-4"
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void fetchInventory();
              void fetchSales(dateFilter);
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            Refresh
          </button>

          <button
            onClick={openSaleModal}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={13} />
            Add Sale
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                dateFilter === f
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              icon: <DollarSign size={14} />,
              label: "Revenue",
              value: formatCurrency(totalRevenue),
              accent: "bg-violet-600",
              text: "text-violet-700",
            },
            {
              icon: <Receipt size={14} />,
              label: "Transactions",
              value: String(sales.length),
              accent: "bg-blue-600",
              text: "text-blue-700",
            },
            {
              icon: <BarChart3 size={14} />,
              label: "Avg Sale",
              value: formatCurrency(avgSale),
              accent: "bg-emerald-600",
              text: "text-emerald-700",
            },
            {
              icon: <Package size={14} />,
              label: "Items Sold",
              value: String(totalItems),
              accent: "bg-amber-500",
              text: "text-amber-700",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.accent} text-white`}>
                  {card.icon}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {card.label}
                </span>
              </div>
              <p className={`text-xl font-extrabold ${card.text}`}>
                {loadingSales ? (
                  <span className="inline-block h-5 w-20 animate-pulse rounded bg-slate-100" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <CalendarDays size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {FILTER_LABELS[dateFilter]} Sales
              </p>
              <p className="text-[11px] text-slate-500">
                {sales.length} transaction{sales.length !== 1 ? "s" : ""}
              </p>
            </div>

            {sales.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Total
                </p>
                <p className="text-base font-extrabold text-slate-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <Download size={13} className="text-slate-500" />
            </div>

            <span className="mr-auto text-xs font-semibold text-slate-600">
              Export {sales.length} sale{sales.length !== 1 ? "s" : ""} ({FILTER_LABELS[dateFilter]})
            </span>

            <button
              onClick={handleExportCSV}
              disabled={!sales.length}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FileText size={12} />
              CSV
            </button>

            <button
              onClick={handleExportHTML}
              disabled={!sales.length}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FileText size={12} />
              HTML
            </button>

            {isOwner && (
              <button
                onClick={handleDeleteAll}
                disabled={!sales.length || deleting}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
              >
                {deleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                Delete All
              </button>
            )}
          </div>

          {loadingSales ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin text-slate-300" />
              Loading sales…
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                <Receipt size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                No sales for {FILTER_LABELS[dateFilter].toLowerCase()} yet.
              </p>
              <button
                onClick={openSaleModal}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus size={13} />
                Add First Sale
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      {["Sale #", "Item", "Qty", "Unit Price", "Total", "Time"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 ${
                            i > 1 ? "text-right" : ""
                          } ${i === 0 ? "pl-5" : ""} ${i === 5 ? "pr-5" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="group transition hover:bg-slate-50/60"
                      >
                        <td className="pl-5 pr-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                            <Hash size={9} className="text-slate-400" />
                            {sale.sale_number ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-900">
                            {sale.item_name ?? "—"}
                          </span>
                          {sale.notes && (
                            <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              {sale.notes}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-600">
                          {sale.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-500">
                          {formatCurrency(sale.unit_price)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-extrabold text-slate-900">
                            {formatCurrency(sale.sale_price)}
                          </span>
                        </td>
                        <td className="pl-4 pr-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={10} />
                            {formatTime(sale.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td
                        colSpan={4}
                        className="pl-5 pr-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400"
                      >
                        Period Total
                      </td>
                      <td className="px-4 py-3 text-right text-base font-extrabold text-slate-900">
                        {formatCurrency(totalRevenue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="divide-y divide-slate-50 md:hidden">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center gap-3 px-4 py-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                      <TrendingUp size={14} className="text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {sale.item_name ?? "—"}
                        </p>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {sale.sale_number ?? "—"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {sale.quantity} × {formatCurrency(sale.unit_price)} · {formatTime(sale.created_at)}
                      </p>
                      {sale.notes && (
                        <p className="mt-0.5 text-[11px] text-amber-600">
                          {sale.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold text-slate-900">
                        {formatCurrency(sale.sale_price)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between bg-slate-50 px-4 py-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Period Total
                  </span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatCurrency(totalRevenue)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isSaleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Create New Sale</h2>
                <p className="text-[11px] text-slate-400">
                  Fast, clean, and safe sales entry
                </p>
              </div>
              <button
                onClick={closeSaleModal}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                    1
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Select Product
                  </span>
                </div>

                <div ref={selectorRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectorOpen((open) => !open)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm transition-all ${
                      selectedItem
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {selectedItem ? (
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            {selectedItem.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(selectedItem.unit_price)} per unit
                          </p>
                        </div>
                        <StockBadge qty={selectedItem.quantity} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Search size={15} />
                        <span>Tap to choose product</span>
                      </div>
                    )}

                    <ChevronDown
                      size={16}
                      className={`ml-2 shrink-0 text-slate-400 transition-transform ${
                        selectorOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {selectorOpen && (
                    <div className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                      <div className="border-b border-slate-100 p-3">
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <Search size={14} className="text-slate-400" />
                          <input
                            autoFocus
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            placeholder="Search item name..."
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                          />
                          {itemSearch && (
                            <button type="button" onClick={() => setItemSearch("")}>
                              <X size={13} className="text-slate-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto">
                        {loadingInventory ? (
                          <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-400">
                            <Loader2 size={15} className="animate-spin" />
                            Loading products…
                          </div>
                        ) : filteredItems.length === 0 ? (
                          <p className="p-6 text-center text-sm text-slate-400">
                            No matching products
                          </p>
                        ) : (
                          filteredItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              disabled={item.quantity <= 0}
                              onClick={() => {
                                setSelectedItem(item);
                                setQty(1);
                                setSelectorOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                                item.quantity <= 0
                                  ? "cursor-not-allowed opacity-50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {item.item_name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                              <StockBadge qty={item.quantity} />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedItem && (
                <>
                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          2
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Quantity
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                        >
                          <Minus size={16} />
                        </button>

                        <input
                          type="number"
                          min={1}
                          max={maxQty}
                          value={qty}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!Number.isNaN(v)) {
                              setQty(Math.max(1, Math.min(maxQty, v)));
                            }
                          }}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white text-center text-xl font-extrabold text-slate-900 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {[1, 2, 5, 10].filter((n) => n <= maxQty).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQty(n)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                              qty === n
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      {qty > maxQty && (
                        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                          <AlertCircle size={12} />
                          Only {maxQty} units available
                        </p>
                      )}
                    </div>

                    <div
                      className={`rounded-2xl p-4 ${
                        stockOk
                          ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white"
                          : "bg-red-50 ring-1 ring-red-200"
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            stockOk ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
                          }`}
                        >
                          3
                        </div>
                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${
                            stockOk ? "text-slate-300" : "text-red-500"
                          }`}
                        >
                          Summary
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${stockOk ? "text-slate-400" : "text-red-400"}`}>
                            Unit Price
                          </p>
                          <p className={`mt-1 text-base font-bold ${stockOk ? "text-white" : "text-red-700"}`}>
                            {formatCurrency(unitPrice)}
                          </p>
                        </div>

                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${stockOk ? "text-slate-400" : "text-red-400"}`}>
                            Quantity
                          </p>
                          <p className={`mt-1 text-base font-bold ${stockOk ? "text-white" : "text-red-700"}`}>
                            × {qty}
                          </p>
                        </div>

                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${stockOk ? "text-emerald-400" : "text-red-400"}`}>
                            Total
                          </p>
                          <p className={`mt-1 text-2xl font-extrabold ${stockOk ? "text-emerald-400" : "text-red-700"}`}>
                            {formatCurrency(totalPrice)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes <span className="normal-case text-slate-400">(optional)</span>
                    </label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Customer name, cash, transfer, quick note..."
                      className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                </>
              )}

              {!selectedItem && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-400">
                  Choose a product first to continue
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={closeSaleModal}
                  className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving || !stockOk}
                  className={`flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all ${
                    stockOk && !saving
                      ? "bg-slate-900 text-white shadow-lg hover:bg-slate-800"
                      : "cursor-not-allowed bg-slate-200 text-slate-400"
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving sale…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Save Sale
                      {stockOk && (
                        <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-extrabold">
                          {formatCurrency(totalPrice)}
                        </span>
                      )}
                      <ArrowRight size={15} className="opacity-60" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default SalesPage;