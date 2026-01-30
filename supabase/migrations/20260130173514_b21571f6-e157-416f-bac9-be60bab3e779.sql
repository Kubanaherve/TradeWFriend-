-- Create customers table for tracking debts
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  items TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales table for tracking sales and profits
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  date_sold DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_settings table for PIN storage
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default PINs (mom: 1234, dad: 5678)
INSERT INTO public.app_settings (setting_key, setting_value) VALUES 
  ('mom_pin', '1234'),
  ('dad_pin', '5678');

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (no auth required for this family app)
CREATE POLICY "Allow public read on customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on customers" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Allow public read on sales" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sales" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sales" ON public.sales FOR DELETE USING (true);

CREATE POLICY "Allow public read on app_settings" ON public.app_settings FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();