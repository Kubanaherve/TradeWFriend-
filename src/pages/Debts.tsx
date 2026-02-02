import { useEffect, useState } from "react";
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
  Trash2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const DebtsPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Fetch customers
  const fetchCustomers = async (searchQuery = "") => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("customers")
        .select("id, name, phone, items, amount, due_date, is_paid, created_at")
        .eq("is_paid", false)
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,items.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Ensure all fields have safe defaults
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

      setCustomers(safeData);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Habaye ikosa mu gufata amakuru");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Actions
  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/\s/g, '');
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleSMS = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    window.location.href = `sms:${customer.phone.replace(/\s/g, '')}?body=${encodeURIComponent(message)}`;
  };

  const handleWhatsApp = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    const message = smsTemplates.debtReminder(customer.items!, formatCurrency(customer.amount!));
    let cleanPhone = customer.phone.replace(/\s/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '250' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('250') && !cleanPhone.startsWith('+')) cleanPhone = '250' + cleanPhone;
    cleanPhone = cleanPhone.replace('+', '');
    window.location.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  const sendThankYouSMS = (phone: string, message: string) => {
    window.location.href = `sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(message)}`;
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
        finalMessage = `${thankYouMessage}\n\nAmafaranga asigaye: ${formatCurrency(newAmount)}`;
      }

      // Update cumulative paid amount in app_settings
      const { data: currentTotalPaid } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "total_paid")
        .maybeSingle();

      const currentPaid = currentTotalPaid ? parseFloat(currentTotalPaid.setting_value) : 0;
      const newTotalPaid = currentPaid + paymentAmount;

      if (currentTotalPaid) {
        await supabase
          .from("app_settings")
          .update({ setting_value: newTotalPaid.toString() })
          .eq("setting_key", "total_paid");
      } else {
        await supabase
          .from("app_settings")
          .insert({ setting_key: "total_paid", setting_value: newTotalPaid.toString() });
      }

      toast.success("Byashyizweho neza! ✨");
      const customerPhone = selectedCustomer.phone;
      setSelectedCustomer(null);
      setPaymentModalOpen(false);
      fetchCustomers();
      if (customerPhone) sendThankYouSMS(customerPhone, finalMessage);
      else toast.info("Umukiriya nta numero afite - SMS ntiyoherejwe");
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
      fetchCustomers();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Habaye ikosa");
    }
  };

  // Filter and calculate totals
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.items || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(searchQuery)
    );
  });

  const totalUnpaid = filteredCustomers.reduce((sum, c) => sum + (c.amount || 0), 0);

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

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={labels.search + "..."} className="pl-9 bg-white/70 input-glow" />
        </div>

        {/* Total Summary */}
        <div className="glass-card-dark p-4 flex items-center justify-between gold-glow">
          <div>
            <p className="text-xs text-primary-foreground/70">{labels.totalDebt}</p>
            <p className="text-xl font-bold text-primary-foreground">{formatCurrency(totalUnpaid)}</p>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Users size={16} />
            <span className="text-sm">{filteredCustomers.length}</span>
          </div>
        </div>

        {/* Customer Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Users size={32} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{labels.noDebts}</p>
            <Button onClick={() => navigate("/add-debt")} className="mt-4 btn-gold">
              <Plus size={16} className="mr-2" />
              {labels.addNew}
            </Button>
          </div>
        ) : (
          <div className="glass-card p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">{labels.customerName}</TableHead>
                  <TableHead className="font-semibold">{labels.itemsTaken}</TableHead>
                  <TableHead className="font-semibold text-right">{labels.amount}</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, index) => (
                  <TableRow key={customer.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                        {customer.due_date && <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(customer.due_date)}</p>}
                      </div>
                    </TableCell>
                    <TableCell><p className="text-sm line-clamp-2">{customer.items}</p></TableCell>
                    <TableCell className="text-right"><p className="font-bold text-destructive">{formatCurrency(customer.amount)}</p></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {customer.phone && (
                          <>
                            <Button onClick={() => handleCall(customer.phone!)} size="icon" variant="outline" className="h-8 w-8" title={labels.call}><Phone size={14} /></Button>
                            <Button onClick={() => handleSMS(customer)} size="icon" variant="outline" className="h-8 w-8" title="SMS"><MessageCircle size={14} /></Button>
                            <Button onClick={() => handleWhatsApp(customer)} size="icon" variant="outline" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="WhatsApp">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </Button>
                          </>
                        )}
                        <Button onClick={() => openPaymentModal(customer)} size="icon" className="h-8 w-8 btn-gold" title={labels.markAsPaid}><Check size={14} /></Button>
                        <Button onClick={() => handleDelete(customer)} size="icon" variant="outline" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title={labels.delete}><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Payment Modal */}
        {selectedCustomer && (
          <PaymentModal
            isOpen={paymentModalOpen}
            onClose={() => { setPaymentModalOpen(false); setSelectedCustomer(null); }}
            onConfirm={handlePayment}
            customerName={selectedCustomer.name!}
            totalAmount={selectedCustomer.amount!}
          />
        )}
      </main>
    </div>
  );
};

export default DebtsPage;
