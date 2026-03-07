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

  // Detect if device is mobile
  const isMobileDevice = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const canSendSMS = () => {
    if (!isMobileDevice()) {
      toast.error("SMS ntishobora koherezwa kuri desktop, gerageza kuri telefone.");
      return false;
    }
    return true;
  };

  const canSendWhatsApp = () => {
    if (!isMobileDevice()) {
      toast.error("WhatsApp ntishobora koherezwa kuri desktop, gerageza kuri telefone.");
      return false;
    }
    return true;
  };

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

      setHasMore(safeData.length === PAGE_SIZE);
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
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchCustomers(page + 1, searchQuery);
      setPage(prev => prev + 1);
    }
  };

  // Actions
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  };

  const handleSMS = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    if (!canSendSMS()) return;

    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    window.location.href = `sms:${customer.phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
  };

  const handleWhatsApp = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    if (!canSendWhatsApp()) return;

    let cleanPhone = customer.phone.replace(/\s/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "250" + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith("250") && !cleanPhone.startsWith("+")) cleanPhone = "250" + cleanPhone;
    cleanPhone = cleanPhone.replace("+", "");

    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    window.location.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const openPayment = (customer: Customer) => {
    // Warn if messages might fail
    if (!customer.phone) {
      toast.warning("Ntushobora kohereza ubutumwa kuri uyu mukiriya mbere yo kwishyura.");
    } else if (!isMobileDevice()) {
      toast.warning("Kohereza ubutumwa kuri telefoni birakenewe mbere yo kwishyura. Gerageza kuri telefone.");
    }
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (paymentAmount: number, thankYouMessage: string) => {
    if (!selectedCustomer) return;

    try {
      const newAmount = (selectedCustomer.amount || 0) - paymentAmount;
      let finalMessage = thankYouMessage;

      // Update total_paid
      const { data: totalPaidSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "total_paid")
        .maybeSingle();

      const currentTotalPaid = totalPaidSetting ? parseFloat(totalPaidSetting.setting_value) : 0;
      const updatedTotalPaid = currentTotalPaid + paymentAmount;

      if (totalPaidSetting) {
        await supabase
          .from("app_settings")
          .update({ setting_value: updatedTotalPaid.toString() })
          .eq("setting_key", "total_paid");
      } else {
        await supabase
          .from("app_settings")
          .insert({ setting_key: "total_paid", setting_value: updatedTotalPaid.toString() });
      }

      // Update customer debt
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

      setPaymentModalOpen(false);
      fetchCustomers(1, searchQuery);
      setPage(1);
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Habaye ikosa mu kwishyura");
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`${labels.confirmDelete} ${customer.name}?`)) return;

    try {
      const itemsArray: { name: string; quantity: number }[] = customer.items
        ? JSON.parse(customer.items)
        : [];

      // Restore inventory
      for (const item of itemsArray) {
        const { data: inventoryItem } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("item_name", item.name)
          .maybeSingle();

        const currentQty = inventoryItem ? inventoryItem.quantity : 0;

        await supabase
          .from("inventory_items")
          .update({ quantity: currentQty + item.quantity })
          .eq("item_name", item.name);
      }

      // Delete customer
      const { error } = await supabase.from("customers").delete().eq("id", customer.id);
      if (error) throw error;

      toast.success("Byasibwe neza kandi inventory yongerewe");
      setSelectedCustomer(null);
      fetchCustomers(1, searchQuery);
      setPage(1);
      window.dispatchEvent(new CustomEvent("inventoryUpdated"));
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
            <button
              onClick={() => navigate("/dashboard")}
              className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold">{labels.debtList}</h1>
          </div>
          <Button
            onClick={() => navigate("/add-debt")}
            size="sm"
            className="btn-navy h-8 px-3 text-xs"
          >
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

      {/* Selected Customer Modal */}
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
                  <button
                    onClick={() => handleWhatsApp(selectedCustomer)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 shadow-md hover:scale-110 transition-transform"
                  >
                    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-500">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-...z"/>
                    </svg>
                  </button>

                  <button
                    onClick={() => handleSMS(selectedCustomer)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 shadow-md hover:scale-110 transition-transform"
                  >
                    <MessageCircle size={28} className="text-blue-500"/>
                  </button>

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