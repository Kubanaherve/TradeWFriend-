import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Sale = {
  sale_price: number | null;
  quantity: number | null;
  created_at: string;
};

type Debt = {
  amount: number | null;
  is_paid: boolean | null;
  paid_at: string | null;
};

const formatCurrency = (amount: number) =>
  `FRW ${amount.toLocaleString()}`;

export default function ReportsPage() {
  const navigate = useNavigate();

  const [todayTotal, setTodayTotal] = useState(0);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);

  const [weekTotal, setWeekTotal] = useState(0);
  const [lastWeekTotal, setLastWeekTotal] = useState(0);

  const [monthTotal, setMonthTotal] = useState(0);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);

  const [todayClients, setTodayClients] = useState(0);
  const [yesterdayClients, setYesterdayClients] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const now = new Date();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const { data: salesData } = await supabase
      .from("sales")
      .select("sale_price, quantity, created_at");

    const { data: debtsData } = await supabase
      .from("customers")
      .select("amount, is_paid, paid_at");

    const sales: Sale[] = salesData || [];
    const debts: Debt[] = debtsData || [];

    const transactions = [
      ...sales.map((s) => ({
        amount:
          (Number(s.sale_price) || 0) *
          (Number(s.quantity) || 0),
        date: new Date(s.created_at),
      })),
      ...debts
        .filter((d) => d.is_paid && d.paid_at)
        .map((d) => ({
          amount: Number(d.amount) || 0,
          date: new Date(d.paid_at as string),
        })),
    ];

    const sumBetween = (start: Date, end?: Date) =>
      transactions
        .filter((t) =>
          end
            ? t.date.getTime() >= start.getTime() &&
              t.date.getTime() < end.getTime()
            : t.date.getTime() >= start.getTime()
        )
        .reduce((sum, t) => sum + t.amount, 0);

    setTodayTotal(sumBetween(today));
    setYesterdayTotal(sumBetween(yesterday, today));

    setWeekTotal(sumBetween(weekStart));
    setLastWeekTotal(sumBetween(lastWeekStart, weekStart));

    setMonthTotal(sumBetween(monthStart));
    setLastMonthTotal(sumBetween(lastMonthStart, monthStart));

    const todaySales = sales.filter(
      (s) =>
        new Date(s.created_at).getTime() >= today.getTime()
    );

    const yesterdaySales = sales.filter((s) => {
      const time = new Date(s.created_at).getTime();
      return (
        time >= yesterday.getTime() &&
        time < today.getTime()
      );
    });

    setTodayClients(todaySales.length);
    setYesterdayClients(yesterdaySales.length);
  };

  const buildMessage = (current: number, previous: number) => {
    if (current > previous) {
      return {
        text: "Wiyongereye ugereranyije n’ejo 👏",
        color: "text-emerald-600",
        bg: "bg-emerald-100",
      };
    }
    if (current < previous) {
      return {
        text: "Wagabanyutse ugereranyije n’ejo ⚠️",
        color: "text-red-600",
        bg: "bg-red-100",
      };
    }
    return {
      text: "Nta mpinduka zabaye",
      color: "text-gray-500",
      bg: "bg-gray-100",
    };
  };

  const Card = ({
    title,
    value,
    previous,
    isMoney = true,
    index,
  }: {
    title: string;
    value: number;
    previous: number;
    isMoney?: boolean;
    index: number;
  }) => {
    const result = buildMessage(value, previous);

    return (
      <div
        className="rounded-3xl p-5 bg-white shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.97]"
        style={{
          animation: `fadeUp 0.4s ease ${index * 0.1}s both`,
        }}
      >
        <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">
          {title}
        </p>

        <p className="text-3xl font-extrabold text-gray-900 mt-2">
          {isMoney ? formatCurrency(value) : value}
        </p>

        <div
          className={`mt-3 text-xs font-semibold px-3 py-1.5 rounded-full inline-block ${result.bg} ${result.color}`}
        >
          {result.text}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5">
      <div className="max-w-md mx-auto space-y-6">

        {/* Back Button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
        >
          🔙 Subira kuri Dashboard
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-gray-900">
            Raporo y’Ubucuruzi
          </h1>
          <p className="text-sm text-gray-500">
            Reba uko amafaranga winjije ahagaze
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4">

          <Card
            title="Amafaranga Uyu Munsi"
            value={todayTotal}
            previous={yesterdayTotal}
            index={0}
          />

          <Card
            title="Amafaranga Iki Cyumweru"
            value={weekTotal}
            previous={lastWeekTotal}
            index={1}
          />

          <Card
            title="Amafaranga Uku Kwezi"
            value={monthTotal}
            previous={lastMonthTotal}
            index={2}
          />

          <Card
            title="Abakiriya Uyu Munsi"
            value={todayClients}
            previous={yesterdayClients}
            isMoney={false}
            index={3}
          />

        </div>
      </div>

      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(15px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}
