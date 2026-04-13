import { supabase } from "@/integrations/supabase/client";
import { getDateKeyFromIso } from "@/lib/reporting";
import { loadLocalAccounts } from "@/lib/localAuth";

export type TransactionType =
  | "sale"
  | "debt"
  | "payment"
  | "inventory"
  | "reset";

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  date: string;
  description: string;
  related_id?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
}

const STORAGE_KEY = "tradewfriend_transactions";

const normalizeAmount = (value: unknown) => Number(value ?? 0) || 0;

const parseSavedTransactions = (raw: string | null): Transaction[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

const saveLocalTransactions = (transactions: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export const loadLocalTransactions = (): Transaction[] =>
  parseSavedTransactions(localStorage.getItem(STORAGE_KEY));

export const clearLocalTransactions = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const fetchTransactionsFromDb = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, transaction_type, amount, date, description, related_id, created_by, metadata"
    )
    .order("date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    transaction_type: row.transaction_type as TransactionType,
    amount: normalizeAmount(row.amount),
    date: row.date,
    description: row.description,
    related_id: row.related_id,
    created_by: row.created_by,
    metadata: row.metadata,
  }));
};

export const persistTransactionToDb = async (
  transaction: Omit<Transaction, "id">,
): Promise<Transaction> => {
  const insertPayload = {
    transaction_type: transaction.transaction_type,
    amount: transaction.amount,
    date: transaction.date,
    description: transaction.description,
    related_id: transaction.related_id,
    created_by: transaction.created_by,
    metadata: transaction.metadata,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(insertPayload)
    .select("id, transaction_type, amount, date, description, related_id, created_by, metadata")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    transaction_type: data.transaction_type as TransactionType,
    amount: normalizeAmount(data.amount),
    date: data.date,
    description: data.description,
    related_id: data.related_id,
    created_by: data.created_by,
    metadata: data.metadata,
  };
};

export const buildTransactionsFromExistingData = async (): Promise<Transaction[]> => {
  const [salesResult, customersResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_price, quantity, item_name, created_at, employee_phone")
      .order("created_at", { ascending: true }),
    supabase
      .from("customers")
      .select("id, amount, created_at, is_paid, paid_at, name")
      .order("created_at", { ascending: true }),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (customersResult.error) throw customersResult.error;

  const transactions: Transaction[] = [];

  (salesResult.data || []).forEach((sale) => {
    const amount = normalizeAmount(sale.sale_price) * Number(sale.quantity ?? 1);
    transactions.push({
      id: `sale:${sale.id}`,
      transaction_type: "sale",
      amount,
      date: sale.created_at,
      description: `Sale: ${sale.item_name}`,
      related_id: sale.id,
      created_by: sale.employee_phone ?? null,
      metadata: {
        item_name: sale.item_name,
        quantity: sale.quantity,
      },
    });
  });

  (customersResult.data || []).forEach((customer) => {
    const amount = normalizeAmount(customer.amount);
    if (customer.is_paid) {
      transactions.push({
        id: `payment:${customer.id}`,
        transaction_type: "payment",
        amount,
        date: customer.paid_at || customer.created_at,
        description: `Payment from ${customer.name}`,
        related_id: customer.id,
        created_by: null,
        metadata: { customer_name: customer.name },
      });
    } else {
      transactions.push({
        id: `debt:${customer.id}`,
        transaction_type: "debt",
        amount,
        date: customer.created_at,
        description: `Credit for ${customer.name}`,
        related_id: customer.id,
        created_by: null,
        metadata: { customer_name: customer.name },
      });
    }
  });

  if (transactions.length === 0) {
    return [];
  }

  // Persist initial transactions for new systems if the table exists.
  try {
    const { error } = await supabase.from("transactions").insert(
      transactions.map((transaction) => ({
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        date: transaction.date,
        description: transaction.description,
        related_id: transaction.related_id,
        created_by: transaction.created_by,
        metadata: transaction.metadata,
      }))
    );

    if (error) {
      console.warn("Unable to persist bootstrap transactions:", error.message);
    }
  } catch (e) {
    console.warn("Bootstrap transaction persist failed", e);
  }

  saveLocalTransactions(transactions);
  return transactions;
};

export const loadOrCreateTransactions = async (): Promise<Transaction[]> => {
  try {
    const dbTransactions = await fetchTransactionsFromDb();
    if (dbTransactions.length > 0) {
      saveLocalTransactions(dbTransactions);
      return dbTransactions;
    }
  } catch (error) {
    console.warn("Transactions table unavailable, falling back to local storage.", error);
  }

  const localTransactions = loadLocalTransactions();
  if (localTransactions.length > 0) return localTransactions;

  const built = await buildTransactionsFromExistingData();
  if (built.length > 0) return built;

  return [];
};

export const addTransaction = async (
  transaction: Omit<Transaction, "id">,
): Promise<Transaction> => {
  try {
    const saved = await persistTransactionToDb(transaction);
    const local = loadLocalTransactions();
    saveLocalTransactions([...local, saved]);
    return saved;
  } catch (error) {
    const saved = {
      id: `local:${crypto.randomUUID()}`,
      ...transaction,
    };
    const localTransactions = loadLocalTransactions();
    saveLocalTransactions([...localTransactions, saved]);
    return saved;
  }
};

export const clearTransactions = async (): Promise<void> => {
  try {
    await supabase.from("transactions").delete();
  } catch (error) {
    console.warn("Unable to clear transactions table", error);
  }
  clearLocalTransactions();
};

export const getTransactionSummary = (transactions: Transaction[]) => {
  const todayKey = getDateKeyFromIso(new Date().toISOString());
  const totalSales = transactions
    .filter((tx) => tx.transaction_type === "sale")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalDebt = transactions
    .filter((tx) => tx.transaction_type === "debt")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalPayments = transactions
    .filter((tx) => tx.transaction_type === "payment")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const todayRevenue = transactions
    .filter((tx) =>
      tx.date && getDateKeyFromIso(tx.date) === todayKey &&
      (tx.transaction_type === "sale" || tx.transaction_type === "payment")
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const todayDebt = transactions
    .filter((tx) =>
      tx.transaction_type === "debt" &&
      tx.date && getDateKeyFromIso(tx.date) === todayKey
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    totalSales,
    totalDebt,
    totalPayments,
    todayRevenue,
    todayDebt,
  };
};
