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
  Users,
  Save,
  X
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [costPrice, setCostPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    // Use proper tel: protocol
    const cleanPhone = phone.replace(/\s/g, '');
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleRemind = (customer: Customer) => {
    if (!customer.phone) {
      toast.error("Umukiriya nta numero afite");
      return;
    }
    const message = smsTemplates.debtReminder(customer.items, formatCurrency(customer.amount));
    const cleanPhone = customer.phone.replace(/\s/g, '');
    // Use location.href for better mobile compatibility
    window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCostPrice("");
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedCustomer) return;
    
    if (!costPrice || parseFloat(costPrice) < 0) {
      toast.error("Andika igiciro cyo kugura (cost price)");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Mark customer as paid
      const { error: updateError } = await supabase
        .from("customers")
        .update({ 
          is_paid: true, 
          paid_at: new Date().toISOString() 
        })
        .eq("id", selectedCustomer.id);

      if (updateError) throw updateError;

      // 2. Add to sales table for profit tracking
      const { error: saleError } = await supabase
        .from("sales")
        .insert({
          item_name: selectedCustomer.items,
          cost_price: parseFloat(costPrice),
          sale_price: selectedCustomer.amount,
          quantity: 1,
          date_sold: new Date().toISOString().split('T')[0],
        });

      if (saleError) throw saleError;

      const profit = selectedCustomer.amount - parseFloat(costPrice);
      toast.success(`${labels.markedAsPaid} ✨ Inyungu: ${formatCurrency(profit)}`);
      
      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setCostPrice("");
      
      // Offer to send thank you SMS
      if (selectedCustomer.phone) {
        const message = smsTemplates.cashAcknowledgment();
        const cleanPhone = selectedCustomer.phone.replace(/\s/g, '');
        window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
      }
      
      fetchCustomers();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
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

      <main className="p-4 max-w-4xl mx-auto space-y-4">
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
            <Button
              onClick={() => navigate("/add-debt")}
              className="mt-4 btn-gold"
            >
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
                  <TableRow 
                    key={customer.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        )}
                        {customer.due_date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(customer.due_date)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{customer.items}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-bold text-destructive">
                        {formatCurrency(customer.amount)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {customer.phone && (
                          <>
                            <Button
                              onClick={() => handleCall(customer.phone!)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              title={labels.call}
                            >
                              <Phone size={14} />
                            </Button>
                            <Button
                              onClick={() => handleRemind(customer)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              title={labels.sendMessage}
                            >
                              <MessageCircle size={14} />
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={() => openPaymentModal(customer)}
                          size="icon"
                          className="h-8 w-8 btn-gold"
                          title={labels.markAsPaid}
                        >
                          <Check size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Payment Confirmation Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{labels.markAsPaid}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="glass-card p-3 bg-muted/30">
                <p className="font-semibold text-sm">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedCustomer.items}</p>
                <p className="text-lg font-bold text-primary mt-2">
                  {formatCurrency(selectedCustomer.amount)}
                </p>
              </div>

              {/* Cost Price Input */}
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  {labels.costPrice} (Igiciro cyo kugura) *
                </label>
                <Input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0"
                  className="bg-muted/50 input-glow text-lg"
                  inputMode="numeric"
                  autoFocus
                />
              </div>

              {/* Profit Preview */}
              {costPrice && (
                <div className={`text-center py-3 rounded-lg ${
                  selectedCustomer.amount - parseFloat(costPrice) >= 0 
                    ? 'bg-green-50 text-green-600' 
                    : 'bg-red-50 text-destructive'
                }`}>
                  <p className="text-xs">Inyungu (Profit):</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(selectedCustomer.amount - parseFloat(costPrice || "0"))}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowPaymentModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isSaving}
                >
                  <X size={16} className="mr-1" />
                  {labels.cancel}
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className="flex-1 btn-gold"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={16} className="mr-1" />
                      {labels.confirm}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtsPage;
