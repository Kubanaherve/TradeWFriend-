import { hashPin } from "@/lib/localAuth";
import {
  clearCurrentLocalAccount,
  findLocalAccount,
  getCurrentLocalAccount,
  getOwnerAccount,
  getEmployeeAccounts,
  hasOwnerAccount,
  removeLocalAccount,
  saveLocalAccount,
  setCurrentLocalAccount,
  LocalAuthAccount,
  UserRole,
} from "@/lib/localAuth";

export interface AuthResponse {
  success: boolean;
  error?: string;
  account?: LocalAuthAccount | null;
}

export const authService = {
  hasOwner: () => hasOwnerAccount(),
  getOwner: () => getOwnerAccount(),
  getEmployees: () => getEmployeeAccounts(),
  getCurrentUser: () => {
    const currentPhone = getCurrentLocalAccount();
    if (!currentPhone) return null;
    return findLocalAccount(currentPhone);
  },
  createOwner: async (phone: string, displayName: string, pin: string) => {
    const account = await saveLocalAccount(phone, displayName, pin, "owner");
    return account;
  },
  createEmployee: async (phone: string, displayName: string, pin: string) => {
    if (!hasOwnerAccount()) {
      throw new Error("Owner account is required before creating employees.");
    }
    const existing = findLocalAccount(phone);
    if (existing && existing.role === "owner") {
      throw new Error("A user with that phone already exists as owner.");
    }
    const account = await saveLocalAccount(phone, displayName, pin, "employee");
    return account;
  },
  deleteEmployee: (phone: string) => {
    const account = findLocalAccount(phone);
    if (!account) {
      throw new Error("Account not found.");
    }
    if (account.role !== "employee") {
      throw new Error("Only employee accounts may be deleted here.");
    }
    return removeLocalAccount(phone);
  },
  login: async (phone: string, pin: string): Promise<AuthResponse> => {
    const account = findLocalAccount(phone);
    if (!account) {
      return { success: false, error: "Konti ntiboneka" };
    }
    const pinHash = await hashPin(pin);
    if (pinHash !== account.pinHash) {
      return { success: false, error: "PIN ntiyemera" };
    }
    setCurrentLocalAccount(account.phone);
    return { success: true, account };
  },
  logout: () => {
    clearCurrentLocalAccount();
  },
};
