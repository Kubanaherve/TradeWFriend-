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
  Users
} from "lucide-react";
import logo from "@/assets/logo.png";

interface DashboardStats {
  totalUnpaid: number;
  totalCustomers: number;
  totalProfit: number;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUnpaid: 0,
    totalCustomers: 0,
    totalProfit: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    const fetchStats = async () => {
      // Get unpaid debts
      const { data: customers } = await supabase
        .from("customers")
        .select("amount, is_paid");
      
      const unpaid = customers?.filter(c => !c.is_paid).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const totalCustomers = customers?.filter(c => !c.is_paid).length || 0;

      // Get profit from sales
      const { data: sales } = await supabase
        .from("sales")
        .select("cost_price, sale_price, quantity");
      
      const profit = sales?.reduce((sum, s) => 
        sum + ((Number(s.sale_price) - Number(s.cost_price)) * s.quantity), 0) || 0;

      setStats({
        totalUnpaid: unpaid,
        totalCustomers,
        totalProfit: profit,
      });
    };

    fetchStats();
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={16} />
            {labels.logout}
          </button>
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

        {/* Profit Card */}
        <div className="glass-card-dark p-4 animate-fade-in gold-glow" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70">{labels.totalProfit}</p>
              <p className="text-2xl font-bold text-primary-foreground">
                {formatCurrency(stats.totalProfit)}
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
      </main>
    </div>
  );
};

export default DashboardPage;
