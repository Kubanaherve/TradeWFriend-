import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  X, 
  TrendingUp,
  DollarSign,
  Package
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Sale {
  id: string;
  item_name: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
  date_sold: string;
  created_at: string;
}

interface SaleForm {
  itemName: string;
  costPrice: string;
  salePrice: string;
  quantity: string;
  dateSold: string;
}

const SalesPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [form, setForm] = useState<SaleForm>({
    itemName: "",
    costPrice: "",
    salePrice: "",
    quantity: "1",
    dateSold: new Date().toISOString().split('T')[0],
  });

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

  const handleSaveSale = async () => {
    if (!form.itemName.trim() || !form.costPrice || !form.salePrice) {
      toast.error("Uzuza ibisabwa byose");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("sales").insert({
        item_name: form.itemName.trim(),
        cost_price: parseFloat(form.costPrice),
        sale_price: parseFloat(form.salePrice),
        quantity: parseInt(form.quantity) || 1,
        date_sold: form.dateSold,
      });

      if (error) throw error;

      toast.success(labels.saleSavedSuccess + " ✨");
      setShowAddModal(false);
      setForm({
        itemName: "",
        costPrice: "",
        salePrice: "",
        quantity: "1",
        dateSold: new Date().toISOString().split('T')[0],
      });
      fetchSales();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals
  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.sale_price) * s.quantity), 0);
  const totalCost = sales.reduce((sum, s) => sum + (Number(s.cost_price) * s.quantity), 0);
  const totalProfit = totalRevenue - totalCost;

  const profit = parseFloat(form.salePrice || "0") - parseFloat(form.costPrice || "0");

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
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="btn-navy h-8 px-3 text-xs"
          >
            <Plus size={14} className="mr-1" />
            {labels.addNew}
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                <DollarSign size={16} className="text-secondary" />
              </div>
              <span className="text-[10px] text-muted-foreground">{labels.totalSales}</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(totalRevenue)}
            </p>
          </div>

          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <span className="text-[10px] text-muted-foreground">{labels.totalProfit}</span>
            </div>
            <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
        </div>

        {/* Sales List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Package size={32} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{labels.noSales}</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="mt-4 btn-gold"
            >
              <Plus size={16} className="mr-2" />
              {labels.addNew}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale, index) => {
              const saleProfit = (Number(sale.sale_price) - Number(sale.cost_price)) * sale.quantity;
              return (
                <div
                  key={sale.id}
                  className="glass-card p-4 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{sale.item_name}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(sale.date_sold)} • {labels.quantity}: {sale.quantity}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(Number(sale.sale_price) * sale.quantity)}</p>
                      <p className={`text-xs ${saleProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        +{formatCurrency(saleProfit)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 text-[10px] text-muted-foreground">
                    <span>{labels.costPrice}: {formatCurrency(sale.cost_price)}</span>
                    <span>{labels.salePrice}: {formatCurrency(sale.sale_price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Sale Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{labels.addNew}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Item Name */}
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {labels.itemName} *
              </label>
              <Input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="Impeta, imiringa..."
                className="bg-muted/50 input-glow"
              />
            </div>

            {/* Prices Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.costPrice} *
                </label>
                <Input
                  type="number"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  placeholder="0"
                  className="bg-muted/50 input-glow"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.salePrice} *
                </label>
                <Input
                  type="number"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  placeholder="0"
                  className="bg-muted/50 input-glow"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Profit Preview */}
            {form.costPrice && form.salePrice && (
              <div className={`text-center py-2 rounded-lg ${profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-destructive'}`}>
                <p className="text-xs">Inyungu: <span className="font-bold">{formatCurrency(profit)}</span></p>
              </div>
            )}

            {/* Quantity & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.quantity}
                </label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  min="1"
                  className="bg-muted/50 input-glow"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.dateSold}
                </label>
                <Input
                  type="date"
                  value={form.dateSold}
                  onChange={(e) => setForm({ ...form, dateSold: e.target.value })}
                  className="bg-muted/50 input-glow"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <X size={16} className="mr-1" />
                {labels.cancel}
              </Button>
              <Button
                onClick={handleSaveSale}
                className="flex-1 btn-navy"
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
    </div>
  );
};

export default SalesPage;
