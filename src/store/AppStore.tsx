import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type TransactionType = "sale" | "debt" | "payment";

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

interface AppStoreState {
  transactions: Transaction[];
  totalSales: number;
  totalDebt: number;
  totalPayments: number;
  todayRevenue: number;
  todayDebt: number;
  isLoading: boolean;
}

type Action =
  | { type: "SET_LOADING" }
  | { type: "SET_STATE"; payload: Omit<AppStoreState, "isLoading"> }
  | { type: "APPEND_TRANSACTION"; payload: Transaction }
  | { type: "RESET_TRANSACTIONS" };

const LOCAL_TX_KEY = "tw_local_transactions_v1";

const initialState: AppStoreState = {
  transactions: [],
  totalSales: 0,
  totalDebt: 0,
  totalPayments: 0,
  todayRevenue: 0,
  todayDebt: 0,
  isLoading: true,
};

const reducer = (state: AppStoreState, action: Action): AppStoreState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: true };

    case "SET_STATE":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
      };

    case "APPEND_TRANSACTION":
      return {
        ...state,
        transactions: [...state.transactions, action.payload],
      };

    case "RESET_TRANSACTIONS":
      return {
        ...initialState,
        isLoading: false,
      };

    default:
      return state;
  }
};

interface AppStoreContextValue extends AppStoreState {
  loadTransactions: () => Promise<void>;
  recordTransaction: (transaction: Omit<Transaction, "id">) => Promise<Transaction>;
  clearAllTransactions: () => Promise<void>;
}

const AppStoreContext = createContext<AppStoreContextValue | undefined>(undefined);

const getDateKeyFromIso = (iso: string) => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => getDateKeyFromIso(new Date().toISOString());

const readLocalTransactions = (): Transaction[] => {
  try {
    const raw = localStorage.getItem(LOCAL_TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(LOCAL_TX_KEY);
    return [];
  }
};

const saveLocalTransactions = (transactions: Transaction[]) => {
  localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(transactions));
};

export const AppStoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadTransactions = useCallback(async () => {
    dispatch({ type: "SET_LOADING" });

    try {
      const [salesResponse, debtItemsResponse, debtPaymentsResponse] = await Promise.all([
        (supabase as any)
          .from("sales")
          .select("id, sale_price, quantity, created_at"),
        (supabase as any)
          .from("debt_items")
          .select("id, customer_id, total_price, date_taken"),
        (supabase as any)
          .from("debt_payments")
          .select("id, customer_id, amount_paid, paid_at"),
      ]);

      if (salesResponse.error) throw salesResponse.error;
      if (debtItemsResponse.error) throw debtItemsResponse.error;
      if (debtPaymentsResponse.error) throw debtPaymentsResponse.error;

      const salesData = (salesResponse.data ?? []) as Array<{
        id: string;
        sale_price: number;
        quantity: number;
        created_at: string;
      }>;

      const debtItemsData = (debtItemsResponse.data ?? []) as Array<{
        id: string;
        customer_id: string;
        total_price: number;
        date_taken: string;
      }>;

      const debtPaymentsData = (debtPaymentsResponse.data ?? []) as Array<{
        id: string;
        customer_id: string;
        amount_paid: number;
        paid_at: string;
      }>;

      const salesTransactions: Transaction[] = salesData.map((sale) => ({
        id: `sale-${sale.id}`,
        transaction_type: "sale",
        amount: (Number(sale.sale_price) || 0) * (Number(sale.quantity) || 0),
        date: sale.created_at,
        description: "Sale recorded",
        related_id: sale.id,
        created_by: null,
        metadata: {
          quantity: Number(sale.quantity) || 0,
          unit_price: Number(sale.sale_price) || 0,
        },
      }));

      const debtTransactions: Transaction[] = debtItemsData.map((item) => ({
        id: `debt-${item.id}`,
        transaction_type: "debt",
        amount: Number(item.total_price) || 0,
        date: item.date_taken,
        description: "Debt recorded",
        related_id: item.customer_id,
        created_by: null,
        metadata: null,
      }));

      const paymentTransactions: Transaction[] = debtPaymentsData.map((payment) => ({
        id: `payment-${payment.id}`,
        transaction_type: "payment",
        amount: Number(payment.amount_paid) || 0,
        date: payment.paid_at,
        description: "Debt payment recorded",
        related_id: payment.customer_id,
        created_by: null,
        metadata: null,
      }));

      const localTransactions = readLocalTransactions();

      const allTransactions = [
        ...salesTransactions,
        ...debtTransactions,
        ...paymentTransactions,
        ...localTransactions,
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalSales = salesTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalDebtIssued = debtTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalPayments = paymentTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalDebt = Math.max(totalDebtIssued - totalPayments, 0);

      const today = todayKey();

      const todaySales = salesTransactions
        .filter((tx) => getDateKeyFromIso(tx.date) === today)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const todayPayments = paymentTransactions
        .filter((tx) => getDateKeyFromIso(tx.date) === today)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const todayDebt = debtTransactions
        .filter((tx) => getDateKeyFromIso(tx.date) === today)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const todayRevenue = todaySales + todayPayments;

      dispatch({
        type: "SET_STATE",
        payload: {
          transactions: allTransactions,
          totalSales,
          totalDebt,
          totalPayments,
          todayRevenue,
          todayDebt,
        },
      });
    } catch (error) {
      console.error("Error loading app store data:", error);

      const localTransactions = readLocalTransactions();

      dispatch({
        type: "SET_STATE",
        payload: {
          transactions: localTransactions,
          totalSales: 0,
          totalDebt: 0,
          totalPayments: 0,
          todayRevenue: 0,
          todayDebt: 0,
        },
      });
    }
  }, []);

  const recordTransaction = useCallback(
    async (transaction: Omit<Transaction, "id">) => {
      const saved: Transaction = {
        ...transaction,
        id: crypto.randomUUID(),
      };

      const current = readLocalTransactions();
      const updated = [...current, saved];
      saveLocalTransactions(updated);

      dispatch({ type: "APPEND_TRANSACTION", payload: saved });

      return saved;
    },
    []
  );

  const clearAllTransactions = useCallback(async () => {
    localStorage.removeItem(LOCAL_TX_KEY);
    dispatch({ type: "RESET_TRANSACTIONS" });
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const value = useMemo(
    () => ({
      ...state,
      loadTransactions,
      recordTransaction,
      clearAllTransactions,
    }),
    [state, loadTransactions, recordTransaction, clearAllTransactions]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export const useAppStore = () => {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
};