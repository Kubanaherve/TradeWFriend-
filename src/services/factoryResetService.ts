import { supabase } from "@/integrations/supabase/client";
import {
  loadLocalAccounts,
  saveLocalAccounts,
  clearCurrentLocalAccount,
} from "@/lib/localAuth";
import { clearTransactions } from "@/services/transactionService";

const deleteAllRows = async (table: string) => {
  const { error } = await (supabase as any)
    .from(table)
    .delete()
    .not("id", "is", null);

  if (error) {
    throw error;
  }
};

export const performFactoryReset = async () => {
  const allAccounts = loadLocalAccounts();

  // keep only owner accounts locally
  const ownerAccounts = allAccounts.filter(
    (account: { role?: string }) => account.role === "owner"
  );

  saveLocalAccounts(ownerAccounts);
  clearCurrentLocalAccount();

  await clearTransactions();

  // only delete business data
  const tablesInDeleteOrder = [
    "debt_payments",
    "debt_items",
    "sales",
    "customers",
    "inventory_items",
    "app_settings",
  ];

  for (const table of tablesInDeleteOrder) {
    await deleteAllRows(table);
  }

  window.dispatchEvent(new CustomEvent("paymentMade"));
  window.dispatchEvent(new CustomEvent("newDebtAdded"));
  window.dispatchEvent(new CustomEvent("debtDeleted"));
  window.dispatchEvent(new CustomEvent("clientDeleted"));
  window.dispatchEvent(new CustomEvent("inventoryUpdated"));
  window.dispatchEvent(new CustomEvent("factoryReset"));
};