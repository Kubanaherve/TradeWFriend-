import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/AppStore";
import { toast } from "sonner";
import PaymentModal from "@/components/PaymentModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  Plus,
  Phone,
  MessageCircle,
  Check,
  Users,
  Trash2,
  Download,
  FileText,
  X,
  Calendar,
  User,
} from "lucide-react";

type CustomerRow = {
  id: string;
  name: string | null;
  phone: string | null;
  due_date: string | null;
  is_paid: boolean;
  amount: number | null;
  items: string | null;
  created_at: string;
  image_url?: string | null;
};

type DebtItemRow = {
  id: string;
  customer_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  date_taken: string;
  due_date: string | null;
  added_by: string | null;
  status: "unpaid" | "paid" | "partial";
  created_at: string;
};

type DebtPaymentRow = {
  id: string;
  customer_id: string;
  amount_paid: number;
  paid_at: string;
  received_by: string | null;
  note: string | null;
  created_at: string;
};

type CustomerLedger = {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
  due_date: string | null;
  image_url?: string | null;
  items: DebtItemRow[];
  payments: DebtPaymentRow[];
  totalDebt: number;
  totalPaid: number;
  remaining: number;
  lastDebtDate: string | null;
};

const DebtsPage = () => {
  const navigate = useNavigate();
  const { settings: businessSettings } = useBusinessSettings();
  const { isOwner, profile } = useAuth();
  const { recordTransaction } = useAppStore();
  const { t } = useI18n();

  const [customers, setCustomers] = useState<CustomerLedger[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLedger | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingCustomerId, setDownloadingCustomerId] = useState<string | null>(null);

  const actorIdentifier = profile?.phone ?? "";

  const isMobileDevice = () =>
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const canSendSMS = () => {
    if (!isMobileDevice()) {
      toast.error(t("messages.phoneOnly"));
      return false;
    }
    return true;
  };

  const canSendWhatsApp = () => {
    if (!isMobileDevice()) {
      toast.error(t("messages.phoneOnly"));
      return false;
    }
    return true;
  };

  const normalizeWhatsappPhone = (phone: string) => {
    let cleanPhone = phone.replace(/\s/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "250" + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith("250") && !cleanPhone.startsWith("+")) cleanPhone = "250" + cleanPhone;
    return cleanPhone.replace("+", "");
  };

  const buildProfessionalDebtWhatsAppMessage = (customer: CustomerLedger) => {
    const itemLines =
      customer.items.length > 0
        ? customer.items
            .map(
              (item, index) =>
                `${index + 1}. ${item.item_name}\n` +
                `   ${t("inventory.quantity")}: ${item.quantity}\n` +
                `   ${t("payment.unitPrice")}: ${formatCurrency(item.unit_price)}\n` +
                `   ${t("common.total")}: ${formatCurrency(item.total_price)}\n` +
                `   ${t("debts.takenDate")}: ${formatDate(item.date_taken)}`
            )
            .join("\n\n")
        : t("debts.noItemsRecorded");

    return [
      `${t("messages.professionalGreeting")} ${customer.name},`,
      "",
      `${t("messages.professionalDebtIntro")} ${businessSettings.businessName}.`,
      "",
      `${t("messages.professionalDebtItemsTitle")}:`,
      itemLines,
      "",
      `${t("debts.totalDebtTaken")}: ${formatCurrency(customer.totalDebt)}`,
      `${t("debts.totalPaid")}: ${formatCurrency(customer.totalPaid)}`,
      `${t("debts.remainingDebt")}: ${formatCurrency(customer.remaining)}`,
      customer.due_date ? `${t("debts.dueDate")}: ${formatDate(customer.due_date)}` : "",
      "",
      t("messages.professionalDebtClosing"),
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildPaymentRequestMessage = (customer: CustomerLedger) => {
    return [
      `${t("addDebt.debtNotificationGreeting")} ${customer.name},`,
      "",
      `${t("debts.requestIntro")} ${businessSettings.businessName}.`,
      `${t("debts.remainingDebt")}: ${formatCurrency(customer.remaining)}`,
      customer.due_date ? `${t("debts.dueDate")}: ${formatDate(customer.due_date)}` : "",
      "",
      t("addDebt.debtNotificationThanks"),
    ]
      .filter(Boolean)
      .join("\n");
  };

  const fetchLedgers = useCallback(async () => {
    setLoading(true);

    try {
      const [customersResponse, debtItemsResponse, paymentsResponse] = await Promise.all([
        (supabase as any)
          .from("customers")
          .select("id, name, phone, due_date, is_paid, amount, items, created_at, image_url")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("debt_items")
          .select("*")
          .order("date_taken", { ascending: false }),
        (supabase as any)
          .from("debt_payments")
          .select("*")
          .order("paid_at", { ascending: false }),
      ]);

      if (customersResponse.error) throw customersResponse.error;
      if (debtItemsResponse.error) throw debtItemsResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      const customerRows = (customersResponse.data ?? []) as CustomerRow[];
      const debtItems = (debtItemsResponse.data ?? []) as DebtItemRow[];
      const payments = (paymentsResponse.data ?? []) as DebtPaymentRow[];

      const debtItemsByCustomer = new Map<string, DebtItemRow[]>();
      const paymentsByCustomer = new Map<string, DebtPaymentRow[]>();

      for (const item of debtItems) {
        const list = debtItemsByCustomer.get(item.customer_id) ?? [];
        list.push(item);
        debtItemsByCustomer.set(item.customer_id, list);
      }

      for (const payment of payments) {
        const list = paymentsByCustomer.get(payment.customer_id) ?? [];
        list.push(payment);
        paymentsByCustomer.set(payment.customer_id, list);
      }

      const ledgers: CustomerLedger[] = customerRows
        .map((customer) => {
          const customerItems = debtItemsByCustomer.get(customer.id) ?? [];
          const customerPayments = paymentsByCustomer.get(customer.id) ?? [];

          const totalDebt = customerItems.reduce(
            (sum, item) => sum + Number(item.total_price || 0),
            0
          );

          const totalPaid = customerPayments.reduce(
            (sum, payment) => sum + Number(payment.amount_paid || 0),
            0
          );

          const remaining = Math.max(totalDebt - totalPaid, 0);
          const lastDebtDate = customerItems.length > 0 ? customerItems[0].date_taken : null;

          return {
            id: customer.id,
            name: customer.name || "Unknown",
            phone: customer.phone || null,
            created_at: customer.created_at,
            due_date: customer.due_date || null,
            image_url: customer.image_url || null,
            items: customerItems,
            payments: customerPayments,
            totalDebt,
            totalPaid,
            remaining,
            lastDebtDate,
          };
        })
        .filter((ledger) => ledger.remaining > 0)
        .sort((a, b) => {
          const aDate = a.lastDebtDate || a.created_at;
          const bDate = b.lastDebtDate || b.created_at;
          return bDate.localeCompare(aDate);
        });

      setCustomers(ledgers);
    } catch (err) {
      console.error("Fetch ledgers error:", err);
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchLedgers();
  }, [fetchLedgers]);

  useEffect(() => {
    const refresh = () => {
      void fetchLedgers();
    };

    window.addEventListener("newDebtAdded", refresh as EventListener);
    window.addEventListener("paymentMade", refresh as EventListener);
    window.addEventListener("debtDeleted", refresh as EventListener);
    window.addEventListener("clientDeleted", refresh as EventListener);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("newDebtAdded", refresh as EventListener);
      window.removeEventListener("paymentMade", refresh as EventListener);
      window.removeEventListener("debtDeleted", refresh as EventListener);
      window.removeEventListener("clientDeleted", refresh as EventListener);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchLedgers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((customer) => {
      const itemText = customer.items.map((item) => item.item_name).join(" ").toLowerCase();
      return (
        customer.name.toLowerCase().includes(q) ||
        (customer.phone || "").toLowerCase().includes(q) ||
        itemText.includes(q)
      );
    });
  }, [customers, searchQuery]);

  const totalUnpaid = filteredCustomers.reduce((sum, customer) => sum + customer.remaining, 0);

  const downloadFullList = async () => {
    setIsDownloading(true);
    toast.info("Preparing PDF...");

    try {
      const list = filteredCustomers;
      const grandTotal = list.reduce((sum, c) => sum + c.remaining, 0);

      const today = new Date().toLocaleDateString("fr-RW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 13;

      const drawTopBar = (full: boolean) => {
        doc.setFillColor(30, 58, 138);
        doc.rect(0, 0, pageW, full ? 26 : 12, "F");

        if (full) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.setTextColor(255, 255, 255);
          doc.text(businessSettings.businessName, pageW / 2, 10, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(180, 205, 255);
          doc.text(t("messages.fullDebtReport"), pageW / 2, 17, { align: "center" });
          doc.setFontSize(7.5);
          doc.setTextColor(150, 180, 230);
          doc.text(`${t("common.date")}: ${today}`, pageW / 2, 23, { align: "center" });
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(
            `${businessSettings.businessName} — ${t("messages.fullDebtReport")}`,
            pageW / 2,
            8,
            { align: "center" }
          );
        }
      };

      drawTopBar(true);

      const cardY = 30;
      const cardH = 17;
      const cardW = (pageW - margin * 2 - 8) / 3;

      const cards = [
        {
          label: t("dashboard.totalCustomers").toUpperCase(),
          value: `${list.length}`,
          rgb: [30, 58, 138] as [number, number, number],
        },
        {
          label: t("debts.remainingDebt").toUpperCase(),
          value: formatCurrency(grandTotal),
          rgb: [185, 28, 28] as [number, number, number],
        },
        {
          label: t("common.date").toUpperCase(),
          value: today,
          rgb: [55, 65, 81] as [number, number, number],
          small: true,
        },
      ];

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(210, 215, 225);
        doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(130, 130, 130);
        doc.text(card.label, x + 3, cardY + 5.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(card.small ? 7.5 : 10.5);
        doc.setTextColor(...card.rgb);
        doc.text(card.value, x + 3, cardY + 13);
      });

      const bodyRows = list.map((customer, i) => [
        (i + 1).toString(),
        customer.name,
        customer.phone || t("messages.noPhone"),
        customer.items.map((item) => `${item.item_name} x${item.quantity}`).join(", "),
        formatCurrency(customer.remaining),
        customer.due_date ? formatDate(customer.due_date) : "-",
        customer.lastDebtDate ? formatDate(customer.lastDebtDate) : formatDate(customer.created_at),
      ]);

      bodyRows.push([
        "",
        "",
        "",
        t("common.total").toUpperCase(),
        formatCurrency(grandTotal),
        "",
        "",
      ]);

      autoTable(doc, {
        startY: cardY + cardH + 5,
        head: [[
          "#",
          t("debts.customerName"),
          t("auth.phoneNumber"),
          t("debts.debtItems"),
          t("debts.remainingDebt"),
          t("debts.dueDate"),
          t("common.date"),
        ]],
        body: bodyRows,
        margin: { left: margin, right: margin, bottom: 14 },
        styles: {
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          font: "helvetica",
          textColor: [30, 30, 30],
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "left",
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 35, fontStyle: "bold" },
          2: { cellWidth: 26 },
          3: { cellWidth: 58 },
          4: { cellWidth: 28, halign: "right", textColor: [185, 28, 28], fontStyle: "bold" },
          5: { cellWidth: 22, halign: "center" },
          6: { cellWidth: 22, halign: "center" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.row.index === bodyRows.length - 1) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: () => {
          const pageNum =
            (doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } })
              .getCurrentPageInfo().pageNumber;

          if (pageNum > 1) drawTopBar(false);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(170, 170, 170);
          doc.text(
            `${t("common.appName")} | ${pageNum} | ${formatCurrency(grandTotal)} | ${businessSettings.businessName}`,
            pageW / 2,
            pageH - 5,
            { align: "center" }
          );
        },
      });

      const filename = `debts-${businessSettings.businessName
        .toLowerCase()
        .replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;

      doc.save(filename);
      toast.success(t("sales.reportDownloaded"));
    } catch (err) {
      console.error("PDF error:", err);
      toast.error(t("errors.saveFailed"));
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadCustomerPdf = async (customer: CustomerLedger) => {
    try {
      setDownloadingCustomerId(customer.id);

      const today = new Date().toLocaleDateString("fr-RW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;

      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageW, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text(businessSettings.businessName || t("common.appName"), pageW / 2, 10, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(180, 205, 255);
      doc.text(t("debts.pdfTitle"), pageW / 2, 17, { align: "center" });

      doc.setFontSize(7.5);
      doc.setTextColor(150, 180, 230);
      doc.text(`${t("common.date")}: ${today}`, pageW / 2, 23, { align: "center" });

      let currentY = 36;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${t("debts.customerName")}: ${customer.name}`, margin, currentY);

      currentY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `${t("auth.phoneNumber")}: ${customer.phone || t("messages.noPhone")}`,
        margin,
        currentY
      );

      currentY += 6;
      doc.text(
        `${t("debts.dueDate")}: ${customer.due_date ? formatDate(customer.due_date) : "-"}`,
        margin,
        currentY
      );

      currentY += 10;

      const itemRows = customer.items.map((item, index) => [
        String(index + 1),
        item.item_name,
        String(item.quantity),
        formatCurrency(item.unit_price),
        formatCurrency(item.total_price),
        formatDate(item.date_taken),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [[
          "#",
          t("debts.itemName"),
          t("inventory.quantity"),
          t("payment.unitPrice"),
          t("common.total"),
          t("debts.takenDate"),
        ]],
        body: itemRows,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          textColor: [30, 30, 30],
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 58 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 32, halign: "right" },
          5: { cellWidth: 30, halign: "center" },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? currentY + 20;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, finalY + 6, pageW - margin, finalY + 6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);

      doc.text(
        `${t("debts.totalDebtTaken")}: ${formatCurrency(customer.totalDebt)}`,
        margin,
        finalY + 15
      );
      doc.text(
        `${t("debts.totalPaid")}: ${formatCurrency(customer.totalPaid)}`,
        margin,
        finalY + 22
      );
      doc.text(
        `${t("debts.remainingDebt")}: ${formatCurrency(customer.remaining)}`,
        margin,
        finalY + 29
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${t("debts.pdfFooter")} ${businessSettings.businessName || t("common.appName")}`,
        pageW / 2,
        pageH - 8,
        { align: "center" }
      );

      const safeName = customer.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "customer";

      const filename = `${safeName}-${t("debts.pdfFilePrefix")}-${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;

      doc.save(filename);
      toast.success(t("messages.customerPdfDownloaded"));
    } catch (error) {
      console.error("Customer PDF download error:", error);
      toast.error(t("messages.customerPdfFailed"));
    } finally {
      setDownloadingCustomerId(null);
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  };

  const handleSMS = (customer: CustomerLedger, kind: "report" | "request" = "request") => {
    if (!customer.phone) return toast.error(t("messages.noPhone"));
    if (!canSendSMS()) return;

    const message =
      kind === "report"
        ? buildProfessionalDebtWhatsAppMessage(customer)
        : buildPaymentRequestMessage(customer);

    window.location.href = `sms:${customer.phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
  };

  const handleWhatsApp = (customer: CustomerLedger, kind: "report" | "request" = "request") => {
    if (!customer.phone) return toast.error(t("messages.noPhone"));
    if (!canSendWhatsApp()) return;

    const cleanPhone = normalizeWhatsappPhone(customer.phone);
    const message =
      kind === "report"
        ? buildProfessionalDebtWhatsAppMessage(customer)
        : buildPaymentRequestMessage(customer);

    window.location.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const openPayment = (customer: CustomerLedger) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (paymentAmount: number, thankYouMessage: string) => {
    if (!isOwner || !selectedCustomer) {
      toast.error(t("errors.noPermission"));
      return;
    }

    if (paymentAmount <= 0) {
      toast.error(t("payment.invalidAmount"));
      return;
    }

    const nowIso = new Date().toISOString();

    if (selectedCustomer.phone) {
      const cleanPhone = normalizeWhatsappPhone(selectedCustomer.phone);
      const remainingPreview = Math.max(selectedCustomer.remaining - paymentAmount, 0);
      const message =
        remainingPreview <= 0
          ? thankYouMessage
          : `${thankYouMessage}\n\n${t("debts.remainingDebt")}: ${formatCurrency(remainingPreview)}`;

      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    }

    try {
      const paymentInsertResponse = await (supabase as any)
        .from("debt_payments")
        .insert({
          customer_id: selectedCustomer.id,
          amount_paid: paymentAmount,
          paid_at: nowIso,
          received_by: actorIdentifier || null,
          note: "Manual payment from debt page",
          created_at: nowIso,
        });

      if (paymentInsertResponse.error) throw paymentInsertResponse.error;

      const newRemaining = Math.max(selectedCustomer.remaining - paymentAmount, 0);

      const customerUpdateResponse = await (supabase as any)
        .from("customers")
        .update(
          newRemaining <= 0
            ? {
                is_paid: true,
                paid_at: nowIso,
                amount: 0,
                updated_at: nowIso,
              }
            : {
                amount: newRemaining,
                is_paid: false,
                updated_at: nowIso,
              }
        )
        .eq("id", selectedCustomer.id);

      if (customerUpdateResponse.error) throw customerUpdateResponse.error;

      if (newRemaining <= 0) {
        const markItemsResponse = await (supabase as any)
          .from("debt_items")
          .update({ status: "paid" })
          .eq("customer_id", selectedCustomer.id)
          .neq("status", "paid");

        if (markItemsResponse.error) throw markItemsResponse.error;
      }

      await recordTransaction({
        transaction_type: "payment",
        amount: paymentAmount,
        date: nowIso,
        description: `Payment from ${selectedCustomer.name}`,
        related_id: selectedCustomer.id,
        created_by: actorIdentifier || null,
        metadata: {
          customer_name: selectedCustomer.name,
          outstanding_before: selectedCustomer.remaining,
          outstanding_after: newRemaining,
        },
      });

      toast.success(t("payment.paymentSuccess"));
      setPaymentModalOpen(false);
      setSelectedCustomer(null);

      window.dispatchEvent(
        new CustomEvent("paymentMade", {
          detail: {
            paymentAmount,
            customerId: selectedCustomer.id,
          },
        })
      );

      await fetchLedgers();
    } catch (err) {
      console.error("Payment error:", err);
      toast.error(t("payment.paymentFailed"));
    }
  };

  const handleDelete = async (customer: CustomerLedger) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const confirmed = window.confirm(t("debts.confirmDeleteLedger"));
    if (!confirmed) return;

    try {
      const deleteResponse = await (supabase as any)
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (deleteResponse.error) throw deleteResponse.error;

      toast.success(t("debts.ledgerDeleted"));
      setSelectedCustomer(null);

      window.dispatchEvent(new CustomEvent("debtDeleted"));
      window.dispatchEvent(new CustomEvent("clientDeleted"));

      await fetchLedgers();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(t("debts.deleteFailed"));
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900"
      style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/35 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-300/25 to-transparent blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold text-slate-900">
                {t("debts.title")}
              </h1>
              <p className="text-[11px] text-slate-500">
                {t("debts.debtReport")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <Button
                onClick={downloadFullList}
                disabled={isDownloading}
                size="sm"
                variant="outline"
                className="h-10 rounded-xl border-green-500/40 px-3 text-xs font-semibold text-green-700 hover:bg-green-50"
              >
                {isDownloading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500/30 border-t-green-500" />
                ) : (
                  <Download size={15} />
                )}
                <span className="ml-1 hidden sm:inline">PDF</span>
              </Button>
            )}

            <Button
              onClick={() => navigate("/add-debt")}
              size="sm"
              className="h-10 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={15} className="mr-1" />
              {t("navigation.addDebt")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-10">
        <div className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t("common.search")}...`}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {t("debts.totalDebt")}
            </p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalUnpaid)}</p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("dashboard.totalCustomers")}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {filteredCustomers.length}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-600">
                <Users size={16} />
                <span className="text-xs font-semibold">{t("debts.debtReport")}</span>
              </div>
            </div>
          </div>
        </div>

        {filteredCustomers.length === 0 && !loading ? (
          <div className="rounded-2xl border border-white/70 bg-white/90 p-10 text-center shadow-sm">
            <Users size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">{t("debts.noDebts")}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="cursor-pointer rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex items-start gap-3">
                  {customer.image_url ? (
                    <img
                      src={customer.image_url}
                      alt={customer.name}
                      className="h-12 w-12 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <User size={18} className="text-slate-500" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {customer.name}
                        </p>
                        {customer.phone && (
                          <p className="mt-1 text-xs text-slate-500">{customer.phone}</p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">
                          {formatCurrency(customer.remaining)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {customer.items.length === 0
                        ? t("debts.noItemsRecorded")
                        : customer.items
                            .slice(0, 3)
                            .map((item) => `${item.item_name} x${item.quantity}`)
                            .join(", ")}
                    </p>

                    {customer.due_date && (
                      <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <Calendar size={11} />
                        {formatDate(customer.due_date)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="col-span-full rounded-2xl border border-white/70 bg-white/90 p-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">{t("common.loading")}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedCustomer.image_url ? (
                  <img
                    src={selectedCustomer.image_url}
                    alt={selectedCustomer.name}
                    className="h-16 w-16 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <User size={22} className="text-slate-500" />
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                    {selectedCustomer.name}
                  </h2>
                  {selectedCustomer.phone && (
                    <p className="mt-1 text-sm text-slate-600">{selectedCustomer.phone}</p>
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
                onClick={() => setSelectedCustomer(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">{t("debts.totalDebtTaken")}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {formatCurrency(selectedCustomer.totalDebt)}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-700">{t("debts.totalPaid")}</p>
                <p className="mt-1 text-lg font-bold text-emerald-800">
                  {formatCurrency(selectedCustomer.totalPaid)}
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700">{t("debts.remainingDebt")}</p>
                <p className="mt-1 text-lg font-bold text-red-700">
                  {formatCurrency(selectedCustomer.remaining)}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("debts.debtItems")}
                </h3>

                {selectedCustomer.items.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    {t("debts.noItemsRecorded")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.item_name} x{item.quantity}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatCurrency(item.unit_price)} • {formatDate(item.date_taken)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {t("common.status")}: {item.status}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-bold text-slate-900">
                          {formatCurrency(item.total_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("debts.paymentHistory")}
                </h3>

                {selectedCustomer.payments.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    {t("debts.noPaymentsRecorded")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-emerald-50 p-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-800">
                            {t("payment.recordPayment")} {formatCurrency(payment.amount_paid)}
                          </p>
                          <p className="mt-1 text-xs text-emerald-700">
                            {formatDate(payment.paid_at)}
                          </p>
                          {payment.note && (
                            <p className="mt-1 text-xs text-emerald-700">{payment.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {selectedCustomer.phone && (
                <>
                  <button
                    onClick={() => handleWhatsApp(selectedCustomer, "report")}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 shadow-sm transition-transform hover:scale-105"
                    title={t("debts.sendReport")}
                  >
                    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-green-500">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => void downloadCustomerPdf(selectedCustomer)}
                    disabled={downloadingCustomerId === selectedCustomer.id}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
                    title={t("messages.downloadCustomerPdf")}
                  >
                    {downloadingCustomerId === selectedCustomer.id ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
                    ) : (
                      <FileText size={24} className="text-blue-600" />
                    )}
                  </button>

                  <button
                    onClick={() => handleSMS(selectedCustomer, "request")}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 shadow-sm transition-transform hover:scale-105"
                    title={t("messages.sendSms")}
                  >
                    <MessageCircle size={24} className="text-sky-600" />
                  </button>

                  <button
                    onClick={() => handleCall(selectedCustomer.phone)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 shadow-sm transition-transform hover:scale-105"
                    title={t("debts.callCustomer")}
                  >
                    <Phone size={24} className="text-indigo-600" />
                  </button>
                </>
              )}

              {isOwner && (
                <>
                  <button
                    onClick={() => openPayment(selectedCustomer)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 shadow-lg transition-transform hover:scale-105"
                    title={t("debts.registerPayment")}
                  >
                    <Check size={28} className="text-white" />
                  </button>

                  <button
                    onClick={() => handleDelete(selectedCustomer)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform hover:scale-105"
                    title={t("common.delete")}
                  >
                    <Trash2 size={22} className="text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && paymentModalOpen && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onConfirm={handlePayment}
          customerName={selectedCustomer.name}
          totalAmount={selectedCustomer.remaining}
        />
      )}
    </div>
  );
};

export default DebtsPage;