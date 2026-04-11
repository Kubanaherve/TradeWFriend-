-- Add image_url column to inventory_items table for photo storage
ALTER TABLE public.inventory_items
ADD COLUMN image_url TEXT;

-- Create index for faster queries
CREATE INDEX idx_inventory_items_image_url ON public.inventory_items(image_url) WHERE image_url IS NOT NULL;
