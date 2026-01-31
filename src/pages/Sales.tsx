import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  Award, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  Wallet, 
  Save 
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Sale {
  id: string;
  item_name: string;
  sale_price: number;
  quantity: number;
  date_sold: string;
}

interface DaySummary {
  date: string;
  dayName: string;
  revenue: number;
  balance: number | null;
  salesCount: number;
}

const DAYS_KIN = ["Ku cyumweru", "Ku wa mbere", "Ku wa kabiri", "Ku wa gatatu", "Ku wa kane", "Ku wa gatanu", "Ku wa gatandatu"];
const DAYS_SHORT = ["Cyu", "Mbe", "Kab", "Gat", "Kan", "Gat", "Gat"];

const SalesPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState("");

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch sales
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id, item_name, sale_price, quantity, date_sold")
      .order("date_sold", { ascending: false });

    if (salesError) {
      console.error("Fetch sales error:", salesError);
      toast.error("Habaye ikosa mu gufata amakuru");
    } else {
      setSales(salesData || []);
    }

    // Fetch daily balances from app_settings
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "balance_%");

    if (settingsData) {
      const balanceMap: Record<string, number> = {};
      settingsData.forEach(s => {
        const date = s.setting_key.replace("balance_", "");
        balanceMap[date] = parseFloat(s.setting_value) || 0;
      });
      setBalances(balanceMap);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const weekDates = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + weekOffset * 7);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekOffset]);

  const weeklySales = useMemo(() => {
    const startDate = weekDates[0].toISOString().split("T")[0];
    const endDate = weekDates[6].toISOString().split("T")[0];
    return sales.filter(sale => sale.date_sold >= startDate && sale.date_sold <= endDate);
  }, [sales, weekDates]);

  const dailySummaries = useMemo(() => {
    return weekDates.map((date, index) => {
      const dateStr = date.toISOString().split("T")[0];
      const daySales = weeklySales.filter(s => s.date_sold === dateStr);
      const revenue = daySales.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);

      return {
        date: dateStr,
        dayName: DAYS_KIN[index],
        revenue,
        balance: balances[dateStr] ?? null,
        salesCount: daySales.length
      };
    });
  }, [weeklySales, weekDates, balances]);

  const highestDay = useMemo(() => {
    if (dailySummaries.every(d => d.revenue === 0)) return null;
    return dailySummaries.reduce((max, day) => (day.revenue > max.revenue ? day : max), dailySummaries[0]);
  }, [dailySummaries]);

  const weeklyTotals = useMemo(() => {
    const revenue = weeklySales.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);
    const totalBalance = dailySummaries.reduce((sum, d) => sum + (d.balance || 0), 0);
    const daysWithBalance = dailySummaries.filter(d => d.balance !== null).length;

    return {
      revenue,
      totalBalance,
      salesCount: weeklySales.length,
      daysWithBalance
    };
  }, [weeklySales, dailySummaries]);

  const maxRevenue = useMemo(() => {
    return Math.max(...dailySummaries.map(d => d.revenue), 1);
  }, [dailySummaries]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "Iki cyumweru";
    if (weekOffset === -1) return "Icyumweru gishize";
    return `${formatDate(weekDates[0].toISOString())} - ${formatDate(weekDates[6].toISOString())}`;
  }, [weekDates, weekOffset]);

  const saveBalance = async (date: string) => {
    const amount = parseFloat(balanceInput);
    if (isNaN(amount) || amount < 0) {
      toast.error("Shyiramo umubare w'amafaranga");
      return;
    }

    const key = `balance_${date}`;

    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("setting_key", key)
      .maybeSingle();

    let error;
    if (existing) {
      const result = await supabase
        .from("app_settings")
        .update({ setting_value: amount.toString() })
        .eq("setting_key", key);
      error = result.error;
    } else {
      const result = await supabase
        .from("app_settings")
        .insert({ setting_key: key, setting_value: amount.toString() });
      error = result.error;
    }

    if (error) {
      toast.error("Habaye ikosa");
      console.error(error);
    } else {
      toast.success("Byashyizweho!");
      setBalances(prev => ({ ...prev, [date]: amount }));
      setEditingBalance(null);
      setBalanceInput("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold">Amafaranga y'icyumweru</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button onClick={() => setWeekOffset(w => w - 1)} size="icon" variant="ghost" className="h-8 w-8">
              <ChevronLeft size={18} />
            </Button>
            <Button
              onClick={() => setWeekOffset(w => w + 1)}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={weekOffset >= 0}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Week Label */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} />
          <span>{weekLabel}</span>
        </div>

        {/* Loading / content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Weekly Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Revenue card */}
              <Card className="glass-card animate-fade-in">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                      <DollarSign size={16} className="text-secondary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Amafaranga yinjiye</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(weeklyTotals.revenue)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{weeklyTotals.salesCount} ibyagurishijwe</p>
                </CardContent>
              </Card>

              {/* Balance card */}
              <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Wallet size={16} className="text-green-600" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Amafaranga asigaye</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(weeklyTotals.totalBalance)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{weeklyTotals.daysWithBalance} iminsi yanditswe</p>
                </CardContent>
              </Card>
            </div>

            {/* Highest Day Card */}
            {highestDay && highestDay.revenue > 0 && (
              <Card className="glass-card border-2 border-amber-500/30 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award size={16} className="text-amber-500" />
                    Umunsi wasize ugurishije cyane
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{highestDay.dayName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(highestDay.date)}</p>
                    </div>
                    <p className="font-bold text-xl text-amber-600">{formatCurrency(highestDay.revenue)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Chart */}
            <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" />
                  Igishushanyo cy'icyumweru
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-end justify-between gap-1 h-32">
                  {dailySummaries.map((day, index) => {
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    const isHighest = highestDay && day.date === highestDay.date && day.revenue > 0;
                    const isToday = day.date === new Date().toISOString().split("T")[0];

                    return (
                      <div key={day.date} className="flex flex-col items-center flex-1 gap-1">
                        <div className="w-full flex flex-col items-center justify-end h-24">
                          {day.revenue > 0 && (
                            <span className="text-[8px] text-muted-foreground mb-1">
                              {formatCurrency(day.revenue).replace(" RWF", "")}
                            </span>
                          )}
                          <div
                            className={`w-full rounded-t-md transition-all duration-300 ${
                              isHighest ? "bg-amber-500" : day.revenue > 0 ? "bg-primary" : "bg-muted"
                            }`}
                            style={{ height: `${Math.max(height, day.revenue > 0 ? 10 : 4)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                          {DAYS_SHORT[index]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown with Balance Entry */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-1">Urutonde rw'iminsi - Andika amafaranga asigaye</h3>
              {dailySummaries.map((day, index) => {
                const isEditing = editingBalance === day.date;
                const isToday = day.date === new Date().toISOString().split("T")[0];

                return (
                  <div key={day.date} className={`glass-card p-3 animate-fade-in ${isToday ? "border-primary/50" : ""}`} style={{ animationDelay: `${0.4 + index * 0.05}s` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{day.dayName}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(day.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-secondary">{formatCurrency(day.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground">yinjiye</p>
                      </div>
                    </div>

                    {/* Balance Entry */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Wallet size={14} className="text-green-600" />
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="number"
                            value={balanceInput}
                            onChange={e => setBalanceInput(e.target.value)}
                            placeholder="Amafaranga asigaye..."
                            className="h-8 text-sm flex-1"
                            autoFocus
                          />
                          <Button size="icon" className="h-8 w-8" onClick={() => saveBalance(day.date)}>
                            <Save size={14} />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingBalance(day.date);
                            setBalanceInput(day.balance?.toString() || "");
                          }}
                          className="flex items-center justify-between flex-1 text-left"
                        >
                          <span className="text-xs text-muted-foreground">Asigaye:</span>
                          {day.balance !== null ? (
                            <span className="font-bold text-green-600">{formatCurrency(day.balance)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Kanda wandike...</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {weeklySales.length === 0 && (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">Nta byagurishijwe muri iki cyumweru</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SalesPage;
