export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  cost_price: number;
  category: string | null;
  subcategory: string | null;
  normalized_name?: string | null;
  created_at?: string;
}

export interface InventoryCategoryOption {
  value: string;
  labelKey: string;
  icon: string;
}

export interface InventorySubcategoryOption {
  value: string;
  labelKey: string;
}