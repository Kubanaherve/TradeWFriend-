import { supabase } from "@/integrations/supabase/client";
import {
  getOwnerAccount,
  loadLocalAccounts,
  saveLocalAccounts,
  clearCurrentLocalAccount,
} from "@/lib/localAuth";
import { clearTransactions } from "@/services/transactionService";

export const performFactoryReset = async () => {
  const allAccounts = loadLocalAccounts();
  const ownerAccounts = allAccounts.filter((account) => account.role === "owner");

  saveLocalAccounts(ownerAccounts);
  clearCurrentLocalAccount();

  await clearTransactions();

  await Promise.all([
    supabase.from("customers").delete(),
    supabase.from("sales").delete(),
    supabase.from("inventory_items").delete(),
    supabase.from("app_settings").delete(),
    supabase.from("profiles").delete(),
    supabase.from("employees").delete(),
  ]).catch((error) => {
    console.warn("Factory reset cleanup warning", error);
  });
};
