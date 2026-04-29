import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Package, Search, AlertTriangle, Plus, X, Trash2,
  ChevronRight, Minus, Boxes, Bell, Check,
  LayoutDashboard, TrendingUp, Edit2, SlidersHorizontal,
  ChevronDown, ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/contexts/useI18n";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem } from "@/types/inventory";

/* ═══════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════ */
const LOW = 5;
const RWF = (n) => `${Math.round(n || 0).toLocaleString()} RWF`;

const C = {
  Drinks:    { e: "🥤", c: "#0284c7", bg: "#e0f2fe", light: "#bae6fd" },
  Food:      { e: "🍚", c: "#b45309", bg: "#fef3c7", light: "#fde68a" },
  Snacks:    { e: "🍪", c: "#7c3aed", bg: "#ede9fe", light: "#ddd6fe" },
  Hygiene:   { e: "🧼", c: "#059669", bg: "#d1fae5", light: "#a7f3d0" },
  Household: { e: "🏠", c: "#c2410c", bg: "#ffedd5", light: "#fed7aa" },
};

const SUBS = {
  Drinks:    ["Soda", "Juice", "Water", "Milk", "Yogurt", "Energy Drink", "Tea", "Coffee", "Alcohol"],
  Food:      ["Rice", "Flour", "Dal", "Beans", "Spices", "Salt", "Sugar", "Oats", "Pasta", "Noodles", "Condiments", "Food Oils"],
  Snacks:    ["Chips", "Biscuits", "Chocolate", "Cake", "Candy", "Gum", "Nuts"],
  Hygiene:   ["Toothpaste", "Soap", "Sanitary Pads", "Baby Products", "Lotion", "Hair Products", "Cleaning Products", "Tissue & Rolls"],
  Household: ["Mosquito Spray", "Bottles", "Matches", "Cleaning Tools", "Miscellaneous"],
};

const CATEGORY_KEYS = {
  Drinks: "drinks",
  Food: "food",
  Snacks: "snacks",
  Hygiene: "hygiene",
  Household: "household",
};

const normalizeItemName = (name) => name.trim().toLowerCase();

const mapInventoryRow = (row): InventoryItem => ({
  id: String(row.id),
  item_name: String(row.item_name ?? ""),
  quantity: Number(row.quantity ?? 0),
  cost_price: Number(row.cost_price ?? 0),
  category: row.category ?? null,
  subcategory: row.subcategory ?? null,
  normalized_name: row.normalized_name ?? (row.item_name ? normalizeItemName(String(row.item_name)) : ""),
  created_at: row.created_at ?? undefined,
});

const SUBCATEGORY_KEYS = {
  Soda: "soda",
  Juice: "juice",
  Water: "water",
  Milk: "milk",
  Yogurt: "yogurt",
  "Energy Drink": "energyDrink",
  Tea: "tea",
  Coffee: "coffee",
  Alcohol: "alcohol",
  Rice: "rice",
  Flour: "flour",
  Dal: "dal",
  Beans: "beans",
  Spices: "spices",
  Salt: "salt",
  Sugar: "sugar",
  Oats: "oats",
  Pasta: "pasta",
  Noodles: "noodles",
  Condiments: "condiments",
  "Food Oils": "foodOils",
  Chips: "chips",
  Biscuits: "biscuits",
  Chocolate: "chocolate",
  Cake: "cake",
  Candy: "candy",
  Gum: "gum",
  Nuts: "nuts",
  Toothpaste: "toothpaste",
  Soap: "soap",
  "Sanitary Pads": "sanitaryPads",
  "Baby Products": "babyProducts",
  Lotion: "lotion",
  "Hair Products": "hairProducts",
  "Cleaning Products": "cleaningProducts",
  "Tissue & Rolls": "tissueRolls",
  "Mosquito Spray": "mosquitoSpray",
  Bottles: "bottles",
  Matches: "matches",
  "Cleaning Tools": "cleaningTools",
  Miscellaneous: "miscellaneous",
};

/* ═══════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
═══════════════════════════════════════════════════ */
const CatIcon = ({ cat, size = 40 }) => {
  const conf = C[cat] || { e: "📦", bg: "#f1f5f9" };
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: conf.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.48, lineHeight: 1 }}>
      {conf.e}
    </div>
  );
};

const QtyBadge = ({ qty, outLabel }) => {
  if (qty === 0)
    return <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.3px" }}>{outLabel}</span>;
  if (qty <= LOW)
    return <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{qty} ⚠</span>;
  return <span style={{ background: "#d1fae5", color: "#065f46", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{qty}</span>;
};

const Pill = ({ label, active, color, onClick }) => (
  <button onClick={onClick} style={{
    flexShrink: 0, border: active ? "none" : "1px solid #e2e8f0",
    background: active ? (color || "#0f172a") : "#fff",
    color: active ? "#fff" : "#475569",
    borderRadius: 24, padding: "7px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
    transition: "all 0.15s",
  }}>{label}</button>
);

const StockBar = ({ qty, max = 50 }) => {
  const pct = Math.min(100, Math.round((qty / max) * 100));
  const col = qty === 0 ? "#ef4444" : qty <= LOW ? "#f59e0b" : "#10b981";
  return (
    <div style={{ height: 3, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginTop: 5, width: 48 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 4 }} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   FORM FIELDS (shared by Add + Edit)
═══════════════════════════════════════════════════ */
const FormFields = ({ vals, onChange, t, categoryLabel, subcategoryLabel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{t("inventory.itemName")}</label>
      <input
        placeholder={t("inventory.itemNameExample")}
        value={vals.name}
        onChange={e => onChange({ ...vals, name: e.target.value })}
        style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#f8fafc", boxSizing: "border-box", color: "#0f172a", fontFamily: "inherit" }}
        onFocus={e => e.target.style.borderColor = "#6366f1"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{t("inventory.quantity")}</label>
        <input type="number" placeholder="0" value={vals.qty}
          onChange={e => onChange({ ...vals, qty: e.target.value })}
          style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 700, outline: "none", background: "#f8fafc", boxSizing: "border-box", color: "#0f172a", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = "#6366f1"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{t("inventory.costRwf")}</label>
        <input type="number" placeholder="0" value={vals.price}
          onChange={e => onChange({ ...vals, price: e.target.value })}
          style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 700, outline: "none", background: "#f8fafc", boxSizing: "border-box", color: "#0f172a", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = "#6366f1"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"}
        />
      </div>
    </div>

    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>{t("inventory.category")}</label>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {Object.entries(C).map(([k, v]) => (
          <button key={k} onClick={() => onChange({ ...vals, cat: k, sub: "" })}
            style={{ flexShrink: 0, border: vals.cat === k ? "none" : `1.5px solid ${v.bg}`, background: vals.cat === k ? v.c : v.bg, color: vals.cat === k ? "#fff" : v.c, borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15 }}>{v.e}</span>{categoryLabel(k)}
          </button>
        ))}
      </div>
    </div>

    {vals.cat && SUBS[vals.cat] && (
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>{t("inventory.subcategory")}</label>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {SUBS[vals.cat].map(s => (
            <button key={s} onClick={() => onChange({ ...vals, sub: s })}
              style={{ flexShrink: 0, border: vals.sub === s ? "none" : "1.5px solid #e2e8f0", background: vals.sub === s ? "#6366f1" : "#f8fafc", color: vals.sub === s ? "#fff" : "#475569", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {subcategoryLabel(s)}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════
   SHEET WRAPPER
═══════════════════════════════════════════════════ */
const Sheet = ({ onClose, children }) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, maxHeight: "92dvh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
      {children}
    </div>
  </div>
);

const SheetHandle = () => (
  <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
    <div style={{ width: 36, height: 4, borderRadius: 4, background: "#e2e8f0" }} />
  </div>
);

/* ═══════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════ */
export default function InventoryApp() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const categoryLabel = useCallback((cat) => t(`inventory.categories.${CATEGORY_KEYS[cat] || cat}`), [t]);
  const subcategoryLabel = useCallback((sub) => t(`inventory.subcategories.${SUBCATEGORY_KEYS[sub] || sub}`), [t]);

  /* ─── core state ─── */
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState(null);

  /* ─── add form ─── */
  const [form, setForm] = useState({ name: "", qty: "", price: "", cat: "", sub: "" });

  /* ─── detail / edit ─── */
  const [editForm, setEditForm] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  /* ─── stock tab filters ─── */
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [sort, setSort] = useState("name_asc");
  const [showSort, setShowSort] = useState(false);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .order("item_name", { ascending: true });

      if (error) throw error;

      const nextItems = (data ?? []).map(mapInventoryRow);
      setItems(nextItems);
      setSelected((current) => {
        if (!current) return null;
        return nextItems.find((item) => item.id === current.id) ?? null;
      });
    } catch (error: any) {
      console.error("Inventory fetch failed:", error);
      showToast(error?.message || t("inventory.loadFailed"), "err");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const refresh = () => void fetchItems();
    const events = ["focus", "inventoryUpdated", "salesUpdated", "newSaleRecorded", "salesDeleted", "factoryReset"];
    events.forEach((eventName) => window.addEventListener(eventName, refresh));
    document.addEventListener("visibilitychange", refresh);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, refresh));
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchItems]);

  /* ─── summary ─── */
  const summary = useMemo(() => ({
    total:  items.length,
    units:  items.reduce((s, i) => s + i.quantity, 0),
    value:  items.reduce((s, i) => s + i.quantity * i.cost_price, 0),
    low:    items.filter(i => i.quantity > 0 && i.quantity <= LOW).length,
    out:    items.filter(i => i.quantity === 0).length,
  }), [items]);

  /* ─── category breakdown ─── */
  const catBreakdown = useMemo(() =>
    Object.keys(C).map(cat => {
      const ci = items.filter(i => i.category === cat);
      return { cat, count: ci.length, units: ci.reduce((s, i) => s + i.quantity, 0), value: ci.reduce((s, i) => s + i.quantity * i.cost_price, 0), low: ci.filter(i => i.quantity <= LOW).length };
    }), [items]);

  /* ─── filtered items ─── */
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = items.filter(i => {
      const ok = catFilter === "All" || i.category === catFilter;
      const hay = `${i.item_name} ${i.subcategory || ""} ${i.category || ""}`.toLowerCase();
      return ok && (!q || hay.includes(q));
    });
    switch (sort) {
      case "name_asc":  r = [...r].sort((a, b) => a.item_name.localeCompare(b.item_name)); break;
      case "name_desc": r = [...r].sort((a, b) => b.item_name.localeCompare(a.item_name)); break;
      case "qty_low":   r = [...r].sort((a, b) => a.quantity - b.quantity); break;
      case "qty_high":  r = [...r].sort((a, b) => b.quantity - a.quantity); break;
      case "value":     r = [...r].sort((a, b) => (b.quantity * b.cost_price) - (a.quantity * a.cost_price)); break;
    }
    return r;
  }, [items, search, catFilter, sort]);

  /* ─── alerts ─── */
  const outItems = useMemo(() => items.filter(i => i.quantity === 0).sort((a, b) => a.item_name.localeCompare(b.item_name)), [items]);
  const lowItems = useMemo(() => items.filter(i => i.quantity > 0 && i.quantity <= LOW).sort((a, b) => a.quantity - b.quantity), [items]);

  const handleAdd = useCallback(async () => {
    const q = parseInt(form.qty, 10);
    const p = parseFloat(form.price);
    if (!form.name.trim() || isNaN(q) || isNaN(p) || !form.cat || !form.sub) {
      showToast(t("inventory.fillAllFieldsDetailed"), "err"); return;
    }
    if (q < 0 || p < 0) { showToast(t("inventory.quantityCostCannotBeNegative"), "err"); return; }
    try {
      const itemName = form.name.trim();
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .insert({
          item_name: itemName,
          normalized_name: normalizeItemName(itemName),
          quantity: q,
          cost_price: p,
          category: form.cat,
          subcategory: form.sub,
          date_bought: new Date().toISOString().split("T")[0],
        })
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .single();

      if (error) throw error;

      const added = mapInventoryRow(data);
      setItems(prev => [added, ...prev].sort((a, b) => a.item_name.localeCompare(b.item_name)));
      setForm({ name: "", qty: "", price: "", cat: "", sub: "" });
      setAddOpen(false);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      showToast(t("inventory.itemAdded"));
    } catch (error: any) {
      console.error("Inventory add failed:", error);
      showToast(error?.message || t("inventory.addFailed"), "err");
    }
  }, [form, showToast, t]);

  const handleUpdate = useCallback(async () => {
    if (!editForm || !selected) return;
    const q = parseInt(editForm.qty, 10);
    const p = parseFloat(editForm.price);
    if (!editForm.name.trim() || isNaN(q) || isNaN(p) || !editForm.cat || !editForm.sub) {
      showToast(t("inventory.fillAllFields"), "err"); return;
    }
    try {
      const itemName = editForm.name.trim();
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .update({
          item_name: itemName,
          normalized_name: normalizeItemName(itemName),
          quantity: q,
          cost_price: p,
          category: editForm.cat,
          subcategory: editForm.sub,
        })
        .eq("id", selected.id)
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .single();

      if (error) throw error;

      const updated = mapInventoryRow(data);
      setItems(prev => prev.map(i => i.id === selected.id ? updated : i));
      setSelected(updated);
      setShowEdit(false);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      showToast(t("inventory.itemUpdated"));
    } catch (error: any) {
      console.error("Inventory update failed:", error);
      showToast(error?.message || t("inventory.updateFailed"), "err");
    }
  }, [editForm, selected, showToast, t]);

  const handleAdjust = useCallback(async (delta) => {
    if (!selected) return;
    const nq = selected.quantity + delta;
    if (nq < 0) { showToast(t("inventory.quantityCannotBeNegative"), "err"); return; }
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: nq })
        .eq("id", selected.id)
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .single();

      if (error) throw error;

      const updated = mapInventoryRow(data);
      setItems(prev => prev.map(i => i.id === selected.id ? updated : i));
      setSelected(updated);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
    } catch (error: any) {
      console.error("Inventory stock update failed:", error);
      showToast(error?.message || t("inventory.updateFailed"), "err");
    }
  }, [selected, showToast, t]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm(t("inventory.confirmDelete"))) return;
    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== id));
      setSelected(current => current?.id === id ? null : current);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      showToast(t("inventory.itemDeleted"));
    } catch (error: any) {
      console.error("Inventory delete failed:", error);
      showToast(error?.message || t("inventory.deleteFailed"), "err");
    }
  }, [showToast, t]);

  const openItem = useCallback((item) => {
    setSelected(item);
    setEditForm({ name: item.item_name, qty: String(item.quantity), price: String(item.cost_price), cat: item.category || "", sub: item.subcategory || "" });
    setShowEdit(false);
  }, []);

  /* ═══════════════════════════════════════════════════
     HOME TAB
  ═══════════════════════════════════════════════════ */
  const HomeTab = () => {
    const maxVal = Math.max(...catBreakdown.map(c => c.value), 1);
    return (
      <div>
        {/* Hero banner */}
        <div style={{ background: "#0f172a", padding: "0 20px 28px", position: "relative", overflow: "hidden" }}>
          {/* decorative circles */}
          <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(99,102,241,0.12)" }} />
          <div style={{ position: "absolute", bottom: -20, right: 60, width: 90, height: 90, borderRadius: "50%", background: "rgba(16,185,129,0.1)" }} />

          <div style={{ position: "relative" }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", margin: "0 0 6px" }}>{t("inventory.totalStockValue")}</p>
            <p style={{ color: "#fff", fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", margin: "0 0 2px" }}>{RWF(summary.value)}</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "0 0 16px" }}>{summary.total} {t("inventory.products")} · {summary.units.toLocaleString()} {t("inventory.units")}</p>

            {(summary.out + summary.low) > 0 ? (
              <button onClick={() => setTab("alerts")} style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", width: "100%", textAlign: "left" }}>
                <AlertTriangle size={15} color="#fca5a5" />
                <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {summary.out > 0 && `${summary.out} ${t("inventory.outOfStockLower")}`}{summary.out > 0 && summary.low > 0 && " · "}{summary.low > 0 && `${summary.low} ${t("inventory.runningLow")}`}
                </span>
                <ChevronRight size={14} color="#fca5a5" />
              </button>
            ) : (
              <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={15} color="#6ee7b7" />
                <span style={{ color: "#6ee7b7", fontSize: 13, fontWeight: 600 }}>{t("inventory.allItemsWellStocked")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stat grid */}
        <div style={{ padding: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: t("inventory.products"), value: summary.total, color: "#6366f1", bg: "#eef2ff", icon: <Boxes size={15} color="#6366f1" />, target: "stock" },
            { label: t("inventory.totalUnits"), value: summary.units.toLocaleString(), color: "#0284c7", bg: "#e0f2fe", icon: <Package size={15} color="#0284c7" />, target: "stock" },
            { label: t("inventory.outOfStock"), value: summary.out, color: "#dc2626", bg: "#fee2e2", icon: <AlertTriangle size={15} color="#dc2626" />, target: "alerts" },
            { label: t("inventory.lowStock"), value: summary.low, color: "#d97706", bg: "#fef3c7", icon: <Bell size={15} color="#d97706" />, target: "alerts" },
          ].map(card => (
            <div key={card.label} onClick={() => setTab(card.target)}
              style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #f1f5f9", cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                {card.icon}
              </div>
              <p style={{ fontSize: 24, fontWeight: 900, color: card.color, margin: "0 0 2px", lineHeight: 1 }}>{card.value}</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div style={{ margin: "14px 16px 0", background: "#fff", borderRadius: 16, padding: "16px", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{t("inventory.stockByCategory")}</p>
            <TrendingUp size={14} color="#94a3b8" />
          </div>
          {catBreakdown.map(({ cat, value, count, low, units }) => {
            const conf = C[cat];
            const pct = Math.round((value / maxVal) * 100);
            return (
              <div key={cat} style={{ marginBottom: 13, cursor: "pointer" }}
                onClick={() => { setCatFilter(cat); setTab("stock"); }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{conf.e}</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{categoryLabel(cat)}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>{count} {t("inventory.items")} · {units} {t("inventory.units")}</span>
                    </div>
                    {low > 0 && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{low} {t("inventory.low")}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: conf.c }}>{RWF(value)}</span>
                </div>
                <div style={{ height: 7, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: conf.c, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions */}
        <div style={{ margin: "14px 16px 24px", display: "flex", gap: 10 }}>
          <button onClick={() => setTab("stock")} style={{ flex: 1, background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Package size={15} /> {t("inventory.viewAllStock")}
          </button>
          <button onClick={() => setAddOpen(true)} style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={15} /> {t("inventory.addItem")}
          </button>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     STOCK TAB
  ═══════════════════════════════════════════════════ */
  const StockTab = () => {
    const SORT_LABELS = { name_asc: t("inventory.sortNameAsc"), name_desc: t("inventory.sortNameDesc"), qty_low: t("inventory.sortQtyLowFirst"), qty_high: t("inventory.sortQtyHighFirst"), value: t("inventory.sortValueHighFirst") };
    return (
      <div style={{ padding: "14px 14px 0" }}>
        {/* Search bar */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "0 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12, height: 48 }}>
          <Search size={15} color="#94a3b8" />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("inventory.searchByNameCategorySubcategory")}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#0f172a", fontFamily: "inherit" }} />
          {search
            ? <button onClick={() => setSearch("")} style={{ background: "#f1f5f9", border: "none", width: 24, height: 24, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={13} color="#64748b" /></button>
            : <SlidersHorizontal size={14} color="#94a3b8" />
          }
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          <Pill label={t("inventory.all")} active={catFilter === "All"} onClick={() => setCatFilter("All")} color={undefined} />
          {Object.entries(C).map(([k, v]) => (
            <button key={k} onClick={() => setCatFilter(catFilter === k ? "All" : k)}
              style={{ flexShrink: 0, border: catFilter === k ? "none" : `1.5px solid ${v.bg}`, background: catFilter === k ? v.c : v.bg, color: catFilter === k ? "#fff" : v.c, borderRadius: 24, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 14 }}>{v.e}</span>{categoryLabel(k)}
            </button>
          ))}
        </div>

        {/* Sort + count row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, margin: 0 }}>
            <span style={{ color: "#0f172a", fontWeight: 800 }}>{filteredItems.length}</span> {t("inventory.items")} · {RWF(filteredItems.reduce((s, i) => s + i.quantity * i.cost_price, 0))}
          </p>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowSort(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "7px 12px", fontSize: 12, color: "#475569", fontWeight: 600, cursor: "pointer" }}>
              {SORT_LABELS[sort]} <ChevronDown size={12} />
            </button>
            {showSort && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setShowSort(false)} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", zIndex: 60, minWidth: 170, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                  {Object.entries(SORT_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => { setSort(k); setShowSort(false); }}
                      style={{ width: "100%", padding: "10px 14px", background: sort === k ? "#f8fafc" : "#fff", border: "none", textAlign: "left", fontSize: 13, color: sort === k ? "#0f172a" : "#475569", fontWeight: sort === k ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {v} {sort === k && <Check size={13} color="#059669" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Item list */}
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}>
            <Package size={44} color="#e2e8f0" style={{ margin: "0 auto 14px", display: "block" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#64748b", margin: "0 0 4px" }}>{t("inventory.noItemsFound")}</p>
            <p style={{ fontSize: 13, margin: 0 }}>{t("inventory.tryDifferentSearch")}</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: 8 }}>
            {filteredItems.map((item, i) => (
              <div key={item.id}
                style={{ width: "100%", background: "none", border: "none", borderBottom: i < filteredItems.length - 1 ? "1px solid #f8fafc" : "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <button onClick={() => openItem(item)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                  <CatIcon cat={item.category} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item_name}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{subcategoryLabel(item.subcategory)} · <span style={{ color: "#64748b", fontWeight: 500 }}>{RWF(item.cost_price)}</span></p>
                    <StockBar qty={item.quantity} />
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <QtyBadge qty={item.quantity} outLabel={t("inventory.outBadge")} />
                    <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>{RWF(item.quantity * item.cost_price)}</p>
                  </div>
                  <ChevronRight size={14} color="#cbd5e1" />
                </button>
                <button onClick={() => handleDelete(item.id)} title={t("inventory.deleteItem")} style={{ width: 34, height: 34, borderRadius: 11, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     ALERTS TAB
  ═══════════════════════════════════════════════════ */
  const AlertsTab = () => (
    <div style={{ padding: "16px" }}>
      {outItems.length === 0 && lowItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Check size={32} color="#059669" />
          </div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>{t("inventory.allStockedUp")}</p>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>{t("inventory.noItemsNeedRestocking")}</p>
        </div>
      ) : (
        <>
          {/* Summary banner */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #fee2e2", marginBottom: 16, display: "flex", gap: 12 }}>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #fee2e2", paddingRight: 12 }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: "#dc2626", margin: 0 }}>{outItems.length}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>{t("inventory.outOfStock")}</p>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: "#d97706", margin: 0 }}>{lowItems.length}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>{t("inventory.lowStock")}</p>
            </div>
          </div>

          {outItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} /> {t("inventory.outOfStock")} ({outItems.length})
              </p>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fee2e2", overflow: "hidden" }}>
                {outItems.map((item, i) => (
                  <button key={item.id} onClick={() => openItem(item)}
                    style={{ width: "100%", background: "none", border: "none", borderBottom: i < outItems.length - 1 ? "1px solid #fef2f2" : "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                    <CatIcon cat={item.category} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item_name}</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{categoryLabel(item.category)} · {subcategoryLabel(item.subcategory)}</p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "block" }}>{t("inventory.outBadge")}</span>
                      <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>{RWF(item.cost_price)} {t("inventory.eachUnitShort")}</p>
                    </div>
                    <ChevronRight size={14} color="#fca5a5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {lowItems.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} /> {t("inventory.lowStock")} ({lowItems.length})
              </p>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fde68a", overflow: "hidden" }}>
                {lowItems.map((item, i) => (
                  <button key={item.id} onClick={() => openItem(item)}
                    style={{ width: "100%", background: "none", border: "none", borderBottom: i < lowItems.length - 1 ? "1px solid #fffbeb" : "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                    <CatIcon cat={item.category} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item_name}</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{categoryLabel(item.category)} · {subcategoryLabel(item.subcategory)}</p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "block" }}>{item.quantity} {t("inventory.leftSuffix")}</span>
                      <StockBar qty={item.quantity} />
                    </div>
                    <ChevronRight size={14} color="#fcd34d" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════
     ADD SHEET
  ═══════════════════════════════════════════════════ */
  const AddSheet = () => (
    <Sheet onClose={() => setAddOpen(false)}>
      <SheetHandle />
      <div style={{ padding: "12px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Plus size={20} color="#059669" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("inventory.addNewItem")}</p>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{t("inventory.fillRequiredDetails")}</p>
        </div>
        <button onClick={() => setAddOpen(false)} style={{ width: 34, height: 34, borderRadius: 10, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={15} color="#64748b" />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <FormFields vals={form} onChange={setForm} t={t} categoryLabel={categoryLabel} subcategoryLabel={subcategoryLabel} />
      </div>
      <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9" }}>
        <button onClick={handleAdd} style={{ width: "100%", height: 52, background: "#059669", color: "#fff", border: "none", borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: "0.2px" }}>
          <Plus size={17} /> {t("inventory.addToInventory")}
        </button>
      </div>
    </Sheet>
  );

  /* ═══════════════════════════════════════════════════
     DETAIL SHEET
  ═══════════════════════════════════════════════════ */
  const DetailSheet = () => {
    if (!selected) return null;
    const conf = C[selected.category] || { e: "📦", c: "#475569", bg: "#f1f5f9" };
    return (
      <Sheet onClose={() => setSelected(null)}>
        <SheetHandle />
        {/* Header */}
        <div style={{ padding: "10px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: conf.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>{conf.e}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.item_name}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {selected.category && <span style={{ fontSize: 10, background: conf.bg, color: conf.c, padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>{categoryLabel(selected.category)}</span>}
              {selected.subcategory && <span style={{ fontSize: 10, background: "#eef2ff", color: "#4f46e5", padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>{subcategoryLabel(selected.subcategory)}</span>}
              {selected.quantity === 0 && <span style={{ fontSize: 10, background: "#fee2e2", color: "#b91c1c", padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>{t("inventory.outOfStock")}</span>}
              {selected.quantity > 0 && selected.quantity <= LOW && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>{t("inventory.lowStock")}</span>}
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{ width: 34, height: 34, borderRadius: 10, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "#f8fafc", borderRadius: 14, padding: "13px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 5px" }}>{t("inventory.qty")}</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: selected.quantity === 0 ? "#dc2626" : selected.quantity <= LOW ? "#d97706" : "#0f172a", margin: 0 }}>{selected.quantity}</p>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 14, padding: "13px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 5px" }}>{t("inventory.cost")}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>{RWF(selected.cost_price)}</p>
            </div>
            <div style={{ background: "#d1fae5", borderRadius: 14, padding: "13px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 5px" }}>{t("inventory.value")}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#065f46", margin: 0 }}>{RWF(selected.quantity * selected.cost_price)}</p>
            </div>
          </div>

          {/* Quick adjust */}
          <div style={{ background: "#f8fafc", borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => handleAdjust(-1)}
              style={{ width: 46, height: 46, borderRadius: 13, background: "#fff", border: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Minus size={17} color="#475569" />
            </button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 3px" }}>{t("inventory.adjustStock")}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{selected.quantity}</p>
            </div>
            <button onClick={() => handleAdjust(+1)}
              style={{ width: 46, height: 46, borderRadius: 13, background: "#0f172a", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Plus size={17} color="#fff" />
            </button>
          </div>

          {/* Edit toggle */}
          <button onClick={() => setShowEdit(v => !v)} style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: showEdit ? 0 : 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Edit2 size={15} color="#475569" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t("inventory.editItemDetails")}</span>
            </div>
            <div style={{ transform: showEdit ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              <ChevronRight size={16} color="#94a3b8" />
            </div>
          </button>

          {showEdit && editForm && (
            <div style={{ background: "#f8fafc", borderRadius: 14, padding: "16px", marginBottom: 12, marginTop: 4 }}>
              <FormFields vals={editForm} onChange={setEditForm} t={t} categoryLabel={categoryLabel} subcategoryLabel={subcategoryLabel} />
              <button onClick={handleUpdate} style={{ width: "100%", height: 48, background: "#0f172a", color: "#fff", border: "none", borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: "pointer", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={16} /> {t("inventory.saveChanges")}
              </button>
            </div>
          )}

          {/* Delete */}
          <button onClick={() => handleDelete(selected.id)} style={{ width: "100%", height: 48, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            <Trash2 size={15} /> {t("inventory.deleteItem")}
          </button>
        </div>
      </Sheet>
    );
  };

  /* ═══════════════════════════════════════════════════
     TAB BAR
  ═══════════════════════════════════════════════════ */
  const alertCount = summary.out + summary.low;
  const TABS = [
    { id: "home",   icon: <LayoutDashboard size={21} />, label: t("inventory.homeTab") },
    { id: "stock",  icon: <Package size={21} />,         label: t("inventory.stockTab") },
    { id: "add",    icon: <Plus size={23} />,            label: t("common.add"),  special: true },
    { id: "alerts", icon: <Bell size={21} />,            label: t("inventory.alertsTab"), badge: alertCount },
  ];

  /* ═══════════════════════════════════════════════════
     HEADER TITLES
  ═══════════════════════════════════════════════════ */
  const headerConfig = {
    home:   { title: t("navigation.dashboard"), dark: true  },
    stock:  { title: t("inventory.allStock"), dark: false },
    alerts: { title: t("inventory.restockAlerts"), dark: false },
  };
  const hc = headerConfig[tab] || { title: "", dark: false };

  /* ═══════════════════════════════════════════════════
     MAIN RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#f1f5f9", fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif", maxWidth: 500, margin: "0 auto", position: "relative", overflow: "hidden" }}>

      {/* ── Top header ── */}
      <div style={{ background: hc.dark ? "#0f172a" : "#fff", padding: "14px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: hc.dark ? "none" : "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate("/dashboard")}
            title={t("settings.backToDashboard")}
            aria-label={t("settings.backToDashboard")}
            style={{ width: 36, height: 36, borderRadius: 11, background: hc.dark ? "rgba(255,255,255,0.12)" : "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <ArrowLeft size={17} color={hc.dark ? "#fff" : "#0f172a"} />
          </button>
          <p style={{ fontSize: 20, fontWeight: 900, color: hc.dark ? "#fff" : "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>{hc.title}</p>
        </div>
        {tab === "stock" && (
          <button onClick={() => setAddOpen(true)} style={{ width: 36, height: 36, borderRadius: 11, background: "#0f172a", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Plus size={17} color="#fff" />
          </button>
        )}
        {tab === "home" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 50, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛒</div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ height: "100%", minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#94a3b8" }}>
            <Package size={40} color="#cbd5e1" />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t("inventory.loading")}</p>
          </div>
        ) : (
          <>
            {tab === "home"   && <HomeTab />}
            {tab === "stock"  && <StockTab />}
            {tab === "alerts" && <AlertsTab />}
          </>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderTop: "1px solid #f1f5f9", padding: "6px 0 10px", display: "flex", alignItems: "flex-end", justifyContent: "space-around", flexShrink: 0 }}>
        {TABS.map(t => {
          if (t.special) {
            return (
              <button key={t.id} onClick={() => setAddOpen(true)}
                style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0", paddingBottom: 2 }}>
                <div style={{ width: 50, height: 50, borderRadius: 18, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -22, boxShadow: "0 4px 20px rgba(5,150,105,0.45)", border: "3px solid #f1f5f9" }}>
                  <Plus size={22} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#059669", marginTop: 2 }}>{t.label}</span>
              </button>
            );
          }
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0 0", position: "relative" }}>
              <div style={{ color: active ? "#0f172a" : "#94a3b8", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t.icon}
                {t.badge > 0 && (
                  <span style={{ position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, background: "#dc2626", borderRadius: 8, fontSize: 9, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid #fff" }}>
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? "#0f172a" : "#94a3b8" }}>{t.label}</span>
              {active && <div style={{ position: "absolute", bottom: -2, width: 22, height: 3, background: "#0f172a", borderRadius: 3 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Sheets ── */}
      {addOpen  && <AddSheet />}
      {selected && <DetailSheet />}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? "#dc2626" : "#0f172a", color: "#fff", padding: "11px 20px", borderRadius: 14, fontSize: 13, fontWeight: 600, zIndex: 500, boxShadow: "0 8px 28px rgba(0,0,0,0.22)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
