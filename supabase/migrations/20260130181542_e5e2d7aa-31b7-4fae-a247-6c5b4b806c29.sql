-- Add capital/investment tracking to app_settings
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('total_capital', '0')
ON CONFLICT (setting_key) DO NOTHING;

-- Create unique constraint on setting_key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_setting_key_key'
  ) THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;

-- Allow public update on app_settings for capital tracking
CREATE POLICY "Allow public update on app_settings"
ON public.app_settings
FOR UPDATE
USING (true);