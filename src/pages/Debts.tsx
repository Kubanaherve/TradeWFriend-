import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, formatCurrency, formatDate, smsTemplates } from "@/lib/kinyarwanda";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAuth } from "@/contexts/AuthContext";
import { getDateKeyFromIso } from "@/lib/reporting";
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

const PAGE_SIZE = 50;

const DebtsPage = () => {
  const navigate = useNavigate();
  const { settings: businessSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const { recordTransaction } = useAppStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const isMobileDevice = () =>
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

  // ── Fetch paginated customers ──────────────────────────────────────────────
  const fetchCustomers = useCallback(async (pageNumber = 1, query = "") => {
    setLoading(true);
    try {
      let supabaseQuery = supabase
        .from("customers")
        .select("id, name, phone, items, amount, due_date, is_paid, created_at")
        .eq("is_paid", false)
        .order("created_at", { ascending: false })
        .range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1);

      if (query) supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);

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

  useEffect(() => {
    fetchCustomers(1, searchQuery);
    setPage(1);
  }, [fetchCustomers, searchQuery]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleScroll = () => {
    if (!containerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchCustomers(page + 1, searchQuery);
      setPage(prev => prev + 1);
    }
  };

  // ── Parse items stored as JSON ─────────────────────────────────────────────
  const parseItems = (raw: string | null): string => {
    if (!raw) return "Ntabwo byanditswe";
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "Ntabwo byanditswe";
        // ["Gold ring 2", "Bracelet 1"]  ← string array
        if (typeof parsed[0] === "string") return parsed.join(", ");
        // [{name, quantity}]             ← object array
        if (typeof parsed[0] === "object") {
          return parsed
            .map((p: { name?: string; quantity?: number }) =>
              `${p.name ?? "?"} x${p.quantity ?? 1}`
            )
            .join(", ");
        }
      }
      return String(raw);
    } catch {
      return String(raw);
    }
  };

  // ── Download full PDF (real multi-page, no print dialog) ──────────────────
  const downloadFullList = async () => {
    setIsDownloading(true);
    toast.info("Gutegura PDF...");

    try {
      // Fetch EVERY unpaid customer — no range / pagination limit
      const { data: allCustomers, error } = await supabase
        .from("customers")
        .select("name, phone, items, amount, due_date, created_at")
        .eq("is_paid", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = allCustomers || [];
      const grandTotal = list.reduce((sum, c) => sum + Number(c.amount || 0), 0);

      const today = new Date().toLocaleDateString("fr-RW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // ── Initialise A4 portrait PDF ─────────────────────────────────────────
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();   // 210
      const pageH = doc.internal.pageSize.getHeight();  // 297
      const margin = 13;

      // ── Helper: draw navy top-bar ─────────────────────────────────────────
      const drawTopBar = (full: boolean) => {
        doc.setFillColor(30, 58, 138); // navy
        doc.rect(0, 0, pageW, full ? 26 : 12, "F");

        if (full) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.setTextColor(255, 255, 255);
          doc.text(businessSettings.businessName, pageW / 2, 10, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(180, 205, 255);
          doc.text(
            "Raporo y'Amafaranga Yose y'Ideni — Abakiriya Batarishe",
            pageW / 2, 17, { align: "center" }
          );
          doc.setFontSize(7.5);
          doc.setTextColor(150, 180, 230);
          doc.text(`Isohotse ku itariki: ${today}`, pageW / 2, 23, { align: "center" });
        } else {
          // Continuation pages — compact bar
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(
            `${businessSettings.businessName} — Raporo y'Ideni (ikurikira)`,
            pageW / 2, 8, { align: "center" }
          );
        }
      };

      drawTopBar(true);

      // ── Summary cards (3 boxes) ────────────────────────────────────────────
      const cardY = 30;
      const cardH = 17;
      const cardW = (pageW - margin * 2 - 8) / 3;

      const cards = [
        {
          label: "UMUBARE W'ABAKIRIYA",
          value: `${list.length}`,
          rgb: [30, 58, 138] as [number, number, number],
        },
        {
          label: "AMAFARANGA YOSE Y'IDENI",
          value: formatCurrency(grandTotal),
          rgb: [185, 28, 28] as [number, number, number],
        },
        {
          label: "ITARIKI YA RAPORO",
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

      // ── Build table body rows ──────────────────────────────────────────────
      const bodyRows = list.map((c, i) => [
        (i + 1).toString(),
        c.name || "Ntazwi",
        c.phone || "Ntafite",
        parseItems(c.items),          // ✅ fixed items
        formatCurrency(c.amount),
        c.due_date
          ? new Date(c.due_date).toLocaleDateString("fr-RW")
          : "Ntiyagenwe",
        new Date(c.created_at).toLocaleDateString("fr-RW"),
      ]);

      // Grand-total row appended at the bottom
      bodyRows.push([
        "", "", "",
        "AMAFARANGA YOSE Y'IDENI:",
        formatCurrency(grandTotal),
        "", "",
      ]);

      // ── Draw auto-paginating table ─────────────────────────────────────────
      autoTable(doc, {
        startY: cardY + cardH + 5,
        head: [[
          "#",
          "Izina ry'Umukiriya",
          "Telefoni",
          "Ibyo Yafashe",
          "Amafaranga y'Ideni",
          "Azishyura Ryari",
          "Yinjiye Ryari",
        ]],
        body: bodyRows,
        margin: { left: margin, right: margin, bottom: 14 },

        // ── Global cell style ──────────────────────────────────────────────
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

        // ── Header row style ───────────────────────────────────────────────
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "left",
          cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        },

        // ── Per-column widths & alignment ──────────────────────────────────
        columnStyles: {
          0: { cellWidth: 8,  halign: "center", textColor: [160, 160, 160] }, // #
          1: { cellWidth: 36, fontStyle: "bold" },                             // Izina
          2: { cellWidth: 26 },                                                 // Telefoni
          3: { cellWidth: 50, textColor: [90, 90, 90], fontSize: 7.5 },        // Ibyo yafashe
          4: { cellWidth: 32, halign: "right",
               textColor: [185, 28, 28], fontStyle: "bold" },                  // Amafaranga
          5: { cellWidth: 22, halign: "center" },                              // Azishyura
          6: { cellWidth: 22, halign: "center",
               textColor: [160, 160, 160], fontSize: 7 },                      // Yinjiye
        },

        // ── Zebra stripes ──────────────────────────────────────────────────
        alternateRowStyles: { fillColor: [248, 250, 252] },

        // ── Style grand-total row differently ─────────────────────────────
        didParseCell: (data) => {
          if (data.row.index === bodyRows.length - 1) {
            data.cell.styles.fillColor   = [254, 226, 226];
            data.cell.styles.textColor   = [185, 28, 28];
            data.cell.styles.fontStyle   = "bold";
            data.cell.styles.fontSize    = 8.5;
          }
        },

        // ── Per-page header + footer ───────────────────────────────────────
        didDrawPage: (data) => {
          const pageNum =
            (doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } })
              .getCurrentPageInfo().pageNumber;

          // Continuation pages get the compact bar
          if (pageNum > 1) drawTopBar(false);

          // Bottom footer on every page
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(170, 170, 170);
          doc.text(
            `Urupapuro ${pageNum}  |  Abakiriya ${list.length}  |  ${formatCurrency(grandTotal)}  |  ${businessSettings.businessName}`,
            pageW / 2,
            pageH - 5,
            { align: "center" }
          );
        },
      });

      // ── Save directly as .pdf ──────────────────────────────────────────────
      const filename = `debts-${businessSettings.businessName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);

      toast.success(`PDF y'abakiriya ${list.length} yamanitswe! ✨`);
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Habaye ikosa mu gutegura PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Communication handlers ─────────────────────────────────────────────────
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  };

  const handleSMS = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    if (!canSendSMS()) return;
    const message = smsTemplates.debtReminder(
      customer.items!,
      formatCurrency(customer.amount!)
    );
    window.location.href = `sms:${customer.phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
  };

  const handleWhatsApp = (customer: Customer) => {
    if (!customer.phone) return toast.error("Umukiriya nta numero afite");
    if (!canSendWhatsApp()) return;

    let cleanPhone = customer.phone.replace(/\s/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "250" + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith("250") && !cleanPhone.startsWith("+"))
      cleanPhone = "250" + cleanPhone;
    cleanPhone = cleanPhone.replace("+", "");

    const message = smsTemplates.debtReminder(
      customer.items!,
      formatCurrency(customer.amount!)
    );
    window.location.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const openPayment = (customer: Customer) => {
    if (!isOwner) {
      toast.error("Ntubifitiye uburenganzira."
      );
      return;
    }
    if (!customer.phone) {
      toast.warning("Ntushobora kohereza ubutumwa kuri uyu mukiriya mbere yo kwishyura.");
    } else if (!isMobileDevice()) {
      toast.warning("Kohereza ubutumwa kuri telefoni birakenewe mbere yo kwishyura.");
    }
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  // ── Payment handler ────────────────────────────────────────────────────────
  const handlePayment = async (paymentAmount: number, thankYouMessage: string) => {
    if (!isOwner) {
      toast.error("Ntubifitiye uburenganzira.");
      return;
    }
    if (!selectedCustomer) return;

    // ✅ WhatsApp FIRST — synchronous before any await (avoids popup blocker)
    if (selectedCustomer.phone) {
      let cleanPhone = selectedCustomer.phone.replace(/\s/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "250" + cleanPhone.substring(1);
      else if (!cleanPhone.startsWith("250") && !cleanPhone.startsWith("+"))
        cleanPhone = "250" + cleanPhone;
      cleanPhone = cleanPhone.replace("+", "");

      const remainingPreview = (selectedCustomer.amount || 0) - paymentAmount;
      const message =
        remainingPreview <= 0
          ? thankYouMessage
          : `${thankYouMessage}\n\nAmafaranga asigaye: ${formatCurrency(remainingPreview)}`;

      window.open(
        `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    }

    try {
      const originalAmount = selectedCustomer.amount || 0;
      const newAmount = originalAmount - paymentAmount;
      const nowIso = new Date().toISOString();
      const todayKey = getDateKeyFromIso(nowIso);

      const { error: updateError } = await supabase
        .from("customers")
        .update(
          newAmount <= 0
            ? { is_paid: true, paid_at: nowIso, amount: 0, updated_at: nowIso }
            : { amount: newAmount, updated_at: nowIso }
        )
        .eq("id", selectedCustomer.id);

      if (updateError) throw updateError;

      await recordTransaction({
        transaction_type: "payment",
        amount: paymentAmount,
        date: nowIso,
        description: `Payment from ${selectedCustomer.name}`,
        related_id: selectedCustomer.id,
        created_by: null,
        metadata: {
          customer_name: selectedCustomer.name,
          outstanding_before: originalAmount,
          outstanding_after: newAmount,
        },
      });

      toast.success("Byishyuwe neza! ✨");
      setPaymentModalOpen(false);
      fetchCustomers(1, searchQuery);
      setPage(1);

      window.dispatchEvent(
        new CustomEvent("paymentMade", {
          detail: {
            paymentAmount,
            affectsTodayDebt:
              getDateKeyFromIso(selectedCustomer.created_at) === todayKey,
          },
        })
      );
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Habaye ikosa mu kwishyura");
    }
  };

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async (customer: Customer) => {
    if (!isOwner) {
      toast.error("Ntubifitiye uburenganzira.");
      return;
    }
    if (!confirm(`${labels.confirmDelete} ${customer.name}?`)) return;

    try {
      const itemsArray: { name: string; quantity: number }[] = customer.items
        ? JSON.parse(customer.items)
        : [];

      for (const item of itemsArray) {
        const { data: inventoryItem, error: fetchError } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("item_name", item.name)
          .maybeSingle();

        if (fetchError) throw fetchError;
        const currentQty = Number(inventoryItem?.quantity) || 0;

        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({ quantity: currentQty + item.quantity })
          .eq("item_name", item.name);

        if (updateError) throw updateError;
      }

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">

      {/* ── Header ── */}
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

          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            {isOwner && (
              <Button
                onClick={downloadFullList}
                disabled={isDownloading}
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1 border-green-500/50 text-green-700 hover:bg-green-50"
              >
              {isDownloading ? (
                <div className="w-3 h-3 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {isDownloading ? "..." : "PDF"}
            </Button>
            )}

            <Button
              onClick={() => navigate("/add-debt")}
              size="sm"
              className="btn-navy h-8 px-3 text-xs"
            >
              <Plus size={14} className="mr-1" />
              {labels.addNew}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main list ── */}
      <main
        className="p-4 max-w-4xl mx-auto space-y-4 overflow-auto animate-fade-in"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        ref={containerRef}
        onScroll={handleScroll}
      >
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={labels.search + "..."}
          className="pl-3 bg-white/70 input-glow"
        />

        {/* Total banner */}
        <div className="glass-card-dark p-4 flex items-center justify-between gold-glow">
          <div>
            <p className="text-xs text-primary-foreground/70">{labels.totalDebt}</p>
            <p className="text-xl font-bold text-primary-foreground">
              {formatCurrency(totalUnpaid)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Shortcut PDF icon inside banner */}
            <button
              onClick={downloadFullList}
              disabled={isDownloading}
              className="flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              title="Manura PDF yuzuye"
            >
              <FileText size={15} />
              <span className="hidden sm:inline text-[11px]">Manura PDF</span>
            </button>
            <div className="flex items-center gap-1 text-primary-foreground/70">
              <Users size={16} />
              <span className="text-sm">{customers.length}</span>
            </div>
          </div>
        </div>

        {/* Customer cards */}
        {customers.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{labels.noDebts}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map(customer => (
              <div
                key={customer.id}
                className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">{customer.name}</p>
                  <p className="font-semibold text-destructive">
                    {formatCurrency(customer.amount)}
                  </p>
                </div>
                {customer.items && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {parseItems(customer.items)}
                  </p>
                )}
              </div>
            ))}
            {loading && (
              <p className="text-center text-sm py-2 text-muted-foreground">
                Gutegereza...
              </p>
            )}
          </div>
        )}
      </main>

      {/* ── Customer detail modal ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-end sm:items-center p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-6 shadow-xl animate-fade-in max-h-[90vh] overflow-auto">

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold truncate">{selectedCustomer.name}</h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-900 text-2xl font-bold leading-none"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-2 text-gray-700">
              {selectedCustomer.items && (
                <p className="text-sm">
                  Ibyo yafashe ni: {parseItems(selectedCustomer.items)}
                </p>
              )}
              <p className="text-xl font-semibold text-gray-900">
                Amafaranga: {formatCurrency(selectedCustomer.amount)}
              </p>
              {selectedCustomer.due_date && (
                <p className="text-sm">
                  Itariki azishyura: {formatDate(selectedCustomer.due_date)}
                </p>
              )}
              {selectedCustomer.phone && (
                <p className="text-sm">Nimero: {selectedCustomer.phone}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {selectedCustomer.phone && (
                <>
                  {/* WhatsApp */}
                  <button
                    onClick={() => handleWhatsApp(selectedCustomer)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 shadow-md hover:scale-110 transition-transform"
                    title="WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="w-9 h-9 fill-green-500">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </button>

                  {/* SMS */}
                  <button
                    onClick={() => handleSMS(selectedCustomer)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 shadow-md hover:scale-110 transition-transform"
                    title="SMS"
                  >
                    <MessageCircle size={30} className="text-blue-500" />
                  </button>

                  {/* Call */}
                  <button
                    onClick={() => handleCall(selectedCustomer.phone!)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 shadow-md hover:scale-110 transition-transform"
                    title="Hamagara"
                  >
                    <Phone size={30} className="text-indigo-500" />
                  </button>
                </>
              )}

              {isOwner && (
                <>
                  {/* Mark as paid */}
                  <button
                    onClick={() => openPayment(selectedCustomer)}
                    className="flex items-center justify-center w-24 h-24 rounded-full bg-blue-700 shadow-xl hover:scale-110 transition-transform"
                    style={{ boxShadow: "0 0 20px #00f6ff, 0 0 40px #00cfff" }}
                    title="Yishyuye"
                  >
                    <Check size={36} className="text-white" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(selectedCustomer)}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-red-600 shadow-xl hover:scale-110 transition-transform"
                    style={{ boxShadow: "0 0 20px #ff4c4c, 0 0 40px #ff2a2a" }}
                    title="Siba"
                  >
                    <Trash2 size={30} className="text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ── */}
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