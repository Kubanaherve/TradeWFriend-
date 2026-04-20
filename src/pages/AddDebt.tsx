import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Camera,
  Search,
  ScanLine,
  Sparkles,
  CheckCircle2,
  AlertCircle,
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
  barcode?: string | null;
}

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  barcode?: string | null;
  image_url?: string | null;
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

type FeatureFlags = {
  barcodeEnabled: boolean;
  photoEnhancementEnabled: boolean;
};

const DEFAULT_FLAGS: FeatureFlags = {
  barcodeEnabled: false,
  photoEnhancementEnabled: true,
};

const DEBT_IMAGE_BUCKET = "debt_images";

const AddDebtPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useI18n();
  const { customers } = useCustomerSuggestions();
  const { settings: businessSettings } = useBusinessSettings();
  const { recordTransaction } = useAppStore();

  const actorIdentifier = auth.profile?.phone ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

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

  const [customerImageUrl, setCustomerImageUrl] = useState("");
  const [customerImagePreview, setCustomerImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageWarning, setImageWarning] = useState("");

  const [nameSuggestion, setNameSuggestion] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerLoopRef = useRef<number | null>(null);

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
    setScannerSupported(Boolean((window as any).BarcodeDetector));
  }, []);

  useEffect(() => {
    return () => {
      if (customerImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(customerImagePreview);
      }
    };
  }, [customerImagePreview]);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["barcode_enabled", "photo_enhancement_enabled"]);

        const next = { ...DEFAULT_FLAGS };

        for (const row of data ?? []) {
          const value = String(row.setting_value ?? "").toLowerCase();
          const enabled = value === "true" || value === "1" || value === "yes";

          if (row.setting_key === "barcode_enabled") next.barcodeEnabled = enabled;
          if (row.setting_key === "photo_enhancement_enabled") next.photoEnhancementEnabled = enabled;
        }

        setFlags(next);
      } catch (error) {
        console.error("Failed to load feature flags:", error);
      }
    };

    void loadFlags();
  }, []);

  useEffect(() => {
    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("*")
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
    if (!scannerOpen || !flags.barcodeEnabled || !scannerSupported) return;

    let stopped = false;

    const stopScanner = () => {
      stopped = true;

      if (scannerLoopRef.current) {
        window.clearTimeout(scannerLoopRef.current);
        scannerLoopRef.current = null;
      }

      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach((track) => track.stop());
        scannerStreamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setScannerBusy(false);
    };

    const startScanner = async () => {
      try {
        setScannerBusy(true);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        scannerStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });

        const scan = async () => {
          if (stopped || !videoRef.current || videoRef.current.readyState < 2) {
            scannerLoopRef.current = window.setTimeout(scan, 350);
            return;
          }

          try {
            const barcodes = await detector.detect(videoRef.current);

            if (barcodes?.length) {
              const rawValue = String(barcodes[0].rawValue || "").trim();

              if (rawValue) {
                setInventoryQuery(rawValue);

                const matched = inventory.find(
                  (item) => String(item.barcode || "").trim() === rawValue
                );

                if (matched) {
                  setPopupSelectedItem(matched);
                  setShowInventoryPopup(true);
                  setScannerOpen(false);
                  stopScanner();
                  toast.success(t("inventory.barcodeMatched") || "Item found");
                  return;
                }

                toast.info(
                  t("inventory.barcodeDetectedNoMatch") ||
                    "Barcode detected. No matching item found."
                );
              }
            }
          } catch (error) {
            console.error("Barcode detect failed:", error);
          }

          scannerLoopRef.current = window.setTimeout(scan, 350);
        };

        void scan();
      } catch (error) {
        console.error("Scanner start failed:", error);
        toast.error(
          t("inventory.barcodeScannerFailed") || "Unable to open barcode scanner"
        );
        stopScanner();
        setScannerOpen(false);
      }
    };

    void startScanner();

    return () => {
      stopScanner();
    };
  }, [scannerOpen, flags.barcodeEnabled, scannerSupported, inventory, t]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    if (!q) return inventory;

    return inventory.filter((item) => {
      const name = item.item_name.toLowerCase();
      const barcode = String(item.barcode || "").toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [inventory, inventoryQuery]);

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

  const optimizeImageFile = async (file: File) => {
    if (!flags.photoEnhancementEnabled) return file;

    const imageUrl = URL.createObjectURL(file);
    const img = document.createElement("img");

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = imageUrl;
    });

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(imageUrl);
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88)
    );

    URL.revokeObjectURL(imageUrl);

    if (!blob) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  };

  const uploadCustomerImageOptional = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.type.split("/").pop() || "jpg";
      const filePath = `debt-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(DEBT_IMAGE_BUCKET)
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error("Image upload failed:", uploadError);
        return null;
      }

      const { data } = supabase.storage.from(DEBT_IMAGE_BUCKET).getPublicUrl(filePath);
      return data.publicUrl || null;
    } catch (error) {
      console.error("Storage upload unavailable:", error);
      return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validImageTypes.includes(originalFile.type)) {
      toast.error(t("addDebt.invalidImageType"));
      e.target.value = "";
      return;
    }

    if (originalFile.size > 30 * 1024 * 1024) {
      toast.error("Image is too large. Please choose a file below 30MB.");
      e.target.value = "";
      return;
    }

    setUploadingImage(true);
    setImageWarning("");

    try {
      const optimized = await optimizeImageFile(originalFile);

      if (customerImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(customerImagePreview);
      }

      const previewUrl = URL.createObjectURL(optimized);
      setCustomerImagePreview(previewUrl);

      const publicUrl = await uploadCustomerImageOptional(optimized);

      if (publicUrl) {
        setCustomerImageUrl(publicUrl);
        setImageWarning("");
        toast.success(t("addDebt.photoUploaded"));
      } else {
        setCustomerImageUrl("");
        setImageWarning(
          "Photo upload is unavailable right now. The debt will still be saved and this preview is only local to this device."
        );
        toast.warning(
          "Photo upload unavailable. You can still continue and save the debt."
        );
      }
    } catch (err) {
      console.error(err);
      setCustomerImageUrl("");
      setImageWarning(
        "Photo could not be uploaded. The debt can still be saved without a photo."
      );
      toast.warning("Photo upload failed. Saving without photo is still allowed.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

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
          .ilike("name", customer.name.trim())
          .maybeSingle();
      }

      const existingCustomer = response.data as ExistingCustomerRow | null;

      if (existingCustomer?.image_url) {
        setCustomerImageUrl(existingCustomer.image_url);
        setCustomerImagePreview(existingCustomer.image_url);
      }
    } catch (error) {
      console.error("Failed to load selected customer details:", error);
    }
  };

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
          barcode: item.barcode || null,
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
        .select("id, item_name, quantity, cost_price, barcode, image_url")
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
            name: customerName,
            phone: normalizedPhone ?? existingCustomer.phone,
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
              barcode: i.barcode || null,
            })),
            due_date: form.dueDate,
            customer_image_url: customerImageUrl || null,
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

  const displayedImage = customerImageUrl || customerImagePreview;

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

            <div className="border-t border-slate-100 pt-3">
              <label className="mb-3 block text-xs font-medium text-slate-500">
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
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <Camera size={16} />
                  <span className="text-xs font-medium">{t("addDebt.takePhoto")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <span className="text-xs font-medium">{t("addDebt.choosePhoto")}</span>
                </button>
              </div>

              {imageWarning && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{imageWarning}</span>
                </div>
              )}

              {displayedImage && (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <img
                    src={displayedImage}
                    alt={t("addDebt.customerSection")}
                    className="h-12 w-12 rounded border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-green-600">
                      ✓ {customerImageUrl ? t("addDebt.photoUploaded") : "Photo selected"}
                    </span>
                    {!customerImageUrl && (
                      <span className="block text-[11px] text-slate-500">
                        Local preview only
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (customerImagePreview?.startsWith("blob:")) {
                        URL.revokeObjectURL(customerImagePreview);
                      }
                      setCustomerImageUrl("");
                      setCustomerImagePreview("");
                      setImageWarning("");
                    }}
                    className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-rose-600"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              )}

              {uploadingImage && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCcw size={12} className="animate-spin" />
                  <span>{t("addDebt.uploadingPhoto")}</span>
                </div>
              )}
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

            <div className="flex items-center gap-2">
              {flags.barcodeEnabled && (
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-tight text-slate-700"
                >
                  <ScanLine size={14} />
                  {t("inventory.scanBarcode") || "Scan"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowInventoryPopup(true)}
                className="text-xs font-black uppercase tracking-tight text-indigo-600"
              >
                + {t("addDebt.addItem")}
              </button>
            </div>
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
                        {formatCurrency(i.price)} {i.barcode ? `• ${i.barcode}` : ""}
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
            className="w-full max-w-sm space-y-5 rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-2xl"
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

            <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
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
                        {item.barcode ? ` • ${item.barcode}` : ""}
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

      {scannerOpen && flags.barcodeEnabled && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  {t("inventory.scanBarcode") || "Scan barcode"}
                </h3>
                <p className="text-xs text-slate-500">
                  {scannerSupported
                    ? t("inventory.pointCameraToBarcode") || "Point camera at barcode"
                    : t("inventory.barcodeScannerUnsupported") || "Scanner not supported on this device"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl bg-slate-900">
              <video
                ref={videoRef}
                className="h-72 w-full object-cover"
                muted
                playsInline
                autoPlay
              />
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {scannerBusy ? <RefreshCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>
                {scannerSupported
                  ? t("inventory.scannerReady") || "Scanner ready"
                  : t("inventory.barcodeScannerUnsupported") || "Scanner unsupported"}
              </span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default AddDebtPageEnhanced;