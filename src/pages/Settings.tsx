import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, AlertTriangle, Crown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import type { AppLanguage } from "@/lib/i18n";
import AppShell from "@/components/layout/AppShell";

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
  const { language, setLanguage, t } = useI18n();

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
        toast.error(t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [businessNameFromProfile, canUsePage, t]);

  const handleSave = async () => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    if (!settings.businessName.trim()) {
      toast.error(t("errors.requiredField"));
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
        const employeeUpdateResponse = await (supabase as any)
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
      toast.success(t("settings.settingsSaved"));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
const handleFactoryReset = async () => {
  if (!isOwner) {
    toast.error(t("errors.noPermission"));
    return;
  }

  const confirmed = window.confirm(t("settings.factoryResetConfirm"));
  if (!confirmed) return;

  setClearing(true);

  try {
    const { error } = await supabase.rpc("factory_reset_app");

    if (error) throw error;

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

    toast.success(t("settings.factoryResetDone"));
    navigate("/dashboard", { replace: true });
  } catch (error) {
    console.error("Error during factory reset:", error);
    toast.error(t("settings.factoryResetFailed"));
  } finally {
    setClearing(false);
  }
};
  if (auth.isLoading || loading) {
    return (
      <AppShell
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        showBack
        showHome
        contentClassName="pt-2 md:pt-3"
      >
        <div className="mx-auto max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (!canUsePage) {
    return (
      <AppShell
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        showBack
        showHome
        contentClassName="pt-2 md:pt-3"
      >
        <div className="mx-auto max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">{t("errors.loadFailed")}</p>
        </div>
      </AppShell>
    );
  }

  if (!isOwner) {
    return (
      <AppShell
        title={t("settings.title")}
        subtitle={t("settings.ownerOnlySection")}
        showBack
        showHome
        contentClassName="pt-2 md:pt-3"
      >
        <div className="mx-auto max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-slate-900 to-blue-900 shadow-sm">
              <img
                src={logo}
                alt={t("common.appName")}
                className="h-10 w-10 object-contain"
              />
            </div>
          </div>

          <h1 className="mb-2 text-xl font-bold text-slate-900">{t("settings.title")}</h1>
          <p className="mb-6 text-sm text-slate-500">{t("settings.employeeRestriction")}</p>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {t("settings.backToDashboard")}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center gap-2">
            <Crown size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              {t("settings.businessSettings")}
            </h2>
          </div>

          <p className="mb-4 text-sm text-slate-500">{t("settings.subtitle")}</p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("settings.businessName")}
              </label>
              <input
                value={settings.businessName}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    businessName: e.target.value,
                  }))
                }
                placeholder={t("settings.businessName")}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("settings.initialCapital")}
              </label>
              <input
                type="number"
                value={settings.initialCapital}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    initialCapital: Number(e.target.value) || 0,
                  }))
                }
                placeholder="0"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("settings.targetCapital")}
              </label>
              <input
                type="number"
                value={settings.targetCapital}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    targetCapital: Number(e.target.value) || 0,
                  }))
                }
                placeholder="0"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? t("common.saving") : t("settings.saveSettings")}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              {t("settings.employeeManagement")}
            </h2>
          </div>

          <p className="mb-4 text-sm text-slate-500">{t("employees.subtitle")}</p>

          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {t("settings.manageEmployees")}
          </button>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-base">🌐</span>
            <h2 className="text-sm font-bold text-slate-900">
              {t("settings.language")}
            </h2>
          </div>

          <p className="mb-4 text-sm text-slate-500">{t("settings.chooseLanguage")}</p>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-500"
          >
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <h2 className="text-sm font-bold text-red-700">
              {t("settings.dangerZone")}
            </h2>
          </div>

          <p className="mb-4 text-sm text-red-700/80">{t("settings.factoryResetConfirm")}</p>

          <button
            type="button"
            onClick={handleFactoryReset}
            disabled={clearing}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <RotateCcw size={16} />
            {clearing ? t("common.loading") : t("settings.factoryReset")}
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default Settings;