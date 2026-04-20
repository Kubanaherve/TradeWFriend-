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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/kinyarwanda";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
}

interface SaleRecord {
  id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

const todayRangeLocal = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const SalesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [todaySales, setTodaySales] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price")
        .order("item_name", { ascending: true });

      if (error) throw error;

      const rows = ((data ?? []) as Array<{
        id: string;
        item_name: string;
        quantity: number;
        cost_price: number;
      }>).map((item) => ({
        id: item.id,
        item_name: item.item_name,
        quantity: Number(item.quantity ?? 0),
        cost_price: Number(item.cost_price ?? 0),
        unit_price: Number(item.cost_price ?? 0),
      }));
      setInventory(rows.filter((item) => Number(item.quantity ?? 0) >= 0));
    } catch (err) {
      console.error("Fetch inventory error:", err);
      toast.error("Gufata stock ya sales byanze.");
      setInventory([]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchTodaySales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const { start, end } = todayRangeLocal();

      const { data, error } = await (supabase as any)
        .from("sales")
        .select("id, item_name, quantity, sale_price, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = ((data ?? []) as Array<{
        id: string;
        item_name: string | null;
        quantity: number;
        sale_price: number;
        created_at: string;
      }>).map((sale) => {
        const quantity = Number(sale.quantity ?? 0);
        const unitPrice = Number(sale.sale_price ?? 0);
        return {
          id: sale.id,
          item_name: sale.item_name,
          quantity,
          unit_price: unitPrice,
          line_total: unitPrice * quantity,
          created_at: sale.created_at,
        };
      });
      setTodaySales(rows);
    } catch (err) {
      console.error("Fetch today sales error:", err);
      setTodaySales([]);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchInventory();
      void fetchTodaySales();
    }
  }, [isAuthenticated, fetchInventory, fetchTodaySales]);

  useEffect(() => {
    const refresh = () => {
      void fetchInventory();
      void fetchTodaySales();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("factoryReset", refresh as EventListener);
    window.addEventListener("inventoryUpdated", refresh as EventListener);
    window.addEventListener("newSaleRecorded", refresh as EventListener);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("factoryReset", refresh as EventListener);
      window.removeEventListener("inventoryUpdated", refresh as EventListener);
      window.removeEventListener("newSaleRecorded", refresh as EventListener);
    };
  }, [fetchInventory, fetchTodaySales]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((i) => i.item_name.toLowerCase().includes(q));
  }, [inventory, itemSearch]);

  const unitPrice = Number(selectedItem?.unit_price ?? 0);
  const totalPrice = unitPrice * qty;
  const maxQty = Number(selectedItem?.quantity ?? 0);
  const stockOk = qty > 0 && qty <= maxQty && !!selectedItem;

  const todayTotal = useMemo(
    () => todaySales.reduce((sum, s) => sum + Number(s.line_total || 0), 0),
    [todaySales]
  );

  const totalItemsSoldToday = useMemo(
    () => todaySales.reduce((sum, s) => sum + Number(s.quantity || 0), 0),
    [todaySales]
  );

  const handleSave = async () => {
    if (!selectedItem) {
      toast.error("Please select an item.");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    if (qty > maxQty) {
      toast.error(`Only ${maxQty} units available in stock.`);
      return;
    }

    if (unitPrice < 0) {
      toast.error("Invalid unit price.");
      return;
    }

    setSaving(true);

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const dateSold = nowIso.split("T")[0];
      const saleUnitPrice = Number(selectedItem.cost_price ?? selectedItem.unit_price ?? 0);

      const { error: saleError } = await (supabase as any).from("sales").insert({
        item_name: selectedItem.item_name,
        quantity: qty,
        cost_price: saleUnitPrice,
        sale_price: saleUnitPrice,
        created_at: nowIso,
        date_sold: dateSold,
      });

      if (saleError) throw saleError;

      const newQty = Math.max(selectedItem.quantity - qty, 0);
      const { error: inventoryError } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", selectedItem.id);

      if (inventoryError) throw inventoryError;

      toast.success(
        `Sale ibitswe neza - ${formatCurrency(totalPrice)}`
      );

      setSelectedItem(null);
      setQty(1);
      setNotes("");
      setItemSearch("");
      setSelectorOpen(false);

      window.dispatchEvent(new CustomEvent("newSaleRecorded"));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));

      await Promise.all([fetchInventory(), fetchTodaySales()]);
    } catch (err: any) {
      console.error("Save sale error:", err);
      toast.error(err?.message || "Failed to save sale. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
          onClick={() => {
            void fetchInventory();
            void fetchTodaySales();
          }}
          className="h-9 rounded-xl text-xs font-semibold"
        >
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[24px] bg-slate-900 p-4 text-white shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Today's Revenue
            </p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(todayTotal)}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sales Today
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{todaySales.length}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Units Sold
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totalItemsSoldToday}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Items In Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {inventory.filter((i) => i.quantity > 0).length}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">New Sale</h2>
          </div>

          <div className="space-y-4">
            <div ref={selectorRef} className="relative">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item
              </label>

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

              {selectorOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                              {formatCurrency(Number(item.unit_price || 0))}
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

            {selectedItem && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
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
                        if (Number.isNaN(v)) {
                          setQty(1);
                          return;
                        }
                        setQty(Math.max(1, v));
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

                  {qty > maxQty && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600">
                      <AlertCircle size={11} />
                      Max {maxQty}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unit Price
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {formatCurrency(unitPrice)}
                  </div>
                </div>

                <div>
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

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <CalendarDays size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Today's Sales</p>
                <p className="text-xs text-slate-500">
                  {new Date().toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {todaySales.length > 0 && (
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500">Total</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(todayTotal)}</p>
              </div>
            )}
          </div>

          {loadingSales ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : todaySales.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                <Receipt size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No sales recorded today yet.</p>
              <p className="text-xs text-slate-400">Select an item above to record your first sale.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {todaySales.map((sale) => (
                      <tr key={sale.id} className="transition hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-medium text-slate-900">{sale.item_name ?? "—"}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{sale.quantity}</td>
                        <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(Number(sale.unit_price || 0))}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">{formatCurrency(Number(sale.line_total || 0))}</td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-400">{formatTime(sale.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={3} className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
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

              <div className="divide-y divide-slate-100 md:hidden">
                {todaySales.map((sale) => (
                  <div key={sale.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <TrendingUp size={14} className="text-slate-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">{sale.item_name ?? "—"}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {sale.quantity} × {formatCurrency(Number(sale.unit_price || 0))} • {formatTime(sale.created_at)}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {formatCurrency(Number(sale.line_total || 0))}
                    </p>
                  </div>
                ))}

                <div className="flex items-center justify-between bg-slate-50 px-5 py-3.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Day Total</span>
                  <span className="text-base font-extrabold text-slate-900">{formatCurrency(todayTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default SalesPage;
