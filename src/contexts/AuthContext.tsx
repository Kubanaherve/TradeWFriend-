import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "employee";

export type AuthProfile = {
  id: string;
  phone: string;
  displayName: string;
  businessName: string;
  role: UserRole;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
};

type RememberedAccount = {
  phone: string;
  displayName: string;
  businessName: string;
  role: UserRole;
  createdAt: string;
};

type LoginResult = "success" | "wrong" | "not_found" | "inactive";
type SignUpResult = { ok: true } | { ok: false; error: string };

type AuthContextType = {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: AuthProfile | null;
  user: null;
  session: null;

  isOwner: boolean;
  isEmployee: boolean;
  canViewFinancials: boolean;

  signInWithPhonePin: (phone: string, pin: string) => Promise<LoginResult>;
  signUpOwner: (input: {
    displayName: string;
    phone: string;
    pin: string;
    businessName: string;
  }) => Promise<SignUpResult>;

  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  getAllAccounts: () => RememberedAccount[];
  removeAccount: (phone: string) => void;

  hasRole: (role: UserRole | UserRole[]) => boolean;

  verifyPin: (pin: string) => Promise<"success" | "wrong">;

  // compatibility helpers
  loginWithPin: (phone: string, pin: string) => Promise<LoginResult>;
  loginLocal: () => void;
  saveAccount: () => void;
  findAccount: () => undefined;
  toggleFinancials: () => void;
  pinAttempts: number;
  maxPinAttempts: number;
  isPinLocked: boolean;
  pinLockMinutesLeft: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const PIN_LENGTH = 6;

const CURRENT_SESSION_KEY = "tw_current_session_v4";
const REMEMBERED_ACCOUNTS_KEY = "tw_remembered_accounts_v4";

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("250") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 9 && digits.startsWith("7")) {
    return `0${digits}`;
  }

  return digits;
};

export const isValidRwandaPhone = (value: string) => {
  const phone = normalizePhone(value);
  return /^07[2389]\d{7}$/.test(phone);
};

export const isValidPin = (pin: string) => /^\d{6}$/.test(pin);

async function hashPin(pin: string, phone: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${normalizePhone(phone)}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RememberedAccount[];
  } catch {
    localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
    return [];
  }
}

function saveRememberedAccounts(accounts: RememberedAccount[]) {
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function upsertRememberedAccount(account: RememberedAccount) {
  const existing = readRememberedAccounts().filter(
    (item) => normalizePhone(item.phone) !== normalizePhone(account.phone)
  );

  const next = [account, ...existing].slice(0, 10);
  saveRememberedAccounts(next);
}

function mapEmployeeRowToProfile(row: any): AuthProfile {
  return {
    id: row.id,
    phone: row.phone,
    displayName: row.display_name,
    businessName: row.business_name,
    role: (row.role ?? "employee") as UserRole,
    createdBy: row.created_by,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  };
}

async function getAccountByPhone(phone: string): Promise<AuthProfile | null> {
  const normalizedPhone = normalizePhone(phone);

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (error || !data) return null;
  return mapEmployeeRowToProfile(data);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);

  useEffect(() => {
    const boot = async () => {
      try {
        const raw = localStorage.getItem(CURRENT_SESSION_KEY);
        if (!raw) {
          setIsLoading(false);
          return;
        }

        const saved = JSON.parse(raw) as { phone: string };
        const latest = await getAccountByPhone(saved.phone);

        if (!latest || !latest.isActive) {
          localStorage.removeItem(CURRENT_SESSION_KEY);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setProfile(latest);
      } catch {
        localStorage.removeItem(CURRENT_SESSION_KEY);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    void boot();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!profile?.phone) return;

    const latest = await getAccountByPhone(profile.phone);
    if (!latest || !latest.isActive) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
      setProfile(null);
      return;
    }

    setProfile(latest);
  }, [profile?.phone]);

  const signUpOwner = useCallback(
    async (input: {
      displayName: string;
      phone: string;
      pin: string;
      businessName: string;
    }): Promise<SignUpResult> => {
      const displayName = input.displayName.trim();
      const businessName = input.businessName.trim();
      const phone = normalizePhone(input.phone);
      const pin = input.pin.trim();

      if (!displayName) {
        return { ok: false, error: "Izina rirakenewe." };
      }

      if (!businessName) {
        return { ok: false, error: "Izina ry'ubucuruzi rirakenewe." };
      }

      if (!isValidRwandaPhone(phone)) {
        return { ok: false, error: "Andika nimero ya telefone y'u Rwanda neza." };
      }

      if (!isValidPin(pin)) {
        return { ok: false, error: "PIN igomba kuba imibare 6." };
      }

      const existing = await getAccountByPhone(phone);
      if (existing) {
        return { ok: false, error: "Iyi nimero isanzwe ifite konti." };
      }

      const pinHash = await hashPin(pin, phone);

      const payload = {
        display_name: displayName,
        phone,
        pin_hash: pinHash,
        business_name: businessName,
        created_by: phone,
        role: "owner",
        is_active: true,
      };

      const { data, error } = await supabase
        .from("employees")
        .insert(payload as any)
        .select("*")
        .single();

      if (error || !data) {
        return { ok: false, error: error?.message ?? "Konti ya owner ntiyakozwe." };
      }

      const nextProfile = mapEmployeeRowToProfile(data);

      localStorage.setItem(
        CURRENT_SESSION_KEY,
        JSON.stringify({ phone: nextProfile.phone })
      );

      upsertRememberedAccount({
        phone: nextProfile.phone,
        displayName: nextProfile.displayName,
        businessName: nextProfile.businessName,
        role: nextProfile.role,
        createdAt: nextProfile.createdAt,
      });

      setProfile(nextProfile);
      return { ok: true };
    },
    []
  );

  const signInWithPhonePin = useCallback(
    async (phone: string, pin: string): Promise<LoginResult> => {
      const normalizedPhone = normalizePhone(phone);

      if (!isValidRwandaPhone(normalizedPhone) || !isValidPin(pin)) {
        return "wrong";
      }

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error || !data) return "not_found";

      const account = mapEmployeeRowToProfile(data);

      if (!account.isActive) return "inactive";

      const expectedHash = data.pin_hash;
      const actualHash = await hashPin(pin, normalizedPhone);

      if (expectedHash !== actualHash) {
        return "wrong";
      }

      localStorage.setItem(
        CURRENT_SESSION_KEY,
        JSON.stringify({ phone: account.phone })
      );

      upsertRememberedAccount({
        phone: account.phone,
        displayName: account.displayName,
        businessName: account.businessName,
        role: account.role,
        createdAt: account.createdAt,
      });

      setProfile(account);
      return "success";
    },
    []
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<"success" | "wrong"> => {
      if (!profile?.phone) return "wrong";
      const result = await signInWithPhonePin(profile.phone, pin);
      return result === "success" ? "success" : "wrong";
    },
    [profile?.phone, signInWithPhonePin]
  );

  const logout = useCallback(async () => {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    setProfile(null);
  }, []);

  const removeAccount = useCallback((phone: string) => {
    const normalized = normalizePhone(phone);
    const next = readRememberedAccounts().filter(
      (item) => normalizePhone(item.phone) !== normalized
    );
    saveRememberedAccounts(next);

    if (profile && normalizePhone(profile.phone) === normalized) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
      setProfile(null);
    }
  }, [profile]);

  const getAllAccounts = useCallback(() => {
    return readRememberedAccounts();
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      if (!profile) return false;
      const allowed = Array.isArray(role) ? role : [role];
      return allowed.includes(profile.role);
    },
    [profile]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      isLoading,
      isAuthenticated: !!profile,
      profile,
      user: null,
      session: null,

      isOwner: profile?.role === "owner",
      isEmployee: profile?.role === "employee",
      canViewFinancials: profile?.role === "owner",

      signInWithPhonePin,
      signUpOwner,
      logout,
      refreshProfile,
      getAllAccounts,
      removeAccount,
      hasRole,
      verifyPin,

      loginWithPin: signInWithPhonePin,
      loginLocal: () => {},
      saveAccount: () => {},
      findAccount: () => undefined,
      toggleFinancials: () => {},
      pinAttempts: 0,
      maxPinAttempts: 0,
      isPinLocked: false,
      pinLockMinutesLeft: 0,
    }),
    [
      getAllAccounts,
      hasRole,
      isLoading,
      logout,
      profile,
      refreshProfile,
      removeAccount,
      signInWithPhonePin,
      signUpOwner,
      verifyPin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}