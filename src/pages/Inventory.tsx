import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus } from "lucide-react";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
}

const InventoryPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<string>("");

  // For Add Item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCost, setNewCost] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, item_name, quantity, cost_price")
      .order("created_at", { ascending: false });
    if (error) toast.error("Habaye ikosa mu gufata ibintu");
    else setItems(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSaveCost = async (id: string) => {
    const cost = parseFloat(editingCost);
    if (isNaN(cost) || cost < 0) {
      toast.error("Andika amafaranga meza");
      return;
    }
    const { error } = await supabase
      .from("inventory_items")
      .update({ cost_price: cost })
      .eq("id", id);
    if (error) toast.error("Habaye ikosa");
    else {
      toast.success("Amafaranga yahinduwe ✨");
      setEditingId(null);
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Urashaka gusiba iki kintu?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error("Habaye ikosa");
    else { toast.success("Byasibwe ✨"); fetchItems(); }
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity);
    const cost = parseFloat(newCost);

    if (!newName || isNaN(quantity) || quantity < 0 || isNaN(cost) || cost < 0) {
      toast.error("Andika neza izina, amafaranga n'umubare");
      return;
    }

    setIsAdding(true);
    const { error } = await supabase.from("inventory_items").insert({
      item_name: newName,
      quantity,
      cost_price: cost
    });

    if (error) toast.error("Habaye ikosa mu kongera ikintu");
    else {
      toast.success("Ikintu cyongewe muri stock ✨");
      setNewName("");
      setNewQuantity("");
      setNewCost("");
      setShowAddForm(false);
      fetchItems();
    }
    setIsAdding(false);
  };

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
          </div>
        </div>
      </header>

      {/* Add New Item Button */}
      <div className="p-4 max-w-lg mx-auto">
        <Button
          className="w-full mb-3 flex items-center justify-center gap-2"
          onClick={() => setShowAddForm(prev => !prev)}
        >
          <Plus size={16} /> Ongeraho Ikintu Gishya
        </Button>

        {showAddForm && (
          <div className="glass-card p-4 mb-3 space-y-2 animate-fade-in">
            <Input
              placeholder="Izina ry'ikintu"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <Input
              placeholder="Umubare uri muri stock"
              type="number"
              value={newQuantity}
              onChange={e => setNewQuantity(e.target.value)}
            />
            <Input
              placeholder="Cost Price"
              type="number"
              value={newCost}
              onChange={e => setNewCost(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleAddItem}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Ongeraho"}
            </Button>
          </div>
        )}
      </div>

      {/* Item List */}
      <main className="p-4 max-w-lg mx-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">Nta bicuruzwa biri muri stock</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="glass-card p-4 flex justify-between items-center animate-fade-in"
            >
              <div className="flex-1">
                <h3 className="font-semibold">{item.item_name}</h3>
                {editingId === item.id ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={editingCost}
                      onChange={e => setEditingCost(e.target.value)}
                      className="w-24 text-sm"
                    />
                    <Button size="sm" onClick={() => handleSaveCost(item.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <p className="text-sm mt-1 flex flex-wrap gap-2">
                    Cost Price: <span className="font-bold text-purple-600">{formatCurrency(item.cost_price)}</span> | 
                    <span className="font-bold text-purple-600">Hasigayemo: {item.quantity}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 ml-3">
                <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={16} />
                </Button>
                <Button size="icon" className="text-primary" onClick={() => { setEditingId(item.id); setEditingCost(item.cost_price.toString()); }}>
                  Edit
                </Button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default InventoryPage;
