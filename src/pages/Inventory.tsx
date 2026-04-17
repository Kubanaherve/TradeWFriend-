import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Plus,
  Camera,
  AlertTriangle,
  Search,
  Package,
  Pencil,
  X,
  Boxes,
  TrendingUp,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/kinyarwanda";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  image_url?: string | null;
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
const INVENTORY_BUCKET = "inventory_images";

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
  const [newImageUrl, setNewImageUrl] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearingInventory, setClearingInventory] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, image_url, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems(Array.isArray(data) ? (data as InventoryItem[]) : []);
    } catch (err) {
      console.error("Fetch inventory error:", err);
      setItems([]);
      toast.error(t("inventory.fetchFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchItems();

    const refreshInventory = () => {
      void fetchItems();
    };

    window.addEventListener("inventoryUpdated", refreshInventory);
    window.addEventListener("factoryReset", refreshInventory);
    window.addEventListener("focus", refreshInventory);

    return () => {
      window.removeEventListener("inventoryUpdated", refreshInventory);
      window.removeEventListener("factoryReset", refreshInventory);
      window.removeEventListener("focus", refreshInventory);
    };
  }, [fetchItems]);

  useEffect(() => {
    if (!selectedItem) return;

    const refreshedItem = items.find((item) => item.id === selectedItem.id);
    if (!refreshedItem) {
      setSelectedItem(null);
      return;
    }

    setSelectedItem(refreshedItem);
  }, [items, selectedItem]);

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;

    const maxBytes = 2.5 * 1024 * 1024;
    if (file.size <= maxBytes) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / img.width);

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              resolve(file);
              return;
            }

            resolve(
              new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
                type: "image/jpeg",
              })
            );
          },
          "image/jpeg",
          0.82
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "new" | "edit" = "new"
  ) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (
      !allowedTypes.includes(originalFile.type) &&
      !originalFile.type.startsWith("image/")
    ) {
      toast.error("Choose a valid image or screenshot.");
      e.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const file = await compressImageIfNeeded(originalFile);

      const safeName = file.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .toLowerCase();

      const filePath = `inventory/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}-${safeName || "image.jpg"}`;

      const { error: uploadError } = await supabase.storage
        .from(INVENTORY_BUCKET)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error(uploadError.message || "Upload failed");
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(INVENTORY_BUCKET).getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error("Public URL not returned after upload.");
      }

      if (mode === "new") {
        setNewImageUrl(publicUrl);
      } else {
        setEditImageUrl(publicUrl);
      }

      toast.success("Image uploaded successfully.");
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error(
        err instanceof Error ? err.message : "Image upload failed. Check storage bucket/policies."
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const resetAddForm = () => {
    setNewName("");
    setNewQuantity("");
    setNewCost("");
    setNewImageUrl("");
    setShowAddForm(false);
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost = parseFloat(newCost);

    if (!newName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error(t("inventory.fillAllFields"));
      return;
    }

    if (quantity < 0 || cost < 0) {
      toast.error(t("inventory.invalidValues"));
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
          image_url: newImageUrl || null,
        })
        .select("id, item_name, quantity, cost_price, image_url, created_at")
        .single();

      if (error) throw error;

      setItems((prev) => [data as InventoryItem, ...prev]);
      resetAddForm();

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemAdded"));
    } catch (err) {
      console.error("Add item error:", err);
      toast.error(t("inventory.addFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  const openItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.item_name);
    setEditQuantity(String(item.quantity));
    setEditCost(String(item.cost_price));
    setEditImageUrl(item.image_url || "");
  };

  const handleUpdateItem = async () => {
    if (!selectedItem || !isOwner) return;

    const quantity = parseInt(editQuantity, 10);
    const cost = parseFloat(editCost);

    if (!editName.trim() || Number.isNaN(quantity) || Number.isNaN(cost)) {
      toast.error(t("inventory.fillAllFields"));
      return;
    }

    if (quantity < 0 || cost < 0) {
      toast.error(t("inventory.invalidValues"));
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
          image_url: editImageUrl || null,
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
                image_url: editImageUrl || null,
              }
            : item
        )
      );

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemUpdated"));
    } catch (err) {
      console.error("Update item error:", err);
      toast.error(t("inventory.updateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickAdjust = async (delta: number) => {
    if (!selectedItem || !isOwner) return;

    const newQty = selectedItem.quantity + delta;
    if (newQty < 0) {
      toast.error(t("inventory.quantityCannotBeNegative"));
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", selectedItem.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, quantity: newQty } : item
        )
      );

      setEditQuantity(String(newQty));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.stockUpdated"));
    } catch (err) {
      console.error("Quick adjust error:", err);
      toast.error(t("inventory.updateFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!isOwner) return;
    if (!window.confirm(t("inventory.confirmDelete"))) return;

    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);

      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success(t("inventory.itemDeleted"));
    } catch (err) {
      console.error("Delete item error:", err);
      toast.error(t("inventory.deleteFailed"));
    }
  };

  const handleClearInventory = async () => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const confirmed = window.confirm("Delete all inventory items?");
    if (!confirmed) return;

    setClearingInventory(true);

    try {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .not("id", "is", null);

      if (error) throw error;

      setItems([]);
      setSelectedItem(null);
      setShowAddForm(false);

      await fetchItems();
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      toast.success("All inventory deleted");
    } catch (err) {
      console.error("Clear inventory error:", err);
      toast.error("Failed to delete inventory");
    } finally {
      setClearingInventory(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = items.filter((item) => item.item_name.toLowerCase().includes(q));

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
      case "newest":
      default:
        result = [...result].sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );
        break;
    }

    return result;
  }, [items, search, sortBy]);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = items.filter((item) => item.quantity <= LOW_STOCK_THRESHOLD).length;
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.cost_price, 0);

    return { totalItems, totalUnits, lowStockCount, totalValue };
  }, [items]);

  const selectedItemValue = selectedItem
    ? selectedItem.quantity * selectedItem.cost_price
    : 0;

  return (
    <AppShell
      title={t("inventory.title")}
      subtitle={t("inventory.subtitle")}
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
      headerRight={
        isOwner ? (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              className="h-9 rounded-xl px-3 text-sm font-semibold"
              onClick={handleClearInventory}
              disabled={clearingInventory}
            >
              <Trash2 size={14} className="mr-1" />
              {clearingInventory ? "Deleting..." : "Clear All"}
            </Button>

            <Button
              className="h-9 rounded-xl px-4 text-sm font-semibold"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              <Plus size={16} className="mr-2" />
              {showAddForm ? t("common.close") : t("inventory.addItem")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <Boxes size={16} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {t("inventory.totalProducts")}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{summary.totalItems}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <Package size={16} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {t("inventory.totalUnits")}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{summary.totalUnits}</p>
          </div>

          <div className="rounded-[24px] border border-red-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <AlertTriangle size={16} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {t("inventory.lowStock")}
              </span>
            </div>
            <p className="text-xl font-bold text-red-600">{summary.lowStockCount}</p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <TrendingUp size={16} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {t("inventory.totalStockValue")}
              </span>
            </div>
            <p className="text-sm font-bold text-emerald-700 md:text-base">
              {formatCurrency(summary.totalValue)}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${t("common.search")}...`}
                className="h-11 rounded-xl border-slate-200 pl-10 text-sm"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="newest">{t("inventory.sortNewest")}</option>
              <option value="name_asc">{t("inventory.sortNameAsc")}</option>
              <option value="name_desc">{t("inventory.sortNameDesc")}</option>
              <option value="qty_low">{t("inventory.sortQtyLow")}</option>
              <option value="qty_high">{t("inventory.sortQtyHigh")}</option>
              <option value="value_high">{t("inventory.sortValueHigh")}</option>
            </select>
          </div>
        </div>

        {showAddForm && isOwner && (
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">{t("inventory.addItem")}</h2>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder={t("inventory.itemNamePlaceholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-11 rounded-xl border-slate-200 text-sm"
              />
              <Input
                placeholder={t("inventory.quantity")}
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="h-11 rounded-xl border-slate-200 text-sm"
              />
              <Input
                placeholder={t("inventory.costPrice")}
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className="h-11 rounded-xl border-slate-200 text-sm"
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
              <Camera size={18} className="text-slate-400" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                capture="environment"
                onChange={(e) => void handleFileUpload(e, "new")}
                className="flex-1 text-xs text-slate-600"
              />
            </div>

            {newImageUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={newImageUrl}
                  className="h-20 w-20 rounded-2xl border border-slate-200 object-cover shadow-sm"
                  alt="preview"
                />
                <div className="text-xs text-slate-500">Image ready</div>
              </div>
            )}

            <Button
              className="h-11 w-full rounded-xl text-sm font-semibold md:w-auto"
              onClick={handleAddItem}
              disabled={isAdding || uploading}
            >
              {isAdding ? t("common.saving") : t("inventory.confirmAdd")}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Package size={30} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">{t("inventory.noItems")}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const isLowStock = item.quantity <= LOW_STOCK_THRESHOLD;
              const totalValue = item.quantity * item.cost_price;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`w-full rounded-[24px] border p-3 text-left transition-all hover:shadow-md ${
                    isLowStock
                      ? "border-red-200 bg-red-50/50"
                      : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          className="h-full w-full object-cover"
                          alt={item.item_name}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Camera size={20} className="text-slate-300" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-bold text-slate-900">
                          {item.item_name}
                        </h3>
                        {isLowStock && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                            {t("inventory.lowStockBadge")}
                          </span>
                        )}
                      </div>

                      {isOwner && (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700">
                          {t("inventory.costPrice")}: {formatCurrency(item.cost_price)}
                        </p>
                      )}

                      <p
                        className={`mt-1 text-xs font-extrabold ${
                          isLowStock ? "text-red-600" : "text-blue-600"
                        }`}
                      >
                        {t("inventory.remainingStock")}: {item.quantity}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {t("inventory.totalStockValue")}: {formatCurrency(totalValue)}
                      </p>
                    </div>

                    {isOwner && (
                      <div className="text-slate-300">
                        <Pencil size={18} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedItem.image_url ? (
                    <img
                      src={selectedItem.image_url}
                      alt={selectedItem.item_name}
                      className="h-16 w-16 rounded-2xl border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                      <Package size={22} className="text-slate-400" />
                    </div>
                  )}

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedItem.item_name}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedItem.quantity <= LOW_STOCK_THRESHOLD
                        ? t("inventory.lowStock")
                        : t("inventory.inStock")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {t("inventory.remainingStock")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedItem.quantity}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {t("inventory.costPrice")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatCurrency(selectedItem.cost_price)}
                  </p>
                </div>

                <div className="col-span-2 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {t("inventory.totalCostValue")}
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    {formatCurrency(selectedItemValue)}
                  </p>
                </div>
              </div>

              {isOwner && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700">{t("inventory.editItem")}</h3>

                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t("inventory.itemNamePlaceholder")}
                    className="h-11 rounded-xl border-slate-200 text-sm"
                  />

                  <Input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    placeholder={t("inventory.quantity")}
                    className="h-11 rounded-xl border-slate-200 text-sm"
                  />

                  <Input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    placeholder={t("inventory.costPrice")}
                    className="h-11 rounded-xl border-slate-200 text-sm"
                  />

                  <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                    <Camera size={18} className="text-slate-400" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                      capture="environment"
                      onChange={(e) => void handleFileUpload(e, "edit")}
                      className="flex-1 text-xs text-slate-600"
                    />
                  </div>

                  {editImageUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={editImageUrl}
                        className="h-20 w-20 rounded-2xl border border-slate-200 object-cover shadow-sm"
                        alt="edit preview"
                      />
                      <div className="text-xs text-slate-500">Updated image ready</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void handleQuickAdjust(-1)}
                      className="h-11 gap-2 rounded-xl text-sm font-semibold"
                    >
                      <Minus size={16} />
                      {t("inventory.reduceOne")}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => void handleQuickAdjust(1)}
                      className="h-11 gap-2 rounded-xl text-sm font-semibold"
                    >
                      <Plus size={16} />
                      {t("inventory.addOne")}
                    </Button>
                  </div>

                  <Button
                    onClick={handleUpdateItem}
                    disabled={isUpdating || uploading}
                    className="h-11 w-full rounded-xl text-sm font-semibold"
                  >
                    {isUpdating ? t("common.saving") : t("inventory.saveChanges")}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => void handleDelete(selectedItem.id)}
                    className="h-11 w-full gap-2 rounded-xl text-sm font-semibold"
                  >
                    <Trash2 size={16} />
                    {t("common.delete")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default InventoryPage;