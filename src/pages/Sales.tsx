import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ikiguzi {
  id: number;
  izina: string;
  amafaranga: number;
}

interface Sale {
  id: string;
  item_name: string;
  sale_price: number;
  quantity: number;
}

const BudgetPageDynamic = () => {
  const navigate = useNavigate();
  const [ibiguzi, setIbiguzi] = useState<Ikiguzi[]>([]);
  const [nextId, setNextId] = useState(1);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("id, item_name, sale_price, quantity");
      setSales(data || []);
      setLoading(false);
    };
    fetchSales();
  }, []);

  const totalIncome = sales.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);
  const totalExpenses = ibiguzi.reduce((sum, i) => sum + i.amafaranga, 0);
  const target = totalExpenses; // She needs to earn this much
  const saved = totalIncome - totalExpenses; // Money left after expenses
  const isWarning = saved < 0;

  const onAdd = () => {
    setIbiguzi([...ibiguzi, { id: nextId, izina: "", amafaranga: 0 }]);
    setNextId(nextId + 1);
  };

  const onUpdate = (id: number, field: keyof Ikiguzi, value: string | number) => {
    setIbiguzi(
      ibiguzi.map(i =>
        i.id === id ? { ...i, [field]: field === "amafaranga" ? parseFloat(value as string) || 0 : value } : i
      )
    );
  };

  const onRemove = (id: number) => setIbiguzi(ibiguzi.filter(i => i.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4 space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3 sticky top-0 bg-white/70 backdrop-blur-sm p-3 rounded-lg z-50">
        <button onClick={() => navigate("/dashboard")} className="w-10 h-10 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Umukoresha w’Ingengo y’Imari</h1>
      </header>

      {/* Target Income Card */}
      <div className={`glass-card p-4 rounded-xl space-y-2 animate-fade-in transition-all ${isWarning ? "ring-2 ring-red-500" : "ring-2 ring-green-500"}`}>
        <h2 className="font-semibold text-lg">Amafaranga ugomba kwinjiza uyu kwezi</h2>
        <p className="text-2xl font-bold text-center">
          {target.toLocaleString()} FRW
        </p>
        {isWarning && (
          <p className="text-red-600 font-semibold text-center animate-pulse">
            ⚠️ Ugomba gukora cyane! Amafaranga yinjijwe ntabwo ahagije.
          </p>
        )}
      </div>

      {/* Expenses Card */}
      <div className="glass-card p-4 rounded-xl space-y-3 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Ibiguzi by’ukwezi</h2>
          <Button size="sm" className="btn-gold flex items-center gap-1" onClick={onAdd}>
            <Plus size={14} /> Ongeraho
          </Button>
        </div>

        {ibiguzi.length === 0 && (
          <p className="text-muted-foreground text-sm italic">Nta bintu byateganyijwe.</p>
        )}

        {ibiguzi.map((i) => (
          <div key={i.id} className="flex gap-2 items-center bg-white/30 p-3 rounded-lg animate-slide-in">
            <Input
              placeholder="Izina ry’igiciro"
              value={i.izina}
              onChange={(e) => onUpdate(i.id, "izina", e.target.value)}
              className="flex-1 bg-white/50 input-glow"
            />
            <Input
              type="number"
              placeholder="Amafaranga"
              value={i.amafaranga}
              onChange={(e) => onUpdate(i.id, "amafaranga", e.target.value)}
              className="w-32 bg-white/50 input-glow font-semibold text-right"
            />
            <Button size="icon" variant="destructive" onClick={() => onRemove(i.id)}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}

        {/* Totals */}
        <div className="mt-4 border-t border-border/50 pt-2 space-y-1">
          <p className="text-lg flex justify-between font-semibold">
            <span>Ibiguzi byose:</span>
            <span>{totalExpenses.toLocaleString()} FRW</span>
          </p>
          <p className={`text-xl flex justify-between font-bold transition-all duration-500 ${saved < 0 ? "text-red-600 animate-pulse" : "text-green-600 animate-bounce"}`}>
            <span>Amafaranga yasigaye nyuma y'ibiguzi:</span>
            <span>{saved.toLocaleString()} FRW</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default BudgetPageDynamic;
