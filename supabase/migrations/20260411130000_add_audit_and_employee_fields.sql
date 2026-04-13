-- Add audit trail and employee tracking fields for production-ready app
-- Migration: 20260411130000_add_audit_and_employee_fields.sql

-- Add added_by column to customers table for audit trails
ALTER TABLE public.customers
ADD COLUMN added_by TEXT;

-- Add employee_phone column to sales table to track who made each sale
ALTER TABLE public.sales
ADD COLUMN employee_phone TEXT;

-- Create employees table for proper employee management
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  business_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL -- owner's phone
);

-- Add low_stock_alerts table for inventory alerts
CREATE TABLE public.low_stock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inventory_item_id)
);

-- Enable RLS on new tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Update existing RLS policies to be more secure
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public update on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public delete on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public read on sales" ON public.sales;
DROP POLICY IF EXISTS "Allow public insert on sales" ON public.sales;
DROP POLICY IF EXISTS "Allow public update on sales" ON public.sales;
DROP POLICY IF EXISTS "Allow public delete on sales" ON public.sales;
DROP POLICY IF EXISTS "Allow public read on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public insert on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public update on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public delete on app_settings" ON public.app_settings;

-- Create proper RLS policies (for now keeping them permissive since we're using local auth)
-- These can be updated when migrating to Supabase Auth
CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on low_stock_alerts" ON public.low_stock_alerts FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_added_by ON public.customers(added_by);
CREATE INDEX IF NOT EXISTS idx_sales_employee_phone ON public.sales(employee_phone);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON public.employees(phone);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_item_id ON public.low_stock_alerts(inventory_item_id);