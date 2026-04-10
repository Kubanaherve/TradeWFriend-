export interface LocalAuthAccount {
  phone: string;
  displayName: string;
  pinHash: string;
}

const LOCAL_ACCOUNTS_KEY = "tradewfriend_local_accounts";
const LOCAL_CURRENT_ACCOUNT_KEY = "tradewfriend_current_local_account";

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const loadLocalAccounts = (): LocalAuthAccount[] => {
  const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as LocalAuthAccount[];
  } catch {
    localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
    return [];
  }
};

export const saveLocalAccounts = (accounts: LocalAuthAccount[]) => {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  return accounts;
};

export const findLocalAccount = (phone: string) => {
  const normalized = normalizePhone(phone);
  return loadLocalAccounts().find((account) => normalizePhone(account.phone) === normalized) ?? null;
};

export const saveLocalAccount = async (
  phone: string,
  displayName: string,
  pin: string,
) => {
  const normalized = normalizePhone(phone);
  const pinHash = await hashPin(pin);
  const accounts = loadLocalAccounts();
  const filtered = accounts.filter((account) => normalizePhone(account.phone) !== normalized);
  const updated = [...filtered, { phone: normalized, displayName, pinHash }];
  saveLocalAccounts(updated);
  return updated;
};

export const removeLocalAccount = (phone: string) => {
  const normalized = normalizePhone(phone);
  const accounts = loadLocalAccounts().filter(
    (account) => normalizePhone(account.phone) !== normalized,
  );
  saveLocalAccounts(accounts);
  return accounts;
};

export const setCurrentLocalAccount = (phone: string | null) => {
  if (phone === null) {
    localStorage.removeItem(LOCAL_CURRENT_ACCOUNT_KEY);
    return;
  }
  localStorage.setItem(LOCAL_CURRENT_ACCOUNT_KEY, normalizePhone(phone));
};

export const getCurrentLocalAccount = () => {
  const stored = localStorage.getItem(LOCAL_CURRENT_ACCOUNT_KEY);
  if (!stored) return null;
  return normalizePhone(stored);
};

export const clearCurrentLocalAccount = () => {
  localStorage.removeItem(LOCAL_CURRENT_ACCOUNT_KEY);
};

export const loadRememberedAccounts = () =>
  loadLocalAccounts().map((account) => ({
    phone: account.phone,
    displayName: account.displayName,
  }));
