import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/kinyarwanda";
import {
  buildDebtAlerts,
  notifyIfInactiveForTenHours,
  notifyDebtAlerts,
  recordAppActivity,
  type DebtAlert,
  type DebtAlertCustomer,
} from "@/lib/debtAlerts";
import { toast } from "sonner";

interface InboxCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  amount: number | null;
  created_at: string;
  due_date: string | null;
  items?: string | null;
  is_paid: boolean;
}

const InboxPage = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<DebtAlert[]>([]);
  const [customersById, setCustomersById] = useState<
    Record<string, InboxCustomer>
  >({});
  const [selectedCustomer, setSelectedCustomer] =
    useState<InboxCustomer | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, amount, created_at, due_date, items, is_paid");

      if (error) throw error;

      const customerRows = (data || []) as InboxCustomer[];

      const builtAlerts = buildDebtAlerts(
        customerRows as DebtAlertCustomer[]
      );

      const customerMap = customerRows.reduce<
        Record<string, InboxCustomer>
      >((acc, customer) => {
        acc[customer.id] = customer;
        return acc;
      }, {});

      setCustomersById(customerMap);
      setAlerts(builtAlerts);

      await notifyDebtAlerts(builtAlerts);
    } catch (error) {
      console.error("Inbox alerts error:", error);
      toast.error("Habaye ikosa mu gufata inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    notifyIfInactiveForTenHours();
    recordAppActivity();

    const refreshAlerts = () => {
      recordAppActivity();
      fetchAlerts();
    };

    window.addEventListener("newDebtAdded", refreshAlerts);
    window.addEventListener("paymentMade", refreshAlerts);
    window.addEventListener("focus", refreshAlerts);

    return () => {
      window.removeEventListener("newDebtAdded", refreshAlerts);
      window.removeEventListener("paymentMade", refreshAlerts);
      window.removeEventListener("focus", refreshAlerts);
    };
  }, [fetchAlerts]);

  const openCustomerCard = (alert: DebtAlert) => {
    const customer = customersById[alert.customerId];

    if (!customer) {
      toast.error("Uyu mukiriya ntiyabonetse neza.");
      return;
    }

    setSelectedCustomer(customer);
  };

  // ✅ CLEAN WHATSAPP LOGIC
  const sendWhatsAppToCustomer = (customer: InboxCustomer) => {
    if (!customer.phone) {
      toast.error("Nimero ya telephone ntiboneka");
      return;
    }

    let parsedItems: { name: string; qty: number; price: number }[] = [];

    try {
      parsedItems = customer.items ? JSON.parse(customer.items) : [];
    } catch {
      parsedItems = [];
    }

    const formattedItems = parsedItems.length
      ? parsedItems
          .map(
            (item) =>
              `- ${item.name} (${item.qty} x ${item.price} FRW = ${
                item.qty * item.price
              } FRW)`
          )
          .join("\n")
      : "Amabijoux";

    const message = `Muraho neza, mwampaye kuri cash nshuti.

${formattedItems}

Totale: ${formatCurrency(
      customer.amount || 0
    )}`;

    const encoded = encodeURIComponent(message);

    const phone = customer.phone.startsWith("0")
      ? "250" + customer.phone.slice(1)
      : customer.phone;

    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <h1 className="text-base font-bold">Inbox y'Ubutumwa</h1>
          <p className="text-[10px] text-muted-foreground">
            Aha ni ho ubona amakuru y'amadeni ashaje n'amadeni manini.
          </p>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        <div className="glass-card-dark p-4 gold-glow">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-secondary" />
            <span className="text-xs text-primary-foreground/70">
              Ubutumwa bw'ingenzi
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{alerts.length}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Gutegereza...
          </div>
        ) : alerts.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm font-medium">Nta butumwa bushya buhari.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="glass-card p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-sm font-bold">{alert.title}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.message}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">
                      {formatCurrency(alert.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(alert.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  <p>Umukiriya: {alert.customerName}</p>
                  {alert.phone && <p>Telefono: {alert.phone}</p>}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 btn-navy"
                    onClick={() => openCustomerCard(alert)}
                  >
                    <Check size={14} className="mr-1" />
                    Reba card
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const customer = customersById[alert.customerId];
                      if (customer) {
                        sendWhatsAppToCustomer(customer);
                      }
                    }}
                  >
                    <MessageCircle size={14} className="mr-1" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-end sm:items-center p-4 z-50">
          <div className="bg-white/100 rounded-2xl w-full sm:max-w-md p-6 space-y-6 shadow-xl">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold truncate">
                {selectedCustomer.name}
              </h2>
              <button onClick={() => setSelectedCustomer(null)}>✕</button>
            </div>

            <div className="text-center space-y-2">
              {selectedCustomer.items && (
                <p className="text-sm">
                  Ibyo yafashe: {selectedCustomer.items}
                </p>
              )}
              <p className="text-xl font-semibold">
                {formatCurrency(selectedCustomer.amount || 0)}
              </p>
            </div>

            <div className="flex gap-2">
              {selectedCustomer.phone && (
                <Button
                  className="w-full"
                  onClick={() =>
                    sendWhatsAppToCustomer(selectedCustomer)
                  }
                >
                  <MessageCircle size={14} className="mr-1" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;