import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/kinyarwanda";
import AppShell from "@/components/layout/AppShell";
import {
  X,
  Package,
  User,
  Phone,
  Calendar,
  ShoppingBag,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";
import { useAppStore } from "@/store/AppStore";
import { useAuth, normalizePhone } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import type { InventoryItem } from "@/types/inventory";

interface SelectedItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

type ExistingCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  items: string;
  amount: number;
  is_paid: boolean;
  due_date: string | null;
};

const CATEGORY_CONFIG: Record<string, { icon: string; subcategories: string[] }> = {
  Drinks: {
    icon: "🥤",
    subcategories: ["All", "Soda", "Juice", "Water", "Milk", "Yogurt", "Energy Drink", "Tea", "Coffee", "Alcohol"],
  },
  Food: {
    icon: "🍚",
    subcategories: [
      "All",
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
    subcategories: ["All", "Chips", "Biscuits", "Chocolate", "Cake", "Candy", "Gum", "Lollipops", "Nuts"],
  },
  Hygiene: {
    icon: "🧼",
    subcategories: [
      "All",
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
    subcategories: ["All", "Mosquito Spray", "Bottles", "Toothpicks & Cotton", "Matches", "Cleaning Tools", "Miscellaneous"],
  },
};

const AddDebtPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useI18n();
  const { customers } = useCustomerSuggestions();
  useBusinessSettings();
  const { recordTransaction } = useAppStore();

  const actorIdentifier = auth.profile?.phone ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    dueDate: new Date().toISOString().split("T")[0],
    isPaid: false,
    amount: "0",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);
  const [popupSelectedItem, setPopupSelectedItem] = useState<InventoryItem | null>(null);
  const [popupItemQty, setPopupItemQty] = useState<string>("1");

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All");

  const [nameSuggestion, setNameSuggestion] = useState("");

  const totalAmount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [selectedItems]
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      amount: String(totalAmount),
    }));
  }, [totalAmount]);

  useEffect(() => {
    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("id, item_name, quantity, cost_price, category, subcategory, normalized_name, created_at")
          .order("item_name", { ascending: true });

        if (error) throw error;
        setInventory((data || []) as InventoryItem[]);
      } catch (error) {
        console.error("Inventory load failed:", error);
        toast.error(t("inventory.loadFailed") || "Failed to load inventory");
      } finally {
        setInventoryLoading(false);
      }
    };

    void fetchInventory();
  }, [t]);

  useEffect(() => {
    if (!showInventoryPopup) {
      setPopupSelectedItem(null);
      setPopupItemQty("1");
      setInventoryQuery("");
      setSelectedCategory("All");
      setSelectedSubcategory("All");
    }
  }, [showInventoryPopup]);

  useEffect(() => {
    setSelectedSubcategory("All");
  }, [selectedCategory]);

  const normalizeCustomerNameSoft = (value: string) => {
    const cleaned = value
      .replace(/\s+/g, " ")
      .replace(/\b(mr|mrs|ms|dr)\.?\s+/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
      .trim();

    return cleaned
      .split(" ")
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
      .join(" ");
  };

  const handleNameBlur = () => {
    const raw = form.name.trim();
    if (!raw) {
      setNameSuggestion("");
      return;
    }

    const normalized = normalizeCustomerNameSoft(raw);
    setNameSuggestion(normalized !== raw ? normalized : "");
  };

  const applyNameSuggestion = () => {
    if (!nameSuggestion) return;
    setForm((prev) => ({ ...prev, name: nameSuggestion }));
    setNameSuggestion("");
  };

  const handleCustomerSelect = async (customer: { name: string; phone: string | null }) => {
    const normalized = customer.phone ? normalizePhone(customer.phone) : "";

    setForm((prev) => ({
      ...prev,
      name: customer.name,
      phone: normalized,
    }));
  };

  const categoryOptions = useMemo(
    () => ["All", ...Object.keys(CATEGORY_CONFIG)],
    []
  );

  const subcategoryOptions = useMemo(() => {
    if (selectedCategory === "All") return ["All"];
    return CATEGORY_CONFIG[selectedCategory]?.subcategories ?? ["All"];
  }, [selectedCategory]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" ? true : item.category === selectedCategory;

      const matchesSubcategory =
        selectedSubcategory === "All" ? true : item.subcategory === selectedSubcategory;

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
  }, [inventory, inventoryQuery, selectedCategory, selectedSubcategory]);

  const addSelectedInventoryItem = (item: InventoryItem, quantityToAdd: number) => {
    if (quantityToAdd < 1) return;

    const existingIndex = selectedItems.findIndex((i) => i.id === item.id);
    const existingQty = existingIndex >= 0 ? selectedItems[existingIndex].quantity : 0;
    const newQty = existingQty + quantityToAdd;

    if (newQty > item.quantity) {
      toast.error(t("addDebt.stockExceeded"));
      return;
    }

    if (existingIndex >= 0) {
      const next = [...selectedItems];
      next[existingIndex] = { ...next[existingIndex], quantity: newQty };
      setSelectedItems(next);
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.item_name,
          quantity: quantityToAdd,
          price: item.cost_price,
        },
      ]);
    }

    setPopupSelectedItem(null);
    setPopupItemQty("1");
    setInventoryQuery("");
    setShowInventoryPopup(false);
  };

  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;
    const qty = parseInt(popupItemQty, 10);
    if (Number.isNaN(qty) || qty < 1) return;
    addSelectedInventoryItem(popupSelectedItem, qty);
  };

  const removeItemFromList = (id: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateSelectedItemQty = (id: string, nextQty: number) => {
    if (nextQty < 1) return;

    const stockItem = inventory.find((item) => item.id === id);
    if (!stockItem) return;

    if (nextQty > stockItem.quantity) {
      toast.error(t("addDebt.stockExceeded"));
      return;
    }

    setSelectedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: nextQty } : item))
    );
  };

  const parseLegacyItems = (raw: string): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
      return [String(parsed)];
    } catch {
      return [raw];
    }
  };

  const buildWhatsappMessage = (
    customerName: string,
    phone: string,
    items: SelectedItem[],
    total: number,
    dueDate: string,
    isPaid: boolean
  ) => {
    const lines = items.map(
      (item) => `- ${item.name} x${item.quantity} = ${formatCurrency(item.quantity * item.price)}`
    );

    const businessName = auth.profile?.businessName || "Business";

    const message = [
      `${t("addDebt.debtNotificationGreeting")} ${customerName},`,
      "",
      isPaid
        ? `${t("addDebt.debtNotificationTaken")} ${t("addDebt.debtNotificationAt")} ${businessName} (${t("addDebt.paid")}).`
        : `${t("addDebt.debtNotificationTaken")} ${t("addDebt.debtNotificationAt")} ${businessName}.`,
      "",
      `${t("common.details")}:`,
      ...lines,
      "",
      `${t("addDebt.debtNotificationTotal")} ${formatCurrency(total)}`,
      isPaid
        ? `${t("common.status")}: ${t("addDebt.paid")}`
        : `${t("addDebt.dueDate")}: ${dueDate}`,
      "",
      t("addDebt.debtNotificationThanks"),
    ].join("\n");

    let cleanPhone = normalizePhone(phone);
    if (cleanPhone.startsWith("0")) {
      cleanPhone = `250${cleanPhone.slice(1)}`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || selectedItems.length === 0) {
      toast.error(t("addDebt.fillCustomerAndItems"));
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    const customerName = normalizeCustomerNameSoft(form.name.trim());
    const normalizedPhone = form.phone.trim() ? normalizePhone(form.phone) : null;
    const amountValue = totalAmount;
    const nowISO = new Date().toISOString();

    try {
      const selectedIds = selectedItems.map((item) => item.id);

      const freshInventoryResponse = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price")
        .in("id", selectedIds);

      if (freshInventoryResponse.error) throw freshInventoryResponse.error;

      const freshInventory = (freshInventoryResponse.data ?? []) as InventoryItem[];

      for (const selected of selectedItems) {
        const fresh = freshInventory.find((item) => item.id === selected.id);

        if (!fresh) {
          throw new Error(`${selected.name} no longer exists in stock`);
        }

        if (selected.quantity > fresh.quantity) {
          toast.error(
            `${selected.name}: ${t("addDebt.stockExceeded")} (${t("addDebt.remainingStock")} ${fresh.quantity})`
          );
          setIsLoading(false);
          return;
        }
      }

      let existingCustomer: ExistingCustomerRow | null = null;

      if (normalizedPhone) {
        const response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date")
          .eq("phone", normalizedPhone)
          .maybeSingle();

        if (response.error) throw response.error;
        existingCustomer = response.data as ExistingCustomerRow | null;
      }

      if (!existingCustomer) {
        const response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date")
          .ilike("name", customerName)
          .maybeSingle();

        if (response.error) throw response.error;
        existingCustomer = response.data as ExistingCustomerRow | null;
      }

      let customerId = existingCustomer?.id ?? "";

      if (!existingCustomer) {
        const insertResponse = await (supabase as any)
          .from("customers")
          .insert([
            {
              name: customerName,
              phone: normalizedPhone,
              items: JSON.stringify(
                selectedItems.map(
                  (i) => `${i.name} (x${i.quantity}) - ${formatCurrency(i.quantity * i.price)}`
                )
              ),
              amount: form.isPaid ? 0 : amountValue,
              due_date: form.isPaid ? null : form.dueDate,
              is_paid: form.isPaid,
              paid_at: form.isPaid ? nowISO : null,
              created_at: nowISO,
              updated_at: nowISO,
              added_by: actorIdentifier || null,
            },
          ])
          .select("id, name, phone, items, amount, is_paid, due_date")
          .single();

        if (insertResponse.error || !insertResponse.data) {
          throw insertResponse.error || new Error("Customer insert failed");
        }

        existingCustomer = insertResponse.data as ExistingCustomerRow;
        customerId = existingCustomer.id;
      } else {
        customerId = existingCustomer.id;

        const legacyItems = parseLegacyItems(existingCustomer.items);
        const newLegacyLines = selectedItems.map(
          (i) => `${i.name} (x${i.quantity}) - ${formatCurrency(i.quantity * i.price)}`
        );

        const newOutstandingAmount =
          (Number(existingCustomer.amount) || 0) + (form.isPaid ? 0 : amountValue);

        const updateResponse = await (supabase as any)
          .from("customers")
          .update({
            name: customerName,
            phone: normalizedPhone ?? existingCustomer.phone,
            items: JSON.stringify([...legacyItems, ...newLegacyLines]),
            amount: newOutstandingAmount,
            is_paid: newOutstandingAmount <= 0,
            due_date: form.isPaid ? existingCustomer.due_date : form.dueDate,
            paid_at: form.isPaid && newOutstandingAmount <= 0 ? nowISO : null,
            updated_at: nowISO,
          })
          .eq("id", customerId);

        if (updateResponse.error) throw updateResponse.error;
      }

      const debtItemsPayload = selectedItems.map((item) => ({
        customer_id: customerId,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price,
        date_taken: nowISO,
        due_date: form.isPaid ? null : form.dueDate,
        added_by: actorIdentifier || null,
        status: form.isPaid ? "paid" : "unpaid",
        created_at: nowISO,
      }));

      const debtItemsInsertResponse = await (supabase as any)
        .from("debt_items")
        .insert(debtItemsPayload);

      if (debtItemsInsertResponse.error) throw debtItemsInsertResponse.error;

      if (form.isPaid) {
        const paymentResponse = await (supabase as any)
          .from("debt_payments")
          .insert({
            customer_id: customerId,
            amount_paid: amountValue,
            paid_at: nowISO,
            received_by: actorIdentifier || null,
            note: "Immediate payment at debt entry",
            created_at: nowISO,
          });

        if (paymentResponse.error) throw paymentResponse.error;
      }

      for (const item of selectedItems) {
        const fresh = freshInventory.find((stockItem) => stockItem.id === item.id);
        if (!fresh) continue;

        const updateInventoryResponse = await (supabase as any)
          .from("inventory_items")
          .update({ quantity: fresh.quantity - item.quantity })
          .eq("id", item.id);

        if (updateInventoryResponse.error) throw updateInventoryResponse.error;
      }

      try {
        await recordTransaction({
          transaction_type: form.isPaid ? "payment" : "debt",
          amount: amountValue,
          date: nowISO,
          description: form.isPaid
            ? `Payment received from ${customerName}`
            : `Debt items added for ${customerName}`,
          related_id: customerId,
          created_by: actorIdentifier || null,
          metadata: {
            customer_name: customerName,
            phone: normalizedPhone,
            items: selectedItems.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
              total: i.quantity * i.price,
            })),
            due_date: form.dueDate,
          },
        });
      } catch (error) {
        console.error("Transaction log failed:", error);
      }

      if (normalizedPhone) {
        try {
          const whatsappUrl = buildWhatsappMessage(
            customerName,
            normalizedPhone,
            selectedItems,
            amountValue,
            form.dueDate,
            form.isPaid
          );
          window.open(whatsappUrl, "_blank");
        } catch (error) {
          console.error("WhatsApp open failed:", error);
        }
      }

      toast.success(t("addDebt.savedSuccess"));
      window.dispatchEvent(
        new CustomEvent("newDebtAdded", {
          detail: {
            amount: amountValue,
            isPaid: form.isPaid,
            customerId,
          },
        })
      );

      navigate("/debts");
    } catch (err) {
      console.error("Add debt save error:", err);
      toast.error(
        err instanceof Error && err.message ? err.message : t("addDebt.saveFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell
      title={t("addDebt.title")}
      subtitle={t("addDebt.customerSection")}
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
      footer={
        <div className="space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedItems.length === 0}
            className="h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {isLoading ? (
              <RefreshCcw size={18} className="animate-spin" />
            ) : (
              t("addDebt.confirmEntry")
            )}
          </Button>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white text-sm font-medium uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {t("addDebt.cancelEntry")}
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {t("addDebt.customerSection")}
              </span>
            </div>

            {nameSuggestion && (
              <button
                type="button"
                onClick={applyNameSuggestion}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
              >
                <Sparkles size={12} />
                {nameSuggestion}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="border-b-2 border-slate-50 pb-2 transition-all focus-within:border-slate-900">
              <CustomerAutocomplete
                value={form.name}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, name: v }));
                  const trimmed = v.trim();
                  if (!trimmed) {
                    setNameSuggestion("");
                    return;
                  }
                  const normalized = normalizeCustomerNameSoft(trimmed);
                  setNameSuggestion(normalized !== trimmed ? normalized : "");
                }}
                onSelect={handleCustomerSelect}
                suggestions={customers}
                placeholder={t("addDebt.customerNamePlaceholder")}
              />
            </div>

            <div className="flex items-center gap-3">
              <Phone size={18} className="text-slate-300" />
              <input
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={handleNameBlur}
                className="flex-1 bg-transparent text-base font-medium outline-none"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag size={14} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {t("addDebt.itemsTaken")}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowInventoryPopup(true)}
              className="text-xs font-black uppercase tracking-tight text-indigo-600"
            >
              + {t("addDebt.addItem")}
            </button>
          </div>

          <div className="space-y-3">
            {selectedItems.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl border-2 border-dashed border-slate-100 text-slate-300">
                <Package size={20} />
                <span className="text-xs font-bold uppercase tracking-tight">
                  {t("addDebt.noItemSelected")}
                </span>
              </div>
            ) : (
              selectedItems.map((i) => (
                <div key={i.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">{i.name}</span>
                      <span className="text-xs font-bold text-slate-500">
                        {formatCurrency(i.price)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItemFromList(i.id)}
                      className="p-2 text-rose-400"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700"
                        onClick={() => updateSelectedItemQty(i.id, i.quantity - 1)}
                      >
                        -
                      </button>
                      <div className="min-w-[48px] text-center text-sm font-bold text-slate-900">
                        {i.quantity}
                      </div>
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700"
                        onClick={() => updateSelectedItemQty(i.id, i.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm font-black text-slate-900">
                      {formatCurrency(i.quantity * i.price)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900 p-5 text-white shadow-lg shadow-slate-300/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("addDebt.totalAmount")}
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                {formatCurrency(totalAmount)}
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
              <span className="min-w-[60px] text-center text-xs font-semibold uppercase text-slate-300">
                {form.isPaid ? t("addDebt.paid") : t("addDebt.debt")}
              </span>
              <Switch
                checked={form.isPaid}
                onCheckedChange={(checked) => setForm({ ...form, isPaid: checked })}
                className="scale-100 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
              />
            </div>
          </div>

          {!form.isPaid && (
            <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
              <Calendar size={16} className="flex-shrink-0 text-slate-400" />
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                  {t("addDebt.dueDate")}
                </p>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border-b border-white/20 bg-transparent pb-1 text-sm font-medium outline-none focus:border-white/40"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {showInventoryPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center">
          <div
            className="w-full max-w-md space-y-5 rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-2xl"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                {t("addDebt.chooseFromStock")}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowInventoryPopup(false);
                  setPopupSelectedItem(null);
                  setInventoryQuery("");
                }}
                className="rounded-full bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <input
                  value={inventoryQuery}
                  onChange={(e) => setInventoryQuery(e.target.value)}
                  placeholder={t("common.search")}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="overflow-x-auto">
                <div className="flex gap-2 pb-1">
                  {categoryOptions.map((category) => {
                    const active = selectedCategory === category;
                    const icon = category === "All" ? "🧾" : CATEGORY_CONFIG[category]?.icon ?? "📦";
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="mr-1">{icon}</span>
                        {category === "All" ? t("common.all") || "All" : category}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedCategory !== "All" && (
                <div className="overflow-x-auto">
                  <div className="flex gap-2 pb-1">
                    {subcategoryOptions.map((subcategory) => {
                      const active = selectedSubcategory === subcategory;
                      return (
                        <button
                          key={subcategory}
                          type="button"
                          onClick={() => setSelectedSubcategory(subcategory)}
                          className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {subcategory === "All" ? t("common.all") || "All" : subcategory}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {inventoryLoading ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                  {t("common.loading")}
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                  {t("inventory.noItems") || "No matching items"}
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPopupSelectedItem(item)}
                    className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                      popupSelectedItem?.id === item.id
                        ? "border-slate-900 bg-slate-50 shadow-md"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                    style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {item.item_name}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {(item.category ?? "Uncategorized")}
                        {item.subcategory ? ` • ${item.subcategory}` : ""}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {t("addDebt.remainingStock")} {item.quantity}
                      </p>
                    </div>

                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(item.cost_price)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {popupSelectedItem && (
              <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
                    {t("addDebt.quantity")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={popupItemQty}
                    onChange={(e) => setPopupItemQty(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-sm font-medium outline-none transition-colors focus:border-slate-400"
                    style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                  />
                </div>

                <Button
                  onClick={confirmPopupItem}
                  className="h-12 flex-1 rounded-lg bg-slate-900 text-sm font-medium uppercase tracking-wide transition-colors hover:bg-slate-800"
                  style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                >
                  {t("addDebt.addSelectedItem")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default AddDebtPageEnhanced;