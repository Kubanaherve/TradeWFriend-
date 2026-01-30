import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { labels, formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  TrendingUp,
  DollarSign,
  Calendar,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Sale {
  id: string;
  item_name: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
  date_sold: string;
  created_at: string;
}

interface DaySummary {
  date: string;
  dayName: string;
  revenue: number;
  profit: number;
  salesCount: number;
  items: string[];
}

const DAYS_KIN = ["Ku cyumweru", "Ku wa mbere", "Ku wa kabiri", "Ku wa gatatu", "Ku wa kane", "Ku wa gatanu", "Ku wa gatandatu"];
const DAYS_SHORT = ["Cyu", "Mbe", "Kab", "Gat", "Kan", "Gat", "Gat"];

const SalesPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchSales = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("date_sold", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      toast.error("Habaye ikosa mu gufata amakuru");
    } else {
      setSales(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Calculate week dates based on offset
  const weekDates = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + (weekOffset * 7));
    
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekOffset]);

  // Filter sales for current week
  const weeklySales = useMemo(() => {
    const startDate = weekDates[0].toISOString().split('T')[0];
    const endDate = weekDates[6].toISOString().split('T')[0];
    
    return sales.filter(sale => {
      return sale.date_sold >= startDate && sale.date_sold <= endDate;
    });
  }, [sales, weekDates]);

  // Calculate daily summaries
  const dailySummaries = useMemo(() => {
    const summaries: DaySummary[] = weekDates.map((date, index) => {
      const dateStr = date.toISOString().split('T')[0];
      const daySales = weeklySales.filter(s => s.date_sold === dateStr);
      
      const revenue = daySales.reduce((sum, s) => sum + (Number(s.sale_price) * s.quantity), 0);
      const cost = daySales.reduce((sum, s) => sum + (Number(s.cost_price) * s.quantity), 0);
      
      return {
        date: dateStr,
        dayName: DAYS_KIN[index],
        revenue,
        profit: revenue - cost,
        salesCount: daySales.length,
        items: daySales.map(s => s.item_name)
      };
    });
    
    return summaries;
  }, [weeklySales, weekDates]);

  // Find highest sale day
  const highestDay = useMemo(() => {
    if (dailySummaries.every(d => d.revenue === 0)) return null;
    return dailySummaries.reduce((max, day) => day.revenue > max.revenue ? day : max, dailySummaries[0]);
  }, [dailySummaries]);

  // Weekly totals
  const weeklyTotals = useMemo(() => {
    const revenue = weeklySales.reduce((sum, s) => sum + (Number(s.sale_price) * s.quantity), 0);
    const cost = weeklySales.reduce((sum, s) => sum + (Number(s.cost_price) * s.quantity), 0);
    return {
      revenue,
      profit: revenue - cost,
      salesCount: weeklySales.length
    };
  }, [weeklySales]);

  // Max revenue for chart scaling
  const maxRevenue = useMemo(() => {
    return Math.max(...dailySummaries.map(d => d.revenue), 1);
  }, [dailySummaries]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (weekOffset === 0) return "Iki cyumweru";
    if (weekOffset === -1) return "Icyumweru gishize";
    return `${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`;
  }, [weekDates, weekOffset]);

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
            <h1 className="text-base font-bold">{labels.salesTracking}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setWeekOffset(w => w - 1)}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
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

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Week Label */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} />
          <span>{weekLabel}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Weekly Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="glass-card animate-fade-in">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                      <DollarSign size={16} className="text-secondary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Ibyagurishijwe</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(weeklyTotals.revenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {weeklyTotals.salesCount} transactions
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <TrendingUp size={16} className="text-green-600" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Inyungu</span>
                  </div>
                  <p className={`text-lg font-bold ${weeklyTotals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(weeklyTotals.profit)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Highest Day Card */}
            {highestDay && highestDay.revenue > 0 && (
              <Card className="glass-card border-2 border-amber-500/30 animate-fade-in" style={{ animationDelay: '0.2s' }}>
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
                    <div className="text-right">
                      <p className="font-bold text-xl text-amber-600">{formatCurrency(highestDay.revenue)}</p>
                      <p className="text-xs text-green-600">+{formatCurrency(highestDay.profit)} inyungu</p>
                    </div>
                  </div>
                  {highestDay.items.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 truncate">
                      Ibigurishijwe: {highestDay.items.slice(0, 3).join(", ")}{highestDay.items.length > 3 ? "..." : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Weekly Chart */}
            <Card className="glass-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
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
                    const isToday = day.date === new Date().toISOString().split('T')[0];
                    
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
                              isHighest ? 'bg-amber-500' : 
                              day.revenue > 0 ? 'bg-primary' : 'bg-muted'
                            }`}
                            style={{ height: `${Math.max(height, day.revenue > 0 ? 10 : 4)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                          {DAYS_SHORT[index]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-1">Urutonde rw'iminsi</h3>
              {dailySummaries.map((day, index) => (
                <div
                  key={day.date}
                  className={`glass-card p-3 animate-fade-in ${
                    day.salesCount === 0 ? 'opacity-50' : ''
                  }`}
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{day.dayName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(day.date)}</p>
                    </div>
                    <div className="text-right">
                      {day.salesCount > 0 ? (
                        <>
                          <p className="font-bold text-sm">{formatCurrency(day.revenue)}</p>
                          <p className={`text-[10px] ${day.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            +{formatCurrency(day.profit)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nta byagurishijwe</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {weeklySales.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  Nta byagurishijwe muri iki cyumweru
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SalesPage;
