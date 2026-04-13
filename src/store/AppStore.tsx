import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  addTransaction,
  clearTransactions,
  getTransactionSummary,
  loadOrCreateTransactions,
  type Transaction,
} from "@/services/transactionService";

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
  | { type: "SET_TRANSACTIONS"; payload: Transaction[] }
  | { type: "APPEND_TRANSACTION"; payload: Transaction }
  | { type: "RESET_TRANSACTIONS" };

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
    case "SET_TRANSACTIONS": {
      const summary = getTransactionSummary(action.payload);
      return {
        ...state,
        transactions: action.payload,
        totalSales: summary.totalSales,
        totalDebt: summary.totalDebt,
        totalPayments: summary.totalPayments,
        todayRevenue: summary.todayRevenue,
        todayDebt: summary.todayDebt,
        isLoading: false,
      };
    }
    case "APPEND_TRANSACTION": {
      const updated = [...state.transactions, action.payload];
      const summary = getTransactionSummary(updated);
      return {
        ...state,
        transactions: updated,
        totalSales: summary.totalSales,
        totalDebt: summary.totalDebt,
        totalPayments: summary.totalPayments,
        todayRevenue: summary.todayRevenue,
        todayDebt: summary.todayDebt,
        isLoading: false,
      };
    }
    case "RESET_TRANSACTIONS":
      return { ...initialState, isLoading: false };
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

export const AppStoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadTransactions = useCallback(async () => {
    dispatch({ type: "SET_LOADING" });
    try {
      const transactions = await loadOrCreateTransactions();
      dispatch({ type: "SET_TRANSACTIONS", payload: transactions });
    } catch (error) {
      console.error("Error loading transactions:", error);
      dispatch({ type: "SET_TRANSACTIONS", payload: [] });
    }
  }, []);

  const recordTransaction = useCallback(async (transaction: Omit<Transaction, "id">) => {
    const saved = await addTransaction(transaction);
    dispatch({ type: "APPEND_TRANSACTION", payload: saved });
    return saved;
  }, []);

  const clearAllTransactions = useCallback(async () => {
    await clearTransactions();
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
