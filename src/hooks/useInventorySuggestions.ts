import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface InventoryItem {
  item_name: string;
}

export const useInventorySuggestions = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("item_name")
        .order("item_name", { ascending: true });

      if (!error && data) {
        // Remove duplicates
        const uniqueItems = Array.from(
          new Map(data.map(item => [item.item_name.toLowerCase(), item])).values()
        );
        setItems(uniqueItems);
      }
      setIsLoading(false);
    };

    fetchItems();
  }, []);

  return { items, isLoading };
};
