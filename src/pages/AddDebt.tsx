import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { ArrowLeft, Save, X, Package, User, Phone, Calendar, ShoppingBag, RefreshCcw, Camera } from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";
import { useAppStore } from "@/store/AppStore";

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

const AddDebtPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
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
  
  // Camera functionality
  const [customerImageUrl, setCustomerImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* =========================
     IMAGE UPLOAD HANDLER
  ========================== */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validImageTypes.includes(file.type)) {
      toast.error("Habaye ikosa: Andika ifoto neza (JPEG, PNG, WebP cyangwa GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ifoto nini cyane (max 5MB)");
      return;
    }

    setUploadingImage(true);
    const fileExt = file.type.split('/').pop();
    const filePath = `debt-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

    try {
      // Try to create bucket if it doesn't exist
      try {
        await supabase.storage.createBucket('debt_images', {
          public: true,
          allowedMimeTypes: validImageTypes,
          fileSizeLimit: 5242880 // 5MB
        });
      } catch (bucketError) {
        // Bucket might already exist, continue
        console.log('Bucket creation attempted:', bucketError);
      }

      const { error: uploadError } = await supabase.storage
        .from('debt_images')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Gushyiraho ifoto byanze');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('debt_images')
        .getPublicUrl(filePath);

      setCustomerImageUrl(publicUrl);
      toast.success("Ifoto yashyizweho!");
    } catch (err: unknown) {
      console.error('Full upload error:', err);
      const errorMsg = (err as Error)?.message || "Gushyiraho ifoto byanze";
      toast.error(errorMsg);
    } finally {
      setUploadingImage(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    if (!showInventoryPopup) return;
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("item_name", { ascending: true });
      if (!error) setInventory(data || []);
    };
    fetchInventory();
  }, [showInventoryPopup]);

  const handleCustomerSelect = (customer: { name: string; phone: string | null }) => {
    setForm(prev => ({ ...prev, name: customer.name, phone: customer.phone || "" }));
  };

  const confirmPopupItem = () => {
    if (!popupSelectedItem) return;
    const qty = parseInt(popupItemQty, 10);
    if (isNaN(qty) || qty < 1) return;

    const newItems = [...selectedItems];
    const existingIndex = newItems.findIndex(i => i.id === popupSelectedItem.id);

    if (existingIndex >= 0) {
      newItems[existingIndex].quantity += qty;
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
    const newList = selectedItems.filter(i => i.id !== id);
    setSelectedItems(newList);
    recalcAmount(newList);
  };

  const recalcAmount = (items: SelectedItem[]) => {
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    setForm(prev => ({ ...prev, amount: total.toString() }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || selectedItems.length === 0) {
      toast.error("Uzuza izina n'ibintu yafashe");
      return;
    }

    setIsLoading(true);
    const amountValue = parseFloat(form.amount);
    const nowISO = new Date().toISOString();

    try {
      if (form.phone) {
        const itemsText = selectedItems.map(i => `${i.name} (x${i.quantity})`).join(", ");
        const message = `Muraho ${form.name}, mufashe ${itemsText} muri ${businessSettings.businessName}. Total ni: ${formatCurrency(amountValue)}. Murakoze!`;
        let cleanPhone = form.phone.replace(/\s+/g, "");
        if (cleanPhone.startsWith("0")) cleanPhone = "25" + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
      }

      const { data: insertedCustomers, error: insertError } = await supabase
        .from("customers")
        .insert([
          {
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            items: JSON.stringify(selectedItems.map(i => `${i.name} ${i.quantity}`)),
            amount: amountValue,
            due_date: form.dueDate,
            is_paid: form.isPaid,
            paid_at: form.isPaid ? nowISO : null,
            created_at: nowISO,
          },
        ])
        .select()
        .single();

      if (insertError || !insertedCustomers) throw insertError || new Error("Customer insert failed");

      for (const item of selectedItems) {
        const currentQty = inventory.find((i) => i.id === item.id)?.quantity ?? 0;
        await supabase
          .from("inventory_items")
          .update({ quantity: currentQty - item.quantity })
          .eq("id", item.id);
      }

      await recordTransaction({
        transaction_type: form.isPaid ? "payment" : "debt",
        amount: amountValue,
        date: nowISO,
        description: form.isPaid
          ? `Payment received from ${form.name}`
          : `Debt created for ${form.name}`,
        related_id: insertedCustomers.id,
        created_by: null,
        metadata: {
          phone: form.phone,
          items: selectedItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        },
      });

      toast.success("Byabitswe neza ✨");
      window.dispatchEvent(new CustomEvent("newDebtAdded", { detail: { amount: amountValue, isPaid: form.isPaid } }));
      navigate("/debts");
    } catch (err) {
      toast.error("Habaye ikosa mu kubika");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 pb-10" style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/40 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-300/30 to-transparent blur-3xl" />

      {/* Navigation - Better Visibility */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/70 px-5 py-4 shadow-sm shadow-slate-200">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate("/dashboard")} 
            className="p-2.5 rounded-2xl bg-slate-50 text-slate-500 shadow-sm shadow-slate-200 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Premium Ledger</p>
            <h1 className="text-sm font-black text-slate-900">Add New Debt</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="relative max-w-md mx-auto p-5 space-y-6 animate-fade-in">
        {/* Customer Info Card */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Umukiriya</span>
          </div>
          
          <div className="border-b-2 border-slate-50 pb-2 focus-within:border-slate-900 transition-all">
            <CustomerAutocomplete
              value={form.name}
              onChange={v => setForm({ ...form, name: v })}
              onSelect={handleCustomerSelect}
              suggestions={customers}
              placeholder={labels.customerNamePlaceholder}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Phone size={18} className="text-slate-300" />
            <input
              type="tel"
              placeholder={labels.phonePlaceholder}
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="flex-1 bg-transparent text-base font-medium focus:outline-none"
            />
          </div>

          {/* Customer Photo Section */}
          <div className="pt-3 border-t border-slate-100">
            <label className="text-xs text-muted-foreground block font-medium mb-3">Ifoto y'umukiriya (ihitamo)</label>
            
            {/* Hidden inputs */}
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

            {/* Upload Buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
              >
                <Camera size={16} />
                <span className="text-xs font-medium">📷 Fata Ifoto</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
              >
                <span className="text-xs font-medium">📁 Hitamo Ifoto</span>
              </button>
            </div>

            {/* Image Preview */}
            {customerImageUrl && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <img src={customerImageUrl} alt="Customer" className="w-12 h-12 object-cover rounded border border-slate-200" />
                <span className="text-xs text-green-600 font-medium">✓ Ifoto yashyizweho</span>
              </div>
            )}

            {uploadingImage && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCcw size={12} className="animate-spin" />
                <span>Kurongora ifoto...</span>
              </div>
            )}
          </div>
        </section>

        {/* Items Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingBag size={14} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Ibyo Afashe</h3>
            </div>
            <button 
              onClick={() => setShowInventoryPopup(true)} 
              className="text-xs font-black text-indigo-600 uppercase tracking-tight"
            >
              + Ongeraho
            </button>
          </div>

          <div className="space-y-3">
            {selectedItems.length === 0 ? (
              <div className="h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-50 rounded-xl text-slate-300 space-y-1">
                <Package size={20} />
                <span className="text-xs font-bold uppercase tracking-tight">Nta kintu kiratoranywa</span>
              </div>
            ) : (
              selectedItems.map(i => (
                <div key={i.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">{i.name}</span>
                    <span className="text-xs font-bold text-slate-500">{i.quantity} × {formatCurrency(i.price)}</span>
                  </div>
                  <button onClick={() => removeItemFromList(i.id)} className="p-2 text-rose-400"><X size={18} /></button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Total Summary Card - High Contrast */}
        <section className="bg-slate-900 rounded-2xl p-5 text-white space-y-4 shadow-lg shadow-slate-300/20 border border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Igiteranyo</p>
              <h2 className="text-2xl font-bold tracking-tight">{formatCurrency(parseFloat(form.amount || "0"))}</h2>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 border border-white/20">
              <span className="text-xs font-semibold uppercase text-slate-300 min-w-[60px] text-center">
                {form.isPaid ? "Yishyuye" : "Ideni"}
              </span>
              <Switch
                checked={form.isPaid}
                onCheckedChange={checked => setForm({ ...form, isPaid: checked })}
                className="scale-100 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
              />
            </div>
          </div>

          {!form.isPaid && (
            <div className="pt-3 border-t border-white/10 flex items-center gap-3">
              <Calendar size={16} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Itariki yo kwishyura</p>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm({...form, dueDate: e.target.value})}
                  className="bg-transparent text-sm font-medium outline-none w-full border-b border-white/20 focus:border-white/40 pb-1"
                />
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="pt-4 space-y-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedItems.length === 0}
            className="w-full h-14 rounded-xl bg-slate-900 text-white font-semibold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            {isLoading ? (
               <RefreshCcw size={18} className="animate-spin" />
            ) : (
              "EMEZA BINJIRE ✨"
            )}
          </Button>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 text-sm font-medium text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50"
            style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
          >
            Hagarika
          </button>
        </div>
      </main>

      {/* Inventory Modal - Large Labels */}
      {showInventoryPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[2rem] sm:rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300" style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Hitamo Muri Stock</h2>
              <button onClick={() => setShowInventoryPopup(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {inventory.map(item => (
                <button
                  key={item.id}
                  onClick={() => setPopupSelectedItem(item)}
                  className={`w-full p-4 rounded-xl flex justify-between items-center border-2 transition-all duration-200 ${
                    popupSelectedItem?.id === item.id ? "border-slate-900 bg-slate-50 shadow-md" : "border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                  }`}
                  style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">{item.item_name}</p>
                    <p className="text-xs font-medium text-slate-500">Hasigaye {item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.cost_price)}</span>
                </button>
              ))}
            </div>

            {popupSelectedItem && (
              <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Qty</span>
                  <input
                    type="number"
                    min={1}
                    value={popupItemQty}
                    onChange={e => setPopupItemQty(e.target.value)}
                    className="w-16 p-3 bg-slate-50 rounded-lg text-center font-medium text-sm outline-none border border-slate-200 focus:border-slate-400 transition-colors"
                    style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                  />
                </div>
                <Button
                  onClick={confirmPopupItem}
                  className="flex-1 h-12 rounded-lg bg-slate-900 font-medium text-sm uppercase tracking-wide hover:bg-slate-800 transition-colors"
                  style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
                >
                  Ongeraho
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