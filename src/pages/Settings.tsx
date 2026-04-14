import { useEffect, useMemo, useState, type CSSProperties, type FocusEvent } from "react";
import { ArrowLeft, Save, RotateCcw, AlertTriangle, Crown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import type { AppLanguage } from "@/lib/i18n";

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

const S = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 14px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: "relative" as const,
    overflow: "hidden",
  },
  blob1: {
    position: "absolute" as const,
    top: -120,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  blob2: {
    position: "absolute" as const,
    bottom: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  card: {
    background: "white",
    borderRadius: 24,
    boxShadow:
      "0 4px 6px rgba(0,0,0,0.04), 0 20px 50px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "24px 20px",
    width: "100%",
    maxWidth: 420,
    position: "relative" as const,
    zIndex: 1,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.22), 0 0 0 1px rgba(59,130,246,0.16)",
  },
  appName: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center" as const,
    letterSpacing: "-0.4px",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center" as const,
    marginBottom: 22,
  },
  section: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    background: "#fff",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionText: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
  btnPrimary: {
    width: "100%",
    padding: "13px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    background: "linear-gradient(135deg,#0f172a 0%,#1e40af 100%)",
    color: "white",
    boxShadow: "0 4px 18px rgba(15,23,42,0.22), 0 0 0 1px rgba(59,130,246,0.15)",
    letterSpacing: "0.2px",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  } as CSSProperties,
  btnDanger: {
    width: "100%",
    padding: "13px",
    borderRadius: 14,
    border: "1px solid rgba(220,38,38,0.15)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    background: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)",
    color: "white",
    letterSpacing: "0.2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as CSSProperties,
  btnOutline: {
    width: "100%",
    padding: "12px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    background: "white",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as CSSProperties,
};

function focusStyle(e: FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "#3b82f6";
  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
}

function blurStyle(e: FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "#e2e8f0";
  e.target.style.boxShadow = "none";
}

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

  const dispatchRefreshEvents = () => {
    window.dispatchEvent(new CustomEvent("newDebtAdded"));
    window.dispatchEvent(new CustomEvent("paymentMade"));
    window.dispatchEvent(new CustomEvent("debtDeleted"));
    window.dispatchEvent(new CustomEvent("clientDeleted"));
    window.dispatchEvent(new CustomEvent("factoryReset"));
    window.dispatchEvent(new CustomEvent("inventoryUpdated"));
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
      const resetTasks = await Promise.allSettled([
        (supabase as any).from("debt_payments").delete().neq("id", ""),
        (supabase as any).from("debt_items").delete().neq("id", ""),
        (supabase as any).from("sales").delete().neq("id", ""),
        (supabase as any).from("transactions").delete().neq("id", ""),
        (supabase as any).from("customers").delete().neq("id", ""),
        (supabase as any).from("inventory_items").delete().neq("id", ""),
        supabase
          .from("app_settings")
          .delete()
          .in("setting_key", [SETTING_KEYS.initialCapital, SETTING_KEYS.targetCapital]),
      ]);

      const failed = resetTasks.filter((result) => result.status === "rejected");

      if (failed.length > 0) {
        throw new Error("Some reset operations failed.");
      }

      setSettings((prev) => ({
        ...prev,
        initialCapital: 0,
        targetCapital: 0,
      }));

      dispatchRefreshEvents();
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
    return <div style={{ padding: 24 }}>{t("common.loading")}</div>;
  }

  if (!canUsePage) {
    return <div style={{ padding: 24 }}>{t("errors.loadFailed")}</div>;
  }

  if (!isOwner) {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(255,255,255,0.92)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={S.card}>
          <div style={S.logoWrap}>
            <img
              src={logo}
              alt={t("common.appName")}
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
          </div>

          <div style={S.appName}>{t("settings.title")}</div>
          <div style={S.subtitle}>{t("settings.ownerOnlySection")}</div>

          <div style={S.section}>
            <div style={S.sectionTitle}>
              <AlertTriangle size={15} color="#dc2626" />
              {t("settings.accessRestricted")}
            </div>
            <div style={S.sectionText}>{t("settings.employeeRestriction")}</div>
            <button type="button" style={S.btnOutline} onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={15} />
              {t("settings.backToDashboard")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} />
      <div style={S.blob2} />

      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "rgba(255,255,255,0.92)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <ArrowLeft size={18} />
      </button>

      <div style={S.card}>
        <div style={S.logoWrap}>
          <img
            src={logo}
            alt={t("common.appName")}
            style={{ width: 40, height: 40, objectFit: "contain" }}
          />
        </div>

        <div style={S.appName}>{t("settings.title")}</div>
        <div style={S.subtitle}>{t("settings.subtitle")}</div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <Crown size={15} color="#d97706" />
            {t("settings.businessSettings")}
          </div>
          <div style={S.sectionText}>{t("settings.subtitle")}</div>

          <label style={S.label}>{t("settings.businessName")}</label>
          <input
            value={settings.businessName}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                businessName: e.target.value,
              }))
            }
            placeholder={t("settings.businessName")}
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <div style={{ height: 10 }} />

          <label style={S.label}>{t("settings.initialCapital")}</label>
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
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <div style={{ height: 10 }} />

          <label style={S.label}>{t("settings.targetCapital")}</label>
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
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <button type="button" style={S.btnPrimary} onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? t("common.saving") : t("settings.saveSettings")}
          </button>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <Users size={15} color="#2563eb" />
            {t("settings.employeeManagement")}
          </div>
          <div style={S.sectionText}>{t("employees.subtitle")}</div>
          <button type="button" style={S.btnOutline} onClick={() => navigate("/employees")}>
            {t("settings.manageEmployees")}
          </button>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>🌐 {t("settings.language")}</div>
          <div style={S.sectionText}>{t("settings.chooseLanguage")}</div>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <div
          style={{
            ...S.section,
            border: "1px solid rgba(220,38,38,0.18)",
            background: "rgba(254,242,242,0.6)",
          }}
        >
          <div style={S.sectionTitle}>
            <AlertTriangle size={15} color="#dc2626" />
            {t("settings.dangerZone")}
          </div>
          <div style={S.sectionText}>{t("settings.factoryResetConfirm")}</div>

          <button type="button" style={S.btnDanger} onClick={handleFactoryReset} disabled={clearing}>
            <RotateCcw size={16} />
            {clearing ? t("common.loading") : t("settings.factoryReset")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;