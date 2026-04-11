import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, Camera, Edit } from "lucide-react";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  image_url?: string;
}

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState("");
  const [editingQuantity, setEditingQuantity] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const [refreshKey, setRefreshKey] = useState(0); // triggers refetch on debt update

  /* =========================
     FILE UPLOAD HANDLER WITH ERROR HANDLING
  ========================== */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId?: string) => {
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

    setUploading(true);
    const fileExt = file.type.split('/').pop();
    const filePath = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('inventory_images')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Gushyiraho ifoto byanze');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('inventory_images')
        .getPublicUrl(filePath);

      if (itemId) {
        // Update existing item
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({ image_url: publicUrl })
          .eq("id", itemId);
        
        if (updateError) throw updateError;
        fetchItems();
        toast.success("Ifoto yashyizweho!");
      } else {
        // Store for new item form
        setNewImageUrl(publicUrl);
        toast.success("Ifoto yateguwe!");
      }
    } catch (err: any) {
      console.error('Full upload error:', err);
      const errorMsg = err?.message || "Gushyiraho ifoto byanze";
      toast.error(errorMsg);
    } finally {
      setUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  /* =========================
     FETCH ITEMS
  ========================== */
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, item_name, quantity, cost_price, image_url")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu gufata ibintu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + refresh listener
  useEffect(() => {
    fetchItems();

    const handleInventoryUpdated = () => {
      setRefreshKey(prev => prev + 1); // triggers refetch
    };

    window.addEventListener("inventoryUpdated", handleInventoryUpdated);
    return () => window.removeEventListener("inventoryUpdated", handleInventoryUpdated);
  }, [fetchItems]);

  // Refetch whenever refreshKey changes
  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  /* =========================
     SAVE EDITS (Cost + Quantity)
  ========================== */
  const handleSaveEdit = async (id: string) => {
    const cost = parseFloat(editingCost);
    const quantity = parseInt(editingQuantity, 10);

    if (isNaN(cost) || cost < 0 || isNaN(quantity) || quantity < 0) {
      toast.error("Andika neza amafaranga n'umubare");
      return;
    }

    const previousItems = [...items];
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, cost_price: cost, quantity } : item
      )
    );

    const { error } = await supabase
      .from("inventory_items")
      .update({ cost_price: cost, quantity })
      .eq("id", id);

    if (error) {
      setItems(previousItems);
      toast.error("Habaye ikosa mu guhindura");
    } else {
      toast.success("Byahinduwe neza ✨");
      setEditingId(null);
    }
  };

  /* =========================
     DELETE ITEM
  ========================== */
  const handleDelete = async (id: string) => {
    if (!window.confirm("Urashaka gusiba iki kintu?")) return;

    const previousItems = [...items];
    setItems(prev => prev.filter(item => item.id !== id));

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id);

    if (error) {
      setItems(previousItems);
      toast.error("Habaye ikosa");
    } else {
      toast.success("Byasibwe ✨");
    }
  };

  /* =========================
     ADD ITEM
  ========================== */
  const handleAddItem = async () => {
    const quantity = parseInt(newQuantity, 10);
    const cost = parseFloat(newCost);

    if (!newName.trim() || isNaN(quantity) || quantity < 0 || isNaN(cost) || cost < 0) {
      toast.error("Andika neza izina, amafaranga n'umubare");
      return;
    }

    setIsAdding(true);

    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          item_name: newName.trim(),
          quantity,
          cost_price: cost,
          ...(newImageUrl && { image_url: newImageUrl }),
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setItems(prev => [data, ...prev]);
        toast.success("Ikintu cyongewe muri stock ✨");
        setNewName("");
        setNewQuantity("");
        setNewCost("");
        setNewImageUrl("");
        setShowAddForm(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu kongera ikintu");
    } finally {
      setIsAdding(false);
    }
  };

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold">{labels.inventoryTitle}</h1>
        </div>
      </header>

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
            
            {/* Image Upload Section */}
            {isOwner && (
              <div className="border-t pt-3 space-y-2">
                <label className="text-xs text-muted-foreground block font-medium">Ongeraho Ifoto (ihitamo)</label>
                
                {/* Camera Input (hidden) */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => handleFileUpload(e)}
                  className="hidden"
                />

                {/* File Input (hidden) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleFileUpload(e)}
                  className="hidden"
                />

                {/* Upload Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 text-xs"
                  >
                    📷 Kunan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 text-xs"
                  >
                    📁 Hitamo
                  </Button>
                </div>

                {/* Image Preview */}
                {newImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={newImageUrl} alt="Preview" className="w-16 h-16 object-cover rounded border border-primary/30" />
                    <span className="text-xs text-green-600 font-medium">✓ Ifoto yateguwe</span>
                  </div>
                )}
              </div>
            )}
            
            <Button
              className="w-full"
              onClick={handleAddItem}
              disabled={isAdding || uploading}
            >
              {isAdding ? "Adding..." : uploading ? "Uploading..." : "Ongeraho"}
            </Button>
          </div>
        )}
      </div>

      <main
        className="p-4 max-w-lg mx-auto space-y-3 overflow-y-auto animate-fade-in"
        style={{ height: "70vh" }}
      >
        {isLoading && items.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground">Nta bintu biri muri stock.</p>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="glass-card p-4 flex justify-between items-start gap-3"
            >
              {/* Image Section */}
              <div className="relative w-16 h-16 flex-shrink-0 rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center group">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-muted-foreground" />
                )}
                
                {/* Upload Overlay (Owner Only) */}
                {isOwner && (
                  <>
                    <input
                      id={`camera-${item.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => handleFileUpload(e, item.id)}
                      disabled={uploading}
                      className="hidden"
                    />
                    <input
                      id={`file-${item.id}`}
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, item.id)}
                      disabled={uploading}
                      className="hidden"
                    />
                    <label
                      htmlFor={`camera-${item.id}`}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center cursor-pointer transition-colors flex-col gap-1"
                    >
                      <Camera size={20} className="text-white/0 group-hover:text-white" />
                      <span className="text-white/0 group-hover:text-white text-xs font-medium">Kunan</span>
                    </label>
                  </>
                )}
              </div>

              {/* Item Details */}
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
                    <Input
                      type="number"
                      value={editingQuantity}
                      onChange={e => setEditingQuantity(e.target.value)}
                      className="w-20 text-sm"
                    />
                    <Button size="sm" onClick={() => handleSaveEdit(item.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm mt-1 flex flex-wrap gap-2">
                    Cost Price:
                    <span className="font-bold text-purple-600">{formatCurrency(item.cost_price)}</span>
                    | 
                    <span className="font-bold text-purple-600">Hasigayemo: {item.quantity}</span>
                  </p>
                )}
              </div>

              {/* Actions (Owner Only) */}
              {isOwner && (
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={16} />
                  </Button>

                  <Button
                    size="icon"
                    className="text-primary"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingCost(item.cost_price?.toString() ?? "");
                      setEditingQuantity(item.quantity.toString());
                    }}
                  >
                    <Edit size={16} />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default InventoryPage;