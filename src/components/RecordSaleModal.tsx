import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Save, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ItemAutocomplete } from "./ItemAutocomplete";
import { useInventorySuggestions, type InventoryItem } from "@/hooks/useInventorySuggestions";

interface RecordSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedItem?: InventoryItem | null;
}

export const RecordSaleModal = ({
  open,
  onOpenChange,
  onSuccess,
  preSelectedItem,
}: RecordSaleModalProps) => {
  const { items, decreaseQuantity, getItemByName } = useInventorySuggestions();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);

  const [form, setForm] = useState({
    item_name: "",
    quantity: "1",
    cost_price: "",
    sale_price: "",
    date_sold: new Date().toISOString().split("T")[0],
  });

  // Handle pre-selected item
  useEffect(() => {
    if (preSelectedItem && open) {
      setForm({
        item_name: preSelectedItem.item_name,
        quantity: "1",
        cost_price: preSelectedItem.cost_price.toString(),
        sale_price: "",
        date_sold: new Date().toISOString().split("T")[0],
      });
      setSelectedInventoryItem(preSelectedItem);
    }
  }, [preSelectedItem, open]);

  const handleItemSelect = (itemName: string) => {
    const item = getItemByName(itemName);
    if (item) {
      setSelectedInventoryItem(item);
      setForm(prev => ({
        ...prev,
        item_name: item.item_name,
        cost_price: item.cost_price.toString(),
      }));
    }
  };

  const handleItemChange = (value: string) => {
    setForm(prev => ({ ...prev, item_name: value }));
    
    // Check if the typed value matches an inventory item
    const item = getItemByName(value);
    if (item) {
      setSelectedInventoryItem(item);
      setForm(prev => ({
        ...prev,
        cost_price: item.cost_price.toString(),
      }));
    } else {
      setSelectedInventoryItem(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      toast.error("Andika izina ry'ikintu");
      return;
    }
    if (!form.sale_price || parseFloat(form.sale_price) <= 0) {
      toast.error("Andika igiciro cy'igurisha");
      return;
    }

    setIsSaving(true);
    try {
      const quantity = parseInt(form.quantity) || 1;
      
      // Insert sale record
      const { error } = await supabase.from("sales").insert({
        item_name: form.item_name.trim(),
        quantity,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price),
        date_sold: form.date_sold,
      });

      if (error) throw error;

      // Decrease inventory quantity
      if (selectedInventoryItem) {
        await decreaseQuantity(form.item_name, quantity);
      }

      toast.success("Byashyizweho neza! ✨");
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      item_name: "",
      quantity: "1",
      cost_price: "",
      sale_price: "",
      date_sold: new Date().toISOString().split("T")[0],
    });
    setSelectedInventoryItem(null);
  };

  const profit = (parseFloat(form.sale_price) || 0) - (parseFloat(form.cost_price) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package size={18} />
            Andika icyo wagurishije
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Name with Autocomplete */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.itemName} *
            </label>
            <ItemAutocomplete
              value={form.item_name}
              onChange={handleItemChange}
              onSelect={handleItemSelect}
              suggestions={items.map(i => ({ item_name: i.item_name }))}
              placeholder="Hitamo ikintu..."
            />
            {selectedInventoryItem && (
              <p className="text-[10px] text-muted-foreground mt-1">
                📦 {selectedInventoryItem.quantity} bisigaye • Cost: {formatCurrency(selectedInventoryItem.cost_price)}
              </p>
            )}
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
                max={selectedInventoryItem?.quantity}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">
                Cost Price
              </label>
              <Input
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                placeholder="0"
                className="bg-muted/50 input-glow"
                inputMode="numeric"
                disabled={!!selectedInventoryItem}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Igiciro cy'igurisha (Sale Price) *
            </label>
            <Input
              type="number"
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
              placeholder="0"
              className="bg-muted/50 input-glow text-lg font-bold"
              inputMode="numeric"
              autoFocus={!preSelectedItem}
            />
          </div>

          {/* Profit Preview */}
          {form.sale_price && (
            <div className={`glass-card p-3 ${profit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <p className="text-xs text-muted-foreground">Inyungu / Igihombo</p>
              <p className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Itariki
            </label>
            <Input
              type="date"
              value={form.date_sold}
              onChange={(e) => setForm({ ...form, date_sold: e.target.value })}
              className="bg-muted/50 input-glow"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
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
  );
};
