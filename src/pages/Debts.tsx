import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate, smsTemplates } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PaymentModal from "@/components/PaymentModal";
import {
  ArrowLeft,
  Plus,
  Phone,
  MessageCircle,
  Check,
  Search,
  Users,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* =======================
   Types
======================= */

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  items: string;
  amount: number;
  due_date: string | null;
  created_at: string;
}

/* =======================
   Constants (IMPORTANT)
======================= */

const PAGE_SIZE = 20; // SAFE for Android WebView
const MAX_RENDER_ROWS = 40; // HARD UI LIMIT

/* =======================
   Component
======================= */

const DebtsPage = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  /* =======================
     Fetch (Paginated)
  ======================= */

  const fetchCustomers = async (reset = false) => {
    if (loadingMore) return;

    setLoadingMore(true);
    if (reset) {
      setCustomers([]);
      setPage(0);
      setHasMore(true);
    }

    const from = reset ? 0 : page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, items, amount, due_date, created_at")
        .eq("is_paid", false)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const safeData: Customer[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name || "Unknown",
        phone: c.phone || null,
        items: c.items || "",
        amount: Number(c.amount) || 0,
        due_date: c.due_date || null,
        created_at: c.created_at,
      }));

      setCustomers((prev) =>
        reset ? safeData : [...prev, ...safeData]
      );

      if (!data || data.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setPage((p) => p + 1);
      }
    } catch (err) {
      console.error(err);
      toast.error("Habaye ikosa mu gufata amakuru");
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCustomers(true);
  }, []);

  /* =======================
     Actions
  ======================= */

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  };

  const handleSMS = (c: Customer) => {
    if (!c.phone) return toast.error("Umukiriya nta numero afite");
    const msg = smsTemplates.debtReminder(c.items, formatCurrency(c.amount));
    window.location.href = `sms:${c.phone.replace(/\s/g, "")}?body=${encodeURIComponent(msg)}`;
  };

  const handleWhatsApp = (c: Customer) => {
    if (!c.phone) return toast.error("Umukiriya nta numero afite");
    let phone = c.phone.replace(/\s/g, "");
    if (phone.startsWith("0")) phone = "250" + phone.slice(1);
    if (!phone.startsWith("250")) phone = "250" + phone;
    const msg = smsTemplates.debtReminder(c.items, formatCurrency(c.amount));
    window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handlePayment = async (paid: number, message: string) => {
    if (!selectedCustomer) return;

    try {
      const remaining = selectedCustomer.amount - paid;

      if (remaining <= 0) {
        await supabase
          .from("customers")
          .update({ is_paid: true, amount: 0 })
          .eq("id", selectedCustomer.id);
      } else {
        await supabase
          .from("customers")
          .update({ amount: remaining })
          .eq("id", selectedCustomer.id);
      }

      toast.success("Byakunze ✨");
      setPaymentModalOpen(false);
      setSelectedCustomer(null);
      fetchCustomers(true);
    } catch (e) {
      console.error(e);
      toast.error("Habaye ikosa");
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`${labels.confirmDelete} ${c.name}?`)) return;
    await supabase.from("customers").delete().eq("id", c.id);
    fetchCustomers(true);
  };

  /* =======================
     Filtering (Memoized)
  ======================= */

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.items.toLowerCase().includes(q) ||
          (c.phone || "").includes(searchQuery)
      )
      .slice(0, MAX_RENDER_ROWS); // HARD UI CAP
  }, [customers, searchQuery]);

  const totalUnpaid = useMemo(
    () => filtered.reduce((s, c) => s + c.amount, 0),
    [filtered]
  );

  /* =======================
     Render
  ======================= */

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b p-3 flex justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="font-bold">{labels.debtList}</h1>
        </div>
        <Button size="sm" onClick={() => navigate("/add-debt")}>
          <Plus size={14} className="mr-1" /> {labels.addNew}
        </Button>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Input
          placeholder={labels.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="flex justify-between items-center p-3 bg-muted rounded">
          <div>
            <p className="text-xs">{labels.totalDebt}</p>
            <p className="font-bold">{formatCurrency(totalUnpaid)}</p>
          </div>
          <Users size={18} />
        </div>

        {isLoading ? (
          <p className="text-center">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.customerName}</TableHead>
                <TableHead>{labels.itemsTaken}</TableHead>
                <TableHead className="text-right">{labels.amount}</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.items}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      {c.phone && (
                        <>
                          <Button size="icon" variant="outline" onClick={() => handleCall(c.phone!)}>
                            <Phone size={14} />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => handleSMS(c)}>
                            <MessageCircle size={14} />
                          </Button>
                        </>
                      )}
                      <Button size="icon" onClick={() => { setSelectedCustomer(c); setPaymentModalOpen(true); }}>
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => handleDelete(c)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {hasMore && (
          <Button
            className="w-full"
            disabled={loadingMore}
            onClick={() => fetchCustomers()}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        )}

        {selectedCustomer && (
          <PaymentModal
            isOpen={paymentModalOpen}
            onClose={() => setSelectedCustomer(null)}
            onConfirm={handlePayment}
            customerName={selectedCustomer.name}
            totalAmount={selectedCustomer.amount}
          />
        )}
      </main>
    </div>
  );
};

export default DebtsPage;
