import { PIN_LENGTH, normalizePhone, type LocalAccount } from "@/lib/auth";

const REMEMBERED_ACCOUNTS_KEY = "businessledger_remembered_accounts_v1";

const readAccounts = (): LocalAccount[] => {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalAccount[];
  } catch {
    localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
    return [];
  }
};

export interface LocalAuthAccount {
  phone: string;
  displayName: string;
  pinHash: string;
}

export async function hashPin(pin: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const loadLocalAccounts = () => readAccounts();

export const saveLocalAccounts = (accounts: LocalAccount[]) => {
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts));
  return accounts;
};

export const findLocalAccount = (phone: string) => {
  const normalized = normalizePhone(phone);
  return (
    readAccounts().find(
      (account) => normalizePhone(account.phone) === normalized
    ) ?? null
  );
};

export const saveLocalAccount = async () => {
  throw new Error(
    "saveLocalAccount is deprecated. Use Supabase Auth + profiles instead."
  );
};

export const removeLocalAccount = (phone: string) => {
  const normalized = normalizePhone(phone);
  const remaining = readAccounts().filter(
    (account) => normalizePhone(account.phone) !== normalized
  );
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(remaining));
  return remaining;
};

export const setCurrentLocalAccount = () => {
  // intentionally no-op
};

export const getCurrentLocalAccount = () => null;

export const clearCurrentLocalAccount = () => {
  // intentionally no-op
};

export const loadRememberedAccounts = () =>
  readAccounts().map((account) => ({
    phone: account.phone,
    displayName: account.displayName,
  }));

export { PIN_LENGTH };