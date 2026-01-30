import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
}

export const useInventorySuggestions = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, item_name, quantity, cost_price")
      .gt("quantity", 0)
      .order("item_name", { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const decreaseQuantity = async (itemName: string, quantitySold: number = 1) => {
    // Find the item with that name
    const item = items.find(i => i.item_name.toLowerCase() === itemName.toLowerCase());
    if (!item) return false;

    const newQuantity = Math.max(0, item.quantity - quantitySold);
    
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", item.id);

    if (!error) {
      // Update local state
      setItems(prev => 
        prev.map(i => i.id === item.id ? { ...i, quantity: newQuantity } : i)
          .filter(i => i.quantity > 0)
      );
      return true;
    }
    return false;
  };

  const getItemByName = (name: string) => {
    return items.find(i => i.item_name.toLowerCase() === name.toLowerCase());
  };

  return { items, isLoading, fetchItems, decreaseQuantity, getItemByName };
};
