import { supabase } from "@/integrations/supabase/client";
import { getDateKeyFromIso } from "@/lib/reporting";

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

const STORAGE_KEY = "businessledger_transactions_v2";

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

/**
 * No real `transactions` table exists in the current schema.
 * So this returns an empty list and lets the app use real tables + local fallback.
 */
export const fetchTransactionsFromDb = async (): Promise<Transaction[]> => {
  return [];
};

/**
 * No real `transactions` table exists in the current schema.
 * Save only to local storage fallback.
 */
export const persistTransactionToDb = async (
  transaction: Omit<Transaction, "id">
): Promise<Transaction> => {
  const saved: Transaction = {
    id: `local:${crypto.randomUUID()}`,
    ...transaction,
  };

  const existing = loadLocalTransactions();
  saveLocalTransactions([...existing, saved]);

  return saved;
};

export const buildTransactionsFromExistingData = async (): Promise<Transaction[]> => {
  const [salesResult, debtItemsResult, debtPaymentsResult] = await Promise.all([
    (supabase as any)
      .from("sales")
      .select("id, sale_price, quantity, item_name, created_at")
      .order("created_at", { ascending: true }),

    (supabase as any)
      .from("debt_items")
      .select("id, customer_id, item_name, quantity, unit_price, total_price, date_taken")
      .order("date_taken", { ascending: true }),

    (supabase as any)
      .from("debt_payments")
      .select("id, customer_id, amount_paid, paid_at, note")
      .order("paid_at", { ascending: true }),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (debtItemsResult.error) throw debtItemsResult.error;
  if (debtPaymentsResult.error) throw debtPaymentsResult.error;

  const transactions: Transaction[] = [];

  ((salesResult.data ?? []) as Array<{
    id: string;
    sale_price: number;
    quantity: number;
    item_name?: string | null;
    created_at: string;
  }>).forEach((sale) => {
    const amount = normalizeAmount(sale.sale_price) * Number(sale.quantity ?? 1);

    transactions.push({
      id: `sale:${sale.id}`,
      transaction_type: "sale",
      amount,
      date: sale.created_at,
      description: sale.item_name ? `Sale: ${sale.item_name}` : "Sale recorded",
      related_id: sale.id,
      created_by: null,
      metadata: {
        item_name: sale.item_name ?? null,
        quantity: Number(sale.quantity ?? 1),
        unit_price: normalizeAmount(sale.sale_price),
      },
    });
  });

  ((debtItemsResult.data ?? []) as Array<{
    id: string;
    customer_id: string;
    item_name?: string | null;
    quantity: number;
    unit_price?: number | null;
    total_price: number;
    date_taken: string;
  }>).forEach((item) => {
    transactions.push({
      id: `debt:${item.id}`,
      transaction_type: "debt",
      amount: normalizeAmount(item.total_price),
      date: item.date_taken,
      description: item.item_name ? `Debt: ${item.item_name}` : "Debt recorded",
      related_id: item.customer_id,
      created_by: null,
      metadata: {
        item_name: item.item_name ?? null,
        quantity: Number(item.quantity ?? 1),
        unit_price: normalizeAmount(item.unit_price),
      },
    });
  });

  ((debtPaymentsResult.data ?? []) as Array<{
    id: string;
    customer_id: string;
    amount_paid: number;
    paid_at: string;
    note?: string | null;
  }>).forEach((payment) => {
    transactions.push({
      id: `payment:${payment.id}`,
      transaction_type: "payment",
      amount: normalizeAmount(payment.amount_paid),
      date: payment.paid_at,
      description: payment.note?.trim() || "Debt payment recorded",
      related_id: payment.customer_id,
      created_by: null,
      metadata: {
        note: payment.note ?? null,
      },
    });
  });

  transactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  saveLocalTransactions(transactions);
  return transactions;
};

export const loadOrCreateTransactions = async (): Promise<Transaction[]> => {
  const localTransactions = loadLocalTransactions();
  if (localTransactions.length > 0) return localTransactions;

  const built = await buildTransactionsFromExistingData();
  if (built.length > 0) return built;

  return [];
};

export const addTransaction = async (
  transaction: Omit<Transaction, "id">
): Promise<Transaction> => {
  return persistTransactionToDb(transaction);
};

export const clearTransactions = async (): Promise<void> => {
  clearLocalTransactions();
};

export const getTransactionSummary = (transactions: Transaction[]) => {
  const todayKey = getDateKeyFromIso(new Date().toISOString());

  const totalSales = transactions
    .filter((tx) => tx.transaction_type === "sale")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalDebtIssued = transactions
    .filter((tx) => tx.transaction_type === "debt")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalPayments = transactions
    .filter((tx) => tx.transaction_type === "payment")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalDebt = Math.max(totalDebtIssued - totalPayments, 0);

  const todayRevenue = transactions
    .filter(
      (tx) =>
        tx.date &&
        getDateKeyFromIso(tx.date) === todayKey &&
        (tx.transaction_type === "sale" || tx.transaction_type === "payment")
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const todayDebt = transactions
    .filter(
      (tx) =>
        tx.transaction_type === "debt" &&
        tx.date &&
        getDateKeyFromIso(tx.date) === todayKey
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