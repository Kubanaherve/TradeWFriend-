import { useState, useEffect } from "react";

export interface BusinessSettings {
  businessName: string;
  initialCapital: number;
  targetCapital?: number;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "TradeWFriend+",
  initialCapital: 0,
  targetCapital: 0,
};

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tradewfriend_business_settings");
      if (stored) {
        setSettings(JSON.parse(stored));
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
    localStorage.setItem("tradewfriend_business_settings", JSON.stringify(updated));
  };

  return {
    settings,
    loading,
    updateSettings,
  };
};
