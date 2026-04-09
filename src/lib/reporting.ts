import { supabase } from "@/integrations/supabase/client";

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
