import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Plus,
  AlertTriangle,
  Search,
  Package,
  X,
  Boxes,
  TrendingUp,
  Minus,
  Loader2,
  Sparkles,
  ChevronRight,
  FileDown,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/kinyarwanda";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { createCsvBlob, csvCell, saveBlobWithPicker, exportCsvType } from "@/lib/fileExport";
import AppShell from "@/components/layout/AppShell";
import type { InventoryItem } from "@/types/inventory";

type SortOption =
  | "newest"
  | "name_asc"
  | "name_desc"
  | "qty_low"
  | "qty_high"
  | "value_high";

const LOW_STOCK_THRESHOLD = 5;

const CATEGORY_CONFIG = {
  Drinks: {
    icon: "🥤",
    subcategories: [
      "Soda","Juice","Water","Milk","Yogurt","Energy Drink","Tea","Coffee","Alcohol",
    ],
  },
  Food: {
    icon: "🍚",
    subcategories: [
      "Rice","Flour","Atta","Dal","Beans","Semolina","Grains","Poha","Besan",
      "Spices","Salt","Sugar","Oats","Cornflakes","Pasta","Noodles","Condiments",
      "Spreads","Milk Powder","Food Oils",
    ],
  },
  Snacks: {
    icon: "🍪",
    subcategories: ["Chips","Biscuits","Chocolate","Cake","Candy","Gum","Lollipops","Nuts"],
  },
  Hygiene: {
    icon: "🧼",
    subcategories: [
      "Toothpaste","Soap","Sanitary Pads","Baby Products","Lotion","Hair Products",
      "Cleaning Products","Tissue & Rolls","Powder & Fresheners",
    ],
  },
  Household: {
    icon: "🏠",
    subcategories: ["Mosquito Spray","Bottles","Toothpicks & Cotton","Matches","Cleaning Tools","Miscellaneous"],
  },
} as const;

const CATEGORY_OPTIONS = [
  { value: "All", icon: "🧾", label: "All" },
  { value: "Drinks", icon: "🥤", label: "Drinks" },
  { value: "Food", icon: "🍚", label: "Food" },
  { value: "Snacks", icon: "🍪", label: "Snacks" },
  { value: "Hygiene", icon: "🧼", label: "Hygiene" },
  { value: "Household", icon: "🏠", label: "Household" },
] as const;

type InventoryCategory = keyof typeof CATEGORY_CONFIG;

const getCategoryIcon = (category?: string | null) => {
  switch (category) {
    case "Drinks":   return "🥤";
    case "Food":     return "🍚";
    case "Snacks":   return "🍪";
    case "Hygiene":  return "🧼";
    case "Household":return "🏠";
    default:         return "📦";
  }
};

/* ── Qty badge ── */
const QtyBadge = ({ qty }: { qty: number }) => {
  if (qty <= 0)
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
        0
      </span>
    );
  if (qty <= LOW_STOCK_THRESHOLD)
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
        {qty}
      </span>
    );
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
      {qty}
    </span>
  );
};

/* ══════════════════════════════════════════════════════ */
const InventoryPage: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useI18n();
  const isOwner = profile?.role === "owner";

  /* ── data ── */
  const [items, setItems]       = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ── add form ── */
  const [showAddForm, setShowAddForm]   = useState(false);
  const [newName, setNewName]           = useState("");
  const [newQuantity, setNewQuantity]   = useState("");
  const [newCost, setNewCost]           = useState("");
  const [newCategory, setNewCategory]   = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [isAdding, setIsAdding]         = useState(false);

  /* ── detail / edit sheet ── */
  const [selectedItem, setSelectedItem]         = useState<InventoryItem | null>(null);
  const [editName, setEditName]                 = useState("");
  const [editQuantity, setEditQuantity]         = useState("");
  const [editCost, setEditCost]                 = useState("");
  const [editCategory, setEditCategory]         = useState("");
  const [editSubcategory, setEditSubcategory]   = useState("");
  const [isUpdating, setIsUpdating]             = useState(false);
  const [showEditForm, setShowEditForm]         = useState(false);

  /* ── finder modal ── */
  const [finderOpen, setFinderOpen]             = useState(false);
  const [finderSearch, setFinderSearch]         = useState("");
  const [finderCategory, setFinderCategory]     = useState<string>("All");
  const [finderSubcategory, setFinderSubcategory] = useState<string>("All");

  /* ── list filters ── */
  const [listSearch, setListSearch]                     = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [sortBy, setSortBy]                             = useState<SortOption>("newest");

  /* ── misc ── */
  const [clearingInventory, setClearingInventory] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  /* ── derived subcategories ── */
  const availableNewSubcategories = useMemo(() => {
    if (!newCategory || !(newCategory in CATEGORY_CONFIG)) return [];
    return CATEGORY_CONFIG[newCategory as InventoryCategory].subcategories;
  }, [newCategory]);

  const availableEditSubcategories = useMemo(() => {
    if (!editCategory || !(editCategory in CATEGORY_CONFIG)) return [];
    return CATEGORY_CONFIG[editCategory as InventoryCategory].subcategories;
  }, [editCategory]);

  /* ── map row ── */
  const mapInventoryRow = (row: any): InventoryItem => ({
    id:              String(row.id),
    item_name:       String(row.item_name ?? ""),
    quantity:        Number(row.quantity ?? 0),
    cost_price:      Number(row.cost_price ?? 0),
    category:        row.category ?? null,
    subcategory:     row.subcategory ?? null,
    normalized_name: row.normalized_name ?? (row.item_name ? String(row.item_name).toLowerCase().trim() : ""),
    created_at:      row.created_at ?? undefined,
  });

  /* ── fetch ── */
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map(mapInventoryRow));
    } catch (err) {
      setItems([]);
      toast.error(getErrorMessage(err, t("inventory.fetchFailed")));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchItems();
    const refresh = () => void fetchItems();
    window.addEventListener("inventoryUpdated", refresh);
    window.addEventListener("factoryReset", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("inventoryUpdated", refresh);
      window.removeEventListener("factoryReset", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchItems]);

  /* keep selectedItem in sync with live items */
  useEffect(() => {
    if (!selectedItem) return;
    const fresh = items.find((i) => i.id === selectedItem.id);
    if (!fresh) { setSelectedItem(null); return; }
    setSelectedItem(fresh);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── escape to close ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (finderOpen) { setFinderOpen(false); return; }
      if (selectedItem) setSelectedItem(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finderOpen, selectedItem]);

  /* ── reset add form ── */
  const resetAddForm = () => {
    setNewName(""); setNewQuantity(""); setNewCost("");
    setNewCategory(""); setNewSubcategory("");
    setShowAddForm(false);
  };

  /* ── add item ── */
  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost     = parseFloat(newCost);
    if (!newName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error(t("inventory.fillAllFields")); return;
    }
    if (!newCategory)    { toast.error(t("inventory.category") + " required"); return; }
    if (!newSubcategory) { toast.error(t("inventory.subcategory") + " required"); return; }
    if (quantity < 0 || cost < 0) { toast.error(t("inventory.quantityCannotBeNegative")); return; }

    setIsAdding(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .insert({
          item_name: newName.trim(), quantity, cost_price: cost,
          category: newCategory || null, subcategory: newSubcategory || null,
          normalized_name: newName.trim().toLowerCase(),
        })
        .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
        .single();
      if (error) throw error;
      setItems((prev) => [mapInventoryRow(data), ...prev]);
      resetAddForm();
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemAdded"));
    } catch (err) {
      toast.error(t("inventory.addFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  /* ── open detail sheet ── */
  const openItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.item_name);
    setEditQuantity(String(item.quantity));
    setEditCost(String(item.cost_price));
    setEditCategory(item.category ?? "");
    setEditSubcategory(item.subcategory ?? "");
    setShowEditForm(false);
  };

  /* ── update item ── */
  const handleUpdateItem = async () => {
    if (!selectedItem || !isOwner) return;
    const quantity = parseInt(editQuantity, 10);
    const cost     = parseFloat(editCost);
    if (!editName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error(t("inventory.fillAllFields")); return;
    }
    if (!editCategory)    { toast.error(t("inventory.category") + " required"); return; }
    if (!editSubcategory) { toast.error(t("inventory.subcategory") + " required"); return; }
    if (quantity < 0 || cost < 0) { toast.error(t("inventory.quantityCannotBeNegative")); return; }

    setIsUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({
          item_name: editName.trim(), quantity, cost_price: cost,
          category: editCategory || null, subcategory: editSubcategory || null,
          normalized_name: editName.trim().toLowerCase(),
        })
        .eq("id", selectedItem.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, item_name: editName.trim(), quantity, cost_price: cost,
                category: editCategory || null, subcategory: editSubcategory || null,
                normalized_name: editName.trim().toLowerCase() }
            : item
        )
      );
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemUpdated"));
      setShowEditForm(false);
    } catch (err) {
      toast.error(t("inventory.updateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  /* ── quick adjust ── */
  const handleQuickAdjust = async (delta: number) => {
    if (!selectedItem || !isOwner) return;
    const newQty = selectedItem.quantity + delta;
    if (newQty < 0) { toast.error(t("inventory.quantityCannotBeNegative")); return; }
    try {
      const { error } = await (supabase as any)
        .from("inventory_items").update({ quantity: newQty }).eq("id", selectedItem.id);
      if (error) throw error;
      setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, quantity: newQty } : i));
      setEditQuantity(String(newQty));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.stockUpdated"));
    } catch {
      toast.error(t("inventory.updateFailed"));
    }
  };

  /* ── delete single item ── */
  const handleDelete = async (id: string) => {
    if (!isOwner || !window.confirm(t("inventory.confirmDelete"))) return;
    try {
      const { error } = await (supabase as any).from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemDeleted"));
    } catch {
      toast.error(t("inventory.deleteFailed"));
    }
  };

  /* ── clear all ── */
  const handleClearInventory = async () => {
    if (!isOwner) { toast.error("Permission denied"); return; }
    if (!window.confirm(t("inventory.clearAll") + "?")) return;
    setClearingInventory(true);
    try {
      const { error } = await (supabase as any).from("inventory_items").delete().not("id", "is", null);
      if (error) throw error;
      setItems([]); setSelectedItem(null); setShowAddForm(false);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemDeleted"));
    } catch {
      toast.error(t("inventory.deleteFailed"));
    } finally {
      setClearingInventory(false);
    }
  };

  /* ── finder subcategories ── */
  const availableFinderSubcategories = useMemo(() => {
    const filtered = finderCategory === "All" ? items : items.filter((i) => i.category === finderCategory);
    const unique = Array.from(new Set(filtered.map((i) => i.subcategory?.trim()).filter(Boolean) as string[])).sort();
    return ["All", ...unique];
  }, [items, finderCategory]);

  const filteredFinderItems = useMemo(() => {
    const q = finderSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchCat = finderCategory === "All" || item.category === finderCategory;
      const matchSub = finderSubcategory === "All" || item.subcategory === finderSubcategory;
      const hay = [item.item_name, item.category ?? "", item.subcategory ?? "", item.normalized_name ?? ""].join(" ").toLowerCase();
      return matchCat && matchSub && (!q || hay.includes(q));
    });
  }, [items, finderSearch, finderCategory, finderSubcategory]);

  /* ── main list filter + sort ── */
  const filteredItems = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let result = items.filter((i) => {
      const matchCat = selectedCategoryFilter === "All" || i.category === selectedCategoryFilter;
      const hay = [i.item_name, i.category ?? "", i.subcategory ?? "", i.normalized_name ?? ""].join(" ").toLowerCase();
      return matchCat && (!q || hay.includes(q));
    });
    switch (sortBy) {
      case "name_asc":   result = [...result].sort((a, b) => a.item_name.localeCompare(b.item_name)); break;
      case "name_desc":  result = [...result].sort((a, b) => b.item_name.localeCompare(a.item_name)); break;
      case "qty_low":    result = [...result].sort((a, b) => a.quantity - b.quantity); break;
      case "qty_high":   result = [...result].sort((a, b) => b.quantity - a.quantity); break;
      case "value_high": result = [...result].sort((a, b) => b.quantity * b.cost_price - a.quantity * a.cost_price); break;
      default:           result = [...result].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))); break;
    }
    return result;
  }, [items, sortBy, selectedCategoryFilter, listSearch]);

  /* ── summary ── */
  const summary = useMemo(() => ({
    totalItems: items.length,
    totalUnits: items.reduce((s, i) => s + i.quantity, 0),
    lowStockCount: items.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD).length,
    totalValue: items.reduce((s, i) => s + i.quantity * i.cost_price, 0),
  }), [items]);

  /* ── low-stock PDF / print ── */
  const handleLowStockPDF = useCallback(() => {
    const lowItems = items
      .filter((i) => i.quantity <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => {
        // out-of-stock first, then by category, then name
        if (a.quantity === 0 && b.quantity > 0) return -1;
        if (b.quantity === 0 && a.quantity > 0) return 1;
        const catCmp = (a.category ?? "").localeCompare(b.category ?? "");
        return catCmp !== 0 ? catCmp : a.item_name.localeCompare(b.item_name);
      });

    if (lowItems.length === 0) {
      toast.success(t("inventory.noLowStockItems"));
      return;
    }

    // Group by category
    const groups: Record<string, typeof lowItems> = {};
    for (const item of lowItems) {
      const key = item.category ?? "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    const categoryIcons: Record<string, string> = {
      Drinks: "🥤", Food: "🍚", Snacks: "🍪", Hygiene: "🧼", Household: "🏠",
    };

    const today = new Date().toLocaleDateString(undefined, {
      day: "2-digit", month: "long", year: "numeric",
    });

    const rows = Object.entries(groups).map(([cat, catItems]) => `
      <tr class="cat-header">
        <td colspan="4">${categoryIcons[cat] ?? "📦"} ${cat}</td>
      </tr>
      ${catItems.map((item) => `
        <tr class="${item.quantity === 0 ? "out" : "low"}">
          <td class="check"><span class="checkbox"></span></td>
          <td class="name">${item.item_name}${item.subcategory ? `<span class="sub"> · ${item.subcategory}</span>` : ""}</td>
          <td class="qty ${item.quantity === 0 ? "zero" : ""}">${item.quantity === 0 ? "OUT" : item.quantity}</td>
          <td class="price">${item.cost_price > 0 ? `${item.cost_price.toLocaleString()} FRW` : "—"}</td>
        </tr>`).join("")}
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Low Stock – ${today}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #fff; padding: 28px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
    .header-left h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
    .header-left p  { font-size: 11px; color: #64748b; margin-top: 3px; }
    .header-right   { text-align: right; font-size: 11px; color: #64748b; }
    .header-right strong { display: block; font-size: 13px; color: #0f172a; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary-card { flex: 1; border-radius: 10px; padding: 10px 14px; }
    .summary-card.red  { background: #fef2f2; border: 1px solid #fecaca; }
    .summary-card.amb  { background: #fffbeb; border: 1px solid #fde68a; }
    .summary-card p    { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    .summary-card span { display: block; font-size: 22px; font-weight: 800; margin-top: 2px; }
    .summary-card.red span { color: #dc2626; }
    .summary-card.amb span { color: #d97706; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child, th:nth-child(3) { text-align: right; }
    .cat-header td { background: #f1f5f9; color: #334155; font-weight: 700; font-size: 11px; padding: 7px 10px; letter-spacing: 0.2px; }
    tr.low  td { background: #fff; border-bottom: 1px solid #f1f5f9; }
    tr.out  td { background: #fff5f5; border-bottom: 1px solid #fee2e2; }
    td { padding: 9px 10px; vertical-align: middle; }
    .check  { width: 28px; }
    .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 3px; }
    .name   { font-weight: 600; }
    .sub    { font-weight: 400; color: #94a3b8; font-size: 10px; }
    .qty    { text-align: right; font-weight: 700; color: #d97706; width: 50px; }
    .qty.zero { color: #dc2626; }
    .price  { text-align: right; color: #475569; width: 90px; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    @media print {
      body { padding: 16px 20px; }
      @page { margin: 14mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>🛒 ${t("inventory.lowStockShoppingList")}</h1>
      <p>${t("inventory.lowStockSubtitle")}</p>
    </div>
    <div class="header-right">
      <strong>${today}</strong>
      ${t("inventory.itemsToRestock")}: ${lowItems.length}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card red">
      <p>${t("inventory.outOfStock")}</p>
      <span>${lowItems.filter((i) => i.quantity === 0).length}</span>
    </div>
    <div class="summary-card amb">
      <p>${t("inventory.lowStock")}</p>
      <span>${lowItems.filter((i) => i.quantity > 0).length}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>${t("inventory.itemName")}</th>
        <th style="text-align:right">${t("inventory.quantity")}</th>
        <th style="text-align:right">${t("inventory.costPrice")}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>Curuza+ · ${t("inventory.title")}</span>
    <span>${lowItems.length} ${t("inventory.items")}</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error(t("inventory.pdfBlockedByBrowser")); return; }
    win.document.write(html);
    win.document.close();
  }, [items, t]);

  /* ── download full stock CSV ── */
  const handleDownloadCSV = useCallback(async () => {
    if (items.length === 0) {
      toast.error(t("inventory.noItemsToExport"));
      return;
    }

    const headers = [
      t("inventory.itemName"),
      t("inventory.category"),
      t("inventory.subcategory"),
      t("inventory.quantity"),
      t("inventory.costPrice"),
      t("inventory.totalValue"),
    ];

    const rows = items.map((item) => [
      csvCell(item.item_name),
      csvCell(item.category),
      csvCell(item.subcategory),
      csvCell(item.quantity),
      csvCell(item.cost_price),
      csvCell(item.quantity * item.cost_price),
    ]);

    const csvLines = [headers.join(","), ...rows.map((row) => row.join(","))];
    const blob = createCsvBlob(csvLines);

    try {
      await saveBlobWithPicker(blob, `inventory-${new Date().toISOString().split('T')[0]}.csv`, {
        fileType: exportCsvType,
      });
      toast.success(t("inventory.exportSuccessful"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User cancelled
        return;
      }
      toast.error(t("inventory.exportFailed"));
    }
  }, [items, t]);

  /* ── download full stock PDF ── */
  const handleDownloadPDF = useCallback(() => {
    if (items.length === 0) {
      toast.error(t("inventory.noItemsToExport"));
      return;
    }

    // Group by category
    const groups: Record<string, typeof items> = {};
    for (const item of items) {
      const key = item.category ?? "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    const categoryIcons: Record<string, string> = {
      Drinks: "🥤", Food: "🍚", Snacks: "🍪", Hygiene: "🧼", Household: "🏠",
    };

    const today = new Date().toLocaleDateString(undefined, {
      day: "2-digit", month: "long", year: "numeric",
    });

    const rows = Object.entries(groups).map(([cat, catItems]) => `
      <tr class="cat-header">
        <td colspan="6">${categoryIcons[cat] ?? "📦"} ${cat}</td>
      </tr>
      ${catItems.map((item) => `
        <tr>
          <td class="name">${item.item_name}${item.subcategory ? `<span class="sub"> · ${item.subcategory}</span>` : ""}</td>
          <td class="qty">${item.quantity}</td>
          <td class="price">${item.cost_price > 0 ? `${item.cost_price.toLocaleString()} FRW` : "—"}</td>
          <td class="value">${item.quantity * item.cost_price > 0 ? `${(item.quantity * item.cost_price).toLocaleString()} FRW` : "—"}</td>
          <td class="status ${item.quantity === 0 ? "out" : item.quantity <= LOW_STOCK_THRESHOLD ? "low" : "good"}">${item.quantity === 0 ? "OUT" : item.quantity <= LOW_STOCK_THRESHOLD ? "LOW" : "OK"}</td>
          <td class="check"><span class="checkbox"></span></td>
        </tr>`).join("")}
    `).join("");

    const totalValue = items.reduce((s, i) => s + i.quantity * i.cost_price, 0);
    const totalItems = items.length;
    const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Full Stock List – ${today}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background: #fff; padding: 28px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
    .header-left h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
    .header-left p  { font-size: 11px; color: #64748b; margin-top: 3px; }
    .header-right   { text-align: right; font-size: 11px; color: #64748b; }
    .header-right strong { display: block; font-size: 13px; color: #0f172a; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary-card { flex: 1; border-radius: 10px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .summary-card p    { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    .summary-card span { display: block; font-size: 22px; font-weight: 800; margin-top: 2px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child { text-align: center; width: 28px; }
    .cat-header td { background: #f1f5f9; color: #334155; font-weight: 700; font-size: 11px; padding: 7px 10px; letter-spacing: 0.2px; }
    tr td { background: #fff; border-bottom: 1px solid #f1f5f9; }
    td { padding: 9px 10px; vertical-align: middle; }
    .check  { width: 28px; text-align: center; }
    .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 3px; }
    .name   { font-weight: 600; }
    .sub    { font-weight: 400; color: #94a3b8; font-size: 10px; }
    .qty    { text-align: right; font-weight: 700; color: #059669; width: 60px; }
    .price  { text-align: right; color: #475569; width: 90px; }
    .value  { text-align: right; color: #7c3aed; width: 100px; font-weight: 600; }
    .status { text-align: center; font-weight: 700; width: 50px; }
    .status.good { color: #059669; }
    .status.low  { color: #d97706; }
    .status.out  { color: #dc2626; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    @media print {
      body { padding: 16px 20px; }
      @page { margin: 14mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>📦 ${t("inventory.fullStockList")}</h1>
      <p>${t("inventory.completeInventoryReport")}</p>
    </div>
    <div class="header-right">
      <strong>${today}</strong>
      ${t("inventory.totalItems")}: ${totalItems}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <p>${t("inventory.totalProducts")}</p>
      <span>${totalItems}</span>
    </div>
    <div class="summary-card">
      <p>${t("inventory.totalUnits")}</p>
      <span>${totalUnits}</span>
    </div>
    <div class="summary-card">
      <p>${t("inventory.totalValue")}</p>
      <span>${totalValue.toLocaleString()} FRW</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t("inventory.itemName")}</th>
        <th style="text-align:right">${t("inventory.quantity")}</th>
        <th style="text-align:right">${t("inventory.costPrice")}</th>
        <th style="text-align:right">${t("inventory.totalValue")}</th>
        <th style="text-align:center">${t("inventory.status")}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>Curuza+ · ${t("inventory.title")}</span>
    <span>${totalItems} ${t("inventory.items")} · ${t("inventory.totalValue")}: ${totalValue.toLocaleString()} FRW</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error(t("inventory.pdfBlockedByBrowser")); return; }
    win.document.write(html);
    win.document.close();
  }, [items, t]);

  /* ── copy to clipboard ── */
  const handleCopyToClipboard = useCallback(async () => {
    if (items.length === 0) {
      toast.error(t("inventory.noItemsToExport"));
      return;
    }

    const headers = [
      t("inventory.itemName"),
      t("inventory.category"),
      t("inventory.subcategory"),
      t("inventory.quantity"),
      t("inventory.costPrice"),
      t("inventory.totalValue"),
    ];

    const rows = items.map((item) => [
      item.item_name,
      item.category || "",
      item.subcategory || "",
      item.quantity,
      item.cost_price,
      item.quantity * item.cost_price,
    ]);

    const csvText = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    try {
      await navigator.clipboard.writeText(csvText);
      toast.success(t("inventory.copiedToClipboard"));
    } catch (error) {
      toast.error(t("inventory.copyFailed"));
    }
  }, [items, t]);

  /* ════════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4 px-3 pb-24 pt-2">

        {/* ── header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{t("inventory.title")}</h1>
            <p className="text-xs text-slate-500">
              {summary.totalItems} {t("inventory.items")} · {summary.totalUnits} {t("inventory.unitsTotal")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFinderOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
            >
              <Search size={16} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDownloadMenu((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
              >
                <FileDown size={16} />
              </button>
              {showDownloadMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { handleDownloadCSV(); setShowDownloadMenu(false); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <FileDown size={14} className="text-slate-400" />
                      {t("inventory.downloadCSV")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleDownloadPDF(); setShowDownloadMenu(false); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <FileDown size={14} className="text-slate-400" />
                      {t("inventory.downloadPDF")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleCopyToClipboard(); setShowDownloadMenu(false); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <Copy size={14} className="text-slate-400" />
                      {t("inventory.copyToClipboard")}
                    </button>
                  </div>
                </>
              )}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddForm((p) => !p)}
                className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-sm transition ${
                  showAddForm ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {showAddForm ? <X size={14} /> : <Plus size={14} />}
                {showAddForm ? t("common.cancel") : t("inventory.addItem")}
              </button>
            )}
          </div>
        </div>

        {/* ── stat strip ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Boxes size={13} />, label: t("inventory.totalProducts"), value: summary.totalItems, color: "text-blue-600", bg: "bg-blue-50" },
            { icon: <Package size={13} />, label: t("inventory.totalUnits"), value: summary.totalUnits, color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: <AlertTriangle size={13} />, label: t("inventory.lowStock"), value: summary.lowStockCount, color: "text-red-600", bg: "bg-red-50" },
            { icon: <TrendingUp size={13} />, label: t("inventory.totalValue"), value: formatCurrency(summary.totalValue), color: "text-violet-600", bg: "bg-violet-50", small: true },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
              <p className={`font-extrabold leading-tight ${card.small ? "text-xs" : "text-lg"} ${card.color}`}>
                {card.value}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── add form ── */}
        {showAddForm && isOwner && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-900">{t("inventory.addNewItem")}</p>
            <div className="space-y-3">
              <Input placeholder={t("inventory.itemName")} value={newName} onChange={(e) => setNewName(e.target.value)} className="h-11 rounded-xl" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder={t("inventory.quantity")} value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="h-11 rounded-xl" />
                <Input type="number" placeholder={t("inventory.costPrice")} value={newCost} onChange={(e) => setNewCost(e.target.value)} className="h-11 rounded-xl" />
              </div>

              {/* Category pills */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t("inventory.category")}</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                    <button key={key} type="button"
                      onClick={() => { setNewCategory(key); setNewSubcategory(""); }}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${newCategory === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                      <span>{val.icon}</span>{key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategory pills */}
              {newCategory && availableNewSubcategories.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t("inventory.subcategory")}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {availableNewSubcategories.map((sub) => (
                      <button key={sub} type="button" onClick={() => setNewSubcategory(sub)}
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${newSubcategory === sub ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button" onClick={handleAddItem} disabled={isAdding}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {isAdding ? <><Loader2 size={15} className="animate-spin" />{t("inventory.adding")}</> : <><Plus size={15} />{t("inventory.addItem")}</>}
              </button>
            </div>
          </div>
        )}

        {/* ── low stock alert + PDF button ── */}
        {summary.lowStockCount > 0 && (
          <button
            type="button"
            onClick={handleLowStockPDF}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                {summary.lowStockCount} {t("inventory.itemsNeedRestocking")}
              </p>
              <p className="text-[11px] text-amber-700">{t("inventory.tapToDownloadList")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm">
              <FileDown size={13} />
              PDF
            </div>
          </button>
        )}

        {/* ── filter bar ── */}
        <div className="space-y-2">
          {/* search input */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder={t("inventory.searchByName")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {listSearch && <button type="button" onClick={() => setListSearch("")}><X size={13} className="text-slate-400" /></button>}
          </div>

          {/* category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_OPTIONS.map((cat) => {
              const active = selectedCategoryFilter === cat.value;
              return (
                <button key={cat.value} type="button" onClick={() => setSelectedCategoryFilter(cat.value)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <span className="text-sm">{cat.icon}</span>{cat.label}
                </button>
              );
            })}
          </div>

          {/* sort + owner clear-all */}
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none">
              <option value="newest">{t("inventory.sortNewest")}</option>
              <option value="name_asc">{t("inventory.sortNameAsc")}</option>
              <option value="name_desc">{t("inventory.sortNameDesc")}</option>
              <option value="qty_low">{t("inventory.sortQtyLow")}</option>
              <option value="qty_high">{t("inventory.sortQtyHigh")}</option>
              <option value="value_high">{t("inventory.sortValueHigh")}</option>
            </select>
            {isOwner && items.length > 0 && (
              <button type="button" onClick={handleClearInventory} disabled={clearingInventory}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
                {clearingInventory ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {t("inventory.clearAll")}
              </button>
            )}
          </div>
        </div>

        {/* ── ITEM LIST ── */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">{t("inventory.loading")}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <Package size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">{t("inventory.noItemsFound")}</p>
            <p className="text-xs text-slate-400">{t("inventory.startAddingFirst")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-50">
              {filteredItems.map((item, idx) => {
                const isLow = item.quantity <= LOW_STOCK_THRESHOLD;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100 ${isLow && item.quantity > 0 ? "bg-amber-50/40" : ""} ${item.quantity === 0 ? "bg-red-50/40" : ""}`}
                  >
                    {/* icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                      {getCategoryIcon(item.category)}
                    </div>

                    {/* name + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.item_name}</p>
                      {item.subcategory && (
                        <p className="truncate text-[11px] text-slate-400">{item.subcategory}</p>
                      )}
                    </div>

                    {/* qty badge + chevron */}
                    <div className="flex shrink-0 items-center gap-2">
                      <QtyBadge qty={item.quantity} />
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-[11px] font-semibold text-slate-400">
                {filteredItems.length} {t("inventory.items")} · {t("inventory.totalValue")}: {formatCurrency(filteredItems.reduce((s, i) => s + i.quantity * i.cost_price, 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════
          FINDER MODAL
          ════════════════════════════════════════════ */}
      {finderOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setFinderOpen(false); }}
        >
          <div className="flex w-full max-w-lg flex-col rounded-t-[2rem] bg-white shadow-2xl" style={{ maxHeight: "88dvh" }}>
            {/* header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Sparkles size={17} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{t("inventory.findItem")}</p>
                <p className="text-[11px] text-slate-400">{filteredFinderItems.length} {t("inventory.items")}</p>
              </div>
              <button type="button" onClick={() => setFinderOpen(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {/* search */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                <Search size={14} className="text-slate-400" />
                <input autoFocus value={finderSearch} onChange={(e) => setFinderSearch(e.target.value)}
                  placeholder={t("inventory.searchByName")}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                {finderSearch && <button type="button" onClick={() => setFinderSearch("")}><X size={13} className="text-slate-400" /></button>}
              </div>

              {/* category pills */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = finderCategory === cat.value;
                  return (
                    <button key={cat.value} type="button"
                      onClick={() => { setFinderCategory(cat.value); setFinderSubcategory("All"); }}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                      <span>{cat.icon}</span>{cat.label}
                    </button>
                  );
                })}
              </div>

              {/* subcategory pills */}
              {finderCategory !== "All" && availableFinderSubcategories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {availableFinderSubcategories.map((sub) => {
                    const active = finderSubcategory === sub;
                    return (
                      <button key={sub} type="button" onClick={() => setFinderSubcategory(sub)}
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {sub}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* results */}
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
              ) : filteredFinderItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{t("inventory.noItemsFound")}</p>
              ) : (
                <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100">
                  {filteredFinderItems.map((item) => (
                    <button key={item.id} type="button"
                      onClick={() => { openItem(item); setFinderOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.item_name}</p>
                        <p className="text-[11px] text-slate-400">
                          {item.subcategory ?? item.category ?? "—"} · {formatCurrency(item.cost_price)}
                        </p>
                      </div>
                      <QtyBadge qty={item.quantity} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          DETAIL / EDIT BOTTOM SHEET
          ════════════════════════════════════════════ */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}
        >
          <div
            className="flex w-full max-w-lg flex-col rounded-t-[2rem] bg-white shadow-2xl"
            style={{ maxHeight: "92dvh" }}
          >
            {/* ── sheet header ── */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                {getCategoryIcon(selectedItem.category)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold text-slate-900">{selectedItem.item_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {selectedItem.category && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {selectedItem.category}
                    </span>
                  )}
                  {selectedItem.subcategory && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {selectedItem.subcategory}
                    </span>
                  )}
                  {selectedItem.quantity <= LOW_STOCK_THRESHOLD && selectedItem.quantity > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {t("inventory.lowStock")}
                    </span>
                  )}
                  {selectedItem.quantity === 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      {t("inventory.outOfStock")}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={17} />
              </button>
            </div>

            {/* ── scrollable body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* stat row */}
              <div className="grid grid-cols-3 gap-3 p-5 pb-0">
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("inventory.quantity")}</p>
                  <p className={`mt-1 text-2xl font-extrabold ${selectedItem.quantity === 0 ? "text-red-500" : selectedItem.quantity <= LOW_STOCK_THRESHOLD ? "text-amber-600" : "text-slate-900"}`}>
                    {selectedItem.quantity}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("inventory.cost")}</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">{formatCurrency(selectedItem.cost_price)}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">{t("inventory.totalValue")}</p>
                  <p className="mt-1 text-base font-extrabold text-emerald-700">
                    {formatCurrency(selectedItem.quantity * selectedItem.cost_price)}
                  </p>
                </div>
              </div>

              {/* owner actions */}
              {isOwner && (
                <div className="px-5 py-4">
                  {/* quick adjust */}
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <button type="button" onClick={() => void handleQuickAdjust(-1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm hover:bg-slate-100 active:scale-95">
                      <Minus size={16} className="text-slate-700" />
                    </button>
                    <div className="flex-1 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("inventory.stockLevel")}</p>
                      <p className="text-lg font-extrabold text-slate-900">{selectedItem.quantity}</p>
                    </div>
                    <button type="button" onClick={() => void handleQuickAdjust(+1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 shadow-sm hover:bg-slate-800 active:scale-95">
                      <Plus size={16} className="text-white" />
                    </button>
                  </div>

                  {/* edit toggle */}
                  <button type="button" onClick={() => setShowEditForm((p) => !p)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 transition ${showEditForm ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <span className="text-sm font-bold text-slate-800">{t("inventory.editItem")}</span>
                    <ChevronRight size={16} className={`text-slate-400 transition-transform ${showEditForm ? "rotate-90" : ""}`} />
                  </button>

                  {/* edit form */}
                  {showEditForm && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder={t("inventory.itemName")} className="h-11 rounded-xl bg-white" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)}
                          placeholder={t("inventory.quantity")} className="h-11 rounded-xl bg-white" />
                        <Input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)}
                          placeholder={t("inventory.costPrice")} className="h-11 rounded-xl bg-white" />
                      </div>

                      {/* Category pills */}
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("inventory.category")}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                            <button key={key} type="button"
                              onClick={() => { setEditCategory(key); setEditSubcategory(""); }}
                              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${editCategory === key ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                              <span>{val.icon}</span>{key}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Subcategory pills */}
                      {editCategory && availableEditSubcategories.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("inventory.subcategory")}</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {availableEditSubcategories.map((sub) => (
                              <button key={sub} type="button" onClick={() => setEditSubcategory(sub)}
                                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${editSubcategory === sub ? "bg-indigo-600 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                                {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button type="button" onClick={handleUpdateItem} disabled={isUpdating}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                        {isUpdating ? <><Loader2 size={15} className="animate-spin" />{t("inventory.updating")}</> : t("inventory.saveChanges")}
                      </button>
                    </div>
                  )}

                  {/* delete */}
                  <button type="button" onClick={() => void handleDelete(selectedItem.id)}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100">
                    <Trash2 size={15} /> {t("inventory.deleteItem")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default InventoryPage;