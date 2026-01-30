import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate, smsTemplates } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Phone, 
  MessageCircle, 
  Check, 
  Search,
  Users
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  items: string;
  amount: number;
  due_date: string | null;
  is_paid: boolean;
  created_at: string;
}

const DebtsPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("is_paid", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      toast.error("Habaye ikosa mu gufata amakuru");
    } else {
      setCustomers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_blank');
  };

  const handleRemind = (customer: Customer) => {
    if (!customer.phone) {
      toast.error("Umukiriya nta numero afite");
      return;
    }
    const message = smsTemplates.debtReminder(customer.items, formatCurrency(customer.amount));
    const smsUrl = `sms:${customer.phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  };

  const handleMarkAsPaid = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ 
          is_paid: true, 
          paid_at: new Date().toISOString() 
        })
        .eq("id", customer.id);

      if (error) throw error;

      toast.success(labels.markedAsPaid + " ✨");
      
      // Offer to send thank you SMS
      if (customer.phone) {
        const message = smsTemplates.cashAcknowledgment();
        const smsUrl = `sms:${customer.phone}?body=${encodeURIComponent(message)}`;
        window.open(smsUrl, '_blank');
      }
      
      fetchCustomers();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Habaye ikosa");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.items.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const totalUnpaid = filteredCustomers.reduce((sum, c) => sum + Number(c.amount), 0);

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

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.search + "..."}
            className="pl-9 bg-white/70 input-glow"
          />
        </div>

        {/* Total Summary */}
        <div className="glass-card-dark p-4 flex items-center justify-between gold-glow">
          <div>
            <p className="text-xs text-primary-foreground/70">{labels.totalDebt}</p>
            <p className="text-xl font-bold text-primary-foreground">
              {formatCurrency(totalUnpaid)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Users size={16} />
            <span className="text-sm">{filteredCustomers.length}</span>
          </div>
        </div>

        {/* Customer List */}
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
            <Button
              onClick={() => navigate("/add-debt")}
              className="mt-4 btn-gold"
            >
              <Plus size={16} className="mr-2" />
              {labels.addNew}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer, index) => (
              <div
                key={customer.id}
                className="glass-card p-4 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Customer Info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{customer.name}</h3>
                    {customer.phone && (
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    )}
                  </div>
                  <p className="text-base font-bold text-destructive shrink-0">
                    {formatCurrency(customer.amount)}
                  </p>
                </div>

                {/* Items */}
                <div className="bg-muted/50 rounded-lg p-2 mb-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{labels.itemsTaken}</p>
                  <p className="text-sm">{customer.items}</p>
                </div>

                {/* Date */}
                {customer.due_date && (
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {labels.dueDate}: {formatDate(customer.due_date)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {customer.phone && (
                    <>
                      <Button
                        onClick={() => handleCall(customer.phone!)}
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs"
                      >
                        <Phone size={14} className="mr-1" />
                        {labels.call}
                      </Button>
                      <Button
                        onClick={() => handleRemind(customer)}
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs"
                      >
                        <MessageCircle size={14} className="mr-1" />
                        {labels.remind}
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => handleMarkAsPaid(customer)}
                    size="sm"
                    className="flex-1 h-9 text-xs btn-gold"
                  >
                    <Check size={14} className="mr-1" />
                    {labels.markAsPaid}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DebtsPage;
