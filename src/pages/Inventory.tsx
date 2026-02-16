import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Package, Trash2, Save, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RecordSaleModal } from "@/components/RecordSaleModal";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  sale_price: number;
  date_bought: string;
  notes: string | null;
  created_at: string;
}

const InventoryPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<InventoryItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    item_name: "",
    quantity: "1",
    cost_price: "",
    sale_price: "",
    date_bought: new Date().toISOString().split('T')[0],
    notes: "",
  });

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Habaye ikosa mu gufata ibintu");
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      toast.error("Andika izina ry'ikintu");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("inventory_items").insert({
        item_name: form.item_name.trim(),
        quantity: parseInt(form.quantity) || 1,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        date_bought: form.date_bought,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Byongeweho neza ✨");
      setShowAddModal(false);
      setForm({ item_name: "", quantity: "1", cost_price: "", sale_price: "", date_bought: new Date().toISOString().split('T')[0], notes: "" });
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Urashaka gusiba iki kintu?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error("Habaye ikosa");
    else { toast.success("Byasibwe ✨"); fetchItems(); }
  };

  // Totals
  const totalCost = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
  const expectedRevenue = items.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold">{labels.inventoryTitle}</h1>
            <p className="text-[10px] text-muted-foreground">{labels.inventorySubtitle}</p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="btn-gold">
          <Plus size={16} className="mr-1" /> {labels.addNew}
        </Button>
      </header>

      {/* Totals */}
      <div className="p-4 max-w-lg mx-auto grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Total Cost Price</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Hateganyijwe kwinjiza</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(expectedRevenue)}</p>
        </div>
      </div>

      {/* Item List */}
      <main className="p-4 max-w-lg mx-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{labels.noInventory}</p>
            <Button onClick={() => setShowAddModal(true)} className="mt-4 btn-gold">
              <Plus size={16} className="mr-2" /> {labels.addNew}
            </Button>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="glass-card p-4 flex justify-between items-start animate-fade-in">
              <div className="flex-1">
                <h3 className="font-semibold">{item.item_name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Qty: 
                  <Input type="number" value={item.quantity} min={0} onChange={async e => {
                    const newQty = parseInt(e.target.value) || 0;
                    const { error } = await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", item.id);
                    if (error) toast.error("Habaye ikosa");
                    else fetchItems();
                  }} className="w-16 ml-1 text-xs" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cost: {formatCurrency(item.cost_price)}</p>
                <p className="text-xs text-muted-foreground mt-1">Sale: {formatCurrency(item.sale_price)}</p>
                {item.notes && <p className="text-xs italic mt-1 text-muted-foreground">{item.notes}</p>}
              </div>
              <div className="flex flex-col gap-2 ml-3">
                <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={16} />
                </Button>
                <Button size="icon" className="text-primary" onClick={() => { setSelectedItemForSale(item); setShowSaleModal(true); }}>
                  <ShoppingCart size={16} />
                </Button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Add Item Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader><DialogTitle>{labels.addInventoryItem}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Izina ry'ikintu..." value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              <Input type="number" placeholder="Cost Price" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
            </div>
            <Input type="number" placeholder="Sale Price" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            <Input type="date" value={form.date_bought} onChange={e => setForm({ ...form, date_bought: e.target.value })} />
            <Input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="btn-gold" onClick={handleSubmit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Sale Modal */}
      <RecordSaleModal open={showSaleModal} onOpenChange={setShowSaleModal} preSelectedItem={selectedItemForSale} onSuccess={fetchItems} />
    </div>
  );
};

export default InventoryPage;
