import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { labels, formatCurrency } from "@/lib/kinyarwanda";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  List, 
  TrendingUp, 
  DollarSign, 
  LogOut, 
  Gem,
  Users,
  Edit3,
  Save,
  X,
  Download,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface DashboardStats {
  totalUnpaid: number;
  totalCustomers: number;
  totalSales: number;
  totalCapital: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUnpaid: 0,
    totalCustomers: 0,
    totalSales: 0,
    totalCapital: 0,
  });
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [capitalInput, setCapitalInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchStats = async () => {
    // Get unpaid debts
    const { data: customers } = await supabase
      .from("customers")
      .select("amount, is_paid");
    
    const unpaid = customers?.filter(c => !c.is_paid).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
    const totalCustomers = customers?.filter(c => !c.is_paid).length || 0;

    // Get total sales (money received when customers pay)
    const paidCustomers = customers?.filter(c => c.is_paid).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

    // Get capital from settings
    const { data: capitalSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "total_capital")
      .maybeSingle();

    const capital = capitalSetting ? parseFloat(capitalSetting.setting_value) : 0;

    setStats({
      totalUnpaid: unpaid,
      totalCustomers,
      totalSales: paidCustomers,
      totalCapital: capital,
    });
    setCapitalInput(capital.toString());
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }
    fetchStats();
  }, [isAuthenticated, navigate]);

  const handleSaveCapital = async () => {
    if (!capitalInput || parseFloat(capitalInput) < 0) {
      toast.error("Andika amafaranga meza");
      return;
    }

    setIsSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", "total_capital")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("app_settings")
          .update({ setting_value: capitalInput })
          .eq("setting_key", "total_capital");
      } else {
        await supabase
          .from("app_settings")
          .insert({ setting_key: "total_capital", setting_value: capitalInput });
      }

      toast.success("Capital yahinduwe neza ✨");
      setShowCapitalModal(false);
      fetchStats();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      // Delete all sales (revenue records)
      await supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Reset capital to 0
      await supabase
        .from("app_settings")
        .update({ setting_value: "0" })
        .eq("setting_key", "total_capital");
      // Reset paid status on customers (mark all as unpaid again for new cycle)
      await supabase
        .from("customers")
        .update({ is_paid: false, paid_at: null })
        .eq("is_paid", true);

      toast.success(labels.resetSuccess + " ✨");
      setShowResetModal(false);
      fetchStats();
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsResetting(false);
    }
  };

  // Calculate profit = Total Sales - Capital
  const totalProfit = stats.totalSales - stats.totalCapital;

  const menuItems = [
    {
      icon: Plus,
      label: labels.addDebt,
      path: "/add-debt",
      bgClass: "bg-gradient-to-br from-primary to-navy-light",
      description: "Ongeraho umukiriya",
    },
    {
      icon: List,
      label: labels.debtList,
      path: "/debts",
      bgClass: "bg-gradient-to-br from-secondary to-gold-light",
      textDark: true,
      description: "Reba abakiriya bose",
    },
    {
      icon: TrendingUp,
      label: labels.salesTracking,
      path: "/sales",
      bgClass: "bg-gradient-to-br from-navy-light to-primary",
      description: "Kurikiranira ibigurishwa",
    },
    {
      icon: DollarSign,
      label: labels.profitRevenue,
      path: "/sales",
      bgClass: "bg-gradient-to-br from-gold-light to-secondary",
      textDark: true,
      description: "Inyungu n'amafaranga",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-foreground">{labels.appName}</h1>
              <p className="text-[10px] text-muted-foreground">
                {labels.welcome}, {user === 'mom' ? 'Mama' : 'Papa'}! 💎
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/install")}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title="Install App"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut size={16} />
              {labels.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-8 space-y-6 max-w-lg mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <DollarSign size={16} className="text-destructive" />
              </div>
              <span className="text-[10px] text-muted-foreground">{labels.totalUnpaid}</span>
            </div>
            <p className="text-lg font-bold text-destructive">
              {formatCurrency(stats.totalUnpaid)}
            </p>
          </div>

          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users size={16} className="text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground">{labels.customers}</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {stats.totalCustomers}
            </p>
          </div>
        </div>

        {/* Capital Card */}
        <div 
          className="glass-card p-4 animate-fade-in cursor-pointer hover:scale-[1.02] transition-transform" 
          style={{ animationDelay: '0.15s' }}
          onClick={() => setShowCapitalModal(true)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <DollarSign size={16} className="text-orange-600" />
              </div>
              <span className="text-[10px] text-muted-foreground">Capital (Ibyo waguzemo)</span>
            </div>
            <Edit3 size={14} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold text-orange-600">
            {formatCurrency(stats.totalCapital)}
          </p>
        </div>

        {/* Total Sales Card */}
        <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] text-muted-foreground">{labels.totalSales}</span>
          </div>
          <p className="text-lg font-bold text-blue-600">
            {formatCurrency(stats.totalSales)}
          </p>
        </div>

        {/* Profit Card */}
        <div className="glass-card-dark p-4 animate-fade-in gold-glow col-span-2" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70">{labels.totalProfit}</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalProfit)}
              </p>
              <p className="text-[10px] text-primary-foreground/50 mt-1">
                = {labels.totalSales} - Capital
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Gem size={24} className="text-secondary" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3">
          {menuItems.map((item, index) => (
            <button
              key={item.path + index}
              onClick={() => navigate(item.path)}
              className={`${item.bgClass} p-4 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-premium active:scale-[0.98] animate-fade-in`}
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <div className={`w-10 h-10 rounded-xl ${item.textDark ? 'bg-foreground/10' : 'bg-white/20'} flex items-center justify-center mb-3`}>
                <item.icon size={20} className={item.textDark ? 'text-foreground' : 'text-white'} />
              </div>
              <h3 className={`text-sm font-semibold mb-1 ${item.textDark ? 'text-foreground' : 'text-white'}`}>
                {item.label}
              </h3>
              <p className={`text-[10px] ${item.textDark ? 'text-foreground/60' : 'text-white/70'}`}>
                {item.description}
              </p>
            </button>
        ))}
        </div>

        {/* Reset All Button */}
        <div className="pt-4">
          <Button
            onClick={() => setShowResetModal(true)}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={16} className="mr-2" />
            {labels.resetAll} (Restock)
          </Button>
        </div>
      </main>

      {/* Capital Edit Modal */}
      <Dialog open={showCapitalModal} onOpenChange={setShowCapitalModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Hindura Capital</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                Amafaranga yose waguzemo bijoux (Total Capital)
              </label>
              <Input
                type="number"
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                placeholder="0"
                className="bg-muted/50 input-glow text-lg"
                inputMode="numeric"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Andika amafaranga yose waguze isaha, bijoux, n'ibindi byose ugurisha
              </p>
            </div>

            {/* Preview */}
            {capitalInput && (
              <div className="glass-card p-3 bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Capital:</span>
                  <span className="font-medium">{formatCurrency(parseFloat(capitalInput || "0"))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{labels.totalSales}:</span>
                  <span className="font-medium">{formatCurrency(stats.totalSales)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{labels.totalProfit}:</span>
                  <span className={`font-bold ${stats.totalSales - parseFloat(capitalInput || "0") >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(stats.totalSales - parseFloat(capitalInput || "0"))}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowCapitalModal(false)}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <X size={16} className="mr-1" />
                {labels.cancel}
              </Button>
              <Button
                onClick={handleSaveCapital}
                className="flex-1 btn-gold"
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={16} className="mr-1" />
                    {labels.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset All Confirmation Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              {labels.resetAll}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {labels.confirmResetAll}
            </p>
            <div className="glass-card p-3 bg-destructive/10 text-sm space-y-1">
              <p>• Sales (amafaranga yinjijwe) azasubira kuri 0</p>
              <p>• Capital izasubira kuri 0</p>
              <p>• Abakiriya bazagaruka mu badeni (unpaid)</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowResetModal(false)}
                variant="outline"
                className="flex-1"
                disabled={isResetting}
              >
                <X size={16} className="mr-1" />
                {labels.cancel}
              </Button>
              <Button
                onClick={handleResetAll}
                variant="destructive"
                className="flex-1"
                disabled={isResetting}
              >
                {isResetting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={16} className="mr-1" />
                    {labels.confirm}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
