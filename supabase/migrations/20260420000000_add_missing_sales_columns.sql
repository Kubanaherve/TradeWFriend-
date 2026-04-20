-- Add missing columns to sales table for enhanced sales tracking
-- Migration: 20260420000000_add_missing_sales_columns.sql

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS sale_number TEXT,
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_price NUMERIC;

-- Generate sale_number for existing records (format: SL001, SL002, etc.)
UPDATE public.sales
SET sale_number = 'SL' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE sale_number IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON public.sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_item_id ON public.sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- Ensure unit_price is populated from existing data (sale_price / quantity)
UPDATE public.sales
SET unit_price = sale_price / NULLIF(quantity, 0)
WHERE unit_price IS NULL;
