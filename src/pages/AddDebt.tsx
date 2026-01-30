import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { labels, smsTemplates, formatCurrency } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, X, Phone, MessageCircle } from "lucide-react";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { useCustomerSuggestions } from "@/hooks/useCustomerSuggestions";

const AddDebtPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const { customers } = useCustomerSuggestions();
  
  const [form, setForm] = useState({
    name: "",
    phone: "",
    items: "",
    amount: "",
    dueDate: new Date().toISOString().split('T')[0],
    isPaid: false,
  });

  const handleCustomerSelect = (customer: { name: string; phone: string | null }) => {
    setForm(prev => ({
      ...prev,
      name: customer.name,
      phone: customer.phone || "",
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.items.trim() || !form.amount) {
      toast.error("Uzuza ibisabwa byose");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("customers").insert({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        items: form.items.trim(),
        amount: parseFloat(form.amount),
        due_date: form.dueDate,
        is_paid: form.isPaid,
        paid_at: form.isPaid ? new Date().toISOString() : null,
      });

      if (error) throw error;

      toast.success(labels.debtSavedSuccess + " ✨");
      
      // Show SMS preview if phone number provided and not paid
      if (form.phone && !form.isPaid) {
        setShowSmsPreview(true);
      } else {
        navigate("/debts");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa. Ongera ugerageze.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSms = () => {
    const message = smsTemplates.debtConfirmation(form.items, formatCurrency(parseFloat(form.amount)));
    // Use proper SMS intent for mobile
    const phone = form.phone.replace(/\s/g, '');
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    setTimeout(() => navigate("/debts"), 500);
  };

  const handleSkipSms = () => {
    navigate("/debts");
  };

  if (showSmsPreview) {
    const message = smsTemplates.debtConfirmation(form.items, formatCurrency(parseFloat(form.amount)));
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
        <div className="max-w-lg mx-auto pt-8">
          <div className="glass-card animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageCircle size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{labels.sendMessage}</h2>
                <p className="text-xs text-muted-foreground">SMS ya {form.name}</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-6">
              <p className="text-sm leading-relaxed">{message}</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSkipSms}
                variant="outline"
                className="flex-1"
              >
                {labels.cancel}
              </Button>
              <Button
                onClick={handleSendSms}
                className="flex-1 btn-navy"
              >
                <Phone size={16} className="mr-2" />
                {labels.sendMessage}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold">{labels.addDebt}</h1>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="glass-card animate-fade-in space-y-4">
          {/* Customer Name with Autocomplete */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.customerName} *
            </label>
            <CustomerAutocomplete
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              onSelect={handleCustomerSelect}
              suggestions={customers}
              placeholder="Andika izina..."
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.phoneNumber}
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="07X XXX XXXX"
              className="bg-white/50 input-glow"
              inputMode="tel"
            />
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.itemsTaken} *
            </label>
            <Textarea
              value={form.items}
              onChange={(e) => setForm({ ...form, items: e.target.value })}
              placeholder="Imiringa, impeta, ..."
              className="bg-white/50 input-glow min-h-[80px]"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.amount} (FRW) *
            </label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className="bg-white/50 input-glow text-lg font-semibold"
              inputMode="numeric"
            />
            {form.amount && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(parseFloat(form.amount) || 0)}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              {labels.dueDate}
            </label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="bg-white/50 input-glow"
            />
          </div>

          {/* Payment Status */}
          <div className="flex items-center justify-between py-3 border-t border-border/50">
            <div>
              <p className="text-sm font-medium">{labels.paymentStatus}</p>
              <p className="text-xs text-muted-foreground">
                {form.isPaid ? labels.paid : labels.willPayLater}
              </p>
            </div>
            <Switch
              checked={form.isPaid}
              onCheckedChange={(checked) => setForm({ ...form, isPaid: checked })}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              <X size={16} className="mr-2" />
              {labels.cancel}
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 btn-navy gold-glow-hover"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  {labels.save}
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddDebtPage;
