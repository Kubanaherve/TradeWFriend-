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
  Package,
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
import { ChangePinCard } from "@/components/ChangePinCard";

interface DashboardStats {
  totalUnpaid: number;
  totalCustomers: number;
  totalSales: number;
  totalCapital: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { profile, logout, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    totalUnpaid: 0,
    totalCustomers: 0,
    totalSales: 0,
    totalCapital: 0,
  });

  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showResetMoneyModal, setShowResetMoneyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  const [capitalInput, setCapitalInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingMoney, setIsResettingMoney] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);

  const fetchStats = async () => {
    // Unpaid debts
    const { data: customers } = await supabase.from("customers").select("amount, is_paid");
    const unpaid = customers?.filter(c => !c.is_paid).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
    const totalCustomers = customers?.filter(c => !c.is_paid).length || 0;

    // Total paid
    const { data: totalPaidSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "total_paid")
      .maybeSingle();
    const totalPaid = totalPaidSetting ? parseFloat(totalPaidSetting.setting_value) : 0;

    // Capital
    const { data: capitalSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "total_capital")
      .maybeSingle();
    const capital = capitalSetting ? parseFloat(capitalSetting.setting_value) : 0;

    setStats({ totalUnpaid: unpaid, totalCustomers, totalSales: totalPaid, totalCapital: capital });
    setCapitalInput(capital.toString());
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated, authLoading, navigate]);

  const handleSaveCapital = async () => {
    if (!capitalInput || parseFloat(capitalInput) < 0) {
      toast.error("Andika amafaranga meza");
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", "total_capital")
        .maybeSingle();

      if (existing) {
        await supabase.from("app_settings").update({ setting_value: capitalInput }).eq("setting_key", "total_capital");
      } else {
        await supabase.from("app_settings").insert({ setting_key: "total_capital", setting_value: capitalInput });
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

  const handleResetMoney = async () => {
    setIsResettingMoney(true);
    try {
      // Reset capital
      await supabase.from("app_settings").update({ setting_value: "0" }).eq("setting_key", "total_capital");
      // Reset total paid
      await supabase.from("app_settings").update({ setting_value: "0" }).eq("setting_key", "total_paid");

      toast.success("Amafaranga yose yinjijwe yasubijwe kuri 0 ✨");
      setShowResetMoneyModal(false);
      fetchStats();
    } catch (error) {
      console.error("Reset money error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsResettingMoney(false);
    }
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      // Delete all sales (revenue records)
      await supabase.from("sales").delete();
      // Reset capital & total paid
      await supabase.from("app_settings").update({ setting_value: "0" }).in("setting_key", ["total_capital", "total_paid"]);
      // Reset paid status on customers
      await supabase.from("customers").update({ is_paid: false, paid_at: null }).eq("is_paid", true);

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

  const handleFactoryReset = async () => {
    setIsFactoryResetting(true);
    try {
      // Delete settings and sales only; keep customers, debts, inventory
      await supabase.from("sales").delete();
      await supabase.from("app_settings").update({ setting_value: "0" }).in("setting_key", ["total_capital", "total_paid"]);

      toast.success("Database yasubijwe ku ntangiriro, abakiriya, debts n'ibicuruzwa byabitswe ✨");
      setShowFactoryResetModal(false);
      fetchStats();
    } catch (error) {
      console.error("Factory reset error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsFactoryResetting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const totalProfit = stats.totalSales - stats.totalCapital;

  const menuItems = [
    { icon: Plus, label: labels.addDebt, path: "/add-debt", bgClass: "bg-gradient-to-br from-primary to-navy-light", description: "Ongeraho umukiriya" },
    { icon: List, label: labels.debtList, path: "/debts", bgClass: "bg-gradient-to-br from-secondary to-gold-light", textDark: true, description: "Reba abakiriya bose" },
    { icon: TrendingUp, label: labels.salesTracking, path: "/sales", bgClass: "bg-gradient-to-br from-navy-light to-primary", description: "Kurikiranira ibigurishwa" },
    { icon: Package, label: labels.inventoryTitle, path: "/inventory", bgClass: "bg-gradient-to-br from-gold-light to-secondary", textDark: true, description: labels.inventorySubtitle },
    { icon: Users, label: "Abakiriya", path: "/clients", bgClass: "bg-gradient-to-br from-emerald-500 to-teal-600", description: "Amakuru y'abakiriya" },
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
                {labels.welcome}, {profile?.display_name || 'User'}! 💎
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/install")} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors" title="Install App">
              <Download size={16} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} /> {labels.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-8 space-y-6 max-w-lg mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Unpaid */}
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center"><DollarSign size={16} className="text-destructive" /></div>
              <span className="text-[10px] text-muted-foreground">{labels.totalUnpaid}</span>
            </div>
            <p className="text-lg font-bold text-destructive">{formatCurrency(stats.totalUnpaid)}</p>
          </div>

          {/* Total Customers */}
          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Users size={16} className="text-primary" /></div>
              <span className="text-[10px] text-muted-foreground">{labels.customers}</span>
            </div>
            <p className="text-lg font-bold text-primary">{stats.totalCustomers}</p>
          </div>
        </div>

        {/* Capital Card */}
        <div className="glass-card p-4 animate-fade-in cursor-pointer hover:scale-[1.02] transition-transform" style={{ animationDelay: '0.15s' }} onClick={() => setShowCapitalModal(true)}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><DollarSign size={16} className="text-orange-600" /></div>
              <span className="text-[10px] text-muted-foreground">Capital (Ibyo waguzemo)</span>
            </div>
            <Edit3 size={14} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalCapital)}</p>
        </div>

        {/* Total Sales Card */}
        <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp size={16} className="text-blue-600" /></div>
            <span className="text-[10px] text-muted-foreground">{labels.totalSales}</span>
          </div>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalSales)}</p>
        </div>

        {/* Profit Card */}
        <div className="glass-card-dark p-4 animate-fade-in gold-glow col-span-2" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70">{labels.totalProfit}</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totalProfit)}</p>
              <p className="text-[10px] text-primary-foreground/50 mt-1">= {labels.totalSales} - Capital</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center"><Gem size={24} className="text-secondary" /></div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3">
          {menuItems.map((item, index) => (
            <button key={item.path + index} onClick={() => navigate(item.path)} className={`${item.bgClass} p-4 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-premium active:scale-[0.98] animate-fade-in`} style={{ animationDelay: `${0.3 + index * 0.1}s` }}>
              <div className={`w-10 h-10 rounded-xl ${item.textDark ? 'bg-foreground/10' : 'bg-white/20'} flex items-center justify-center mb-3`}>
                <item.icon size={20} className={item.textDark ? 'text-foreground' : 'text-white'} />
              </div>
              <h3 className={`text-sm font-semibold mb-1 ${item.textDark ? 'text-foreground' : 'text-white'}`}>{item.label}</h3>
              <p className={`text-[10px] ${item.textDark ? 'text-foreground/60' : 'text-white/70'}`}>{item.description}</p>
            </button>
          ))}
        </div>

        {/* Settings Section */}
        <div className="pt-4 space-y-3">
          <ChangePinCard />

          {/* Reset Money Entered */}
          <Button onClick={() => setShowResetMoneyModal(true)} variant="outline" className="w-full border-warning/50 text-warning hover:bg-warning/10">
            <DollarSign size={16} className="mr-2" /> Siba amafaranga yinjijwe (Reset Money)
          </Button>

          {/* Reset All / Restock */}
          <Button onClick={() => setShowResetModal(true)} variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
            <Trash2 size={16} className="mr-2" /> {labels.resetAll} (Restock)
          </Button>

          {/* Factory Reset */}
          <Button onClick={() => setShowFactoryResetModal(true)} variant="destructive" className="w-full">
            <AlertTriangle size={16} className="mr-2" /> Factory Reset (Siba Byose)
          </Button>
        </div>
      </main>

      {/* --- Capital Modal --- */}
      <Dialog open={showCapitalModal} onOpenChange={setShowCapitalModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Hindura Capital</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Amafaranga yose waguzemo bijoux (Total Capital)</label>
              <Input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)} placeholder="0" className="bg-muted/50 input-glow text-lg" inputMode="numeric" autoFocus />
              <p className="text-[10px] text-muted-foreground mt-1.5">Andika amafaranga yose waguze isaha, bijoux, n'ibindi byose ugurisha</p>
            </div>

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

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowCapitalModal(false)} variant="outline" className="flex-1" disabled={isSaving}>
                <X size={16} className="mr-1" /> {labels.cancel}
              </Button>
              <Button onClick={handleSaveCapital} className="flex-1 btn-gold" disabled={isSaving}>
                {isSaving ? <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <><Save size={16} className="mr-1" />{labels.save}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Reset Money Modal --- */}
      <Dialog open={showResetMoneyModal} onOpenChange={setShowResetMoneyModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-warning">
              <DollarSign size={20} /> Siba Amafaranga Yinjijwe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ibi bizasubiza kuri 0 amafaranga yose yinjijwe (sales & capital), ariko abakiriya, debts n'ibicuruzwa bizakomeza.</p>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowResetMoneyModal(false)} variant="outline" className="flex-1" disabled={isResettingMoney}><X size={16} className="mr-1" />Ongeraho</Button>
              <Button onClick={handleResetMoney} variant="destructive" className="flex-1" disabled={isResettingMoney}>
                {isResettingMoney ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Siba Amafaranga"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Reset All Modal --- */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle size={20} />{labels.resetAll}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{labels.confirmResetAll}</p>
            <div className="glass-card p-3 bg-destructive/10 text-sm space-y-1">
              <p>• Sales (amafaranga yinjijwe) azasubira kuri 0</p>
              <p>• Capital izasubira kuri 0</p>
              <p>• Abakiriya bazagaruka mu badeni (unpaid)</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowResetModal(false)} variant="outline" className="flex-1" disabled={isResetting}><X size={16} className="mr-1" />{labels.cancel}</Button>
              <Button onClick={handleResetAll} variant="destructive" className="flex-1" disabled={isResetting}>
                {isResetting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Trash2 size={16} className="mr-1" />{labels.confirm}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Factory Reset Modal --- */}
      <Dialog open={showFactoryResetModal} onOpenChange={setShowFactoryResetModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle size={20} /> Factory Reset - Siba Byose!</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ibi bizasiba settings n'amafaranga yose yinjijwe. Abakiriya, debts n'ibicuruzwa byabitswe ntabwo bizasibwa.</p>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowFactoryResetModal(false)} variant="outline" className="flex-1" disabled={isFactoryResetting}><X size={16} className="mr-1" />{labels.cancel}</Button>
              <Button onClick={handleFactoryReset} variant="destructive" className="flex-1" disabled={isFactoryResetting}>
                {isFactoryResetting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Reset Settings & Money"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
