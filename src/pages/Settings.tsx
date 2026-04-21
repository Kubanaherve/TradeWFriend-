import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, AlertTriangle, Crown, Users, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { performFactoryReset } from "@/services/factoryResetService";
import { useI18n } from "@/contexts/LanguageContext";
import type { AppLanguage } from "@/lib/i18n";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BusinessSettings = {
  businessName: string;
  initialCapital: number;
  targetCapital: number;
};

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "",
  initialCapital: 0,
  targetCapital: 0,
};

const SETTING_KEYS = {
  initialCapital: "initial_capital",
  targetCapital: "target_capital",
} as const;

const Settings = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, setLanguage } = useI18n();

  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isOwner = auth.profile?.role === "owner";
  const ownerIdentifier = auth.profile?.phone ?? "";
  const businessNameFromProfile = auth.profile?.businessName ?? "";

  const canUsePage = useMemo(
    () => !!auth.isAuthenticated && !!auth.profile,
    [auth.isAuthenticated, auth.profile]
  );

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!canUsePage) {
        setLoading(false);
        return;
      }

      try {
        const response = await supabase
          .from("app_settings")
          .select("setting_key, setting_value")
          .in("setting_key", [SETTING_KEYS.initialCapital, SETTING_KEYS.targetCapital]);

        if (response.error) throw response.error;

        const map = new Map(
          (response.data ?? []).map((row) => [row.setting_key, row.setting_value])
        );

        setSettings({
          businessName: businessNameFromProfile,
          initialCapital: Number(map.get(SETTING_KEYS.initialCapital) ?? 0),
          targetCapital: Number(map.get(SETTING_KEYS.targetCapital) ?? 0),
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [businessNameFromProfile, canUsePage]);

  const handleSave = async () => {
    if (!isOwner) {
      toast.error("Permission denied");
      return;
    }

    if (!settings.businessName.trim()) {
      toast.error("Business name is required");
      return;
    }

    setSaving(true);

    try {
      const settingsRows = [
        {
          setting_key: SETTING_KEYS.initialCapital,
          setting_value: String(settings.initialCapital || 0),
        },
        {
          setting_key: SETTING_KEYS.targetCapital,
          setting_value: String(settings.targetCapital || 0),
        },
      ];

      const upsertResponse = await supabase
        .from("app_settings")
        .upsert(settingsRows, {
          onConflict: "setting_key",
        });

      if (upsertResponse.error) throw upsertResponse.error;

      if (ownerIdentifier) {
        const employeeUpdateResponse = await supabase
          .from("employees")
          .update({
            business_name: settings.businessName.trim(),
          })
          .eq("created_by", ownerIdentifier);

        if (employeeUpdateResponse.error) throw employeeUpdateResponse.error;

        const ownerUpdateResponse = await (supabase as any)
          .from("employees")
          .update({
            business_name: settings.businessName.trim(),
          })
          .eq("phone", ownerIdentifier)
          .eq("role", "owner");

        if (ownerUpdateResponse.error) throw ownerUpdateResponse.error;
      }

      await auth.refreshProfile();
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!isOwner) {
      toast.error("Permission denied");
      return;
    }

    const confirmed = window.confirm("This will permanently delete all data. Are you sure?");
    if (!confirmed) return;

    setClearing(true);

    try {
      await performFactoryReset();

      setSettings((prev) => ({
        ...prev,
        initialCapital: 0,
        targetCapital: 0,
      }));

      window.dispatchEvent(new CustomEvent("newDebtAdded"));
      window.dispatchEvent(new CustomEvent("paymentMade"));
      window.dispatchEvent(new CustomEvent("debtDeleted"));
      window.dispatchEvent(new CustomEvent("clientDeleted"));
      window.dispatchEvent(new CustomEvent("factoryReset"));
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
      window.dispatchEvent(new CustomEvent("salesUpdated"));

      toast.success("Factory reset completed");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Error during factory reset:", error);
      toast.error("Factory reset failed");
    } finally {
      setClearing(false);
    }
  };

  if (auth.isLoading || loading) {
    return (
      <AppShell>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading settings...</p>
        </div>
      </AppShell>
    );
  }

  if (!canUsePage) {
    return (
      <AppShell>
        <div className="text-center py-8">
          <p className="text-gray-600">Unable to load settings</p>
        </div>
      </AppShell>
    );
  }

  if (!isOwner) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <Crown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 mb-6">Only business owners can access settings.</p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your business configuration</p>
        </div>

        {/* Business Settings */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Business Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name *
                </label>
                <Input
                  value={settings.businessName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                  placeholder="Enter your business name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This name will appear on all customer communications and reports
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Capital
                  </label>
                  <Input
                    type="number"
                    value={settings.initialCapital}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        initialCapital: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Capital
                  </label>
                  <Input
                    type="number"
                    value={settings.targetCapital}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        targetCapital: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </div>

        {/* Employee Management */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Employee Management</h2>
            </div>

            <p className="text-gray-600 mb-4">
              Manage employees and their access to the system
            </p>

            <Button
              onClick={() => navigate("/employees")}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Manage Employees
            </Button>
          </div>
        </div>

        {/* Language Settings */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Language</h2>
            </div>

            <p className="text-gray-600 mb-4">
              Choose your preferred language
            </p>

            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="rw">Kinyarwanda</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
            </div>

            <p className="text-red-700 mb-4">
              Factory reset will permanently delete all business data. This action cannot be undone.
            </p>

            <Button
              onClick={handleFactoryReset}
              disabled={clearing}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {clearing ? "Resetting..." : "Factory Reset"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Settings;
