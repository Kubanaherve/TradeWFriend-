import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Plus,
  AlertTriangle,
  Search,
  Package,
  Pencil,
  X,
  Boxes,
  TrendingUp,
  Minus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/kinyarwanda";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
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
      "Soda",
      "Juice",
      "Water",
      "Milk",
      "Yogurt",
      "Energy Drink",
      "Tea",
      "Coffee",
      "Alcohol",
    ],
  },
  Food: {
    icon: "🍚",
    subcategories: [
      "Rice",
      "Flour",
      "Atta",
      "Dal",
      "Beans",
      "Semolina",
      "Grains",
      "Poha",
      "Besan",
      "Spices",
      "Salt",
      "Sugar",
      "Oats",
      "Cornflakes",
      "Pasta",
      "Noodles",
      "Condiments",
      "Spreads",
      "Milk Powder",
      "Food Oils",
    ],
  },
  Snacks: {
    icon: "🍪",
    subcategories: [
      "Chips",
      "Biscuits",
      "Chocolate",
      "Cake",
      "Candy",
      "Gum",
      "Lollipops",
      "Nuts",
    ],
  },
  Hygiene: {
    icon: "🧼",
    subcategories: [
      "Toothpaste",
      "Soap",
      "Sanitary Pads",
      "Baby Products",
      "Lotion",
      "Hair Products",
      "Cleaning Products",
      "Tissue & Rolls",
      "Powder & Fresheners",
    ],
  },
  Household: {
    icon: "🏠",
    subcategories: [
      "Mosquito Spray",
      "Bottles",
      "Toothpicks & Cotton",
      "Matches",
      "Cleaning Tools",
      "Miscellaneous",
    ],
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
    case "Drinks":
      return "🥤";
    case "Food":
      return "🍚";
    case "Snacks":
      return "🍪";
    case "Hygiene":
      return "🧼";
    case "Household":
      return "🏠";
    default:
      return "📦";
  }
};

const InventoryPage: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useI18n();

  const isOwner = profile?.role === "owner";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");

  const [finderOpen, setFinderOpen] = useState(false);
  const [finderSearch, setFinderSearch] = useState("");
  const [finderCategory, setFinderCategory] = useState<string>("All");
  const [finderSubcategory, setFinderSubcategory] = useState<string>("All");

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [clearingInventory, setClearingInventory] = useState(false);

  const availableNewSubcategories = useMemo(() => {
    if (!newCategory || !(newCategory in CATEGORY_CONFIG)) return [];
    return CATEGORY_CONFIG[newCategory as InventoryCategory].subcategories;
  }, [newCategory]);

  const availableEditSubcategories = useMemo(() => {
    if (!editCategory || !(editCategory in CATEGORY_CONFIG)) return [];
    return CATEGORY_CONFIG[editCategory as InventoryCategory].subcategories;
  }, [editCategory]);

  const mapInventoryRow = (row: any): InventoryItem => ({
    id: String(row.id),
    item_name: String(row.item_name ?? ""),
    quantity: Number(row.quantity ?? 0),
    cost_price: Number(row.cost_price ?? 0),
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    normalized_name:
      row.normalized_name ??
      (row.item_name ? String(row.item_name).toLowerCase().trim() : ""),
    created_at: row.created_at ?? undefined,
  });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select(
          "id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data ?? []).map(mapInventoryRow));
    } catch (err) {
      console.error("Fetch inventory error:", err);
      setItems([]);
      toast.error(getErrorMessage(err, "Failed to load inventory"));
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!selectedItem) return;

    const fresh = items.find((i) => i.id === selectedItem.id);
    if (!fresh) {
      setSelectedItem(null);
      return;
    }

    setSelectedItem(fresh);
  }, [items, selectedItem]);

  const resetAddForm = () => {
    setNewName("");
    setNewQuantity("");
    setNewCost("");
    setNewCategory("");
    setNewSubcategory("");
    setShowAddForm(false);
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost = parseFloat(newCost);

    if (!newName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error("Please fill all fields with valid values");
      return;
    }

    if (!newCategory) {
      toast.error("Please choose a category");
      return;
    }

    if (!newSubcategory) {
      toast.error("Please choose a subcategory");
      return;
    }

    if (quantity < 0 || cost < 0) {
      toast.error("Values cannot be negative");
      return;
    }

    setIsAdding(true);

    try {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .insert({
          item_name: newName.trim(),
          quantity,
          cost_price: cost,
          category: newCategory || null,
          subcategory: newSubcategory || null,
          normalized_name: newName.trim().toLowerCase(),
        })
        .select(
          "id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at"
        )
        .single();

      if (error) throw error;

      setItems((prev) => [mapInventoryRow(data), ...prev]);
      resetAddForm();
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Item added successfully");
    } catch (err) {
      console.error("Add item error:", err);
      toast.error("Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  const openItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.item_name);
    setEditQuantity(String(item.quantity));
    setEditCost(String(item.cost_price));
    setEditCategory(item.category ?? "");
    setEditSubcategory(item.subcategory ?? "");
  };

  const handleUpdateItem = async () => {
    if (!selectedItem || !isOwner) return;

    const quantity = parseInt(editQuantity, 10);
    const cost = parseFloat(editCost);

    if (!editName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error("Please fill all fields with valid values");
      return;
    }

    if (!editCategory) {
      toast.error("Please choose a category");
      return;
    }

    if (!editSubcategory) {
      toast.error("Please choose a subcategory");
      return;
    }

    if (quantity < 0 || cost < 0) {
      toast.error("Values cannot be negative");
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({
          item_name: editName.trim(),
          quantity,
          cost_price: cost,
          category: editCategory || null,
          subcategory: editSubcategory || null,
          normalized_name: editName.trim().toLowerCase(),
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                item_name: editName.trim(),
                quantity,
                cost_price: cost,
                category: editCategory || null,
                subcategory: editSubcategory || null,
                normalized_name: editName.trim().toLowerCase(),
              }
            : item
        )
      );

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Item updated successfully");
    } catch (err) {
      console.error("Update item error:", err);
      toast.error("Failed to update item");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickAdjust = async (delta: number) => {
    if (!selectedItem || !isOwner) return;

    const newQty = selectedItem.quantity + delta;
    if (newQty < 0) {
      toast.error("Quantity cannot be negative");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", selectedItem.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) => (i.id === selectedItem.id ? { ...i, quantity: newQty } : i))
      );
      setEditQuantity(String(newQty));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Stock updated");
    } catch (err) {
      console.error("Quick adjust error:", err);
      toast.error("Failed to update stock");
    }
  };

  const handleDelete = async (id: string) => {
    if (!isOwner || !window.confirm("Delete this item?")) return;

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Item deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete item");
    }
  };

  const handleClearInventory = async () => {
    if (!isOwner) {
      toast.error("Permission denied");
      return;
    }

    if (!window.confirm("Delete all inventory items?")) return;

    setClearingInventory(true);

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .delete()
        .not("id", "is", null);

      if (error) throw error;

      setItems([]);
      setSelectedItem(null);
      setShowAddForm(false);

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("All inventory deleted");
    } catch (err) {
      console.error("Clear inventory error:", err);
      toast.error("Failed to delete inventory");
    } finally {
      setClearingInventory(false);
    }
  };

  const availableFinderSubcategories = useMemo(() => {
    const filteredByCategory =
      finderCategory === "All"
        ? items
        : items.filter((item) => item.category === finderCategory);

    const unique = Array.from(
      new Set(
        filteredByCategory
          .map((item) => item.subcategory?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...unique];
  }, [items, finderCategory]);

  const filteredFinderItems = useMemo(() => {
    const q = finderSearch.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory =
        finderCategory === "All" ? true : item.category === finderCategory;

      const matchesSubcategory =
        finderSubcategory === "All" ? true : item.subcategory === finderSubcategory;

      const haystack = [
        item.item_name,
        item.category ?? "",
        item.subcategory ?? "",
        item.normalized_name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q ? true : haystack.includes(q);

      return matchesCategory && matchesSubcategory && matchesSearch;
    });
  }, [items, finderSearch, finderCategory, finderSubcategory]);

  const filteredItems = useMemo(() => {
    let result = items.filter((i) =>
      selectedCategoryFilter === "All" ? true : i.category === selectedCategoryFilter
    );

    switch (sortBy) {
      case "name_asc":
        result = [...result].sort((a, b) => a.item_name.localeCompare(b.item_name));
        break;
      case "name_desc":
        result = [...result].sort((a, b) => b.item_name.localeCompare(a.item_name));
        break;
      case "qty_low":
        result = [...result].sort((a, b) => a.quantity - b.quantity);
        break;
      case "qty_high":
        result = [...result].sort((a, b) => b.quantity - a.quantity);
        break;
      case "value_high":
        result = [...result].sort(
          (a, b) => b.quantity * b.cost_price - a.quantity * a.cost_price
        );
        break;
      default:
        result = [...result].sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );
        break;
    }

    return result;
  }, [items, sortBy, selectedCategoryFilter]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};

    for (const item of filteredItems) {
      const key = item.subcategory?.trim() || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    Object.keys(groups).forEach((key) => {
      groups[key] = [...groups[key]].sort((a, b) =>
        a.item_name.localeCompare(b.item_name)
      );
    });

    return groups;
  }, [filteredItems]);

  const shouldGroupBySubcategory = selectedCategoryFilter !== "All";

  const summary = useMemo(
    () => ({
      totalItems: items.length,
      totalUnits: items.reduce((s, i) => s + i.quantity, 0),
      lowStockCount: items.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD).length,
      totalValue: items.reduce((s, i) => s + i.quantity * i.cost_price, 0),
    }),
    [items]
  );

  const selectedItemValue = selectedItem
    ? selectedItem.quantity * selectedItem.cost_price
    : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("inventory.title") || "Inventory"}
            </h1>
            <p className="mt-1 text-gray-600">
              {summary.totalItems} {t("inventory.items") || "items"} • {summary.totalUnits}{" "}
              {t("inventory.unitsTotal") || "units total"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFinderOpen(true)}>
              <Search size={16} className="mr-2" />
              {t("inventory.findItem") || "Find Item"}
            </Button>

            {isOwner && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleClearInventory}
                  disabled={clearingInventory}
                  size="sm"
                >
                  <Trash2 size={16} className="mr-2" />
                  {clearingInventory
                    ? t("inventory.deleting") || "Deleting..."
                    : t("inventory.clearAll") || "Clear All"}
                </Button>

                <Button onClick={() => setShowAddForm((p) => !p)} size="sm">
                  <Plus size={16} className="mr-2" />
                  {showAddForm
                    ? t("common.cancel") || "Cancel"
                    : t("inventory.addItem") || "Add Item"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t("inventory.totalProducts") || "Total Products"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalItems}</p>
              </div>
              <Boxes className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t("inventory.totalUnits") || "Total Units"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalUnits}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t("inventory.lowStock") || "Low Stock"}
                </p>
                <p className="text-2xl font-bold text-red-600">{summary.lowStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t("inventory.totalValue") || "Total Value"}
                </p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(summary.totalValue)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            >
              <option value="newest">{t("inventory.sortNewest") || "Newest First"}</option>
              <option value="name_asc">{t("inventory.sortNameAsc") || "Name A-Z"}</option>
              <option value="name_desc">{t("inventory.sortNameDesc") || "Name Z-A"}</option>
              <option value="qty_low">{t("inventory.sortQtyLow") || "Lowest Stock"}</option>
              <option value="qty_high">{t("inventory.sortQtyHigh") || "Highest Stock"}</option>
              <option value="value_high">{t("inventory.sortValueHigh") || "Highest Value"}</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {CATEGORY_OPTIONS.map((category) => {
                const active = selectedCategoryFilter === category.value;
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(category.value)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="text-sm">{category.icon}</span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {showAddForm && isOwner && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {t("inventory.addNewItem") || "Add New Item"}
            </h2>

            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder={t("inventory.itemName") || "Item name"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                type="number"
                placeholder={t("inventory.quantity") || "Quantity"}
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
              <Input
                type="number"
                placeholder={t("inventory.costPrice") || "Cost price"}
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </div>

            <div className="mb-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                {t("inventory.category") || "Category"}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setNewCategory(key);
                      setNewSubcategory("");
                    }}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                      newCategory === key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span>{val.icon}</span>
                    <span>{key}</span>
                  </button>
                ))}
              </div>
            </div>

            {newCategory && availableNewSubcategories.length > 0 && (
              <div className="mb-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  {t("inventory.subcategory") || "Subcategory"}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {availableNewSubcategories.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setNewSubcategory(sub)}
                      className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                        newSubcategory === sub
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAddItem}
              disabled={isAdding}
              className="w-full sm:w-auto"
            >
              {isAdding ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  {t("inventory.adding") || "Adding..."}
                </>
              ) : (
                t("inventory.addItem") || "Add Item"
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">
              {t("inventory.loading") || "Loading inventory..."}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              {t("inventory.noItemsFound") || "No items found"}
            </h3>
            <p className="text-gray-600">
              {t("inventory.startAddingFirst") || "Start by adding your first inventory item."}
            </p>
          </div>
        ) : shouldGroupBySubcategory ? (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([subcategory, subcategoryItems]) => (
              <section key={subcategory} className="space-y-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{subcategory}</h2>
                  <p className="text-xs text-slate-500">
                    {subcategoryItems.length} item{subcategoryItems.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subcategoryItems.map((item) => {
                    const isLowStock = item.quantity <= LOW_STOCK_THRESHOLD;
                    const totalValue = item.quantity * item.cost_price;

                    return (
                      <div
                        key={item.id}
                        className={`cursor-pointer rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${
                          isLowStock ? "border-red-200 bg-red-50" : ""
                        }`}
                        onClick={() => openItem(item)}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{getCategoryIcon(item.category)}</span>
                              <h3 className="truncate font-semibold text-gray-900">
                                {item.item_name}
                              </h3>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {item.category && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                  {item.category}
                                </span>
                              )}
                              {item.subcategory && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                  {item.subcategory}
                                </span>
                              )}
                            </div>
                          </div>

                          {isLowStock && (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                              {t("inventory.lowStock") || "Low Stock"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {t("inventory.quantity") || "Quantity"}:
                            </span>
                            <span
                              className={`font-medium ${
                                isLowStock ? "text-red-600" : "text-gray-900"
                              }`}
                            >
                              {item.quantity}
                            </span>
                          </div>

                          {isOwner && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {t("inventory.cost") || "Cost"}:
                              </span>
                              <span className="font-medium">
                                {formatCurrency(item.cost_price)}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {t("inventory.totalValue") || "Total Value"}:
                            </span>
                            <span className="font-medium text-emerald-600">
                              {formatCurrency(totalValue)}
                            </span>
                          </div>
                        </div>

                        {isOwner && (
                          <div className="mt-4 flex justify-end border-t pt-3">
                            <Pencil size={16} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const isLowStock = item.quantity <= LOW_STOCK_THRESHOLD;
              const totalValue = item.quantity * item.cost_price;

              return (
                <div
                  key={item.id}
                  className={`cursor-pointer rounded-lg border bg-white p-4 transition-shadow hover:shadow-md ${
                    isLowStock ? "border-red-200 bg-red-50" : ""
                  }`}
                  onClick={() => openItem(item)}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{getCategoryIcon(item.category)}</span>
                        <h3 className="truncate font-semibold text-gray-900">{item.item_name}</h3>
                      </div>

                      {(item.category || item.subcategory) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {item.category && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              {item.category}
                            </span>
                          )}
                          {item.subcategory && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                              {item.subcategory}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isLowStock && (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                        {t("inventory.lowStock") || "Low Stock"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {t("inventory.quantity") || "Quantity"}:
                      </span>
                      <span
                        className={`font-medium ${isLowStock ? "text-red-600" : "text-gray-900"}`}
                      >
                        {item.quantity}
                      </span>
                    </div>

                    {isOwner && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t("inventory.cost") || "Cost"}:</span>
                        <span className="font-medium">{formatCurrency(item.cost_price)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {t("inventory.totalValue") || "Total Value"}:
                      </span>
                      <span className="font-medium text-emerald-600">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="mt-4 flex justify-end border-t pt-3">
                      <Pencil size={16} className="text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {finderOpen && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-3xl rounded-t-[2rem] bg-white shadow-2xl sm:rounded-2xl">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {t("inventory.findItem") || "Find Item"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Search by name, category, or subcategory
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFinderOpen(false)}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    autoFocus
                    value={finderSearch}
                    onChange={(e) => setFinderSearch(e.target.value)}
                    placeholder="Search item name, category or subcategory..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {finderSearch && (
                    <button type="button" onClick={() => setFinderSearch("")}>
                      <X size={13} className="text-slate-400" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {CATEGORY_OPTIONS.map((category) => {
                    const active = finderCategory === category.value;
                    return (
                      <button
                        key={category.value}
                        type="button"
                        onClick={() => {
                          setFinderCategory(category.value);
                          setFinderSubcategory("All");
                        }}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="text-sm">{category.icon}</span>
                        <span>{category.label}</span>
                      </button>
                    );
                  })}
                </div>

                {finderCategory !== "All" && availableFinderSubcategories.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Subcategory
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {availableFinderSubcategories.map((subcategory) => {
                        const active = finderSubcategory === subcategory;
                        return (
                          <button
                            key={subcategory}
                            type="button"
                            onClick={() => setFinderSubcategory(subcategory)}
                            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              active
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {subcategory}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="max-h-[420px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-400">
                      <Loader2 size={15} className="animate-spin" />
                      Loading items…
                    </div>
                  ) : filteredFinderItems.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">
                      No matching items
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredFinderItems.map((item) => {
                        const isLowStock = item.quantity <= LOW_STOCK_THRESHOLD;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              openItem(item);
                              setFinderOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                              isLowStock
                                ? "border-red-200 bg-red-50"
                                : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{getCategoryIcon(item.category)}</span>
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {item.item_name}
                                </p>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {item.category && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                    {item.category}
                                  </span>
                                )}
                                {item.subcategory && (
                                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                    {item.subcategory}
                                  </span>
                                )}
                                <span className="font-semibold text-emerald-700">
                                  {formatCurrency(item.cost_price)}
                                </span>
                              </div>

                              <p className="mt-2 text-xs text-slate-500">
                                Remaining stock: {item.quantity}
                              </p>
                            </div>

                            <div className="shrink-0">
                              {isLowStock ? (
                                <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                                  Low
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                  OK
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg bg-white">
              <div className="flex items-center justify-between border-b p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(selectedItem.category)}</span>
                    <h2 className="text-lg font-bold text-gray-900">{selectedItem.item_name}</h2>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {selectedItem.category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {selectedItem.category}
                      </span>
                    )}
                    {selectedItem.subcategory && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                        {selectedItem.subcategory}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-gray-600">
                    {selectedItem.quantity <= LOW_STOCK_THRESHOLD
                      ? t("inventory.lowStock") || "Low stock"
                      : t("inventory.inStock") || "In stock"}
                  </p>
                </div>

                <Button onClick={() => setSelectedItem(null)} variant="ghost" size="sm">
                  <X size={20} />
                </Button>
              </div>

              <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-600">
                      {t("inventory.quantity") || "Quantity"}
                    </p>
                    <p className="text-lg font-bold text-gray-900">{selectedItem.quantity}</p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-600">
                      {t("inventory.costPrice") || "Cost Price"}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedItem.cost_price)}
                    </p>
                  </div>

                  <div className="col-span-2 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-600">
                      {t("inventory.totalValue") || "Total Value"}
                    </p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(selectedItemValue)}
                    </p>
                  </div>
                </div>

                {isOwner && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      {t("inventory.editItem") || "Edit Item"}
                    </h3>

                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t("inventory.itemName") || "Item name"}
                    />

                    <Input
                      type="number"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      placeholder={t("inventory.quantity") || "Quantity"}
                    />

                    <Input
                      type="number"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      placeholder={t("inventory.costPrice") || "Cost price"}
                    />

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700">
                        {t("inventory.category") || "Category"}
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setEditCategory(key);
                              setEditSubcategory("");
                            }}
                            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                              editCategory === key
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span>{val.icon}</span>
                            <span>{key}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {editCategory && availableEditSubcategories.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">
                          {t("inventory.subcategory") || "Subcategory"}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {availableEditSubcategories.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setEditSubcategory(sub)}
                              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                                editSubcategory === sub
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleQuickAdjust(-1)}
                        className="flex-1"
                      >
                        <Minus size={16} className="mr-1" />
                        -1
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => void handleQuickAdjust(1)}
                        className="flex-1"
                      >
                        <Plus size={16} className="mr-1" />
                        +1
                      </Button>
                    </div>

                    <Button
                      onClick={handleUpdateItem}
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          {t("inventory.updating") || "Updating..."}
                        </>
                      ) : (
                        t("inventory.saveChanges") || "Save Changes"
                      )}
                    </Button>

                    <Button
                      onClick={() => void handleDelete(selectedItem.id)}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 size={16} className="mr-2" />
                      {t("inventory.deleteItem") || "Delete Item"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default InventoryPage;