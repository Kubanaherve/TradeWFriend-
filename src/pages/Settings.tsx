import { useEffect, useMemo, useState, type CSSProperties, type FocusEvent } from "react";
import { ArrowLeft, Save, RotateCcw, AlertTriangle, Crown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    padding: "24px 16px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: "relative" as const,
    overflow: "hidden",
  },
  blob1: {
    position: "absolute" as const,
    top: -120,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  blob2: {
    position: "absolute" as const,
    bottom: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  card: {
    background: "white",
    borderRadius: 28,
    boxShadow:
      "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "32px 28px",
    width: "100%",
    maxWidth: 430,
    position: "relative" as const,
    zIndex: 1,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 32px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.2)",
  },
  appName: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center" as const,
    letterSpacing: "-0.5px",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center" as const,
    marginBottom: 28,
  },
  section: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    background: "#fff",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 14,
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
  btnPrimary: {
    width: "100%",
    padding: "14px",
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    background: "linear-gradient(135deg,#0f172a 0%,#1e40af 100%)",
    color: "white",
    boxShadow: "0 4px 20px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.15)",
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
    padding: "14px",
    borderRadius: 16,
    border: "1px solid rgba(220,38,38,0.15)",
    cursor: "pointer",
    fontSize: 15,
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
    padding: "13px",
    borderRadius: 16,
    border: "1.5px solid #e2e8f0",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    background: "white",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as CSSProperties,
};

function focusStyle(e: FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#3b82f6";
  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
}

function blurStyle(e: FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#e2e8f0";
  e.target.style.boxShadow = "none";
}

const Settings = () => {
  const navigate = useNavigate();
  const auth = useAuth();

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
        const { data: appSettings, error: appSettingsError } = await supabase
          .from("app_settings")
          .select("setting_key, setting_value")
          .in("setting_key", [SETTING_KEYS.initialCapital, SETTING_KEYS.targetCapital]);

        if (appSettingsError) throw appSettingsError;

        const map = new Map(
          (appSettings ?? []).map((row) => [row.setting_key, row.setting_value])
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
      toast.error("Only the owner can change business settings.");
      return;
    }

    if (!settings.businessName.trim()) {
      toast.error("Business name is required.");
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

      const { error: upsertError } = await supabase
        .from("app_settings")
        .upsert(settingsRows, {
          onConflict: "setting_key",
        });

      if (upsertError) throw upsertError;

      if (ownerIdentifier) {
        const { error: employeeUpdateError } = await supabase
          .from("employees")
          .update({
            business_name: settings.businessName.trim(),
          })
          .eq("created_by", ownerIdentifier);

        if (employeeUpdateError) throw employeeUpdateError;
      }

      await auth.refreshProfile();
      toast.success("Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!isOwner) {
      toast.error("Only the owner can reset the business.");
      return;
    }

    const confirmed = window.confirm(
      "This will clear settings and owner-linked records that can be safely reset with the current schema. Continue?"
    );
    if (!confirmed) return;

    setClearing(true);

    try {
      const tasks = await Promise.allSettled([
        supabase.from("app_settings").delete().in("setting_key", [
          SETTING_KEYS.initialCapital,
          SETTING_KEYS.targetCapital,
        ]),
        ownerIdentifier
          ? supabase.from("customers").delete().eq("added_by", ownerIdentifier)
          : Promise.resolve(null),
        ownerIdentifier
          ? supabase.from("transactions").delete().eq("created_by", ownerIdentifier)
          : Promise.resolve(null),
      ]);

      const failed = tasks.filter((result) => result.status === "rejected");

      if (failed.length > 0) {
        throw new Error("Some reset operations failed.");
      }

      setSettings((prev) => ({
        ...prev,
        initialCapital: 0,
        targetCapital: 0,
      }));

      toast.success("Factory reset completed.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Error during factory reset:", error);
      toast.error("Failed to reset business data.");
    } finally {
      setClearing(false);
    }
  };

  if (auth.isLoading || loading) {
    return <div style={{ padding: 24 }}>Loading settings...</div>;
  }

  if (!canUsePage) {
    return <div style={{ padding: 24 }}>Unable to load settings.</div>;
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
            top: 20,
            left: 20,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,0.9)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={S.card}>
          <div style={S.logoWrap}>
            <img
              src={logo}
              alt="TradeWFriend+"
              style={{ width: 42, height: 42, objectFit: "contain" }}
            />
          </div>

          <div style={S.appName}>Settings</div>
          <div style={S.subtitle}>This section is owner-only.</div>

          <div style={S.section}>
            <div style={S.sectionTitle}>
              <AlertTriangle size={16} color="#dc2626" />
              Access restricted
            </div>
            <div style={S.sectionText}>
              Employees should not control business settings, employee management, or factory reset.
            </div>
            <button type="button" style={S.btnOutline} onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={16} />
              Back to dashboard
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
          top: 20,
          left: 20,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,255,255,0.9)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <div style={S.card}>
        <div style={S.logoWrap}>
          <img
            src={logo}
            alt="TradeWFriend+"
            style={{ width: 42, height: 42, objectFit: "contain" }}
          />
        </div>

        <div style={S.appName}>Settings</div>
        <div style={S.subtitle}>Owner controls for your business</div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <Crown size={16} color="#d97706" />
            Business settings
          </div>
          <div style={S.sectionText}>
            Change the business name used for employees and the stored financial setting values.
          </div>

          <label style={S.label}>Business Name</label>
          <input
            value={settings.businessName}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                businessName: e.target.value,
              }))
            }
            placeholder="Enter your business name"
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>Initial Capital</label>
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

          <div style={{ height: 12 }} />

          <label style={S.label}>Target Capital</label>
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
            <Save size={18} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <Users size={16} color="#2563eb" />
            Employee management
          </div>
          <div style={S.sectionText}>
            Employee accounts should only be created and controlled under the owner account.
          </div>
          <button type="button" style={S.btnOutline} onClick={() => navigate("/employees")}>
            Manage Employees
          </button>
        </div>

        <div
          style={{
            ...S.section,
            border: "1px solid rgba(220,38,38,0.18)",
            background: "rgba(254,242,242,0.6)",
          }}
        >
          <div style={S.sectionTitle}>
            <AlertTriangle size={16} color="#dc2626" />
            Danger zone
          </div>
          <div style={S.sectionText}>
            This reset matches your current database structure. It clears saved financial settings and
            owner-linked customer and transaction records.
          </div>

          <button type="button" style={S.btnDanger} onClick={handleFactoryReset} disabled={clearing}>
            <RotateCcw size={18} />
            {clearing ? "Resetting..." : "Factory Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;