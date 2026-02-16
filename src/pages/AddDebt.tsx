import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { ArrowLeft, Save, X } from "lucide-react";
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

const AddDebtPageEnhanced = () => {
  const navigate = useNavigate();
  const { customers } = useCustomerSuggestions();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    dueDate: new Date().toISOString().split("T")[0],
    isPaid: false,
    amount: "",
  });
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);
  const [popupSelectedItem, setPopupSelectedItem] = useState<InventoryItem | null>(null);
  const [popupItemQty, setPopupItemQty] = useState(1);

  // Fetch inventory whenever popup opens
  useEffect(() => {
    if (!showInventoryPopup) return;
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Inventory fetch error:", error);
        toast.error("Habaye ikosa mu gufata ibintu");
      } else {
        setInventory(data || []);
      }
    };
    fetchInventory();
  }, [showInventoryPopup]);

  const handleCustomerSelect = (customer: { name: string; phone: string | null }) => {
    setForm(prev => ({
      ...prev,
      name: customer.name,
      phone: customer.phone || "",
    }));
  };

  const confirmPopupItem = () => {
    if (!popupSelectedItem || popupItemQty < 1) return;

    const existing = selectedItems.find(i => i.id === popupSelectedItem.id);
    if (existing) {
      existing.quantity += popupItemQty;
      setSelectedItems([...selectedItems]);
    } else {
      setSelectedItems([...selectedItems, {
        id: popupSelectedItem.id,
        name: popupSelectedItem.item_name,
        quantity: popupItemQty,
        price: popupSelectedItem.cost_price,
      }]);
    }

    recalcAmount([...selectedItems, {
      id: popupSelectedItem.id,
      name: popupSelectedItem.item_name,
      quantity: popupItemQty,
      price: popupSelectedItem.cost_price,
    }]);

    setPopupSelectedItem(null);
    setPopupItemQty(1);
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
      toast.error("Uzuza ibisabwa byose");
      return;
    }

    setIsLoading(true);
    try {
      await supabase.from("customers").insert([{
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        items: JSON.stringify(selectedItems.map(i => `${i.name} ${i.quantity}`)),
        amount: parseFloat(form.amount),
        due_date: form.dueDate,
        is_paid: form.isPaid,
        paid_at: form.isPaid ? new Date().toISOString() : null,
      }]);

      // Update inventory stock
      for (const item of selectedItems) {
        const current = inventory.find(i => i.id === item.id)?.quantity || 0;
        await supabase
          .from("inventory_items")
          .update({ quantity: current - item.quantity })
          .eq("id", item.id);
      }

      toast.success(labels.debtSavedSuccess + " ✨");
      navigate("/debts");
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu kubika umukiriya");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold">Kongeramo Umukiriya n'Ibyo yafashe</h1>
      </header>

      <main className="max-w-lg mx-auto mt-4 space-y-4">
        <CustomerAutocomplete
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          onSelect={handleCustomerSelect}
          suggestions={customers}
          placeholder="Andika izina ry'umukiriya..."
        />

        <Input
          type="tel"
          placeholder="07X XXX XXXX"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="bg-white/50 input-glow"
        />

       {/* Selected Items */}
<div>
  <label className="block text-xs font-medium mb-1.5">Items Taken *</label>
  <div className="space-y-2 max-h-48 overflow-y-auto">
    {selectedItems.map(i => (
      <div key={i.id} className="flex justify-between items-center bg-muted/20 rounded-lg p-2">
        <span>{i.name} {i.quantity}</span>
        {/* Red cross button with animation */}
        <button
          onClick={() => removeItemFromList(i.id)}
          className="text-red-600 text-lg animate-pulse hover:scale-110 transition-transform"
          title="Gukuraho ❌"
        >
          ❌
        </button>
      </div>
    ))}
  </div>
  <Button onClick={() => setShowInventoryPopup(true)} size="sm" className="mt-2 btn-gold">
    + Add Item
  </Button>
</div>
        {/* Amount */}
        <Input
          type="number"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="bg-white/50 input-glow text-lg font-semibold"
        />

        {/* Payment Status */}
        <div className="flex items-center justify-between py-3 border-t border-border/50">
          <span>{form.isPaid ? labels.paid : labels.willPayLater}</span>
          <Switch
            checked={form.isPaid}
            onCheckedChange={(checked) => setForm({ ...form, isPaid: checked })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1" disabled={isLoading}>
            <X size={16} /> {labels.cancel}
          </Button>
          <Button onClick={handleSubmit} className="flex-1 btn-navy gold-glow-hover" disabled={isLoading}>
            {isLoading ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <><Save size={16} /> {labels.save}</>}
          </Button>
        </div>
      </main>

      {/* Inventory Popup */}
      {showInventoryPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center p-4 z-50">
          <div className="bg-background rounded-xl p-4 w-full max-w-md space-y-4">
            <h2 className="text-sm font-bold">Hitamo Icyo Ushaka</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {inventory.map(item => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center p-2 rounded cursor-pointer hover:bg-muted/30 ${popupSelectedItem?.id === item.id ? "bg-primary/20" : ""}`}
                  onClick={() => setPopupSelectedItem(item)}
                >
                  <span>{item.item_name} (Hasigaye {item.quantity})</span>
                  <span>{formatCurrency(item.cost_price)}</span>
                </div>
              ))}
            </div>

            {popupSelectedItem && (
              <div className="flex gap-2 items-center">
                <span>{popupSelectedItem.item_name}</span>
                <Input
                  type="number"
                  min={1}
                  value={popupItemQty}
                  onChange={(e) => setPopupItemQty(parseInt(e.target.value) || 1)}
                  className="bg-white/50 w-20 input-glow"
                />
                <Button onClick={confirmPopupItem} className="btn-gold flex-1">OK</Button>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => setShowInventoryPopup(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddDebtPageEnhanced;
