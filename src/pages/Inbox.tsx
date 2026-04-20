import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  MessageCircle,
  Phone,
  User,
  Calendar,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import {
  buildDebtAlerts,
  notifyIfInactiveForTenHours,
  notifyDebtAlerts,
  recordAppActivity,
  type DebtAlert,
  type DebtAlertCustomer,
} from "@/lib/debtAlerts";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";

interface InboxCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  amount: number | null;
  created_at: string;
  due_date: string | null;
  items?: string | null;
  is_paid: boolean;
  image_url?: string | null;
}

type ParsedItem = {
  name: string;
  qty: number;
  price: number;
};

const InboxPage = () => {
  const navigate = useNavigate();
  const { settings: businessSettings } = useBusinessSettings();
  const { profile } = useAuth();
  const { t } = useI18n();

  const [alerts, setAlerts] = useState<DebtAlert[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, InboxCustomer>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<InboxCustomer | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("customers")
        .select("id, name, phone, amount, created_at, due_date, items, is_paid, image_url");

      if (error) throw error;

      const customerRows = (data || []) as InboxCustomer[];
      const builtAlerts = buildDebtAlerts(customerRows as DebtAlertCustomer[]);

      const customerMap = customerRows.reduce<Record<string, InboxCustomer>>((acc, customer) => {
        acc[customer.id] = customer;
        return acc;
      }, {});

      setCustomersById(customerMap);
      setAlerts(builtAlerts);

      await notifyDebtAlerts(builtAlerts);
    } catch (error) {
      console.error("Inbox alerts error:", error);
      toast.error(getErrorMessage(error, t("inbox.fetchFailed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    notifyIfInactiveForTenHours(profile?.businessName || "Business");
    recordAppActivity();

    const refreshAlerts = () => {
      recordAppActivity();
      void fetchAlerts();
    };

    window.addEventListener("newDebtAdded", refreshAlerts);
    window.addEventListener("paymentMade", refreshAlerts);
    window.addEventListener("debtDeleted", refreshAlerts);
    window.addEventListener("focus", refreshAlerts);

    return () => {
      window.removeEventListener("newDebtAdded", refreshAlerts);
      window.removeEventListener("paymentMade", refreshAlerts);
      window.removeEventListener("debtDeleted", refreshAlerts);
      window.removeEventListener("focus", refreshAlerts);
    };
  }, [fetchAlerts, profile?.businessName]);

  const openCustomerCard = (alert: DebtAlert) => {
    const customer = customersById[alert.customerId];

    if (!customer) {
      toast.error(t("inbox.customerNotFound"));
      return;
    }

    setSelectedCustomer(customer);
  };

  const parseItems = (raw: string | null | undefined): ParsedItem[] => {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((item: any) => {
          if (typeof item === "object" && item !== null) {
            return {
              name: String(item.name ?? item.item_name ?? ""),
              qty: Number(item.qty ?? item.quantity ?? 1),
              price: Number(item.price ?? item.unit_price ?? 0),
            };
          }

          if (typeof item === "string") {
            return {
              name: item,
              qty: 1,
              price: 0,
            };
          }

          return null;
        })
        .filter(Boolean) as ParsedItem[];
    } catch {
      return [];
    }
  };

  const parsedSelectedItems = useMemo(
    () => parseItems(selectedCustomer?.items),
    [selectedCustomer]
  );

  const sendWhatsAppToCustomer = (customer: InboxCustomer) => {
    if (!customer.phone) {
      toast.error(t("inbox.phoneMissing"));
      return;
    }

    const parsedItems = parseItems(customer.items);

    const formattedItems = parsedItems.length
      ? parsedItems
          .map((item) =>
            item.price > 0
              ? `- ${item.name} (${item.qty} x ${formatCurrency(item.price)} = ${formatCurrency(
                  item.qty * item.price
                )})`
              : `- ${item.name} (${item.qty})`
          )
          .join("\n")
      : t("inbox.noItems");

    const message = [
      `${t("addDebt.debtNotificationGreeting")} ${customer.name || t("common.name")},`,
      "",
      `${t("inbox.messageIntro")} ${profile?.businessName || "Business"}.`,
      "",
      `${t("common.details")}:`,
      formattedItems,
      "",
      `${t("inbox.totalAmount")}: ${formatCurrency(customer.amount || 0)}`,
      customer.due_date ? `${t("debts.dueDate")}: ${formatDate(customer.due_date)}` : "",
      "",
      t("addDebt.debtNotificationThanks"),
    ]
      .filter(Boolean)
      .join("\n");

    const encoded = encodeURIComponent(message);

    let phone = customer.phone.replace(/\s+/g, "");
    if (phone.startsWith("0")) {
      phone = "250" + phone.slice(1);
    } else if (phone.startsWith("+")) {
      phone = phone.slice(1);
    }

    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const urgentCount = alerts.filter((alert) => alert.amount >= 10000).length;
return (
  <AppShell
    title={t("inbox.title")}
    subtitle={t("inbox.subtitle")}
    showBack
    showHome
    contentClassName="pt-2 md:pt-3"
  >
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Bell size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              {t("inbox.importantMessages")}
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900">{alerts.length}</p>
        </div>

        <div className="rounded-[24px] border border-red-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <AlertTriangle size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              {t("inbox.urgentAlerts")}
            </span>
          </div>
          <p className="text-xl font-bold text-red-600">{urgentCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Bell size={30} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">{t("inbox.noMessages")}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-slate-900">{alert.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {alert.message}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">
                    {formatCurrency(alert.amount)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatDate(alert.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-500">
                <p>
                  {t("inbox.customer")}:{" "}
                  <span className="font-semibold text-slate-700">{alert.customerName}</span>
                </p>
                {alert.phone && <p>{t("auth.phoneNumber")}: {alert.phone}</p>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-10 rounded-xl text-xs font-semibold"
                  onClick={() => openCustomerCard(alert)}
                >
                  <Check size={14} className="mr-1" />
                  {t("inbox.viewCard")}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 rounded-xl text-xs font-semibold"
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

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {selectedCustomer.image_url ? (
                  <img
                    src={selectedCustomer.image_url}
                    alt={selectedCustomer.name || "Customer"}
                    className="h-16 w-16 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <User size={22} className="text-slate-400" />
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedCustomer.name}
                  </h2>
                  {selectedCustomer.phone && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={12} />
                      {selectedCustomer.phone}
                    </p>
                  )}
                  {selectedCustomer.due_date && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar size={12} />
                      {t("debts.dueDate")}: {formatDate(selectedCustomer.due_date)}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">{t("inbox.totalAmount")}</p>
                <p className="mt-1 text-lg font-bold text-red-600">
                  {formatCurrency(selectedCustomer.amount || 0)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">{t("common.status")}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {selectedCustomer.is_paid ? t("addDebt.paid") : t("addDebt.debt")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-700">{t("debts.debtItems")}</h3>

              {parsedSelectedItems.length === 0 ? (
                <p className="text-sm text-slate-500">{t("inbox.noItems")}</p>
              ) : (
                <div className="space-y-2">
                  {parsedSelectedItems.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-start justify-between rounded-xl bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {t("inventory.quantity")}: {item.qty}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {item.price > 0
                            ? formatCurrency(item.qty * item.price)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              {selectedCustomer.phone && (
                <Button
                  className="h-11 w-full rounded-xl text-sm font-semibold"
                  onClick={() => sendWhatsAppToCustomer(selectedCustomer)}
                >
                  <MessageCircle size={14} className="mr-2" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </AppShell>
);
};

export default InboxPage;
