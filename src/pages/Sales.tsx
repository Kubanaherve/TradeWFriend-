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
  Receipt,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  X,
  Download,
  Trash2,
  FileText,
  Hash,
  DollarSign,
  CheckCircle2,
  Clock,
  BarChart3,
  Loader2,
  ShoppingCart,
  ChevronRight,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { formatCurrency } from "@/lib/kinyarwanda";
import {
  createCsvBlob,
  saveBlobWithPicker,
  exportCsvType,
} from "@/lib/fileExport";
import type { InventoryItem } from "@/types/inventory";

/* ─── interfaces ─── */
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

interface CartItem {
  cartId: string;
  item: InventoryItem;
  qty: number;
}

type DateFilter = "today" | "week" | "month" | "all";

/* ── Category config ── */
const CATEGORY_CONFIG: Record<string, { icon: string; subcategories: string[] }> = {
  Drinks:    { icon: "🥤", subcategories: ["All","Soda","Juice","Water","Milk","Yogurt","Energy Drink","Tea","Coffee","Alcohol"] },
  Food:      { icon: "🍚", subcategories: ["All","Rice","Flour","Atta","Dal","Beans","Semolina","Grains","Poha","Besan","Spices","Salt","Sugar","Oats","Cornflakes","Pasta","Noodles","Condiments","Spreads","Milk Powder","Food Oils"] },
  Snacks:    { icon: "🍪", subcategories: ["All","Chips","Biscuits","Chocolate","Cake","Candy","Gum","Lollipops","Nuts"] },
  Hygiene:   { icon: "🧼", subcategories: ["All","Toothpaste","Soap","Sanitary Pads","Baby Products","Lotion","Hair Products","Cleaning Products","Tissue & Rolls","Powder & Fresheners"] },
  Household: { icon: "🏠", subcategories: ["All","Mosquito Spray","Bottles","Toothpicks & Cotton","Matches","Cleaning Tools","Miscellaneous"] },
};

const padNumber = (n: number) => String(n).padStart(3, "0");
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const getDateRange = (filter: DateFilter) => {
  const now = new Date(); let start = new Date();
  switch (filter) {
    case "today":  start.setHours(0, 0, 0, 0); break;
    case "week":   start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); break;
    case "month":  start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case "all":    start = new Date("2000-01-01T00:00:00.000Z"); break;
  }
  return { start: start.toISOString(), end: now.toISOString() };
};
const getCategoryIcon = (category?: string | null) =>
  CATEGORY_CONFIG[category ?? ""]?.icon ?? "📦";

const StockBadge = ({ qty, outOfStockLabel, leftLabel, inStockLabel }: { qty: number; outOfStockLabel: string; leftLabel: string; inStockLabel: string }) => {
  if (qty <= 0)  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{outOfStockLabel}</span>;
  if (qty <= 5)  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{qty} {leftLabel}</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{qty} {inStockLabel}</span>;
};

/* ═══════════════════════════════════════════════════════ */
const SalesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
  const { t } = useI18n();
  const { settings: businessSettings } = useBusinessSettings();

  const businessName = businessSettings.businessName?.trim() || "Business";
  const isOwner = profile?.role === "owner";
  const tr = useCallback((key: string, vars?: Record<string, string | number>) => {
    const template = t(key);
    if (!vars) return template;
    return Object.entries(vars).reduce(
       (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
      template
    );
  }, [t]);
  const filterLabels = useMemo<Record<DateFilter, string>>(
    () => ({
      today: t("sales.todayOnly"),
      week: t("sales.thisWeek"),
      month: t("sales.thisMonth"),
      all: t("sales.allTime"),
    }),
    [t]
  );

  /* ── data state ── */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales]         = useState<SaleRecord[]>([]);

  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingSales, setLoadingSales]         = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [deleting, setDeleting]                 = useState(false);

  /* ── CART (replaces single-item selectedItem/qty) ── */
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [notes, setNotes]         = useState("");

  /* ── modals ── */
  const [isSaleModalOpen, setIsSaleModalOpen]       = useState(false);
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);

  /* ── inventory popup state ── */
  const [inventoryQuery, setInventoryQuery]           = useState("");
  const [popupSelectedItem, setPopupSelectedItem]     = useState<InventoryItem | null>(null);
  const [popupItemQty, setPopupItemQty]               = useState<string>("1");
  const [selectedCategory, setSelectedCategory]       = useState<string>("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All");

  /* ── date filter ── */
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const fetchSalesAbort = useRef<AbortController | null>(null);
  const fetchInvAbort   = useRef<AbortController | null>(null);

  /* ── auth guard ── */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [authLoading, isAuthenticated, navigate]);

  /* ── escape key ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showInventoryPopup) { setShowInventoryPopup(false); return; }
      if (isSaleModalOpen)    { setIsSaleModalOpen(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSaleModalOpen, showInventoryPopup]);

  /* ── reset popup on close ── */
  useEffect(() => {
    if (!showInventoryPopup) {
      setPopupSelectedItem(null);
      setPopupItemQty("1");
      setInventoryQuery("");
      setSelectedCategory("All");
      setSelectedSubcategory("All");
    }
  }, [showInventoryPopup]);

  useEffect(() => { setSelectedSubcategory("All"); }, [selectedCategory]);

  /* ── helpers ── */
  const normalizeSalesRows = (rows: any[]): SaleRecord[] =>
    (rows ?? []).map((row: any) => {
      const quantity  = Number(row.quantity  ?? 0);
      const salePrice = Number(row.sale_price ?? 0);
      const costPrice = Number(row.cost_price ?? 0);
      const unitPrice = row.unit_price != null
        ? Number(row.unit_price ?? 0)
        : quantity > 0 ? salePrice / quantity : 0;
      return {
        id:          String(row.id),
        sale_number: row.sale_number ?? null,
        item_id:     row.item_id ?? null,
        item_name:   row.item_name ?? "Sale",
        quantity, cost_price: costPrice, unit_price: unitPrice,
        sale_price:  salePrice,
        notes:       row.notes ?? null,
        created_at:  String(row.created_at ?? new Date().toISOString()),
      };
    });

  const fetchInventory = useCallback(async () => {
    fetchInvAbort.current?.abort();
    fetchInvAbort.current = new AbortController();
    setLoadingInventory(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .order("item_name", { ascending: true });
      if (error) throw error;
      const mapped: InventoryItem[] = (data ?? []).map((row: any) => ({
        id:              String(row.id),
        item_name:       String(row.item_name ?? ""),
        quantity:        Number(row.quantity ?? 0),
        cost_price:      Number(row.cost_price ?? 0),
        category:        row.category ?? null,
        subcategory:     row.subcategory ?? null,
        normalized_name: row.normalized_name ?? (row.item_name ? String(row.item_name).toLowerCase().trim() : ""),
        created_at:      row.created_at ?? undefined,
      }));
      setInventory(mapped);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(err?.message || t("sales.failedToLoadInventory"));
      setInventory([]);
    } finally {
      setLoadingInventory(false);
    }
  }, [t]);

  const fetchSales = useCallback(async (filter: DateFilter = dateFilter) => {
    fetchSalesAbort.current?.abort();
    fetchSalesAbort.current = new AbortController();
    setLoadingSales(true);
    try {
      const { start, end } = getDateRange(filter);
      const { data, error } = await (supabase as any)
        .from("sales")
        .select("id, sale_number, item_id, item_name, quantity, cost_price, unit_price, sale_price, notes, created_at")
        .gte("created_at", start).lte("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSales(normalizeSalesRows(data ?? []));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(err?.message || t("sales.failedToLoadSales"));
      setSales([]);
    } finally {
      setLoadingSales(false);
    }
  }, [dateFilter, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchInventory();
    void fetchSales(dateFilter);
  }, [isAuthenticated, fetchInventory, fetchSales, dateFilter]);

  useEffect(() => {
    const refresh = () => { void fetchInventory(); void fetchSales(dateFilter); };
    const events = ["focus","factoryReset","salesDeleted","newSaleRecorded","inventoryUpdated"];
    events.forEach((e) => window.addEventListener(e, refresh as EventListener));
    return () => events.forEach((e) => window.removeEventListener(e, refresh as EventListener));
  }, [dateFilter, fetchInventory, fetchSales]);

  useEffect(() => () => {
    fetchSalesAbort.current?.abort();
    fetchInvAbort.current?.abort();
  }, []);

  /* ── sale numbers ── allocates `count` sequential numbers in one DB round-trip */
  const generateSaleNumbers = useCallback(async (count: number): Promise<string[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from("sales").select("sale_number")
        .not("sale_number", "is", null)
        .order("sale_number", { ascending: false }).limit(1);
      if (error) throw error;
      let next = 1;
      if (data?.length && data[0]?.sale_number) {
        // handles both "SALE-001" and legacy formats
        const n = parseInt(String(data[0].sale_number).split("-")[1] ?? "0", 10);
        if (!Number.isNaN(n)) next = n + 1;
      }
      return Array.from({ length: count }, (_, i) => `SALE-${padNumber(next + i)}`);
    } catch {
      const base = Date.now();
      return Array.from({ length: count }, (_, i) => `SALE-${String(base + i).slice(-6)}`);
    }
  }, []);

  /* ── open / close sale modal ── */
  const resetSaleForm = useCallback(() => {
    setCartItems([]);
    setNotes("");
  }, []);

  const openSaleModal  = () => { resetSaleForm(); setIsSaleModalOpen(true); };
  const closeSaleModal = () => { setIsSaleModalOpen(false); setShowInventoryPopup(false); };

  /* ── category options ── */
  const categoryOptions = useMemo(() => ["All", ...Object.keys(CATEGORY_CONFIG)], []);
  const subcategoryOptions = useMemo(() => {
    if (selectedCategory === "All") return ["All"];
    return CATEGORY_CONFIG[selectedCategory]?.subcategories ?? ["All"];
  }, [selectedCategory]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchCat = selectedCategory    === "All" || item.category    === selectedCategory;
      const matchSub = selectedSubcategory === "All" || item.subcategory === selectedSubcategory;
      const hay      = [item.item_name, item.category ?? "", item.subcategory ?? "", item.normalized_name ?? ""].join(" ").toLowerCase();
      return matchCat && matchSub && (!q || hay.includes(q));
    });
  }, [inventory, inventoryQuery, selectedCategory, selectedSubcategory]);

  /* ── CART helpers ── */
  const addToCart = (item: InventoryItem, qty: number) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        const newQty = existing.qty + qty;
        if (newQty > item.quantity) {
          toast.error(`${tr("sales.onlyInStock", { n: item.quantity })} ${item.item_name}`);
          return prev;
        }
        return prev.map((ci) => ci.item.id === item.id ? { ...ci, qty: newQty } : ci);
      }
      return [...prev, { cartId: crypto.randomUUID(), item, qty }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartId !== cartId));
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((ci) => {
        if (ci.cartId !== cartId) return ci;
        const newQty = ci.qty + delta;
        if (newQty < 1) return ci;
        if (newQty > ci.item.quantity) {
          toast.error(tr("sales.onlyInStock", { n: ci.item.quantity }));
          return ci;
        }
        return { ...ci, qty: newQty };
      })
    );
  };

  /* ── confirm item from popup → add to cart ── */
  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;
    const q = parseInt(popupItemQty, 10);
    if (Number.isNaN(q) || q < 1) { toast.error(t("sales.quantityMin")); return; }
    if (q > popupSelectedItem.quantity) { toast.error(tr("sales.onlyNInStock", { n: popupSelectedItem.quantity })); return; }

    addToCart(popupSelectedItem, q);
    toast.success(`✓ ${popupSelectedItem.item_name} ${t("sales.addedToCart")}`);
    // Reset selection but KEEP popup open so they can add more items
    setPopupSelectedItem(null);
    setPopupItemQty("1");
  };

  /* ── save ALL cart items as one sale batch ── */
  const handleSave = async () => {
    if (cartItems.length === 0) { toast.error(t("sales.atLeastOneItem")); return; }
    for (const ci of cartItems) {
      if (ci.qty <= 0 || ci.qty > ci.item.quantity) {
        toast.error(`${t("sales.checkQuantity")} "${ci.item.item_name}"`);
        return;
      }
    }

    setSaving(true);
    try {
      const createdAt   = new Date().toISOString();
      // Allocate one unique sale number per item in a single round-trip
      const saleNumbers = await generateSaleNumbers(cartItems.length);

      for (let i = 0; i < cartItems.length; i++) {
        const ci        = cartItems[i];
        const unitPrice = Number(ci.item.cost_price ?? 0);
        const salePrice = unitPrice * ci.qty;

        const { error: insertError } = await (supabase as any).from("sales").insert({
          sale_number: saleNumbers[i],
          item_id:    ci.item.id,
          item_name:  ci.item.item_name,
          quantity:   ci.qty,
          cost_price: unitPrice,
          unit_price: unitPrice,
          sale_price: salePrice,
          notes:      notes.trim() || null,
          created_at: createdAt,
          date_sold:  createdAt.split("T")[0],
          added_by:   profile?.phone ?? null,
        });
        if (insertError) throw insertError;

        const newQty = Math.max(ci.item.quantity - ci.qty, 0);
        await (supabase as any).from("inventory_items").update({ quantity: newQty }).eq("id", ci.item.id);
      }

      const grandTotal = cartItems.reduce((s, ci) => s + Number(ci.item.cost_price) * ci.qty, 0);
      toast.success(`✓ ${t("sales.saleSaved")} — ${formatCurrency(grandTotal)} (${cartItems.length} ${cartItems.length > 1 ? t("sales.itemsInCart") : t("sales.itemInCart")})`);

      resetSaleForm();
      closeSaleModal();
      window.dispatchEvent(new CustomEvent("newSaleRecorded"));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      await Promise.allSettled([fetchInventory(), fetchSales(dateFilter)]);
    } catch (err: any) {
      toast.error(err?.message || t("sales.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  /* ── delete single sale + restore inventory ── */
  const handleDeleteSale = useCallback(async (sale: SaleRecord) => {
    if (!window.confirm(t("sales.confirmDeleteSale") || "Delete this sale and restore inventory?")) return;

    // Step 1 — delete the sale row
    const { error: deleteError } = await (supabase as any)
      .from("sales").delete().eq("id", sale.id);
    if (deleteError) {
      toast.error(deleteError.message || t("sales.failedToDelete"));
      return;
    }

    // Step 2 — update UI immediately so the row disappears regardless of what follows
    setSales((prev) => prev.filter((s) => s.id !== sale.id));

    // Step 3 — restore inventory (isolated; a failure here won't undo the delete)
    if (sale.item_id && sale.quantity > 0) {
      try {
        // .maybeSingle() returns { data: null } instead of throwing when 0 rows found
        const { data: invData, error: fetchError } = await (supabase as any)
          .from("inventory_items")
          .select("quantity")
          .eq("id", sale.item_id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (invData) {
          const { error: updateError } = await (supabase as any)
            .from("inventory_items")
            .update({ quantity: (invData.quantity ?? 0) + sale.quantity })
            .eq("id", sale.item_id);
          if (updateError) throw updateError;
        }

        void fetchInventory();
        window.dispatchEvent(new CustomEvent("inventoryUpdated"));
        toast.success(t("sales.saleDeleted") || "Sale deleted & inventory restored");
      } catch {
        // sale is already gone — just warn about stock
        toast.warning(t("sales.saleDeletedStockNotRestored") || "Sale deleted but stock could not be restored");
        void fetchInventory();
      }
    } else {
      toast.success(t("sales.saleDeleted") || "Sale deleted");
    }
  }, [t, fetchInventory]);

  /* ── exports ── */
  const handleExportCSV = useCallback(async () => {
    if (!sales.length) { toast.error(t("sales.noSalesToExport")); return; }
    try {
      const lines = ['"Date","Sale #","Item","Qty","Unit Price","Total","Notes"'];
      sales.forEach((s) =>
        lines.push(`"${new Date(s.created_at).toLocaleString()}","${s.sale_number ?? "—"}","${s.item_name ?? "—"}","${s.quantity}","${s.unit_price}","${s.sale_price}","${s.notes ?? ""}"`)
      );
      lines.push("", `"TOTAL","","","","",${sales.reduce((a, s) => a + Number(s.sale_price || 0), 0)},""`)
      const blob = createCsvBlob(lines);
      await saveBlobWithPicker(blob, `${businessName}-sales-${dateFilter}-${new Date().toISOString().split("T")[0]}.csv`, { fileType: exportCsvType, fallbackMimeType: "text/csv;charset=utf-8;" });
      toast.success(t("sales.csvExported"));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(t("sales.exportFailed"));
    }
  }, [businessName, dateFilter, sales, t]);

  const handleExportHTML = useCallback(async () => {
    if (!sales.length) { toast.error(t("sales.noSalesToExport")); return; }
    try {
      const total = sales.reduce((a, s) => a + Number(s.sale_price || 0), 0);
      const avg   = sales.length ? total / sales.length : 0;
      const html  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${businessName} ${t("sales.title")}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}h1{text-align:center}.summary{background:#f8fafc;padding:14px;border-radius:12px;margin:20px 0;border:1px solid #e2e8f0}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#0f172a;color:#fff;padding:10px;text-align:left}td{padding:10px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#fafafa}.footer{text-align:center;margin-top:30px;font-size:12px;color:#64748b}</style></head><body><h1>${businessName} ${t("sales.title")}</h1><div class="summary"><p><strong>${t("common.status")}:</strong> ${filterLabels[dateFilter]}</p><p><strong>${t("sales.revenue")}:</strong> ${formatCurrency(total)}</p><p><strong>${t("sales.transactions")}:</strong> ${sales.length}</p><p><strong>${t("sales.avgSale")}:</strong> ${formatCurrency(avg)}</p></div><table><thead><tr><th>${t("common.date")}</th><th>${t("sales.saleNumber")}</th><th>${t("sales.item")}</th><th>${t("sales.qty")}</th><th>${t("sales.unitPrice")}</th><th>${t("sales.total")}</th><th>${t("sales.note")}</th></tr></thead><tbody>${sales.map((s) => `<tr><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.sale_number ?? "—"}</td><td>${s.item_name ?? "—"}</td><td>${s.quantity}</td><td>${formatCurrency(s.unit_price)}</td><td><strong>${formatCurrency(s.sale_price)}</strong></td><td>${s.notes ?? ""}</td></tr>`).join("")}</tbody></table><div class="footer"><p>${new Date().toLocaleString()} · ${businessName}</p></div></body></html>`;
      const blob  = new Blob([html], { type: "text/html;charset=utf-8;" });
      await saveBlobWithPicker(blob, `${businessName}-sales-report-${dateFilter}-${new Date().toISOString().split("T")[0]}.html`, { fallbackMimeType: "text/html;charset=utf-8;" });
      toast.success(t("sales.reportExported"));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(t("sales.exportFailed"));
    }
  }, [businessName, dateFilter, filterLabels, sales, t]);

  const handleDeleteAll = useCallback(async () => {
    if (!isOwner) { toast.error(t("sales.ownerOnly")); return; }
    if (!window.confirm(t("sales.confirmDeleteAll"))) return;
    if (!window.confirm(t("sales.cannotUndo"))) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("sales").delete().not("id", "is", null);
      if (error) throw error;
      setSales([]);
      window.dispatchEvent(new CustomEvent("salesDeleted"));
      toast.success(t("sales.allSalesDeleted"));
    } catch { toast.error(t("sales.failedToDelete")); }
    finally { setDeleting(false); }
  }, [isOwner, t]);

  /* ── derived ── */
  const cartTotal = useMemo(
    () => cartItems.reduce((s, ci) => s + Number(ci.item.cost_price) * ci.qty, 0),
    [cartItems]
  );
  const cartValid = cartItems.length > 0 &&
    cartItems.every((ci) => ci.qty > 0 && ci.qty <= ci.item.quantity);

  const totalRevenue = useMemo(() => sales.reduce((a, s) => a + Number(s.sale_price ?? 0), 0), [sales]);
  const totalItems   = useMemo(() => sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0), [sales]);
  const avgSale      = sales.length ? totalRevenue / sales.length : 0;

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <AppShell
      title={t("sales.title")}
      subtitle={`${businessName} ${t("sales.salesCenter").toLowerCase()}`}
      showBack
      showHome
      contentClassName="pt-2 md:pt-4"
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void fetchInventory(); void fetchSales(dateFilter); }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={13} /> {t("sales.refresh")}
          </button>
          <button
            onClick={openSaleModal}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={13} /> {t("sales.newSale")}
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">

        {/* ── date filter pills ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                dateFilter === f ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}>
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {/* ── stat cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <DollarSign size={14} />, label: t("sales.revenue"),      value: formatCurrency(totalRevenue), accent: "bg-violet-600", text: "text-violet-700" },
            { icon: <Receipt size={14} />,    label: t("sales.transactions"), value: String(sales.length),         accent: "bg-blue-600",   text: "text-blue-700"   },
            { icon: <BarChart3 size={14} />,  label: t("sales.avgSale"),      value: formatCurrency(avgSale),      accent: "bg-emerald-600",text: "text-emerald-700"},
            { icon: <Package size={14} />,    label: t("sales.itemsSold"),    value: String(totalItems),           accent: "bg-amber-500",  text: "text-amber-700"  },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.accent} text-white`}>{card.icon}</div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</span>
              </div>
              <p className={`text-xl font-extrabold ${card.text}`}>
                {loadingSales ? <span className="inline-block h-5 w-20 animate-pulse rounded bg-slate-100" /> : card.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── sales table ── */}
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <CalendarDays size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{filterLabels[dateFilter]} {t("sales.salesList")}</p>
              <p className="text-[11px] text-slate-500">{sales.length} {sales.length !== 1 ? t("sales.transactions_plural") : t("sales.transaction")}</p>
            </div>
            {sales.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("sales.total")}</p>
                <p className="text-base font-extrabold text-slate-900">{formatCurrency(totalRevenue)}</p>
              </div>
            )}
          </div>

          {/* export / delete toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <Download size={13} className="text-slate-500" />
            </div>
            <span className="mr-auto text-xs font-semibold text-slate-600">
              {t("sales.export")} {sales.length} {sales.length !== 1 ? t("sales.transactions_plural") : t("sales.transaction")} ({filterLabels[dateFilter]})
            </span>
            <button onClick={handleExportCSV} disabled={!sales.length}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              <FileText size={12} /> {t("sales.exportCsv")}
            </button>
            <button onClick={handleExportHTML} disabled={!sales.length}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              <FileText size={12} /> HTML
            </button>
            {isOwner && (
              <button onClick={handleDeleteAll} disabled={!sales.length || deleting}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-40">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {t("sales.deleteAll")}
              </button>
            )}
          </div>

          {/* sales content */}
          {loadingSales ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin text-slate-300" /> {t("sales.loadingSales")}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                <Receipt size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-semibold text-slate-500">{tr("sales.noSalesYet", { period: filterLabels[dateFilter].toLowerCase() })}</p>
              <button onClick={openSaleModal}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                <Plus size={13} /> {t("sales.addFirstSale")}
              </button>
            </div>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      {[t("sales.saleNumber"), t("sales.item"), t("sales.qty"), t("sales.unitPrice"), t("sales.total"), t("sales.time"), ""].map((h, i) => (
                        <th key={h + i} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 ${i > 1 ? "text-right" : ""} ${i === 0 ? "pl-5" : ""} ${i === 6 ? "pr-5 w-8" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="group transition hover:bg-slate-50/60">
                        <td className="pl-5 pr-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                            <Hash size={9} className="text-slate-400" />{sale.sale_number ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-900">{sale.item_name ?? "—"}</span>
                          {sale.notes && <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{sale.notes}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-600">{sale.quantity}</td>
                        <td className="px-4 py-3.5 text-right text-slate-500">{formatCurrency(sale.unit_price)}</td>
                        <td className="px-4 py-3.5 text-right"><span className="font-extrabold text-slate-900">{formatCurrency(sale.sale_price)}</span></td>
                        <td className="pl-4 pr-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock size={10} />{formatTime(sale.created_at)}</span>
                        </td>
                        <td className="py-3.5 pr-4 text-right">
                          <button
                            onClick={() => handleDeleteSale(sale)}
                            title="Delete sale & restore inventory"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="pl-5 pr-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("sales.periodTotal")}</td>
                      <td className="px-4 py-3 text-right text-base font-extrabold text-slate-900">{formatCurrency(totalRevenue)}</td>
                      <td /><td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* mobile list */}
              <div className="divide-y divide-slate-50 md:hidden">
                {sales.map((sale) => (
                  <div key={sale.id} className="flex items-center gap-3 px-4 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                      <TrendingUp size={14} className="text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">{sale.item_name ?? "—"}</p>
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{sale.sale_number ?? "—"}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {t("sales.qty")} {sale.quantity} · {formatCurrency(sale.unit_price)} {t("sales.eachUnit")} · {formatTime(sale.created_at)}
                      </p>
                      {sale.notes && (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-amber-700">{sale.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-sm font-extrabold text-slate-900">{formatCurrency(sale.sale_price)}</p>
                      <button
                        onClick={() => handleDeleteSale(sale)}
                        title="Delete sale & restore inventory"
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={11} /> {t("sales.delete") || "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("sales.periodTotal")}</span>
                  <span className="text-base font-extrabold text-slate-900">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SALE MODAL  — Cart-based, mobile-first bottom sheet
          ════════════════════════════════════════════════════ */}
      {isSaleModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeSaleModal(); }}
        >
          <div
            className="flex w-full max-w-lg flex-col rounded-t-[2rem] bg-white shadow-2xl"
            style={{ maxHeight: "92dvh", fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {/* ── sticky header ── */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
                  <ShoppingCart size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t("sales.newSale")}</h2>
                  <p className="text-[11px] text-slate-400">
                    {cartItems.length === 0 ? t("sales.getStarted") : `${cartItems.length} ${cartItems.length > 1 ? t("sales.itemsInCart") : t("sales.itemInCart")}`}
                  </p>
                </div>
              </div>
              <button onClick={closeSaleModal}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>

            {/* ── scrollable body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* EMPTY STATE */}
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center gap-4 px-6 py-10">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50">
                    <ShoppingBag size={32} className="text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">{t("sales.cartEmpty")}</p>
                    <p className="mt-1 text-xs text-slate-400">{t("sales.cartEmptyHint")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInventoryPopup(true)}
                    className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
                        <Plus size={20} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">{t("sales.addItems")}</p>
                        <p className="text-xs text-slate-400">{t("sales.browseInventory")}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* CART ITEMS */}
                  {cartItems.map((ci, index) => {
                    const lineTotal = Number(ci.item.cost_price) * ci.qty;
                    const isOverStock = ci.qty > ci.item.quantity;
                    return (
                      <div
                        key={ci.cartId}
                        className={`flex items-center gap-3 px-4 py-3.5 ${index !== cartItems.length - 1 ? "border-b border-slate-100" : ""} ${isOverStock ? "bg-red-50/60" : ""}`}
                      >
                        {/* icon */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                          {getCategoryIcon(ci.item.category)}
                        </div>

                        {/* name + price */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{ci.item.item_name}</p>
                          <p className="text-xs text-slate-400">{formatCurrency(ci.item.cost_price)} {t("sales.eachUnit")}</p>
                          {isOverStock && (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                              <AlertCircle size={10} /> {tr("sales.onlyInStock", { n: ci.item.quantity })}
                            </p>
                          )}
                        </div>

                        {/* qty stepper */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(ci.cartId, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-90"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-8 text-center text-sm font-extrabold text-slate-900">{ci.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(ci.cartId, +1)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white active:scale-90"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* line total */}
                        <div className="w-20 shrink-0 text-right">
                          <p className={`text-sm font-extrabold ${isOverStock ? "text-red-600" : "text-slate-900"}`}>
                            {formatCurrency(lineTotal)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(ci.cartId)}
                            className="mt-0.5 text-[11px] font-medium text-red-400 hover:text-red-600 active:scale-90"
                          >
                            {t("sales.remove")}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* ADD MORE ITEMS ROW */}
                  <div className="border-t border-dashed border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setShowInventoryPopup(true)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 transition hover:bg-slate-100 active:scale-[0.98]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200">
                        <Plus size={16} className="text-slate-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{t("sales.addMoreItems")}</span>
                      <ChevronRight size={15} className="ml-auto text-slate-300" />
                    </button>
                  </div>

                  {/* NOTES */}
                  <div className="border-t border-slate-100 px-4 py-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      {t("sales.note")} <span className="normal-case font-normal text-slate-300">({t("sales.noteOptional")})</span>
                    </label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("sales.notePlaceholder")}
                      className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── sticky footer: totals + save ── */}
            {cartItems.length > 0 && (
              <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-6 pt-4">

                {/* Totals breakdown */}
                <div className="mb-4 space-y-2 rounded-2xl bg-slate-50 px-4 py-3.5">
                  {cartItems.map((ci) => (
                    <div key={ci.cartId} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-500" style={{ maxWidth: "60%" }}>
                        {ci.item.item_name} × {ci.qty}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(Number(ci.item.cost_price) * ci.qty)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("sales.grandTotal")}</span>
                    <span className="text-xl font-extrabold text-slate-900">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeSaleModal}
                    className="flex h-13 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                    style={{ height: 52 }}
                  >
                    {t("sales.cancel")}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !cartValid}
                    className={`flex flex-[2] items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] ${
                      cartValid && !saving
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    }`}
                    style={{ height: 52 }}
                  >
                    {saving ? (
                      <><Loader2 size={18} className="animate-spin" /> {t("sales.savingSale")}</>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        {t("sales.confirmSale")}
                        {cartValid && (
                          <span className="ml-1 rounded-xl bg-white/25 px-2.5 py-1 text-xs font-extrabold">
                            {formatCurrency(cartTotal)}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          INVENTORY POPUP — Add items to cart
          ═══════════════════════════════════════════════════ */}
      {showInventoryPopup && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowInventoryPopup(false); }}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-t-[2rem] bg-white shadow-2xl"
            style={{ maxHeight: "88dvh", fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {/* popup header */}
            <div className="shrink-0 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t("sales.chooseItems")}</h2>
                  <p className="text-[11px] text-slate-400">
                    {cartItems.length > 0
                      ? `${cartItems.length} ${cartItems.length > 1 ? t("sales.itemsInCart") : t("sales.itemInCart")} · ${t("sales.tapToAddMore")}`
                      : t("sales.tapToAdd")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInventoryPopup(false)}
                      className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                    >
                      <CheckCircle2 size={13} />
                      {t("sales.done")} ({cartItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInventoryPopup(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* search bar */}
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    autoFocus
                    value={inventoryQuery}
                    onChange={(e) => setInventoryQuery(e.target.value)}
                    placeholder={t("sales.searchPlaceholder")}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {inventoryQuery && (
                    <button type="button" onClick={() => setInventoryQuery("")}>
                      <X size={13} className="text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* category pills */}
              <div className="mt-3 overflow-x-auto">
                <div className="flex gap-2 pb-1">
                  {(["All", ...Object.keys(CATEGORY_CONFIG)]).map((cat) => {
                    const active = selectedCategory === cat;
                    const icon   = cat === "All" ? "🧾" : CATEGORY_CONFIG[cat]?.icon ?? "📦";
                    return (
                      <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                        className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <span className="mr-1">{icon}</span>{cat === "All" ? t("sales.all") : cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* subcategory pills */}
              {selectedCategory !== "All" && (
                <div className="mt-2 overflow-x-auto">
                  <div className="flex gap-2 pb-1">
                    {subcategoryOptions.map((sub) => {
                      const active = selectedSubcategory === sub;
                      return (
                        <button key={sub} type="button" onClick={() => setSelectedSubcategory(sub)}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"}`}>
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* item list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loadingInventory ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">{t("sales.noItemsFound")}</div>
              ) : (
                <div className="space-y-2">
                  {filteredInventory.map((item) => {
                    const inCart    = cartItems.find((ci) => ci.item.id === item.id);
                    const isSelected = popupSelectedItem?.id === item.id;
                    const outOfStock = item.quantity <= 0;

                    return (
                      <div
                        key={item.id}
                        className={`overflow-hidden rounded-2xl border-2 transition-all ${
                          outOfStock
                            ? "cursor-not-allowed border-slate-100 opacity-40"
                            : isSelected
                              ? "border-slate-900 bg-slate-50 shadow-md"
                              : inCart
                                ? "border-emerald-400 bg-emerald-50/30"
                                : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => {
                            if (outOfStock) return;
                            if (isSelected) {
                              setPopupSelectedItem(null);
                              setPopupItemQty("1");
                            } else {
                              setPopupSelectedItem(item);
                              setPopupItemQty("1");
                            }
                          }}
                          className="flex w-full items-center gap-3 p-4 text-left"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{item.item_name}</p>
                              {inCart && (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  ✓ {inCart.qty} {t("sales.inCart")}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.category ?? "Uncategorized"}{item.subcategory ? ` · ${item.subcategory}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-slate-900">{formatCurrency(item.cost_price)}</p>
                            <StockBadge qty={item.quantity} outOfStockLabel={t("sales.outOfStock")} leftLabel={t("sales.leftSuffix")} inStockLabel={t("sales.inStock")} />
                          </div>
                        </button>

                        {/* inline qty picker when selected */}
                        {isSelected && (
                          <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-4 py-3">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("sales.qty")}</span>
                            <div className="flex flex-1 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPopupItemQty((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-90"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number" min={1} max={item.quantity}
                                value={popupItemQty}
                                onChange={(e) => setPopupItemQty(e.target.value)}
                                className="h-9 w-16 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm font-extrabold outline-none focus:border-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => setPopupItemQty((v) => String(Math.min(item.quantity, parseInt(v, 10) + 1)))}
                                className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-emerald-600 px-3 text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.97]"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={confirmPopupItem}
                              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm shadow-emerald-200 active:scale-[0.97]"
                            >
                              <Plus size={14} /> {t("sales.add")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default SalesPage;