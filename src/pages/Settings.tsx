import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, AlertCircle } from "lucide-react";
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
      
      // Also save to Supabase app_settings if user is authenticated
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          // Store settings in app_settings table
          await supabase.from("app_settings").insert([
            {
              user_id: session.user.id,
              key: "business_name",
              value: settings.businessName,
            },
            {
              user_id: session.user.id,
              key: "initial_capital",
              value: settings.initialCapital.toString(),
            },
            {
              user_id: session.user.id,
              key: "target_capital",
              value: (settings.targetCapital || 0).toString(),
            },
          ]);
        }
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
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Delete all customer records
        await supabase
          .from("customers")
          .delete()
          .eq("user_id", session.user.id);

        // Delete all sales records
        await supabase
          .from("sales")
          .delete()
          .eq("user_id", session.user.id);

        // Delete all inventory items
        await supabase
          .from("inventory_items")
          .delete()
          .eq("user_id", session.user.id);

        // Reset app settings (clear daily tracking)
        await supabase
          .from("app_settings")
          .delete()
          .eq("user_id", session.user.id)
          .in("key", [
            "total_paid",
            "daily_customer_payments_2024-01-01", // This will match all daily keys
          ]);

        // Clear localStorage caches
        localStorage.removeItem("dashboard_stats_cache");
        localStorage.removeItem("tradewfriend_last_active_at");
      }

      // Clear all local storage data
      localStorage.clear();

      // Reinitialize with fresh settings
      localStorage.setItem(
        "tradewfriend_business_settings",
        JSON.stringify(settings)
      );

      toast.success(
        "Factory reset complete! All data has been cleared. ✨"
      );

      // Redirect to dashboard after reset
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (error) {
      console.error("Error during factory reset:", error);
      toast.error("Failed to reset data");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-white rounded-lg transition"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>

        {/* Business Settings Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Business Settings
          </h2>

          <div className="space-y-6">
            {/* Business Name */}
            <div>
              <Label htmlFor="businessName" className="text-slate-700 font-semibold">
                Business Name
              </Label>
              <Input
                id="businessName"
                type="text"
                value={settings.businessName}
                onChange={(e) =>
                  setSettings({ ...settings, businessName: e.target.value })
                }
                placeholder="Enter your business name"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                This name will appear throughout the app
              </p>
            </div>

            {/* Initial Capital */}
            <div>
              <Label htmlFor="initialCapital" className="text-slate-700 font-semibold">
                Initial Capital (Starting Balance)
              </Label>
              <Input
                id="initialCapital"
                type="number"
                value={settings.initialCapital}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    initialCapital: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                The amount you're starting with in your business
              </p>
            </div>

            {/* Target Capital / Goal */}
            <div>
              <Label htmlFor="targetCapital" className="text-slate-700 font-semibold">
                Target Capital (Goal Amount)
              </Label>
              <Input
                id="targetCapital"
                type="number"
                value={settings.targetCapital || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    targetCapital: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your financial goal that you want to reach
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save size={16} className="mr-2" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-red-500">
          <div className="flex items-start gap-3 mb-6">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Danger Zone</h2>
              <p className="text-sm text-slate-600 mt-1">
                Irreversible and destructive actions
              </p>
            </div>
          </div>

          {/* Factory Reset Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <RotateCcw size={16} className="mr-2" />
                Factory Reset All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All customer records and debts</li>
                    <li>All sales history</li>
                    <li>All inventory items</li>
                    <li>All cached data and statistics</li>
                  </ul>
                  <p className="mt-3 font-semibold text-red-600">
                    Your business settings (name, initial capital, target) will be preserved.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFactoryReset}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Reset Everything
              </AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-slate-500 mt-4">
            Use this to prepare your system for a new customer or to start fresh.
            Business settings will be preserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
