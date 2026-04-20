/**
 * SalesPage.tsx
 *
 * Standalone POS-style sales page.
 * - Select item from inventory (with live stock display)
 * - Enter quantity → auto-calculates total
 * - Validates stock before saving
 * - Inserts into `sales` table & decrements `inventory` quantity
 * - Auto-generates sale number: SALE-001, SALE-002, ...
 * - Shows today's sales in a clean table
 * - Fires custom DOM events so Dashboard + Reports refresh instantly
 *
 * ─── REQUIRED SUPABASE MIGRATION ─────────────────────────────────────────────
 * Run this SQL in your Supabase SQL editor before using this page:
 *
 *   ALTER TABLE sales
 *     ADD COLUMN IF NOT EXISTS item_id       uuid REFERENCES inventory(id) ON DELETE SET NULL,
 *     ADD COLUMN IF NOT EXISTS item_name     text,
 *     ADD COLUMN IF NOT EXISTS unit_price    numeric DEFAULT 0,
 *     ADD COLUMN IF NOT EXISTS sale_number   text,
 *     ADD COLUMN IF NOT EXISTS notes         text;
 *
 *   -- Optional: add a unique index on sale_number
 *   CREATE UNIQUE INDEX IF NOT EXISTS sales_sale_number_idx ON sales(sale_number);
 *
 * ─── ROUTING ──────────────────────────────────────────────────────────────────
 * Add to src/App.tsx:
 *   import SalesPage from "@/pages/Sales";
 *   <Route path="/sales" element={<SalesPage />} />
 *
 * ─── DASHBOARD FIX (totalSales) ───────────────────────────────────────────────
 * In DashboardPage, the `totalSales` stat already reads from the `sales` table
 * (sale_price × quantity). Once partial debt payments flow through `debt_payments`,
 * update the dashboard `totalSales` card label to "Total Revenue" and compute:
 *   totalRevenue = totalSales (from sales table) + totalPayments (from debt_payments)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Plus,
  Minus,
  Check,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { formatCurrency } from "@/lib/kinyarwanda";
import { createCsvBlob, saveBlobWithPicker, exportCsvType } from "@/lib/fileExport";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;   // selling price
  cost_price?: number;
}

interface SaleRecord {
  id: string;
  sale_number: string | null;
  item_id: string | null;
  item_name: string | null;
  quantity: number;
  unit_price: number;
  sale_price: number;   // total (unit_price × quantity)
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayKey = () => new Date().toISOString().split("T")[0];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Pad a number to at least 3 digits: 1 → "001" */
const padNumber = (n: number) => String(n).padStart(3, "0");

// ─── Component ───────────────────────────────────────────────────────────────

const SalesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
  const { t } = useI18n();
  const { settings: businessSettings } = useBusinessSettings();

  // ── Inventory ──
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // ── Item selector ──
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  // ── Sale form ──
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Today's sales ──
  const [todaySales, setTodaySales] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // ── Date filtering ──
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [allSales, setAllSales] = useState<SaleRecord[]>([]);
  const [deleting, setDeleting] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, authLoading, navigate]);

  // ── Close selector on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Fetch inventory ───────────────────────────────────────────────────────

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      // Table is `inventory_items`; selling price is stored as `cost_price`
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price")
        .order("item_name", { ascending: true });

      if (error) throw error;

      // Map cost_price → unit_price so the rest of the page stays consistent
      const mapped: InventoryItem[] = (data ?? []).map((row: any) => ({
        id:         row.id,
        item_name:  row.item_name,
        quantity:   row.quantity ?? 0,
        unit_price: row.cost_price ?? 0,
        cost_price: row.cost_price ?? 0,
      }));

      setInventory(mapped);
    } catch (err) {
      console.error("Fetch inventory error:", err);
      toast.error("Failed to load inventory.");
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  // ─── Get date range based on filter ───────────────────────────────────────

  const getDateRange = useCallback((filter: "today" | "week" | "month" | "all") => {
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
        start = new Date("2000-01-01");
        break;
    }
    
    return { start: start.toISOString(), end: now.toISOString() };
  }, []);

  // ─── Fetch sales by date range ─────────────────────────────────────────────

  const fetchFilteredSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const { start, end } = getDateRange(dateFilter);

      const { data, error } = await (supabase as any)
        .from("sales")
        .select("id, sale_number, item_id, item_name, quantity, unit_price, sale_price, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const sales = (data ?? []) as SaleRecord[];
      setAllSales(sales);
      if (dateFilter === "today") {
        setTodaySales(sales);
      }
    } catch (err) {
      console.error("Fetch sales error:", err);
      toast.error("Failed to load sales.");
    } finally {
      setLoadingSales(false);
    }
  }, [dateFilter, getDateRange]);

  // ─── Export as CSV ────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(async () => {
    const displaySales = dateFilter === "today" ? todaySales : allSales;
    if (displaySales.length === 0) {
      toast.error("No sales to export.");
      return;
    }

    try {
      const lines: string[] = [];
      lines.push('"Date","Sale #","Item","Qty","Unit Price","Total"');
      
      displaySales.forEach((sale) => {
        const date = new Date(sale.created_at).toLocaleString();
        lines.push(
          `"${date}","${sale.sale_number || "—"}","${sale.item_name || "—"}","${sale.quantity}","${sale.unit_price}","${sale.sale_price}"`
        );
      });

      lines.push(""); // blank line
      const total = displaySales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
      lines.push(`"TOTAL","","","","",${total}`);

      const blob = createCsvBlob(lines);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `Sales-${dateFilter}-${dateStr}.csv`;
      
      await saveBlobWithPicker(blob, filename, {
        fileType: exportCsvType,
        fallbackMimeType: "text/csv;charset=utf-8;",
      });

      toast.success("Sales exported as CSV.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Export CSV error:", err);
      toast.error("Failed to export CSV.");
    }
  }, [dateFilter, todaySales, allSales]);

  // ─── Export as simple HTML table (for PDF printing) ────────────────────────

  const handleExportHTML = useCallback(async () => {
    const displaySales = dateFilter === "today" ? todaySales : allSales;
    if (displaySales.length === 0) {
      toast.error("No sales to export.");
      return;
    }

    try {
      const total = displaySales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
      const dateStr = new Date().toLocaleDateString();
      const avgSale = displaySales.length > 0 ? total / displaySales.length : 0;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sales Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { text-align: center; color: #333; }
    .summary { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #333; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>Sales Report</h1>
  <div class="summary">
    <p><strong>Date:</strong> ${dateStr}</p>
    <p><strong>Period:</strong> ${dateFilter === "today" ? "Today" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : "All Time"}</p>
    <p><strong>Total Sales:</strong> ${formatCurrency(total)}</p>
    <p><strong>Number of Transactions:</strong> ${displaySales.length}</p>
    <p><strong>Average Sale:</strong> ${formatCurrency(avgSale)}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Date & Time</th>
        <th>Sale #</th>
        <th>Item</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${displaySales.map(sale => `
        <tr>
          <td>${new Date(sale.created_at).toLocaleString()}</td>
          <td>${sale.sale_number || "—"}</td>
          <td>${sale.item_name || "—"}</td>
          <td>${sale.quantity}</td>
          <td>${formatCurrency(sale.unit_price)}</td>
          <td><strong>${formatCurrency(sale.sale_price)}</strong></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()} from ${businessSettings.businessName || "Business"}</p>
    <p>This report was automatically generated by Curuza +</p>
  </div>
</body>
</html>
      `;

      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const dateKey = new Date().toISOString().split("T")[0];
      const filename = `Sales-Report-${dateFilter}-${dateKey}.html`;
      
      await saveBlobWithPicker(blob, filename, {
        fallbackMimeType: "text/html;charset=utf-8;",
      });

      toast.success("Sales report exported (open with browser or print to PDF).");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Export HTML error:", err);
      toast.error("Failed to export report.");
    }
  }, [dateFilter, todaySales, allSales, businessSettings.businessName]);

  // ─── Delete all sales ──────────────────────────────────────────────────────

  const handleDeleteAllSales = useCallback(async () => {
    const isOwner = profile?.role === "owner";
    if (!isOwner) {
      toast.error("Only the owner can delete sales.");
      return;
    }

    const confirmed = window.confirm(
      "⚠️  Delete ALL sales records? This will permanently remove all historical sales data and cannot be undone. Continue?"
    );
    if (!confirmed) return;

    const reconfirmed = window.confirm(
      "This action is permanent. Type 'DELETE' in the next prompt to confirm."
    );
    if (!reconfirmed) return;

    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("sales")
        .delete()
        .not("id", "is", null);

      if (error) throw error;

      setTodaySales([]);
      setAllSales([]);
      window.dispatchEvent(new CustomEvent("salesDeleted"));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("All sales deleted successfully.");
    } catch (err) {
      console.error("Delete all sales error:", err);
      toast.error("Failed to delete sales.");
    } finally {
      setDeleting(false);
    }
  }, [profile?.role]);

  // ─── Fetch today's sales (legacy, now part of fetchFilteredSales) ──────────

  const fetchTodaySales = useCallback(async () => {
    await fetchFilteredSales();
  }, [fetchFilteredSales]);

  // ─── Generate next sale number ─────────────────────────────────────────────

  const generateSaleNumber = useCallback(async (): Promise<string> => {
    try {
      // Find highest existing sale number like "SALE-042"
      const { data, error } = await (supabase as any)
        .from("sales")
        .select("sale_number")
        .not("sale_number", "is", null)
        .order("sale_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let next = 1;
      if (data && data.length > 0 && data[0].sale_number) {
        const parts = String(data[0].sale_number).split("-");
        const num = parseInt(parts[1] ?? "0", 10);
        if (!isNaN(num)) next = num + 1;
      }

      return `SALE-${padNumber(next)}`;
    } catch {
      // Fallback: timestamp-based
      return `SALE-${Date.now().toString().slice(-6)}`;
    }
  }, []);

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      void fetchInventory();
      void fetchFilteredSales();
    }
  }, [isAuthenticated, fetchInventory, fetchFilteredSales]);

  // ─── Reload when date filter changes ────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      void fetchFilteredSales();
    }
  }, [dateFilter, isAuthenticated, fetchFilteredSales]);

  // ─── Listen for global refresh events ─────────────────────────────────────

  useEffect(() => {
    const refresh = () => {
      void fetchInventory();
      void fetchFilteredSales();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("factoryReset", refresh as EventListener);
    window.addEventListener("salesDeleted", refresh as EventListener);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("factoryReset", refresh as EventListener);
      window.removeEventListener("salesDeleted", refresh as EventListener);
    };
  }, [fetchInventory, fetchFilteredSales]);

  // ─── Derived values ────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((i) => i.item_name.toLowerCase().includes(q));
  }, [inventory, itemSearch]);

  const unitPrice  = selectedItem?.unit_price ?? 0;
  const totalPrice = unitPrice * qty;
  const maxQty     = selectedItem?.quantity ?? 0;
  const stockOk    = qty > 0 && qty <= maxQty;

  const displaySales = dateFilter === "today" ? todaySales : allSales;
  const todayTotal = useMemo(
    () => displaySales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0),
    [displaySales]
  );

  const avgSale = displaySales.length > 0 ? todayTotal / displaySales.length : 0;

  // ─── Save sale ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedItem) {
      toast.error("Please select an item.");
      return;
    }
    if (qty <= 0) {
      toast.error("Quantity must be at least 1.");
      return;
    }
    if (qty > maxQty) {
      toast.error(`Only ${maxQty} units available in stock.`);
      return;
    }

    setSaving(true);
    try {
      const saleNumber = await generateSaleNumber();
      const nowIso     = new Date().toISOString();

      // 1. Insert sale row
      const { error: saleError } = await (supabase as any).from("sales").insert({
        sale_number: saleNumber,
        item_id:     selectedItem.id,
        item_name:   selectedItem.item_name,
        quantity:    qty,
        unit_price:  unitPrice,
        sale_price:  totalPrice,
        notes:       notes.trim() || null,
        created_at:  nowIso,
      });
      if (saleError) throw saleError;

      // 2. Decrement inventory quantity (table: inventory_items)
      const newQty = Math.max(selectedItem.quantity - qty, 0);
      const { error: invError } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", selectedItem.id);
      if (invError) throw invError;

      toast.success(`${saleNumber} saved — ${formatCurrency(totalPrice)}`);

      // 3. Reset form
      setSelectedItem(null);
      setQty(1);
      setNotes("");
      setItemSearch("");

      // 4. Notify other pages (Dashboard, Reports)
      window.dispatchEvent(new CustomEvent("newSaleRecorded"));
      window.dispatchEvent(new CustomEvent("newDebtAdded")); // piggyback for dashboard refresh

      // 5. Refresh local data
      await Promise.all([fetchInventory(), fetchTodaySales()]);
    } catch (err) {
      console.error("Save sale error:", err);
      toast.error("Failed to save sale. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell
      title="Sales"
      subtitle="Record paid sales"
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
      headerRight={
        <Button
          size="sm"
          variant="outline"
          onClick={() => { void fetchInventory(); void fetchFilteredSales(); }}
          className="h-9 rounded-xl text-xs font-semibold"
        >
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">

        {/* ── Date Filter Buttons ── */}
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "all"] as const).map((filter) => (
            <Button
              key={filter}
              onClick={() => setDateFilter(filter)}
              variant={dateFilter === filter ? "default" : "outline"}
              size="sm"
              className="rounded-xl text-xs font-semibold"
            >
              {filter === "today" && "Today"}
              {filter === "week" && "This Week"}
              {filter === "month" && "This Month"}
              {filter === "all" && "All Time"}
            </Button>
          ))}
        </div>

        {/* ── Statistics Card ── */}
        <div className="rounded-[24px] bg-gradient-to-br from-blue-50 to-indigo-50 p-5 ring-1 ring-blue-200">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Total Revenue
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{formatCurrency(todayTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Transactions
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{displaySales.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Avg Sale
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{formatCurrency(avgSale)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Items Sold
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900">
                {displaySales.reduce((sum, s) => sum + s.quantity, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Export Controls ── */}
        <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/50">
              <Download size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700">Export Data</p>
              <p className="text-[11px] text-slate-500">
                {displaySales.length} sales available
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={displaySales.length === 0 || loadingSales}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-white border border-slate-200"
            >
              <FileText size={13} />
              CSV
            </button>
            <button
              onClick={handleExportHTML}
              disabled={displaySales.length === 0 || loadingSales}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-white border border-slate-200"
            >
              <FileText size={13} />
              PDF
            </button>
            {profile?.role === "owner" && (
              <button
                onClick={handleDeleteAllSales}
                disabled={displaySales.length === 0 || deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-40 disabled:hover:bg-red-50 border border-red-200 ml-auto"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] bg-slate-900 p-4 text-white shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {dateFilter === "today" ? "Today's Revenue" : "Revenue"}
            </p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(todayTotal)}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {dateFilter === "today" ? "Sales Today" : "Sales"}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{displaySales.length}</p>
          </div>

          <div className="hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Items in Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {inventory.filter((i) => i.quantity > 0).length}
            </p>
          </div>
        </div>

        {/* ── New Sale Form ── */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">New Sale</h2>
          </div>

          <div className="space-y-4">
            {/* Item selector */}
            <div ref={selectorRef} className="relative">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item
              </label>

              {/* Trigger */}
              <button
                type="button"
                onClick={() => setSelectorOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition hover:border-slate-300"
              >
                {selectedItem ? (
                  <span className="flex items-center gap-2">
                    <Package size={14} className="shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-900">{selectedItem.item_name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        selectedItem.quantity > 5
                          ? "bg-green-100 text-green-700"
                          : selectedItem.quantity > 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {selectedItem.quantity} left
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">Select an item…</span>
                )}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${selectorOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown */}
              {selectorOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {/* Search inside dropdown */}
                  <div className="border-b border-slate-100 p-2">
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <Search size={14} className="shrink-0 text-slate-400" />
                      <input
                        autoFocus
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Search items…"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                      />
                      {itemSearch && (
                        <button type="button" onClick={() => setItemSearch("")}>
                          <X size={13} className="text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item list */}
                  <div className="max-h-56 overflow-y-auto">
                    {loadingInventory ? (
                      <p className="p-4 text-center text-xs text-slate-400">Loading…</p>
                    ) : filteredItems.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">No items found.</p>
                    ) : (
                      filteredItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.quantity === 0}
                          onClick={() => {
                            setSelectedItem(item);
                            setQty(1);
                            setSelectorOpen(false);
                            setItemSearch("");
                          }}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                            item.quantity === 0
                              ? "cursor-not-allowed opacity-40"
                              : "hover:bg-slate-50"
                          } ${selectedItem?.id === item.id ? "bg-blue-50" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <Package size={13} className="shrink-0 text-slate-400" />
                            <span className="font-medium text-slate-900">{item.item_name}</span>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <span className="text-xs font-semibold text-slate-600">
                              {formatCurrency(item.unit_price)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                item.quantity > 5
                                  ? "bg-green-100 text-green-700"
                                  : item.quantity > 0
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-600"
                              }`}
                            >
                              {item.quantity === 0 ? "Out of stock" : `${item.quantity} left`}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity + price row */}
            {selectedItem && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Quantity stepper */}
                <div className="sm:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQty}
                      value={qty}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) setQty(Math.max(1, v));
                      }}
                      className="w-full bg-transparent text-center text-base font-bold text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Stock warning */}
                  {qty > maxQty && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600">
                      <AlertCircle size={11} />
                      Max {maxQty}
                    </p>
                  )}
                </div>

                {/* Unit price (read-only) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unit Price
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {formatCurrency(unitPrice)}
                  </div>
                </div>

                {/* Total */}
                <div className="sm:col-span-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </label>
                  <div
                    className={`flex h-11 items-center rounded-xl border px-4 text-sm font-bold transition ${
                      stockOk
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    {formatCurrency(totalPrice)}
                  </div>
                </div>
              </div>
            )}

            {/* Notes (optional) */}
            {selectedItem && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes (optional)
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. cash, customer name…"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm"
                />
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving || !selectedItem || !stockOk}
              className="h-12 w-full rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Check size={16} className="mr-2" />
                  Save Sale
                  {selectedItem && stockOk && (
                    <span className="ml-2 rounded-lg bg-white/20 px-2 py-0.5 text-xs">
                      {formatCurrency(totalPrice)}
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Sales Table ── */}
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <CalendarDays size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {dateFilter === "today" && "Today's Sales"}
                  {dateFilter === "week" && "This Week's Sales"}
                  {dateFilter === "month" && "This Month's Sales"}
                  {dateFilter === "all" && "All Sales"}
                </p>
                <p className="text-xs text-slate-500">
                  {dateFilter === "all" ? (
                    `${displaySales.length} total transactions`
                  ) : (
                    new Date().toLocaleDateString([], {
                      weekday: dateFilter === "today" ? "long" : undefined,
                      month: "long",
                      day: "numeric",
                    })
                  )}
                </p>
              </div>
            </div>

            {displaySales.length > 0 && (
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500">Total</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(todayTotal)}</p>
              </div>
            )}
          </div>

          {/* Table / Empty state */}
          {loadingSales ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : displaySales.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                <Receipt size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {dateFilter === "today" ? "No sales recorded today yet." : "No sales found for this period."}
              </p>
              <p className="text-xs text-slate-400">Select an item above to record a sale.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Sale #
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {displaySales.map((sale) => (
                      <tr key={sale.id} className="transition hover:bg-slate-50/50">
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                            <TrendingUp size={10} />
                            {sale.sale_number ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {sale.item_name ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                          {sale.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-600">
                          {formatCurrency(sale.unit_price)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                          {formatCurrency(sale.sale_price)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                          {formatTime(sale.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary footer */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Day Total
                      </td>
                      <td className="px-4 py-3 text-right text-base font-extrabold text-slate-900">
                        {formatCurrency(todayTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {displaySales.map((sale) => (
                  <div key={sale.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
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
                      <p className="mt-0.5 text-xs text-slate-500">
                        {sale.quantity} × {formatCurrency(sale.unit_price)} •{" "}
                        {formatTime(sale.created_at)}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {formatCurrency(sale.sale_price)}
                    </p>
                  </div>
                ))}

                {/* Mobile total */}
                <div className="flex items-center justify-between bg-slate-50 px-5 py-3.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Period Total
                  </span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatCurrency(todayTotal)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Dashboard note ── */}
        <div className="rounded-[20px] border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">
            💡 Dashboard Tip
          </p>
          <p className="mt-0.5 text-xs text-blue-600">
            To show total revenue on the dashboard (sales + debt payments), update the
            dashboard's <code className="rounded bg-blue-100 px-1">totalSales</code> card to sum both the{" "}
            <code className="rounded bg-blue-100 px-1">sales</code> table and the{" "}
            <code className="rounded bg-blue-100 px-1">debt_payments</code> table. The logic
            already exists — just relabel the card "Total Revenue."
          </p>
        </div>

      </div>
    </AppShell>
  );
};

export default SalesPage;
