-- Create inventory_items table for tracking items bought during restock
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  date_bought DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same pattern as other tables)
CREATE POLICY "Allow public read on inventory_items" 
ON public.inventory_items 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on inventory_items" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on inventory_items" 
ON public.inventory_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on inventory_items" 
ON public.inventory_items 
FOR DELETE 
USING (true);