import { useState, useEffect } from "react";

export interface BusinessSettings {
  businessName: string;
  initialCapital: number;
  targetCapital?: number;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "",
  initialCapital: 0,
  targetCapital: 0,
};

const STORAGE_KEY = "curuza_business_settings";
const LEGACY_STORAGE_KEY = "tradewfriend_business_settings";

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch (error) {
      console.error("Error loading business settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = (newSettings: Partial<BusinessSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return {
    settings,
    loading,
    updateSettings,
  };
};
