import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Package, Trash2, X, Save, ShoppingCart, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordSaleModal } from "@/components/RecordSaleModal";
import { Checkbox } from "@/components/ui/checkbox";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
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
      console.error("Fetch error:", error);
      toast.error("Habaye ikosa");
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
        date_bought: form.date_bought,
        notes: form.notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Byongeweho neza ✨");
      setShowAddModal(false);
      setForm({
        item_name: "",
        quantity: "1",
        cost_price: "",
        date_bought: new Date().toISOString().split('T')[0],
        notes: "",
      });
      fetchItems();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(labels.confirmDelete)) return;
    
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) {
      toast.error("Habaye ikosa");
    } else {
      toast.success("Byasibwe ✨");
      fetchItems();
    }
  };

  const totalCost = items.reduce((sum, item) => sum + Number(item.cost_price) * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-bold">{labels.inventoryTitle}</h1>
              <p className="text-[10px] text-muted-foreground">{labels.inventorySubtitle}</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="btn-gold"
          >
            <Plus size={16} className="mr-1" />
            {labels.addNew}
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <p className="text-[10px] text-muted-foreground mb-1">Total Items</p>
            <p className="text-xl font-bold text-primary">{totalItems}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] text-muted-foreground mb-1">Total Cost</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(totalCost)}</p>
          </div>
        </div>

        {/* Items List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{labels.noInventory}</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="mt-4 btn-gold"
            >
              <Plus size={16} className="mr-2" />
              {labels.addNew}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sell Selected Button */}
            {selectedItems.size > 0 && (
              <div className="glass-card p-3 bg-primary/10 flex items-center justify-between animate-fade-in">
                <span className="text-sm font-medium">
                  {selectedItems.size} byahiswemo
                </span>
                <Button
                  size="sm"
                  className="btn-gold"
                  onClick={() => {
                    // Get the first selected item for now
                    const firstId = Array.from(selectedItems)[0];
                    const item = items.find(i => i.id === firstId);
                    if (item) {
                      setSelectedItemForSale(item);
                      setShowSaleModal(true);
                    }
                  }}
                >
                  <ShoppingCart size={14} className="mr-1" />
                  Gurisha
                </Button>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className={`glass-card p-4 animate-fade-in transition-all ${
                  selectedItems.has(item.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedItems);
                        if (checked) {
                          newSelected.add(item.id);
                        } else {
                          newSelected.delete(item.id);
                        }
                        setSelectedItems(newSelected);
                      }}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{item.item_name}</h3>
                      {item.quantity === 0 && (
                        <span className="text-[10px] bg-red-500/20 text-red-600 px-1.5 py-0.5 rounded">
                          Sold Out
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className={item.quantity <= 2 ? 'text-orange-600 font-medium' : ''}>
                        Qty: {item.quantity}
                      </span>
                      <span>•</span>
                      <span>{formatCurrency(Number(item.cost_price))}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {formatDate(item.date_bought)}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {/* Quick Sell Button */}
                    <button
                      onClick={() => {
                        setSelectedItemForSale(item);
                        setShowSaleModal(true);
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Gurisha"
                    >
                      <ShoppingCart size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Item Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{labels.addInventoryItem}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {labels.itemName} *
              </label>
              <Input
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                placeholder="Impeta, Isaha, ..."
                className="bg-muted/50 input-glow"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.quantity}
                </label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="1"
                  className="bg-muted/50 input-glow"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.costPrice} (FRW)
                </label>
                <Input
                  type="number"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  placeholder="0"
                  className="bg-muted/50 input-glow"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">
                {labels.dateBought}
              </label>
              <Input
                type="date"
                value={form.date_bought}
                onChange={(e) => setForm({ ...form, date_bought: e.target.value })}
                className="bg-muted/50 input-glow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">
                Notes (Optional)
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Ibindi..."
                className="bg-muted/50 input-glow"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <X size={16} className="mr-1" />
                {labels.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 btn-gold"
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={16} className="mr-1" />
                    {labels.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Sale Modal */}
      <RecordSaleModal
        open={showSaleModal}
        onOpenChange={(open) => {
          setShowSaleModal(open);
          if (!open) {
            setSelectedItemForSale(null);
            setSelectedItems(new Set());
          }
        }}
        onSuccess={() => {
          fetchItems();
          setSelectedItems(new Set());
        }}
        preSelectedItem={selectedItemForSale}
      />
    </div>
  );
};

export default InventoryPage;
