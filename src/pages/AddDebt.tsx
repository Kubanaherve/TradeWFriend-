import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import {
  DAILY_CUSTOMER_PAYMENTS_PREFIX,
  DAILY_NEW_DEBT_PREFIX,
  getDateKeyFromIso,
  incrementAppSettingAmount,
} from "@/lib/reporting";
import { ArrowLeft, Save, X, Package, User, Phone, Calendar, ShoppingBag, RefreshCcw } from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";

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
    const todayKey = getDateKeyFromIso(nowISO);

    try {
      if (form.phone) {
        const itemsText = selectedItems.map(i => `${i.name} (x${i.quantity})`).join(", ");
        const message = `Muraho ${form.name}, mufashe ${itemsText} muri Jeanne Friend Jewerlies. Total ni: ${formatCurrency(amountValue)}. Murakoze!`;
        let cleanPhone = form.phone.replace(/\s+/g, "");
        if (cleanPhone.startsWith("0")) cleanPhone = "25" + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
      }

      const { error: insertError } = await supabase.from("customers").insert([
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
      ]);
      if (insertError) throw insertError;

      for (const item of selectedItems) {
        const currentQty = inventory.find(i => i.id === item.id)?.quantity ?? 0;
        await supabase
          .from("inventory_items")
          .update({ quantity: currentQty - item.quantity })
          .eq("id", item.id);
      }

      if (form.isPaid) {
        await incrementAppSettingAmount("total_paid", amountValue);
        await incrementAppSettingAmount(`${DAILY_CUSTOMER_PAYMENTS_PREFIX}${todayKey}`, amountValue);
      } else {
        await incrementAppSettingAmount(`${DAILY_NEW_DEBT_PREFIX}${todayKey}`, amountValue);
      }

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
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 pb-10">
      {/* Navigation - Better Visibility */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate("/dashboard")} 
            className="p-2.5 rounded-xl bg-slate-50 text-slate-500 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xs font-black uppercase tracking-widest text-slate-500">Gucuruza</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
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
              placeholder="Izina ry'umukiriya..."
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Phone size={18} className="text-slate-300" />
            <input
              type="tel"
              placeholder="07X XXX XXXX"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="flex-1 bg-transparent text-base font-medium focus:outline-none"
            />
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
        <section className="bg-slate-900 rounded-3xl p-7 text-white space-y-6 shadow-xl shadow-slate-200">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Igiteranyo</p>
              <h2 className="text-3xl font-black tracking-tight">{formatCurrency(parseFloat(form.amount || "0"))}</h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="text-xs font-bold uppercase text-slate-500">{form.isPaid ? "Yishyuwe" : "Ideni"}</span>
              <Switch 
                checked={form.isPaid} 
                onCheckedChange={checked => setForm({ ...form, isPaid: checked })}
                className="scale-110 data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {!form.isPaid && (
            <div className="pt-5 border-t border-white/10 flex items-center gap-4">
              <Calendar size={18} className="text-slate-500" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Itariki yo kwishyura</p>
                <input 
                  type="date" 
                  value={form.dueDate} 
                  onChange={e => setForm({...form, dueDate: e.target.value})}
                  className="bg-transparent text-sm font-bold outline-none w-full"
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
            className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
          >
            {isLoading ? (
               <RefreshCcw size={20} className="animate-spin" />
            ) : (
              "EMEZA BINJIRE ✨"
            )}
          </Button>
          <button 
            onClick={() => navigate("/dashboard")} 
            className="w-full py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900"
          >
            Hagarika
          </button>
        </div>
      </main>

      {/* Inventory Modal - Large Labels */}
      {showInventoryPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-8 w-full max-w-sm space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">Hitamo Muri Stock</h2>
              <button onClick={() => setShowInventoryPopup(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {inventory.map(item => (
                <button
                  key={item.id}
                  onClick={() => setPopupSelectedItem(item)}
                  className={`w-full p-4 rounded-2xl flex justify-between items-center border-2 transition-all ${
                    popupSelectedItem?.id === item.id ? "border-slate-900 bg-slate-50" : "border-slate-50 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{item.item_name}</p>
                    <p className="text-xs font-bold text-slate-400 tracking-tight">Hasigaye {item.quantity}</p>
                  </div>
                  <span className="text-sm font-black text-slate-700">{formatCurrency(item.cost_price)}</span>
                </button>
              ))}
            </div>

            {popupSelectedItem && (
              <div className="pt-6 border-t border-slate-100 flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Qty</span>
                  <input
                    type="number"
                    min={1}
                    value={popupItemQty}
                    onChange={e => setPopupItemQty(e.target.value)}
                    className="w-20 p-4 bg-slate-50 rounded-2xl text-center font-black text-base outline-none border-2 border-transparent focus:border-slate-200"
                  />
                </div>
                <Button onClick={confirmPopupItem} className="flex-1 h-16 rounded-2xl bg-slate-900 font-black text-xs uppercase tracking-widest">
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