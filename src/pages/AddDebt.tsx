import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/kinyarwanda";
import {
  ArrowLeft,
  X,
  Package,
  User,
  Phone,
  Calendar,
  ShoppingBag,
  RefreshCcw,
  Camera,
} from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";
import { useAppStore } from "@/store/AppStore";
import { useAuth, normalizePhone } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";

interface SelectedItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
}

type ExistingCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  items: string;
  amount: number;
  is_paid: boolean;
  due_date: string | null;
  image_url?: string | null;
};

const AddDebtPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useI18n();
  const { customers } = useCustomerSuggestions();
  const { settings: businessSettings } = useBusinessSettings();
  const { recordTransaction } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    dueDate: new Date().toISOString().split("T")[0],
    isPaid: false,
    amount: "0",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);
  const [popupSelectedItem, setPopupSelectedItem] = useState<InventoryItem | null>(null);
  const [popupItemQty, setPopupItemQty] = useState<string>("1");

  const [customerImageUrl, setCustomerImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const actorIdentifier = auth.profile?.phone ?? "";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validImageTypes.includes(file.type)) {
      toast.error(t("addDebt.invalidImageType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("addDebt.imageTooLarge"));
      return;
    }

    setUploadingImage(true);
    const fileExt = file.type.split("/").pop();
    const filePath = `debt-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    try {
      try {
        await supabase.storage.createBucket("debt_images", {
          public: true,
          allowedMimeTypes: validImageTypes,
          fileSizeLimit: 5242880,
        });
      } catch {
        // bucket may already exist
      }

      const { error: uploadError } = await supabase.storage
        .from("debt_images")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("debt_images").getPublicUrl(filePath);

      setCustomerImageUrl(publicUrl);
      toast.success(t("addDebt.photoUploaded"));
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error)?.message || t("addDebt.imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  useEffect(() => {
    if (!showInventoryPopup) return;

    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("item_name", { ascending: true });

      if (!error) setInventory((data || []) as InventoryItem[]);
    };

    void fetchInventory();
  }, [showInventoryPopup]);

  const handleCustomerSelect = async (customer: { name: string; phone: string | null }) => {
    const normalized = customer.phone ? normalizePhone(customer.phone) : "";

    setForm((prev) => ({
      ...prev,
      name: customer.name,
      phone: normalized,
    }));

    if (!normalized && !customer.name.trim()) return;

    try {
      let response;

      if (normalized) {
        response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date, image_url")
          .eq("phone", normalized)
          .maybeSingle();
      } else {
        response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date, image_url")
          .eq("name", customer.name.trim())
          .maybeSingle();
      }

      const existingCustomer = response.data as ExistingCustomerRow | null;

      if (existingCustomer?.image_url) {
        setCustomerImageUrl(existingCustomer.image_url);
      }
    } catch (error) {
      console.error("Failed to load selected customer details:", error);
    }
  };

  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;

    const qty = parseInt(popupItemQty, 10);
    if (Number.isNaN(qty) || qty < 1) return;

    if (qty > popupSelectedItem.quantity) {
      toast.error(t("addDebt.stockExceeded"));
      return;
    }

    const newItems = [...selectedItems];
    const existingIndex = newItems.findIndex((i) => i.id === popupSelectedItem.id);

    if (existingIndex >= 0) {
      const newQty = newItems[existingIndex].quantity + qty;
      if (newQty > popupSelectedItem.quantity) {
        toast.error(t("addDebt.stockExceeded"));
        return;
      }
      newItems[existingIndex].quantity = newQty;
    } else {
      newItems.push({
        id: popupSelectedItem.id,
        name: popupSelectedItem.item_name,
        quantity: qty,
        price: popupSelectedItem.cost_price,
      });
    }

    setSelectedItems(newItems);
    recalcAmount(newItems);
    setPopupSelectedItem(null);
    setPopupItemQty("1");
    setShowInventoryPopup(false);
  };

  const removeItemFromList = (id: string) => {
    const newList = selectedItems.filter((i) => i.id !== id);
    setSelectedItems(newList);
    recalcAmount(newList);
  };

  const recalcAmount = (items: SelectedItem[]) => {
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    setForm((prev) => ({ ...prev, amount: total.toString() }));
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
      (item) =>
        `- ${item.name} x${item.quantity} = ${formatCurrency(item.quantity * item.price)}`
    );

    const businessName = businessSettings.businessName || t("common.appName");

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
      isPaid ? `${t("common.status")}: ${t("addDebt.paid")}` : `${t("addDebt.dueDate")}: ${dueDate}`,
      "",
      t("addDebt.debtNotificationThanks"),
    ].join("\n");

    let cleanPhone = normalizePhone(phone);
    if (cleanPhone.startsWith("0")) {
      cleanPhone = `25${cleanPhone}`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || selectedItems.length === 0) {
      toast.error(t("addDebt.fillCustomerAndItems"));
      return;
    }

    setIsLoading(true);

    const customerName = form.name.trim();
    const normalizedPhone = form.phone.trim() ? normalizePhone(form.phone) : null;
    const amountValue = parseFloat(form.amount);
    const nowISO = new Date().toISOString();

    try {
      let existingCustomer: ExistingCustomerRow | null = null;

      if (normalizedPhone) {
        const response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date, image_url")
          .eq("phone", normalizedPhone)
          .maybeSingle();

        if (response.error) throw response.error;
        existingCustomer = response.data as ExistingCustomerRow | null;
      }

      if (!existingCustomer) {
        const response = await (supabase as any)
          .from("customers")
          .select("id, name, phone, items, amount, is_paid, due_date, image_url")
          .eq("name", customerName)
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
              image_url: customerImageUrl || null,
            },
          ])
          .select("id, name, phone, items, amount, is_paid, due_date, image_url")
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
            items: JSON.stringify([...legacyItems, ...newLegacyLines]),
            amount: newOutstandingAmount,
            is_paid: newOutstandingAmount <= 0,
            due_date: form.isPaid ? existingCustomer.due_date : form.dueDate,
            paid_at: form.isPaid && newOutstandingAmount <= 0 ? nowISO : null,
            updated_at: nowISO,
            image_url: customerImageUrl || existingCustomer.image_url || null,
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
        const stockItem = inventory.find((i) => i.id === item.id);
        const currentQty = stockItem?.quantity ?? 0;

        const updateInventoryResponse = await (supabase as any)
          .from("inventory_items")
          .update({ quantity: currentQty - item.quantity })
          .eq("id", item.id);

        if (updateInventoryResponse.error) throw updateInventoryResponse.error;
      }

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
          customer_image_url: customerImageUrl || null,
        },
      });

      if (normalizedPhone) {
        const whatsappUrl = buildWhatsappMessage(
          customerName,
          normalizedPhone,
          selectedItems,
          amountValue,
          form.dueDate,
          form.isPaid
        );
        window.open(whatsappUrl, "_blank");
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
      console.error(err);
      toast.error(t("addDebt.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 pb-10 text-slate-900"
      style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/40 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-300/30 to-transparent blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 px-5 py-4 shadow-sm shadow-slate-200 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-2xl bg-slate-50 p-2.5 text-slate-500 shadow-sm shadow-slate-200 transition-all active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
              {t("addDebt.premiumLedger")}
            </p>
            <h1 className="text-sm font-black text-slate-900">{t("addDebt.title")}</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="relative mx-auto max-w-md space-y-6 p-5 animate-fade-in">
        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {t("addDebt.customerSection")}
            </span>
          </div>

          <div className="border-b-2 border-slate-50 pb-2 transition-all focus-within:border-slate-900">
            <CustomerAutocomplete
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              onSelect={handleCustomerSelect}
              suggestions={customers}
              placeholder={t("addDebt.customerNamePlaceholder")}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Phone size={18} className="text-slate-300" />
            <input
              type="tel"
              placeholder={t("auth.phonePlaceholder")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="flex-1 bg-transparent text-base font-medium focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="mb-3 block text-xs font-medium text-muted-foreground">
              {t("addDebt.customerPhotoOptional")}
            </label>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <div className="mb-3 flex gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <Camera size={16} />
                <span className="text-xs font-medium">{t("addDebt.takePhoto")}</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <span className="text-xs font-medium">{t("addDebt.choosePhoto")}</span>
              </button>
            </div>

            {customerImageUrl && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <img
                  src={customerImageUrl}
                  alt={t("addDebt.customerSection")}
                  className="h-12 w-12 rounded border border-slate-200 object-cover"
                />
                <span className="text-xs font-medium text-green-600">
                  ✓ {t("addDebt.photoUploaded")}
                </span>
              </div>
            )}

            {uploadingImage && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCcw size={12} className="animate-spin" />
                <span>{t("addDebt.uploadingPhoto")}</span>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={14} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {t("addDebt.itemsTaken")}
              </h3>
            </div>
            <button
              onClick={() => setShowInventoryPopup(true)}
              className="text-xs font-black uppercase tracking-tight text-indigo-600"
            >
              + {t("addDebt.addItem")}
            </button>
          </div>

          <div className="space-y-3">
            {selectedItems.length === 0 ? (
              <div className="flex h-20 flex-col items-center justify-center space-y-1 rounded-xl border-2 border-dashed border-slate-50 text-slate-300">
                <Package size={20} />
                <span className="text-xs font-bold uppercase tracking-tight">
                  {t("addDebt.noItemSelected")}
                </span>
              </div>
            ) : (
              selectedItems.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">{i.name}</span>
                    <span className="text-xs font-bold text-slate-500">
                      {i.quantity} × {formatCurrency(i.price)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItemFromList(i.id)}
                    className="p-2 text-rose-400"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-5 text-white shadow-lg shadow-slate-300/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("addDebt.totalAmount")}
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                {formatCurrency(parseFloat(form.amount || "0"))}
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
            <div className="flex items-center gap-3 border-t border-white/10 pt-3">
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

        <div className="space-y-4 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedItems.length === 0}
            className="h-14 w-full rounded-xl bg-slate-900 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {isLoading ? <RefreshCcw size={18} className="animate-spin" /> : t("addDebt.confirmEntry")}
          </Button>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full rounded-lg py-3 text-sm font-medium uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {t("addDebt.cancelEntry")}
          </button>
        </div>
      </main>

      {showInventoryPopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center">
          <div
            className="w-full max-w-sm animate-in space-y-5 rounded-t-[2rem] bg-white p-6 shadow-2xl duration-300 slide-in-from-bottom sm:rounded-2xl"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                {t("addDebt.chooseFromStock")}
              </h2>
              <button
                onClick={() => setShowInventoryPopup(false)}
                className="rounded-full bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
              {inventory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPopupSelectedItem(item)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-4 transition-all duration-200 ${
                    popupSelectedItem?.id === item.id
                      ? "border-slate-900 bg-slate-50 shadow-md"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                  style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">{item.item_name}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {t("addDebt.remainingStock")} {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatCurrency(item.cost_price)}
                  </span>
                </button>
              ))}
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
    </div>
  );
};

export default AddDebtPageEnhanced;