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
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/useI18n";
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

/* ── Stock badge ── */
const StockBadge = ({ qty, outOfStockLabel, leftLabel, inStockLabel }: {
  qty: number; outOfStockLabel: string; leftLabel: string; inStockLabel: string;
}) => {
  if (qty <= 0)  return (
    <span style={{ background: "#FEE2E2", color: "#DC2626" }}
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide">
      {outOfStockLabel}
    </span>
  );
  if (qty <= 5)  return (
    <span style={{ background: "#FEF3C7", color: "#D97706" }}
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide">
      {qty} {leftLabel}
    </span>
  );
  return (
    <span style={{ background: "#DCFCE7", color: "#16A34A" }}
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide">
      {qty} {inStockLabel}
    </span>
  );
};

/* ── Stat Card ── */
const StatCard = ({ icon, label, value, loading, accentColor, bgColor, textColor }: {
  icon: React.ReactNode; label: string; value: string;
  loading: boolean; accentColor: string; bgColor: string; textColor: string;
}) => (
  <div style={{
    background: "#FFFFFF",
    borderRadius: 20,
    border: "1.5px solid #F1F5F9",
    padding: "16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    transition: "box-shadow 0.2s",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 34, height: 34,
        borderRadius: 10,
        background: bgColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accentColor,
      }}>{icon}</div>
    </div>
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94A3B8", marginBottom: 4 }}>{label}</p>
    {loading
      ? <div style={{ height: 24, width: 80, borderRadius: 8, background: "#F1F5F9", animation: "pulse 1.5s ease-in-out infinite" }} />
      : <p style={{ fontSize: 20, fontWeight: 800, color: textColor, letterSpacing: "-0.03em" }}>{value}</p>
    }
  </div>
);

/* ════════════════════════════════════════════════════════ */
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
      week:  t("sales.thisWeek"),
      month: t("sales.thisMonth"),
      all:   t("sales.allTime"),
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

  /* ── CART ── */
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

  const generateSaleNumbers = useCallback(async (count: number): Promise<string[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from("sales").select("sale_number")
        .not("sale_number", "is", null)
        .order("sale_number", { ascending: false }).limit(1);
      if (error) throw error;
      let next = 1;
      if (data?.length && data[0]?.sale_number) {
        const n = parseInt(String(data[0].sale_number).split("-")[1] ?? "0", 10);
        if (!Number.isNaN(n)) next = n + 1;
      }
      return Array.from({ length: count }, (_, i) => `SALE-${padNumber(next + i)}`);
    } catch {
      const base = Date.now();
      return Array.from({ length: count }, (_, i) => `SALE-${String(base + i).slice(-6)}`);
    }
  }, []);

  const resetSaleForm = useCallback(() => {
    setCartItems([]);
    setNotes("");
  }, []);

  const openSaleModal  = () => { resetSaleForm(); setIsSaleModalOpen(true); };
  const closeSaleModal = () => { setIsSaleModalOpen(false); setShowInventoryPopup(false); };

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

  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;
    const q = parseInt(popupItemQty, 10);
    if (Number.isNaN(q) || q < 1) { toast.error(t("sales.quantityMin")); return; }
    if (q > popupSelectedItem.quantity) { toast.error(tr("sales.onlyNInStock", { n: popupSelectedItem.quantity })); return; }
    addToCart(popupSelectedItem, q);
    toast.success(`✓ ${popupSelectedItem.item_name} ${t("sales.addedToCart")}`);
    setPopupSelectedItem(null);
    setPopupItemQty("1");
  };

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
      toast.success(`✓ ${t("sales.saleSaved")} — ${formatCurrency(grandTotal)}`);
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

  const handleDeleteSale = useCallback(async (sale: SaleRecord) => {
    if (!window.confirm(t("sales.confirmDeleteSale") || "Delete this sale and restore inventory?")) return;
    const { error: deleteError } = await (supabase as any).from("sales").delete().eq("id", sale.id);
    if (deleteError) { toast.error(deleteError.message || t("sales.failedToDelete")); return; }
    setSales((prev) => prev.filter((s) => s.id !== sale.id));
    if (sale.item_id && sale.quantity > 0) {
      try {
        const { data: invData, error: fetchError } = await (supabase as any)
          .from("inventory_items").select("quantity").eq("id", sale.item_id).maybeSingle();
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
        toast.warning(t("sales.saleDeletedStockNotRestored") || "Sale deleted but stock could not be restored");
        void fetchInventory();
      }
    } else {
      toast.success(t("sales.saleDeleted") || "Sale deleted");
    }
  }, [t, fetchInventory]);

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

  /* ════════════════════════ STYLES ════════════════════════ */
  const styles = {
    page: {
      background: "#F8FAFC",
      minHeight: "100vh",
      fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    } as React.CSSProperties,

    // Filter pills
    filterPill: (active: boolean): React.CSSProperties => ({
      padding: "8px 18px",
      borderRadius: 100,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.02em",
      border: "none",
      cursor: "pointer",
      transition: "all 0.18s ease",
      background: active ? "#1E293B" : "#FFFFFF",
      color: active ? "#FFFFFF" : "#64748B",
      boxShadow: active ? "0 4px 12px rgba(30,41,59,0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
    }),

    // Section card
    sectionCard: {
      background: "#FFFFFF",
      borderRadius: 24,
      border: "1.5px solid #F1F5F9",
      boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      overflow: "hidden",
    } as React.CSSProperties,

    // New Sale FAB
    fab: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 20px",
      background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)",
      color: "#FFFFFF",
      border: "none",
      borderRadius: 16,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(30,41,59,0.25)",
      transition: "all 0.18s ease",
    } as React.CSSProperties,

    // Refresh button
    refreshBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 14px",
      background: "#FFFFFF",
      color: "#64748B",
      border: "1.5px solid #E2E8F0",
      borderRadius: 14,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.15s ease",
    } as React.CSSProperties,

    // Sale row
    saleRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      borderBottom: "1px solid #F8FAFC",
      transition: "background 0.15s",
    } as React.CSSProperties,

    // Modal overlay
    overlay: {
      position: "fixed" as const,
      inset: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      background: "rgba(15, 23, 42, 0.5)",
      backdropFilter: "blur(8px)",
    },

    // Bottom sheet
    sheet: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "92dvh",
      background: "#FFFFFF",
      borderRadius: "28px 28px 0 0",
      display: "flex",
      flexDirection: "column" as const,
      boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
    },

    // Sheet handle
    handle: {
      width: 40,
      height: 4,
      borderRadius: 100,
      background: "#E2E8F0",
      margin: "12px auto 0",
      flexShrink: 0,
    },

    // Cart item row
    cartRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      borderBottom: "1px solid #F8FAFC",
    } as React.CSSProperties,

    // Qty stepper button
    qtyBtn: (dark: boolean): React.CSSProperties => ({
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: dark ? "#1E293B" : "#F1F5F9",
      color: dark ? "#FFFFFF" : "#475569",
      transition: "all 0.15s",
      flexShrink: 0,
    }),

    // Confirm/Save button
    saveBtn: (valid: boolean): React.CSSProperties => ({
      flex: 2,
      height: 54,
      borderRadius: 18,
      border: "none",
      cursor: valid ? "pointer" : "not-allowed",
      background: valid
        ? "linear-gradient(135deg, #059669 0%, #10B981 100%)"
        : "#E2E8F0",
      color: valid ? "#FFFFFF" : "#94A3B8",
      fontSize: 15,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: valid ? "0 6px 20px rgba(5,150,105,0.3)" : "none",
      transition: "all 0.2s ease",
    }),

    // Inventory item card
    invCard: (selected: boolean, inCart: boolean, outOfStock: boolean): React.CSSProperties => ({
      borderRadius: 18,
      border: `2px solid ${selected ? "#1E293B" : inCart ? "#10B981" : "#F1F5F9"}`,
      background: selected ? "#F8FAFC" : inCart ? "#F0FDF4" : "#FFFFFF",
      overflow: "hidden",
      transition: "all 0.18s ease",
      opacity: outOfStock ? 0.45 : 1,
      cursor: outOfStock ? "not-allowed" : "pointer",
      boxShadow: selected ? "0 4px 16px rgba(30,41,59,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
    }),

    // Search bar
    searchBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#F8FAFC",
      border: "1.5px solid #E2E8F0",
      borderRadius: 16,
      padding: "10px 14px",
    } as React.CSSProperties,

    // Category pill
    catPill: (active: boolean, accent?: boolean): React.CSSProperties => ({
      padding: "7px 14px",
      borderRadius: 100,
      fontSize: 12,
      fontWeight: 600,
      border: "none",
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      transition: "all 0.15s ease",
      background: active
        ? (accent ? "#4F46E5" : "#1E293B")
        : (accent ? "#EEF2FF" : "#F1F5F9"),
      color: active
        ? "#FFFFFF"
        : (accent ? "#4F46E5" : "#64748B"),
    }),

    // Total bar in footer
    totalBar: {
      background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
      borderRadius: 18,
      padding: "14px 16px",
      marginBottom: 14,
      border: "1px solid #E2E8F0",
    } as React.CSSProperties,
  };

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <AppShell
      title={t("sales.title")}
      subtitle={`${businessName} · ${t("sales.salesCenter")}`}
      showBack
      showHome
      contentClassName="pt-2 md:pt-4"
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={styles.refreshBtn}
            onClick={() => { void fetchInventory(); void fetchSales(dateFilter); }}
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">{t("sales.refresh")}</span>
          </button>
          <button style={styles.fab} onClick={openSaleModal}>
            <Plus size={15} />
            {t("sales.newSale")}
          </button>
        </div>
      }
    >
      <div style={styles.page}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 32px" }}>

          {/* ── date filter pills ── */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
            {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
              <button key={f} style={styles.filterPill(dateFilter === f)} onClick={() => setDateFilter(f)}>
                {filterLabels[f]}
              </button>
            ))}
          </div>

          {/* ── stat cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <StatCard icon={<DollarSign size={15} />} label={t("sales.revenue")}
              value={formatCurrency(totalRevenue)} loading={loadingSales}
              accentColor="#7C3AED" bgColor="#F5F3FF" textColor="#6D28D9" />
            <StatCard icon={<Receipt size={15} />} label={t("sales.transactions")}
              value={String(sales.length)} loading={loadingSales}
              accentColor="#2563EB" bgColor="#EFF6FF" textColor="#1D4ED8" />
            <StatCard icon={<BarChart3 size={15} />} label={t("sales.avgSale")}
              value={formatCurrency(avgSale)} loading={loadingSales}
              accentColor="#059669" bgColor="#ECFDF5" textColor="#047857" />
            <StatCard icon={<Package size={15} />} label={t("sales.itemsSold")}
              value={String(totalItems)} loading={loadingSales}
              accentColor="#D97706" bgColor="#FFFBEB" textColor="#B45309" />
          </div>

          {/* ── sales table card ── */}
          <div style={styles.sectionCard}>

            {/* header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "16px 16px 14px",
              borderBottom: "1px solid #F1F5F9",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: "#EFF6FF",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CalendarDays size={16} style={{ color: "#3B82F6" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0 }}>
                  {filterLabels[dateFilter]} {t("sales.salesList")}
                </p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                  {sales.length} {sales.length !== 1 ? t("sales.transactions_plural") : t("sales.transaction")}
                </p>
              </div>
              {sales.length > 0 && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    {t("sales.total")}
                  </p>
                  <p style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>
              )}
            </div>

            {/* export toolbar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const,
              padding: "10px 14px",
              borderBottom: "1px solid #F8FAFC",
              background: "#FAFAFA",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginRight: "auto" }}>
                {t("sales.export")} · {filterLabels[dateFilter]}
              </span>
              {[
                { label: "CSV", action: handleExportCSV },
                { label: "HTML", action: handleExportHTML },
              ].map(({ label, action }) => (
                <button key={label}
                  onClick={action} disabled={!sales.length}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 10,
                    border: "1.5px solid #E2E8F0",
                    background: "#FFFFFF", color: "#475569",
                    fontSize: 12, fontWeight: 600, cursor: !sales.length ? "not-allowed" : "pointer",
                    opacity: !sales.length ? 0.4 : 1,
                  }}>
                  <Download size={11} /> {label}
                </button>
              ))}
              {isOwner && (
                <button onClick={handleDeleteAll} disabled={!sales.length || deleting}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 10,
                    border: "1.5px solid #FCA5A5",
                    background: "#FFF5F5", color: "#EF4444",
                    fontSize: 12, fontWeight: 600,
                    cursor: (!sales.length || deleting) ? "not-allowed" : "pointer",
                    opacity: (!sales.length || deleting) ? 0.4 : 1,
                  }}>
                  {deleting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                  {t("sales.deleteAll")}
                </button>
              )}
            </div>

            {/* sales content */}
            {loadingSales ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 16px", color: "#94A3B8" }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13 }}>{t("sales.loadingSales")}</span>
              </div>
            ) : sales.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", textAlign: "center", gap: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: "#F8FAFC",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Receipt size={28} style={{ color: "#CBD5E1" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", margin: 0 }}>
                  {tr("sales.noSalesYet", { period: filterLabels[dateFilter].toLowerCase() })}
                </p>
                <button onClick={openSaleModal} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 14,
                  background: "#1E293B", color: "#FFFFFF",
                  border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  marginTop: 4,
                }}>
                  <Plus size={14} /> {t("sales.addFirstSale")}
                </button>
              </div>
            ) : (
              <>
                {/* mobile list */}
                <div>
                  {sales.map((sale, i) => (
                    <div
                      key={sale.id}
                      style={{
                        ...styles.saleRow,
                        borderBottom: i < sales.length - 1 ? "1px solid #F8FAFC" : "none",
                      }}
                    >
                      {/* icon */}
                      <div style={{
                        width: 42, height: 42, flexShrink: 0,
                        borderRadius: 14, background: "#F8FAFC",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <TrendingUp size={14} style={{ color: "#94A3B8" }} />
                      </div>

                      {/* info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {sale.item_name ?? "—"}
                          </p>
                          <span style={{
                            background: "#F1F5F9", color: "#64748B",
                            fontSize: 10, fontWeight: 700,
                            padding: "2px 7px", borderRadius: 6, flexShrink: 0,
                          }}>
                            {sale.sale_number ?? "—"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>
                            ×{sale.quantity} · {formatCurrency(sale.unit_price)}
                          </span>
                          <span style={{
                            display: "flex", alignItems: "center", gap: 3,
                            fontSize: 11, color: "#94A3B8",
                          }}>
                            <Clock size={9} />{formatTime(sale.created_at)}
                          </span>
                        </div>
                        {sale.notes && (
                          <p style={{
                            fontSize: 11, fontWeight: 500, color: "#D97706",
                            margin: "3px 0 0",
                            background: "#FFFBEB",
                            padding: "2px 7px", borderRadius: 6, display: "inline-block",
                          }}>{sale.notes}</p>
                        )}
                      </div>

                      {/* amount + delete */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                          {formatCurrency(sale.sale_price)}
                        </p>
                        <button
                          onClick={() => handleDeleteSale(sale)}
                          style={{
                            display: "flex", alignItems: "center", gap: 3,
                            padding: "3px 8px", borderRadius: 8,
                            border: "none", background: "transparent",
                            fontSize: 11, fontWeight: 600, color: "#FDA4AF",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* total footer */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
                    background: "#F8FAFC",
                    borderTop: "2px solid #F1F5F9",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {t("sales.periodTotal")}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B" }}>
                      {formatCurrency(totalRevenue)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════
          SALE MODAL  — Cart bottom sheet
          ════════════════════════════════════════════ */}
      {isSaleModalOpen && (
        <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeSaleModal(); }}>
          <div style={styles.sheet}>
            <div style={styles.handle} />

            {/* header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 16px 14px",
              borderBottom: "1px solid #F8FAFC",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: "#1E293B",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShoppingCart size={16} style={{ color: "#FFFFFF" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                    {t("sales.newSale")}
                  </h2>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                    {cartItems.length === 0
                      ? t("sales.getStarted")
                      : `${cartItems.length} ${cartItems.length > 1 ? t("sales.itemsInCart") : t("sales.itemInCart")}`}
                  </p>
                </div>
              </div>
              <button onClick={closeSaleModal} style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "none", background: "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94A3B8", cursor: "pointer",
              }}>
                <X size={16} />
              </button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: "auto" }}>

              {/* EMPTY STATE */}
              {cartItems.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 24px" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 24,
                    background: "#F8FAFC",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ShoppingBag size={30} style={{ color: "#CBD5E1" }} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: 0 }}>{t("sales.cartEmpty")}</p>
                    <p style={{ fontSize: 13, color: "#94A3B8", margin: "6px 0 0" }}>{t("sales.cartEmptyHint")}</p>
                  </div>
                  <button
                    onClick={() => setShowInventoryPopup(true)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 18px",
                      borderRadius: 20,
                      border: "2px dashed #E2E8F0",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: "#1E293B",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Plus size={20} style={{ color: "#FFFFFF" }} />
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0 }}>{t("sales.addItems")}</p>
                        <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>{t("sales.browseInventory")}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: "#CBD5E1" }} />
                  </button>
                </div>
              ) : (
                <div>
                  {/* CART ITEMS */}
                  {cartItems.map((ci, index) => {
                    const lineTotal  = Number(ci.item.cost_price) * ci.qty;
                    const isOverStock = ci.qty > ci.item.quantity;
                    return (
                      <div key={ci.cartId} style={{
                        ...styles.cartRow,
                        background: isOverStock ? "#FFF5F5" : "#FFFFFF",
                        borderBottom: index < cartItems.length - 1 ? "1px solid #F8FAFC" : "none",
                      }}>
                        {/* emoji icon */}
                        <div style={{
                          width: 44, height: 44, flexShrink: 0,
                          borderRadius: 14, background: "#F8FAFC",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20,
                        }}>
                          {getCategoryIcon(ci.item.category)}
                        </div>

                        {/* name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {ci.item.item_name}
                          </p>
                          <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                            {formatCurrency(ci.item.cost_price)} {t("sales.eachUnit")}
                          </p>
                          {isOverStock && (
                            <p style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#EF4444", margin: "3px 0 0" }}>
                              <AlertCircle size={10} /> {tr("sales.onlyInStock", { n: ci.item.quantity })}
                            </p>
                          )}
                        </div>

                        {/* stepper */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button style={styles.qtyBtn(false)} onClick={() => updateCartQty(ci.cartId, -1)}>
                            <Minus size={13} />
                          </button>
                          <span style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 800, color: "#1E293B" }}>
                            {ci.qty}
                          </span>
                          <button style={styles.qtyBtn(true)} onClick={() => updateCartQty(ci.cartId, +1)}>
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* total + remove */}
                        <div style={{ width: 70, textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: isOverStock ? "#EF4444" : "#1E293B", margin: 0 }}>
                            {formatCurrency(lineTotal)}
                          </p>
                          <button onClick={() => removeFromCart(ci.cartId)}
                            style={{
                              background: "none", border: "none",
                              fontSize: 11, fontWeight: 600, color: "#FDA4AF",
                              cursor: "pointer", padding: "2px 0", marginTop: 3,
                            }}>
                            {t("sales.remove")}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add more */}
                  <div style={{ padding: "10px 14px", borderTop: "1px dashed #E2E8F0" }}>
                    <button onClick={() => setShowInventoryPopup(true)} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px", borderRadius: 16,
                      background: "#F8FAFC", border: "none", cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: "#E2E8F0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Plus size={15} style={{ color: "#64748B" }} />
                      </div>
                      <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: "#64748B" }}>
                        {t("sales.addMoreItems")}
                      </span>
                      <ChevronRight size={14} style={{ color: "#CBD5E1" }} />
                    </button>
                  </div>

                  {/* Notes */}
                  <div style={{ padding: "10px 14px 16px", borderTop: "1px solid #F8FAFC" }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      {t("sales.note")} <span style={{ fontWeight: 400, textTransform: "none" }}>({t("sales.noteOptional")})</span>
                    </label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("sales.notePlaceholder")}
                      style={{
                        width: "100%", height: 44,
                        borderRadius: 14,
                        border: "1.5px solid #E2E8F0",
                        background: "#F8FAFC",
                        padding: "0 14px",
                        fontSize: 13,
                        color: "#1E293B",
                        outline: "none",
                        boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* sticky footer */}
            {cartItems.length > 0 && (
              <div style={{ flexShrink: 0, padding: "14px 16px 24px", borderTop: "1px solid #F8FAFC", background: "#FFFFFF" }}>

                {/* Breakdown */}
                <div style={styles.totalBar}>
                  {cartItems.map((ci) => (
                    <div key={ci.cartId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "60%" }}>
                        {ci.item.item_name} × {ci.qty}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                        {formatCurrency(Number(ci.item.cost_price) * ci.qty)}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1.5px solid #E2E8F0", paddingTop: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {t("sales.grandTotal")}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.03em" }}>
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeSaleModal} style={{
                    flex: 1, height: 54, borderRadius: 18,
                    border: "1.5px solid #E2E8F0",
                    background: "#FFFFFF", color: "#475569",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}>
                    {t("sales.cancel")}
                  </button>
                  <button onClick={handleSave} disabled={saving || !cartValid} style={styles.saveBtn(cartValid && !saving)}>
                    {saving ? (
                      <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> {t("sales.savingSale")}</>
                    ) : (
                      <>
                        <CheckCircle2 size={17} />
                        {t("sales.confirmSale")}
                        {cartValid && (
                          <span style={{
                            background: "rgba(255,255,255,0.25)",
                            padding: "3px 10px", borderRadius: 10,
                            fontSize: 12, fontWeight: 800, marginLeft: 4,
                          }}>
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

      {/* ════════════════════════════════════════
          INVENTORY POPUP — Add items to cart
          ════════════════════════════════════════ */}
      {showInventoryPopup && (
        <div
          style={{ ...styles.overlay, zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInventoryPopup(false); }}
        >
          <div style={{ ...styles.sheet, maxWidth: 440, maxHeight: "90dvh" }}>
            <div style={styles.handle} />

            {/* popup header */}
            <div style={{ padding: "16px 16px 12px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                    {t("sales.chooseItems")}
                  </h2>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0" }}>
                    {cartItems.length > 0
                      ? `${cartItems.length} ${cartItems.length > 1 ? t("sales.itemsInCart") : t("sales.itemInCart")} · ${t("sales.tapToAddMore")}`
                      : t("sales.tapToAdd")}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {cartItems.length > 0 && (
                    <button onClick={() => setShowInventoryPopup(false)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 100,
                      background: "#059669", color: "#FFFFFF",
                      border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(5,150,105,0.3)",
                    }}>
                      <CheckCircle2 size={13} />
                      {t("sales.done")} ({cartItems.length})
                    </button>
                  )}
                  <button onClick={() => setShowInventoryPopup(false)} style={{
                    width: 34, height: 34, borderRadius: "50%",
                    border: "none", background: "#F1F5F9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#94A3B8", cursor: "pointer",
                  }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* search */}
              <div style={styles.searchBar}>
                <Search size={14} style={{ color: "#94A3B8", flexShrink: 0 }} />
                <input
                  autoFocus
                  value={inventoryQuery}
                  onChange={(e) => setInventoryQuery(e.target.value)}
                  placeholder={t("sales.searchPlaceholder")}
                  style={{
                    flex: 1, background: "transparent",
                    border: "none", outline: "none",
                    fontSize: 13, color: "#1E293B",
                  }}
                />
                {inventoryQuery && (
                  <button onClick={() => setInventoryQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* category pills */}
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <div style={{ display: "flex", gap: 7, paddingBottom: 4 }}>
                  {(["All", ...Object.keys(CATEGORY_CONFIG)]).map((cat) => {
                    const icon = cat === "All" ? "🧾" : CATEGORY_CONFIG[cat]?.icon ?? "📦";
                    return (
                      <button key={cat} onClick={() => setSelectedCategory(cat)}
                        style={styles.catPill(selectedCategory === cat)}>
                        <span style={{ marginRight: 4 }}>{icon}</span>
                        {cat === "All" ? t("sales.all") : cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* subcategory pills */}
              {selectedCategory !== "All" && (
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 6, paddingBottom: 4 }}>
                    {subcategoryOptions.map((sub) => (
                      <button key={sub} onClick={() => setSelectedSubcategory(sub)}
                        style={styles.catPill(selectedSubcategory === sub, true)}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* item list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 16px" }}>
              {loadingInventory ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", color: "#94A3B8" }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : filteredInventory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, color: "#94A3B8" }}>
                  {t("sales.noItemsFound")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredInventory.map((item) => {
                    const inCart    = cartItems.find((ci) => ci.item.id === item.id);
                    const isSelected = popupSelectedItem?.id === item.id;
                    const outOfStock = item.quantity <= 0;

                    return (
                      <div key={item.id} style={styles.invCard(isSelected, !!inCart, outOfStock)}>
                        <button
                          disabled={outOfStock}
                          onClick={() => {
                            if (outOfStock) return;
                            if (isSelected) { setPopupSelectedItem(null); setPopupItemQty("1"); }
                            else { setPopupSelectedItem(item); setPopupItemQty("1"); }
                          }}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 14px",
                            background: "transparent", border: "none", cursor: outOfStock ? "not-allowed" : "pointer",
                            textAlign: "left" as const,
                          }}
                        >
                          <div style={{
                            width: 44, height: 44, flexShrink: 0,
                            borderRadius: 14, background: "#F8FAFC",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20,
                          }}>
                            {getCategoryIcon(item.category)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                                {item.item_name}
                              </p>
                              {inCart && (
                                <span style={{
                                  background: "#DCFCE7", color: "#16A34A",
                                  fontSize: 10, fontWeight: 700,
                                  padding: "2px 7px", borderRadius: 100,
                                  flexShrink: 0,
                                }}>
                                  ✓ {inCart.qty} {t("sales.inCart")}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                              {item.category ?? "Uncategorized"}{item.subcategory ? ` · ${item.subcategory}` : ""}
                            </p>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", margin: "0 0 4px" }}>
                              {formatCurrency(item.cost_price)}
                            </p>
                            <StockBadge qty={item.quantity}
                              outOfStockLabel={t("sales.outOfStock")}
                              leftLabel={t("sales.leftSuffix")}
                              inStockLabel={t("sales.inStock")} />
                          </div>
                        </button>

                        {/* inline qty picker */}
                        {isSelected && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px 12px",
                            borderTop: "1px solid #F1F5F9",
                            background: "#FAFAFA",
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {t("sales.qty")}
                            </span>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                onClick={() => setPopupItemQty((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                                style={styles.qtyBtn(false)}>
                                <Minus size={13} />
                              </button>
                              <input
                                type="number" min={1} max={item.quantity}
                                value={popupItemQty}
                                onChange={(e) => setPopupItemQty(e.target.value)}
                                style={{
                                  width: 56, height: 36, borderRadius: 12,
                                  border: "1.5px solid #E2E8F0",
                                  background: "#FFFFFF",
                                  textAlign: "center",
                                  fontSize: 15, fontWeight: 800, color: "#1E293B",
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => setPopupItemQty((v) => String(Math.min(item.quantity, parseInt(v, 10) + 1)))}
                                style={styles.qtyBtn(true)}>
                                <Plus size={13} />
                              </button>
                            </div>
                            <button onClick={confirmPopupItem} style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "8px 16px", borderRadius: 12,
                              background: "linear-gradient(135deg, #059669, #10B981)",
                              color: "#FFFFFF", border: "none",
                              fontSize: 13, fontWeight: 700, cursor: "pointer",
                              boxShadow: "0 4px 12px rgba(5,150,105,0.3)",
                              flexShrink: 0,
                            }}>
                              <Plus size={13} /> {t("sales.add")}
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

      {/* CSS animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </AppShell>
  );
};

export default SalesPage;