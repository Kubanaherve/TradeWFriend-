import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/kinyarwanda";
import { getErrorMessage } from "@/lib/errors";
import { createCsvBlob, csvCell, saveBlobWithPicker } from "@/lib/fileExport";
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
  Plus,
  Check,
  Users,
  Trash2,
  FileText,
  X,
  Calendar,
  User,
  Download,
  Copy,
  ExternalLink,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";

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

type WhatsAppPromptState = {
  open: boolean;
  phone: string;
  message: string;
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
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [downloadingCustomerId, setDownloadingCustomerId] = useState<string | null>(null);
  const [whatsAppPrompt, setWhatsAppPrompt] = useState<WhatsAppPromptState>({
    open: false,
    phone: "",
    message: "",
  });

  const actorIdentifier = profile?.phone ?? "";

  const exportPdfType = {
    description: "PDF document",
    accept: { "application/pdf": [".pdf"] },
  };

  const exportCsvType = {
    description: "CSV spreadsheet",
    accept: { "text/csv": [".csv"] },
  };

  const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const normalizeWhatsappPhone = (phone: string) => {
    let cleanPhone = phone.replace(/[^\d+]/g, "");

    if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.slice(1);
    }

    if (cleanPhone.startsWith("0")) {
      cleanPhone = "250" + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith("250")) {
      cleanPhone = "250" + cleanPhone;
    }

    return cleanPhone;
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied.");
      return true;
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      toast.error("Failed to copy message.");
      return false;
    }
  };

  const openExternal = (url: string) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
  };

  const openWhatsAppSmart = useCallback(
    async (phone: string, message: string) => {
      const cleanPhone = normalizeWhatsappPhone(phone);
      const encodedMessage = encodeURIComponent(message);

      const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
      const webUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      await copyText(message);

      if (isMobileDevice()) {
        window.location.href = appUrl;

        window.setTimeout(() => {
          openExternal(webUrl);
        }, 1200);

        return;
      }

      openExternal(webUrl);
    },
    []
  );

  const buildDebtReportMessage = useCallback(
    (customer: CustomerLedger) => {
      const itemLines =
        customer.items.length > 0
          ? customer.items
              .map(
                (item, index) =>
                  `${index + 1}. ${item.item_name}\n` +
                  `   ${t("inventory.quantity") || "Quantity"}: ${item.quantity}\n` +
                  `   ${t("payment.unitPrice") || "Unit Price"}: ${formatCurrency(item.unit_price)}\n` +
                  `   ${t("common.total") || "Total"}: ${formatCurrency(item.total_price)}\n` +
                  `   ${t("debts.takenDate") || "Taken Date"}: ${formatDate(item.date_taken)}`
              )
              .join("\n\n")
          : (t("debts.noItemsRecorded") || "No items recorded");

      return [
        `Hello ${customer.name},`,
        "",
        `Here is your debt statement from ${profile?.businessName || "Business"}.`,
        "",
        `Items taken:`,
        itemLines,
        "",
        `${t("debts.totalDebtTaken") || "Total Debt"}: ${formatCurrency(customer.totalDebt)}`,
        `${t("debts.totalPaid") || "Total Paid"}: ${formatCurrency(customer.totalPaid)}`,
        `${t("debts.remainingDebt") || "Remaining"}: ${formatCurrency(customer.remaining)}`,
        customer.due_date
          ? `${t("debts.dueDate") || "Due Date"}: ${formatDate(customer.due_date)}`
          : "",
        "",
        `Please contact ${profile?.businessName || "Business"} if you need any clarification. Thank you.`,
      ]
        .filter(Boolean)
        .join("\n");
    },
    [profile?.businessName, t]
  );

  const buildPaymentRequestMessage = useCallback(
    (customer: CustomerLedger) => {
      return [
        `Hello ${customer.name},`,
        "",
        `This is a payment reminder from ${profile?.businessName || "Business"}.`,
        `${t("debts.remainingDebt") || "Remaining Debt"}: ${formatCurrency(customer.remaining)}`,
        customer.due_date
          ? `${t("debts.dueDate") || "Due Date"}: ${formatDate(customer.due_date)}`
          : "",
        "",
        `Please make your payment as soon as possible. Thank you.`,
      ]
        .filter(Boolean)
        .join("\n");
    },
    [profile?.businessName, t]
  );

  const openWhatsAppPrompt = (phone: string, message: string) => {
    setWhatsAppPrompt({
      open: true,
      phone,
      message,
    });
  };

  const closeWhatsAppPrompt = () => {
    setWhatsAppPrompt({
      open: false,
      phone: "",
      message: "",
    });
  };

  const fetchLedgers = useCallback(async () => {
    setLoading(true);

    try {
      const customersResponse = await (supabase as any)
        .from("customers")
        .select("id, name, phone, due_date, is_paid, amount, items, created_at, image_url")
        .or("is_paid.eq.false,amount.gt.0")
        .order("created_at", { ascending: false });

      if (customersResponse.error) throw customersResponse.error;

      const customerRows = (customersResponse.data ?? []) as CustomerRow[];

      if (customerRows.length === 0) {
        setCustomers([]);
        return;
      }

      const customerIds = customerRows.map((customer) => customer.id);

      const [debtItemsResponse, paymentsResponse] = await Promise.all([
        (supabase as any)
          .from("debt_items")
          .select(
            "id, customer_id, item_name, quantity, unit_price, total_price, date_taken, due_date, added_by, status, created_at"
          )
          .in("customer_id", customerIds),
        (supabase as any)
          .from("debt_payments")
          .select("id, customer_id, amount_paid, paid_at, received_by, note, created_at")
          .in("customer_id", customerIds),
      ]);

      if (debtItemsResponse.error) throw debtItemsResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

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

          const sortedItems = [...customerItems].sort((a, b) =>
            String(b.date_taken || b.created_at).localeCompare(
              String(a.date_taken || a.created_at)
            )
          );

          const lastDebtDate = sortedItems[0]?.date_taken ?? null;

          return {
            id: customer.id,
            name: customer.name || "Unknown",
            phone: customer.phone || null,
            created_at: customer.created_at,
            due_date: customer.due_date || null,
            image_url: customer.image_url || null,
            items: sortedItems,
            payments: [...customerPayments].sort((a, b) =>
              String(b.paid_at || b.created_at).localeCompare(
                String(a.paid_at || a.created_at)
              )
            ),
            totalDebt,
            totalPaid,
            remaining,
            lastDebtDate,
          };
        })
        .filter((ledger) => ledger.items.length > 0 && ledger.totalDebt > 0 && ledger.remaining > 0)
        .sort((a, b) => {
          const aDate = a.lastDebtDate || a.created_at;
          const bDate = b.lastDebtDate || b.created_at;
          return String(bDate).localeCompare(String(aDate));
        });

      setCustomers(ledgers);
    } catch (err) {
      console.error("Fetch ledgers error:", err);
      toast.error(getErrorMessage(err, t("errors.loadFailed") || "Failed to load debts."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchLedgers();
  }, [fetchLedgers]);

  useEffect(() => {
    if (!selectedCustomer?.id) return;

    const freshSelected = customers.find((ledger) => ledger.id === selectedCustomer.id);

    if (!freshSelected) {
      setSelectedCustomer(null);
      setPaymentModalOpen(false);
      return;
    }

    if (freshSelected !== selectedCustomer) {
      setSelectedCustomer(freshSelected);
    }
  }, [customers, selectedCustomer]);

  useEffect(() => {
    const refresh = () => {
      void fetchLedgers();
    };

    window.addEventListener("newDebtAdded", refresh as EventListener);
    window.addEventListener("paymentMade", refresh as EventListener);
    window.addEventListener("debtDeleted", refresh as EventListener);
    window.addEventListener("clientDeleted", refresh as EventListener);
    window.addEventListener("factoryReset", refresh as EventListener);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("newDebtAdded", refresh as EventListener);
      window.removeEventListener("paymentMade", refresh as EventListener);
      window.removeEventListener("debtDeleted", refresh as EventListener);
      window.removeEventListener("clientDeleted", refresh as EventListener);
      window.removeEventListener("factoryReset", refresh as EventListener);
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

  const buildFullListCsvLines = () => {
    const rows = [
      [
        "#",
        t("debts.customerName") || "Customer Name",
        t("auth.phoneNumber") || "Phone",
        t("debts.debtItems") || "Debt Items",
        t("debts.totalDebtTaken") || "Total Debt",
        t("debts.totalPaid") || "Total Paid",
        t("debts.remainingDebt") || "Remaining Debt",
        t("debts.dueDate") || "Due Date",
        t("common.date") || "Date",
      ]
        .map(csvCell)
        .join(","),
    ];

    filteredCustomers.forEach((customer, index) => {
      rows.push(
        [
          index + 1,
          customer.name,
          customer.phone || (t("messages.noPhone") || "No phone"),
          customer.items.map((item) => `${item.item_name} x${item.quantity}`).join("; "),
          customer.totalDebt,
          customer.totalPaid,
          customer.remaining,
          customer.due_date ? formatDate(customer.due_date) : "-",
          customer.lastDebtDate ? formatDate(customer.lastDebtDate) : formatDate(customer.created_at),
        ]
          .map(csvCell)
          .join(",")
      );
    });

    return rows;
  };

  const buildCustomerCsvLines = (customer: CustomerLedger) => {
    const rows = [
      [csvCell(t("debts.customerName") || "Customer Name"), csvCell(customer.name)].join(","),
      [csvCell(t("auth.phoneNumber") || "Phone"), csvCell(customer.phone || (t("messages.noPhone") || "No phone"))].join(","),
      [csvCell(t("debts.dueDate") || "Due Date"), csvCell(customer.due_date ? formatDate(customer.due_date) : "-")].join(","),
      "",
      [
        "#",
        t("debts.itemName") || "Item Name",
        t("inventory.quantity") || "Quantity",
        t("payment.unitPrice") || "Unit Price",
        t("common.total") || "Total",
        t("debts.takenDate") || "Taken Date",
        t("common.status") || "Status",
      ]
        .map(csvCell)
        .join(","),
    ];

    customer.items.forEach((item, index) => {
      rows.push(
        [
          index + 1,
          item.item_name,
          item.quantity,
          item.unit_price,
          item.total_price,
          formatDate(item.date_taken),
          item.status,
        ]
          .map(csvCell)
          .join(",")
      );
    });

    rows.push("");
    rows.push([csvCell(t("debts.totalDebtTaken") || "Total Debt"), csvCell(customer.totalDebt)].join(","));
    rows.push([csvCell(t("debts.totalPaid") || "Total Paid"), csvCell(customer.totalPaid)].join(","));
    rows.push([csvCell(t("debts.remainingDebt") || "Remaining Debt"), csvCell(customer.remaining)].join(","));

    if (customer.payments.length > 0) {
      rows.push("");
      rows.push(
        [
          t("payment.recordPayment") || "Payment",
          t("common.date") || "Date",
          t("common.details") || "Details",
        ]
          .map(csvCell)
          .join(",")
      );

      customer.payments.forEach((payment) => {
        rows.push(
          [
            payment.amount_paid,
            formatDate(payment.paid_at),
            payment.note || "",
          ]
            .map(csvCell)
            .join(",")
        );
      });
    }

    return rows;
  };

  const downloadFullListCsv = async () => {
    setIsExportingCsv(true);

    try {
      const filename = `debts-${(profile?.businessName || "Business")
        .toLowerCase()
        .replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;

      await saveBlobWithPicker(createCsvBlob(buildFullListCsvLines()), filename, {
        fallbackMimeType: "text/csv;charset=utf-8;",
        fileType: exportCsvType,
      });

      toast.success((t("reports.csvDownloaded") || "Report downloaded.") + " Excel ready.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Debt CSV error:", error);
      toast.error(t("errors.saveFailed") || "Failed to save CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  };

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
          doc.text(profile?.businessName || "Business", pageW / 2, 10, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(180, 205, 255);
          doc.text(t("messages.fullDebtReport") || "Full Debt Report", pageW / 2, 17, {
            align: "center",
          });

          doc.setFontSize(7.5);
          doc.setTextColor(150, 180, 230);
          doc.text(`${t("common.date") || "Date"}: ${today}`, pageW / 2, 23, {
            align: "center",
          });
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(
            `${profile?.businessName || "Business"} — ${t("messages.fullDebtReport") || "Full Debt Report"}`,
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
          label: (t("dashboard.totalCustomers") || "Total Customers").toUpperCase(),
          value: `${list.length}`,
          rgb: [30, 58, 138] as [number, number, number],
        },
        {
          label: (t("debts.remainingDebt") || "Remaining Debt").toUpperCase(),
          value: formatCurrency(grandTotal),
          rgb: [185, 28, 28] as [number, number, number],
        },
        {
          label: (t("common.date") || "Date").toUpperCase(),
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
        customer.phone || (t("messages.noPhone") || "No phone"),
        customer.items.map((item) => `${item.item_name} x${item.quantity}`).join(", "),
        formatCurrency(customer.remaining),
        customer.due_date ? formatDate(customer.due_date) : "-",
        customer.lastDebtDate ? formatDate(customer.lastDebtDate) : formatDate(customer.created_at),
      ]);

      bodyRows.push([
        "",
        "",
        "",
        (t("common.total") || "Total").toUpperCase(),
        formatCurrency(grandTotal),
        "",
        "",
      ]);

      autoTable(doc, {
        startY: cardY + cardH + 5,
        head: [[
          "#",
          t("debts.customerName") || "Customer Name",
          t("auth.phoneNumber") || "Phone",
          t("debts.debtItems") || "Debt Items",
          t("debts.remainingDebt") || "Remaining Debt",
          t("debts.dueDate") || "Due Date",
          t("common.date") || "Date",
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
            `${profile?.businessName || "Business"} | ${pageNum} | ${formatCurrency(grandTotal)}`,
            pageW / 2,
            pageH - 5,
            { align: "center" }
          );
        },
      });

      const filename = `debts-${(profile?.businessName || "Business")
        .toLowerCase()
        .replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;

      await saveBlobWithPicker(doc.output("blob"), filename, {
        fallbackMimeType: "application/pdf",
        fileType: exportPdfType,
      });
      toast.success(t("sales.reportDownloaded") || "Report downloaded.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("PDF error:", err);
      toast.error(t("errors.saveFailed") || "Failed to save PDF.");
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

      const businessName = profile?.businessName || "Business";
      const customerName = customer.name || "Unknown";
      const customerPhone = customer.phone || (t("messages.noPhone") || "No phone");
      const dueDateText = customer.due_date ? formatDate(customer.due_date) : "-";

      const status =
        customer.remaining <= 0
          ? "PAID"
          : customer.totalPaid > 0
          ? "PARTIALLY PAID"
          : "UNPAID";

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 30, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(businessName, pageW / 2, 10, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(t("debts.pdfTitle") || "Customer Debt Statement", pageW / 2, 17, {
        align: "center",
      });

      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`${t("common.date") || "Date"}: ${today}`, pageW / 2, 24, {
        align: "center",
      });

      let y = 38;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      if (status === "PAID") {
        doc.setTextColor(22, 163, 74);
      } else if (status === "PARTIALLY PAID") {
        doc.setTextColor(234, 88, 12);
      } else {
        doc.setTextColor(185, 28, 28);
      }
      doc.text(status, pageW - 38, 42, { angle: 18 });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, pageW - margin * 2, 28, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(t("debts.customerName") || "Customer Name", margin + 4, y + 7);
      doc.text(t("auth.phoneNumber") || "Phone", margin + 4, y + 15);
      doc.text(t("debts.dueDate") || "Due Date", margin + 4, y + 23);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(customerName, margin + 42, y + 7);
      doc.text(customerPhone, margin + 42, y + 15);
      doc.text(dueDateText, margin + 42, y + 23);

      y += 36;

      const gap = 4;
      const boxW = (pageW - margin * 2 - gap * 2) / 3;
      const boxH = 20;

      const summaryCards = [
        {
          label: t("debts.totalDebtTaken") || "Total Debt",
          value: formatCurrency(customer.totalDebt),
          fill: [248, 250, 252] as [number, number, number],
          text: [15, 23, 42] as [number, number, number],
        },
        {
          label: t("debts.totalPaid") || "Total Paid",
          value: formatCurrency(customer.totalPaid),
          fill: [236, 253, 245] as [number, number, number],
          text: [6, 95, 70] as [number, number, number],
        },
        {
          label: t("debts.remainingDebt") || "Remaining Debt",
          value: formatCurrency(customer.remaining),
          fill: [254, 242, 242] as [number, number, number],
          text: [185, 28, 28] as [number, number, number],
        },
      ];

      summaryCards.forEach((card, index) => {
        const x = margin + index * (boxW + gap);

        doc.setFillColor(...card.fill);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, boxW, boxH, 3, 3, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(card.label.toUpperCase(), x + 4, y + 6);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...card.text);
        doc.text(card.value, x + 4, y + 14);
      });

      y += 28;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(t("debts.debtItems") || "Debt Items", margin, y);

      y += 4;

      const itemRows = customer.items.map((item, index) => [
        String(index + 1),
        item.item_name,
        String(item.quantity),
        formatCurrency(item.unit_price),
        formatCurrency(item.total_price),
        formatDate(item.date_taken),
        item.status,
      ]);

      autoTable(doc, {
        startY: y,
        head: [[
          "#",
          t("debts.itemName") || "Item Name",
          t("inventory.quantity") || "Quantity",
          t("payment.unitPrice") || "Unit Price",
          t("common.total") || "Total",
          t("debts.takenDate") || "Taken Date",
          t("common.status") || "Status",
        ]],
        body: itemRows,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8.5,
          cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          overflow: "linebreak",
          font: "helvetica",
          valign: "middle",
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 52, fontStyle: "bold" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 28, halign: "right" },
          4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 26, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            const raw = String(data.cell.raw || "").toLowerCase();
            if (raw === "paid") {
              data.cell.styles.fillColor = [236, 253, 245];
              data.cell.styles.textColor = [6, 95, 70];
              data.cell.styles.fontStyle = "bold";
            } else if (raw === "partial") {
              data.cell.styles.fillColor = [255, 251, 235];
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.fillColor = [254, 242, 242];
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      let finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;

      finalY += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(t("debts.paymentHistory") || "Payment History", margin, finalY);

      finalY += 4;

      if (customer.payments.length > 0) {
        const paymentRows = customer.payments.map((payment, index) => [
          String(index + 1),
          formatCurrency(payment.amount_paid),
          formatDate(payment.paid_at),
          payment.note || "-",
        ]);

        autoTable(doc, {
          startY: finalY,
          head: [[
            "#",
            t("payment.recordPayment") || "Payment",
            t("common.date") || "Date",
            t("common.details") || "Details",
          ]],
          body: paymentRows,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 8,
            cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            font: "helvetica",
          },
          headStyles: {
            fillColor: [22, 163, 74],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: [240, 253, 244],
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 35, halign: "right", fontStyle: "bold" },
            2: { cellWidth: 35, halign: "center" },
            3: { cellWidth: 92 },
          },
        });

        finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;
      } else {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, finalY, pageW - margin * 2, 12, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          t("debts.noPaymentsRecorded") || "No payments recorded",
          pageW / 2,
          finalY + 7.5,
          { align: "center" }
        );

        finalY += 18;
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageH - 18, pageW - margin, pageH - 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${t("debts.pdfFooter") || "Generated by"} ${businessName}`,
        margin,
        pageH - 12
      );

      doc.text(
        `${t("auth.phoneNumber") || "Phone"}: ${actorIdentifier || "-"}`,
        margin,
        pageH - 8
      );

      doc.text(
        `${status}`,
        pageW - margin,
        pageH - 8,
        { align: "right" }
      );

      const safeName = customer.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "customer";

      const filename = `${safeName}-${(t("debts.pdfFilePrefix") || "debt-report")
        .toLowerCase()
        .replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;

      await saveBlobWithPicker(doc.output("blob"), filename, {
        fallbackMimeType: "application/pdf",
        fileType: exportPdfType,
      });

      toast.success(t("messages.customerPdfDownloaded") || "Customer PDF downloaded.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Customer PDF download error:", error);
      toast.error(t("messages.customerPdfFailed") || "Customer PDF failed.");
    } finally {
      setDownloadingCustomerId(null);
    }
  };

  const downloadCustomerCsv = async (customer: CustomerLedger) => {
    try {
      setDownloadingCustomerId(customer.id);

      const safeName = customer.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "customer";

      const filename = `${safeName}-debt-ledger-${new Date().toISOString().split("T")[0]}.csv`;

      await saveBlobWithPicker(createCsvBlob(buildCustomerCsvLines(customer)), filename, {
        fallbackMimeType: "text/csv;charset=utf-8;",
        fileType: exportCsvType,
      });

      toast.success((t("reports.csvDownloaded") || "Report downloaded.") + " Excel ready.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Customer CSV download error:", error);
      toast.error(t("errors.saveFailed") || "Failed to save CSV.");
    } finally {
      setDownloadingCustomerId(null);
    }
  };

  const handleWhatsApp = (customer: CustomerLedger, kind: "report" | "request" = "request") => {
    if (!customer.phone) {
      toast.error(t("messages.noPhone") || "No phone number.");
      return;
    }

    const message =
      kind === "report"
        ? buildDebtReportMessage(customer)
        : buildPaymentRequestMessage(customer);

    openWhatsAppPrompt(customer.phone, message);
  };

  const openPayment = (customer: CustomerLedger) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission") || "No permission.");
      return;
    }

    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (paymentAmount: number, thankYouMessage: string) => {
    if (!isOwner || !selectedCustomer) {
      toast.error(t("errors.noPermission") || "No permission.");
      return;
    }

    if (paymentAmount <= 0) {
      toast.error(t("payment.invalidAmount") || "Invalid amount.");
      return;
    }

    const nowIso = new Date().toISOString();

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

      if (selectedCustomer.phone) {
        const remainingPreview = Math.max(selectedCustomer.remaining - paymentAmount, 0);
        const message =
          remainingPreview <= 0
            ? thankYouMessage
            : `${thankYouMessage}\n\n${t("debts.remainingDebt") || "Remaining Debt"}: ${formatCurrency(
                remainingPreview
              )}`;

        openWhatsAppPrompt(selectedCustomer.phone, message);
      }

      toast.success(t("payment.paymentSuccess") || "Payment recorded.");
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
      toast.error(t("payment.paymentFailed") || "Payment failed.");
    }
  };

  const handleDelete = async (customer: CustomerLedger) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission") || "No permission.");
      return;
    }

    const confirmed = window.confirm(t("debts.confirmDeleteLedger") || "Delete this debt ledger?");
    if (!confirmed) return;

    try {
      const deleteResponse = await (supabase as any)
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (deleteResponse.error) throw deleteResponse.error;

      toast.success(t("debts.ledgerDeleted") || "Debt ledger deleted.");
      setSelectedCustomer(null);

      window.dispatchEvent(new CustomEvent("debtDeleted"));
      window.dispatchEvent(new CustomEvent("clientDeleted"));

      await fetchLedgers();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(t("debts.deleteFailed") || "Delete failed.");
    }
  };

  return (
    <AppShell
      title={t("debts.title") || "Debts"}
      subtitle={t("debts.debtReport") || "Debt report"}
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
      headerRight={
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <Button
                onClick={downloadFullList}
                disabled={isDownloading}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-green-500/40 px-3 text-xs font-semibold text-green-700 hover:bg-green-50"
              >
                {isDownloading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500/30 border-t-green-500" />
                ) : (
                  <Download size={15} />
                )}
                <span className="ml-1 hidden sm:inline">PDF</span>
              </Button>

              <Button
                onClick={() => void downloadFullListCsv()}
                disabled={isExportingCsv}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-blue-500/40 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                {isExportingCsv ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
                ) : (
                  <FileText size={15} />
                )}
                <span className="ml-1 hidden sm:inline">CSV / Excel</span>
              </Button>
            </>
          )}

          <Button
            onClick={() => navigate("/add-debt")}
            size="sm"
            className="h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={15} className="mr-1" />
            {t("navigation.addDebt") || "Add Debt"}
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t("common.search") || "Search"}...`}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] bg-slate-900 p-4 text-white shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {t("debts.totalDebt") || "Total Debt"}
            </p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalUnpaid)}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("dashboard.totalCustomers") || "Total Customers"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {filteredCustomers.length}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-600">
                <Users size={16} />
                <span className="text-xs font-semibold">
                  {t("debts.debtReport") || "Debt Report"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {filteredCustomers.length === 0 && !loading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Users size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">
              {t("debts.noDebts") || "No debts found."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="cursor-pointer rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                        ? t("debts.noItemsRecorded") || "No items recorded"
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
              <div className="col-span-full rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">{t("common.loading") || "Loading..."}</p>
              </div>
            )}
          </div>
        )}

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
                        {(t("debts.dueDate") || "Due Date")}: {formatDate(selectedCustomer.due_date)}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {t("debts.totalDebtTaken") || "Total Debt"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatCurrency(selectedCustomer.totalDebt)}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-700">
                    {t("debts.totalPaid") || "Total Paid"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-800">
                    {formatCurrency(selectedCustomer.totalPaid)}
                  </p>
                </div>

                <div className="rounded-2xl bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-700">
                    {t("debts.remainingDebt") || "Remaining Debt"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-red-700">
                    {formatCurrency(selectedCustomer.remaining)}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {t("debts.debtItems") || "Debt Items"}
                  </h3>

                  {selectedCustomer.items.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      {t("debts.noItemsRecorded") || "No items recorded"}
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
                              {(t("common.status") || "Status")}: {item.status}
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
                    {t("debts.paymentHistory") || "Payment History"}
                  </h3>

                  {selectedCustomer.payments.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      {t("debts.noPaymentsRecorded") || "No payments recorded"}
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
                              {(t("payment.recordPayment") || "Payment")} {formatCurrency(payment.amount_paid)}
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

              <div className="mt-6 flex flex-wrap justify-center gap-4">
                {selectedCustomer.phone && (
                  <button
                    type="button"
                    onClick={() => handleWhatsApp(selectedCustomer, "report")}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg transition-transform hover:scale-105 hover:bg-green-600"
                    title="WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void downloadCustomerPdf(selectedCustomer)}
                  disabled={downloadingCustomerId === selectedCustomer.id}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 shadow-lg transition-transform hover:scale-105 hover:bg-blue-700 disabled:opacity-60"
                  title={t("messages.downloadCustomerPdf") || "Download Customer PDF"}
                >
                  {downloadingCustomerId === selectedCustomer.id ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <FileText size={26} className="text-white" />
                  )}
                </button>

                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => openPayment(selectedCustomer)}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-lg transition-transform hover:scale-105 hover:bg-emerald-700"
                      title={t("debts.registerPayment") || "Register Payment"}
                    >
                      <Check size={28} className="text-white" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(selectedCustomer)}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform hover:scale-105 hover:bg-red-700"
                      title={t("common.delete") || "Delete"}
                    >
                      <Trash2 size={26} className="text-white" />
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

        {whatsAppPrompt.open && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4">
            <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Open WhatsApp</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Your message is ready. Open WhatsApp or copy the text first.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeWhatsAppPrompt}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-44 overflow-auto rounded-2xl bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
                {whatsAppPrompt.message}
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    void openWhatsAppSmart(whatsAppPrompt.phone, whatsAppPrompt.message);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <ExternalLink size={16} />
                  Open WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void copyText(whatsAppPrompt.message);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Copy size={16} />
                  Copy Message
                </button>

                <button
                  type="button"
                  onClick={closeWhatsAppPrompt}
                  className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Back to App
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default DebtsPage;