-- Add INSERT policy for app_settings to allow saving daily balances
CREATE POLICY "Allow public insert on app_settings"
ON public.app_settings
FOR INSERT
WITH CHECK (true);