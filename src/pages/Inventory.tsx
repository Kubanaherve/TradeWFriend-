import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, Camera, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  image_url?: string;
}

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth(); //
  const isOwner = profile?.role === 'owner'; //

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, image_url")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems((data as InventoryItem[]) ?? []);
    } catch (err) {
      toast.error("Habaye ikosa mu gufata ibintu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const filePath = `${Math.random().toString(36).substring(7)}_${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('inventory_images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('inventory_images')
        .getPublicUrl(filePath);

      if (itemId) {
        await supabase.from("inventory_items").update({ image_url: publicUrl }).eq("id", itemId);
        fetchItems();
      } else {
        setNewImageUrl(publicUrl);
      }
      toast.success("Ifoto yashyizweho neza! ✨");
    } catch (err) {
      toast.error("Gushyiraho ifoto byanze.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost = parseFloat(newCost);

    if (!newName.trim() || isNaN(quantity) || isNaN(cost)) {
      toast.error("Uzuza amakuru yose neza");
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase.from("inventory_items").insert({
        item_name: newName.trim(),
        quantity,
        cost_price: cost,
        image_url: newImageUrl || null,
      }).select().single();

      if (error) throw error;
      setItems(prev => [data, ...prev]);
      setShowAddForm(false);
      setNewName(""); setNewQuantity(""); setNewCost(""); setNewImageUrl("");
      toast.success("Byabitswe neza ✨");
    } catch (err) {
      toast.error("Habaye ikosa mu kubika");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isOwner) return; //
    if (!window.confirm("Urashaka gusiba iki kintu burundu?")) return;

    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success("Byasibwe ✨");
    } catch (err) {
      toast.error("Gusiba byanze");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-2 bg-slate-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-slate-900">{labels.inventoryTitle}</h1>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {isOwner && ( //
          <Button className="w-full mb-4 gap-2" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={18} /> {showAddForm ? "Funga" : "Ongeraho Gishya"}
          </Button>
        )}

        {showAddForm && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3 mb-6 animate-in slide-in-from-top">
            <Input placeholder="Izina ry'ikintu" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="Umubare (Quantity)" type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} />
            <Input placeholder="Igiciro waguriyeho (Cost)" type="number" value={newCost} onChange={e => setNewCost(e.target.value)} />
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border-2 border-dashed">
               <Camera size={20} className="text-slate-400" />
               <input type="file" accept="image/*" onChange={handleFileUpload} className="text-xs flex-1" />
            </div>
            {newImageUrl && <img src={newImageUrl} className="w-16 h-16 rounded object-cover" />}
            <Button className="w-full" onClick={handleAddItem} disabled={isAdding || uploading}>
              {isAdding ? "Biri kubikwa..." : "Emeza Binjire ✨"}
            </Button>
          </div>
        )}

        <main className="space-y-3 pb-10">
          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-slate-400 py-20">Nta bintu biri muri Stock</p>
          ) : (
            items.map(item => {
              const isLowStock = item.quantity <= 2; //
              return (
                <div key={item.id} className={`bg-white p-3 rounded-2xl flex gap-4 items-center border-2 transition-all ${isLowStock ? 'border-red-200 bg-red-50/30' : 'border-transparent shadow-sm'}`}>
                  <div className="relative w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-full h-full object-cover" />
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                        <Camera size={20} className="text-slate-300" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, item.id)} />
                      </label>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">{item.item_name}</h3>
                      {isLowStock && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">GISHIZE!</span>}
                    </div>
                    <div className="mt-1">
                      {isOwner && ( //
                        <p className="text-[11px] text-purple-700 font-bold uppercase tracking-tighter">
                          Waguze: {formatCurrency(item.cost_price)}
                        </p>
                      )}
                      <p className={`text-xs font-black ${isLowStock ? 'text-red-600' : 'text-blue-600'}`}>
                        Hasigaye: {item.quantity}
                      </p>
                    </div>
                  </div>

                  {isOwner && ( //
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
};

export default InventoryPage;