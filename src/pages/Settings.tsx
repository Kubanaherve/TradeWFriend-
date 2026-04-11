import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, AlertCircle, Gem } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

/* ─── Styles ───────────────────────────────────────────── */
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
    boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "32px 28px",
    width: "100%",
    maxWidth: 380,
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
  btn: {
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
  },
  neonLine: {
    height: 2,
    borderRadius: 99,
    background: "linear-gradient(90deg,transparent,#3b82f6,#06b6d4,transparent)",
    margin: "20px 0",
    opacity: 0.5,
  },
};

interface BusinessSettings {
  businessName: string;
  initialCapital: number;
  targetCapital?: number;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "My Business",
  initialCapital: 0,
  targetCapital: 0,
};

export const Settings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem("tradewfriend_business_settings");
        if (stored) {
          setSettings(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem(
        "tradewfriend_business_settings",
        JSON.stringify(settings)
      );
      
      // Also save to Supabase app_settings for persistence
      try {
        const appSettings = [
          { setting_key: "business_name", setting_value: settings.businessName },
          { setting_key: "initial_capital", setting_value: settings.initialCapital.toString() },
          { setting_key: "target_capital", setting_value: (settings.targetCapital || 0).toString() },
        ];

        const { data: existingRows, error: existingError } = await supabase
          .from("app_settings")
          .select("id, setting_key")
          .in("setting_key", appSettings.map((item) => item.setting_key));

        if (existingError) {
          throw existingError;
        }

        const existingKeys = new Set((existingRows || []).map((row) => row.setting_key));

        await Promise.all(
          appSettings.map(async (item) => {
            if (existingKeys.has(item.setting_key)) {
              await supabase
                .from("app_settings")
                .update({ setting_value: item.setting_value })
                .eq("setting_key", item.setting_key);
            } else {
              await supabase.from("app_settings").insert(item);
            }
          })
        );
      } catch (dbError) {
        console.error("Error saving to database:", dbError);
        // Continue - localStorage save was successful
      }

      toast.success("Settings saved successfully! ✨");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    try {
      setClearing(true);

      await supabase.from("customers").delete();
      await supabase.from("sales").delete();
      await supabase.from("inventory_items").delete();
      await supabase.from("app_settings").delete();
      await supabase.from("profiles").delete();

      localStorage.clear();

      toast.success("Factory reset complete! The app is now empty and ready to start fresh. ✨");

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (error) {
      console.error("Error during factory reset:", error);
      toast.error("Failed to reset data");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} />
      <div style={S.blob2} />

      {/* Back Button */}
      <button
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
        <ArrowLeft size={20} style={{ color: "#64748b" }} />
      </button>

      <div style={S.card}>
        <div style={S.logoWrap}>
          <img src={logo} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        </div>
        <h1 style={S.appName}>Settings</h1>
        <p style={S.subtitle}>
          <Gem size={16} />
          Configure your business
        </p>

        <div className="space-y-6">
          {/* Business Name */}
          <div>
            <label style={S.label}>Business Name</label>
            <input
              style={S.input}
              type="text"
              value={settings.businessName}
              onChange={(e) =>
                setSettings({ ...settings, businessName: e.target.value })
              }
              placeholder="Enter your business name"
            />
          </div>

          {/* Initial Capital */}
          <div>
            <label style={S.label}>Initial Capital</label>
            <input
              style={S.input}
              type="number"
              value={settings.initialCapital}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  initialCapital: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0"
            />
          </div>

          {/* Target Capital */}
          <div>
            <label style={S.label}>Target Capital</label>
            <input
              style={S.input}
              type="number"
              value={settings.targetCapital || 0}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  targetCapital: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0"
            />
          </div>

          <button
            style={S.btn}
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div style={S.neonLine} />

        {/* Danger Zone */}
        <div className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                style={{ ...S.btn, background: "linear-gradient(135deg,#dc2626,#b91c1c)", marginTop: 0 }}
              >
                <RotateCcw size={16} />
                Factory Reset
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFactoryReset}
                style={{ background: "#dc2626" }}
              >
                {clearing ? "Clearing..." : "Reset"}
              </AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default Settings;
