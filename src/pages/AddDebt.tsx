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
    const phone = form.phone.replace(/\s/g, '');
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    setTimeout(() => navigate("/debts"), 500);
  };

  const handleSendWhatsApp = () => {
    const message = smsTemplates.debtConfirmation(form.items, formatCurrency(parseFloat(form.amount)));
    // Format phone for WhatsApp (remove leading 0, add country code 250 for Rwanda)
    let cleanPhone = form.phone.replace(/\s/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '250' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('250') && !cleanPhone.startsWith('+')) {
      cleanPhone = '250' + cleanPhone;
    }
    cleanPhone = cleanPhone.replace('+', '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
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

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSendWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </Button>
              <Button
                onClick={handleSendSms}
                className="flex-1 btn-navy"
              >
                <MessageCircle size={16} className="mr-2" />
                SMS
              </Button>
              <Button
                onClick={handleSkipSms}
                variant="outline"
                className="flex-1"
              >
                {labels.cancel}
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
