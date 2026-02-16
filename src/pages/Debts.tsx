import { useEffect, useState, useRef, useCallback } from "react";
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
  Users,
  Trash2,
} from "lucide-react";

interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  items: string | null;
  amount: number | null;
  due_date: string | null;
  is_paid: boolean;
  created_at: string;
}

const PAGE_SIZE = 50; // Fetch 50 customers per batch

const DebtsPage = () => {
  const navigate = useNavigate();

  // States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch customers from Supabase with pagination and search
  const fetchCustomers = useCallback(async (pageNumber = 1, query = "") => {
    setLoading(true);
    try {
      let supabaseQuery = supabase
        .from("customers")
        .select("id, name, phone, items, amount, due_date, is_paid, created_at")
        .eq("is_paid", false)
        .order("created_at", { ascending: false })
        .range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1);

      if (query) {
        // Simple server-side filtering using ilike (case-insensitive)
        supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);
      }

      const { data, error } = await supabaseQuery;

      if (error) throw error;

      const safeData = (data || []).map(c => ({
        id: c.id,
        name: c.name || "Unknown",
        phone: c.phone || null,
        items: c.items || "",
        amount: c.amount ?? 0,
        due_date: c.due_date || null,
        is_paid: c.is_paid,
        created_at: c.created_at,
      }));

      if (pageNumber === 1) setCustomers(safeData);
      else setCustomers(prev => [...prev, ...safeData]);

      setHasMore(safeData.length === PAGE_SIZE); // More pages if full batch
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Habaye ikosa mu gufata amakuru");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCustomers(1, searchQuery);
    setPage(1);
  }, [fetchCustomers, searchQuery]);

  // Infinite scroll
  const handleScroll = () => {
    if (!containerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) { // 100px from bottom
      fetchCustomers(page + 1, searchQuery);
      setPage(prev => prev + 1);
    }
  };

  // Actions
  const handleCall = (phone: string) => (window.location.href = `tel:${phone.replace(/\s/g, "")}`);
  const handleSMS = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    window.location.href = `sms:${customer.phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
  };
  const handleWhatsApp = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    let cleanPhone = customer.phone.replace(/\s/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "250" + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith("250") && !cleanPhone.startsWith("+")) cleanPhone = "250" + cleanPhone;
    cleanPhone = cleanPhone.replace("+", "");
    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    window.location.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const openPayment = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (paymentAmount: number, thankYouMessage: string) => {
    if (!selectedCustomer) return;
    try {
      const newAmount = (selectedCustomer.amount || 0) - paymentAmount;
      let finalMessage = thankYouMessage;

      if (newAmount <= 0) {
        const { error } = await supabase
          .from("customers")
          .update({ is_paid: true, paid_at: new Date().toISOString(), amount: 0 })
          .eq("id", selectedCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .update({ amount: newAmount, updated_at: new Date().toISOString() })
          .eq("id", selectedCustomer.id);
        if (error) throw error;
        finalMessage += `\n\nAmafaranga asigaye: ${formatCurrency(newAmount)}`;
      }

      toast.success("Byashyizweho neza! ✨");
      if (selectedCustomer.phone) {
        window.location.href = `sms:${selectedCustomer.phone.replace(/\s/g, "")}?body=${encodeURIComponent(finalMessage)}`;
      }
      setPaymentModalOpen(false);
      setSelectedCustomer(null);
      fetchCustomers(1, searchQuery);
      setPage(1);
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Habaye ikosa");
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`${labels.confirmDelete} ${customer.name}?`)) return;
    try {
      const { error } = await supabase.from("customers").delete().eq("id", customer.id);
      if (error) throw error;
      toast.success("Byasibwe neza");
      fetchCustomers(1, searchQuery);
      setPage(1);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Habaye ikosa");
    }
  };

  const totalUnpaid = customers.reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold">{labels.debtList}</h1>
          </div>
          <Button onClick={() => navigate("/add-debt")} size="sm" className="btn-navy h-8 px-3 text-xs">
            <Plus size={14} className="mr-1" />
            {labels.addNew}
          </Button>
        </div>
      </header>

      {/* Main List */}
      <main
        className="p-4 max-w-4xl mx-auto space-y-4 overflow-auto"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* Search */}
        <div className="relative mb-2">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={labels.search + "..."}
            className="pl-3 bg-white/70 input-glow"
          />
        </div>

        {/* Total */}
        <div className="glass-card-dark p-4 flex items-center justify-between gold-glow">
          <div>
            <p className="text-xs text-primary-foreground/70">{labels.totalDebt}</p>
            <p className="text-xl font-bold text-primary-foreground">{formatCurrency(totalUnpaid)}</p>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Users size={16} />
            <span className="text-sm">{customers.length}</span>
          </div>
        </div>

        {/* Customer List */}
        {customers.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{labels.noDebts}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map(customer => (
              <div
                key={customer.id}
                className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">{customer.name}</p>
                  <p className="font-semibold text-destructive">{formatCurrency(customer.amount)}</p>
                </div>
                {customer.items && <p className="text-xs text-muted-foreground truncate">{customer.items}</p>}
              </div>
            ))}
            {loading && <p className="text-center text-sm py-2">Loading...</p>}
          </div>
        )}
      </main>
{selectedCustomer && (
  <div className="fixed inset-0 bg-black/90 flex justify-center items-end sm:items-center p-4 z-50">
    <div className="bg-white/100 backdrop-blur-md rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-6 shadow-xl animate-fade-in max-h-[90vh] overflow-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold truncate">{selectedCustomer.name}</h2>
        <button
          onClick={() => setSelectedCustomer(null)}
          className="text-gray-700 hover:text-gray-900 text-2xl font-bold"
        >
          ✕
        </button>
      </div>

      {/* Customer Info */}
      <div className="text-center space-y-2 text-gray-700">
        {selectedCustomer.items && <p className="text-sm">Ibyo yafashe ni: {selectedCustomer.items}</p>}
        <p className="text-xl font-semibold text-gray-900">Amafaranga: {formatCurrency(selectedCustomer.amount)}</p>
        {selectedCustomer.due_date && <p className="text-sm">Itariki azishyura: {formatDate(selectedCustomer.due_date)}</p>}
        {selectedCustomer.phone && <p className="text-sm">Nimero: {selectedCustomer.phone}</p>}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        {selectedCustomer.phone && (
          <>
            {/* WhatsApp */}
            <button
              onClick={() => handleWhatsApp(selectedCustomer)}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 shadow-md hover:scale-110 transition-transform"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-500">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>

            {/* SMS */}
            <button
              onClick={() => handleSMS(selectedCustomer)}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 shadow-md hover:scale-110 transition-transform"
            >
              <MessageCircle size={28} className="text-blue-500"/>
            </button>

            {/* Call */}
            <button
              onClick={() => handleCall(selectedCustomer.phone!)}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 shadow-md hover:scale-110 transition-transform"
            >
              <Phone size={28} className="text-indigo-500"/>
            </button>
          </>
        )}

        {/* Mark as Paid */}
        <button
          onClick={() => openPayment(selectedCustomer)}
          className="flex items-center justify-center w-24 h-24 rounded-full bg-blue-700 shadow-xl hover:scale-110 transition-transform relative animate-pulse-slow"
          style={{
            boxShadow: "0 0 20px #00f6ff, 0 0 40px #00cfff, 0 0 60px #00b8ff"
          }}
        >
          <Check size={36} className="text-white"/>
        </button>

        {/* Delete */}
        <button
          onClick={() => handleDelete(selectedCustomer)}
          className="flex items-center justify-center w-20 h-20 rounded-full bg-red-600 shadow-xl hover:scale-110 transition-transform animate-pulse-slow"
          style={{
            boxShadow: "0 0 20px #ff4c4c, 0 0 40px #ff2a2a"
          }}
        >
          <Trash2 size={36} className="text-white"/>
        </button>
      </div>
    </div>
  </div>
)}

      {/* Payment Modal */}
      {selectedCustomer && paymentModalOpen && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onConfirm={handlePayment}
          customerName={selectedCustomer.name!}
          totalAmount={selectedCustomer.amount!}
        />
      )}
    </div>
  );
};

export default DebtsPage;
