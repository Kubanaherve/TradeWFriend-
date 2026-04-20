import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./kinyarwanda";

export const DAILY_CUSTOMER_PAYMENTS_PREFIX = "daily_customer_payments_";
export const DAILY_NEW_DEBT_PREFIX = "daily_new_debt_";

export const getDateKeyFromIso = (isoString: string) => isoString.split("T")[0];

export const incrementAppSettingAmount = async (
  settingKey: string,
  amount: number
) => {
  const { data: existingRows, error: fetchError } = await supabase
    .from("app_settings")
    .select("id, setting_value, created_at")
    .eq("setting_key", settingKey)
    .order("created_at", { ascending: true });

  if (fetchError) throw fetchError;

  const currentAmount = (existingRows || []).reduce(
    (sum, row) => sum + (Number(row.setting_value) || 0),
    0
  );
  const nextAmount = currentAmount + amount;

  if (!existingRows || existingRows.length === 0) {
    const { error: insertError } = await supabase.from("app_settings").insert({
      setting_key: settingKey,
      setting_value: nextAmount.toString(),
    });

    if (insertError) throw insertError;
    return;
  }

  const [primaryRow, ...duplicateRows] = existingRows;

  const { error: updateError } = await supabase
    .from("app_settings")
    .update({ setting_value: nextAmount.toString() })
    .eq("id", primaryRow.id);

  if (updateError) throw updateError;

  if (duplicateRows.length > 0) {
    const { error: deleteError } = await supabase
      .from("app_settings")
      .delete()
      .in(
        "id",
        duplicateRows.map((row) => row.id)
      );

    if (deleteError) throw deleteError;
  }
};

export const isDateInFilter = (
  dateKey: string,
  filter: "today" | "week" | "month" | "all",
  now = new Date()
) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const todayKey = getDateKeyFromIso(now.toISOString());

  if (filter === "today") {
    return dateKey === todayKey;
  }

  if (filter === "week") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return date >= start;
  }

  if (filter === "month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  return true;
};

export const generateBusinessReportPDF = (
  businessName: string,
  reportData: Array<{
    date: string;
    salesTotal: number;
    newDebt: number;
    debtsPaid: number;
    unpaidDebt: number;
    receivedTotal: number;
    expectedTotal: number;
  }>,
  summary: {
    salesTotal: number;
    debtsPaid: number;
    unpaidDebt: number;
    receivedTotal: number;
    expectedTotal: number;
  }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(businessName || "Business Report", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(16);
  doc.text("Financial Report", pageWidth / 2, 35, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 45, { align: "center" });

  // Summary section
  let yPos = 60;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryData = [
    ["Total Sales", formatCurrency(summary.salesTotal)],
    ["Debt Payments Received", formatCurrency(summary.debtsPaid)],
    ["Outstanding Debt", formatCurrency(summary.unpaidDebt)],
    ["Total Received", formatCurrency(summary.receivedTotal)],
    ["Total Expected", formatCurrency(summary.expectedTotal)],
  ];

  summaryData.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, 20, yPos);
    yPos += 8;
  });

  yPos += 10;

  // Table
  if (reportData.length > 0) {
    const tableData = reportData.map((report) => [
      new Date(report.date).toLocaleDateString(),
      formatCurrency(report.salesTotal),
      formatCurrency(report.newDebt),
      formatCurrency(report.debtsPaid),
      formatCurrency(report.unpaidDebt),
      formatCurrency(report.receivedTotal),
      formatCurrency(report.expectedTotal),
    ]);

    autoTable(doc, {
      head: [["Date", "Sales", "New Debt", "Paid", "Unpaid", "Received", "Expected"]],
      body: tableData,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });
  }

  // Footer
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  doc.setFontSize(8);
  doc.text(`${businessName || "Business"} - Confidential Report`, pageWidth / 2, Math.max(finalY + 20, pageHeight - 10), { align: "center" });

  return doc;
};
