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

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  created_at?: string;
}

type SortOption =
  | "newest"
  | "name_asc"
  | "name_desc"
  | "qty_low"
  | "qty_high"
  | "value_high";

const LOW_STOCK_THRESHOLD = 5;

const InventoryPage: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useI18n();

  const isOwner = profile?.role === "owner";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCost, setNewCost] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCost, setEditCost] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // UI
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [clearingInventory, setClearingInventory] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(Array.isArray(data) ? (data as InventoryItem[]) : []);
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

  // Keep selected item fresh
  useEffect(() => {
    if (!selectedItem) return;
    const fresh = items.find((i) => i.id === selectedItem.id);
    if (!fresh) { setSelectedItem(null); return; }
    setSelectedItem(fresh);
  }, [items]);

  // ─── Add item ───────────────────────────────────────────────────────────

  const resetAddForm = () => {
    setNewName(""); setNewQuantity(""); setNewCost("");
    setShowAddForm(false);
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost = parseFloat(newCost);

    if (!newName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error("Please fill all fields with valid values"); return;
    }
    if (quantity < 0 || cost < 0) {
      toast.error("Values cannot be negative"); return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({ item_name: newName.trim(), quantity, cost_price: cost })
        .select("id, item_name, quantity, cost_price, created_at")
        .single();

      if (error) throw error;

      setItems((prev) => [data as InventoryItem, ...prev]);
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

  // ─── Open edit modal ─────────────────────────────────────────────────────

  const openItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.item_name);
    setEditQuantity(String(item.quantity));
    setEditCost(String(item.cost_price));
  };

  // ─── Update item ─────────────────────────────────────────────────────────

  const handleUpdateItem = async () => {
    if (!selectedItem || !isOwner) return;

    const quantity = parseInt(editQuantity, 10);
    const cost = parseFloat(editCost);

    if (!editName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error("Please fill all fields with valid values"); return;
    }
    if (quantity < 0 || cost < 0) {
      toast.error("Values cannot be negative"); return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ item_name: editName.trim(), quantity, cost_price: cost })
        .eq("id", selectedItem.id);

      if (error) throw error;

      setItems((prev) => prev.map((item) =>
        item.id === selectedItem.id
          ? { ...item, item_name: editName.trim(), quantity, cost_price: cost }
          : item
      ));

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Item updated successfully");
    } catch (err) {
      console.error("Update item error:", err);
      toast.error("Failed to update item");
    } finally {
      setIsUpdating(false);
    }
  };

  // ─── Quick stock adjust ─────────────────────────────────────────────────

  const handleQuickAdjust = async (delta: number) => {
    if (!selectedItem || !isOwner) return;
    const newQty = selectedItem.quantity + delta;
    if (newQty < 0) { toast.error("Quantity cannot be negative"); return; }

    try {
      const { error } = await supabase
        .from("inventory_items").update({ quantity: newQty }).eq("id", selectedItem.id);
      if (error) throw error;

      setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, quantity: newQty } : i));
      setEditQuantity(String(newQty));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("Stock updated");
    } catch (err) {
      console.error("Quick adjust error:", err);
      toast.error("Failed to update stock");
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!isOwner || !window.confirm("Delete this item?")) return;
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
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

  // ─── Clear all ───────────────────────────────────────────────────────────

  const handleClearInventory = async () => {
    if (!isOwner) { toast.error("Permission denied"); return; }
    if (!window.confirm("Delete all inventory items?")) return;
    setClearingInventory(true);
    try {
      const { error } = await supabase.from("inventory_items").delete().not("id", "is", null);
      if (error) throw error;
      setItems([]); setSelectedItem(null); setShowAddForm(false);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("All inventory deleted");
    } catch (err) {
      console.error("Clear inventory error:", err);
      toast.error("Failed to delete inventory");
    } finally {
      setClearingInventory(false);
    }
  };

  // ─── Filtered & sorted list ──────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = items.filter((i) => i.item_name.toLowerCase().includes(q));
    switch (sortBy) {
      case "name_asc":   result = [...result].sort((a, b) => a.item_name.localeCompare(b.item_name)); break;
      case "name_desc":  result = [...result].sort((a, b) => b.item_name.localeCompare(a.item_name)); break;
      case "qty_low":    result = [...result].sort((a, b) => a.quantity - b.quantity); break;
      case "qty_high":   result = [...result].sort((a, b) => b.quantity - a.quantity); break;
      case "value_high": result = [...result].sort((a, b) => b.quantity * b.cost_price - a.quantity * a.cost_price); break;
      default:           result = [...result].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))); break;
    }
    return result;
  }, [items, search, sortBy]);

  const summary = useMemo(() => ({
    totalItems: items.length,
    totalUnits: items.reduce((s, i) => s + i.quantity, 0),
    lowStockCount: items.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD).length,
    totalValue: items.reduce((s, i) => s + i.quantity * i.cost_price, 0),
  }), [items]);

  const selectedItemValue = selectedItem ? selectedItem.quantity * selectedItem.cost_price : 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-gray-600 mt-1">
              {summary.totalItems} items • {summary.totalUnits} units total
            </p>
          </div>

          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={handleClearInventory}
                disabled={clearingInventory}
                size="sm"
              >
                <Trash2 size={16} className="mr-2" />
                {clearingInventory ? "Deleting..." : "Clear All"}
              </Button>

              <Button
                onClick={() => setShowAddForm((p) => !p)}
                size="sm"
              >
                <Plus size={16} className="mr-2" />
                {showAddForm ? "Cancel" : "Add Item"}
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalItems}</p>
              </div>
              <Boxes className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Units</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalUnits}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{summary.lowStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="qty_low">Lowest Stock</option>
            <option value="qty_high">Highest Stock</option>
            <option value="value_high">Highest Value</option>
          </select>
        </div>

        {/* Add Form */}
        {showAddForm && isOwner && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Add New Item</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Input
                placeholder="Item name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Quantity"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Cost price"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </div>

            <Button
              onClick={handleAddItem}
              disabled={isAdding}
              className="w-full sm:w-auto"
            >
              {isAdding ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </div>
        )}

        {/* Items Grid */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">
              {search ? "No items match your search." : "Start by adding your first inventory item."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const isLowStock = item.quantity <= LOW_STOCK_THRESHOLD;
              const totalValue = item.quantity * item.cost_price;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    isLowStock ? "border-red-200 bg-red-50" : ""
                  }`}
                  onClick={() => openItem(item)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 truncate">{item.item_name}</h3>
                    {isLowStock && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        Low Stock
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Quantity:</span>
                      <span className={`font-medium ${isLowStock ? "text-red-600" : "text-gray-900"}`}>
                        {item.quantity}
                      </span>
                    </div>
                    {isOwner && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Cost:</span>
                        <span className="font-medium">{formatCurrency(item.cost_price)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Value:</span>
                      <span className="font-medium text-emerald-600">{formatCurrency(totalValue)}</span>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="mt-4 pt-3 border-t flex justify-end">
                      <Pencil size={16} className="text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Modal */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedItem.item_name}</h2>
                  <p className="text-sm text-gray-600">
                    {selectedItem.quantity <= LOW_STOCK_THRESHOLD ? "Low stock" : "In stock"}
                  </p>
                </div>
                <Button
                  onClick={() => setSelectedItem(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X size={20} />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide">Quantity</p>
                    <p className="text-lg font-bold text-gray-900">{selectedItem.quantity}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide">Cost Price</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedItem.cost_price)}</p>
                  </div>
                  <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide">Total Value</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedItemValue)}</p>
                  </div>
                </div>

                {isOwner && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Edit Item</h3>

                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Item name"
                    />
                    <Input
                      type="number"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      placeholder="Quantity"
                    />
                    <Input
                      type="number"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      placeholder="Cost price"
                    />

                    {/* Quick Adjust */}
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
                          Updating...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>

                    <Button
                      onClick={() => void handleDelete(selectedItem.id)}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete Item
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
