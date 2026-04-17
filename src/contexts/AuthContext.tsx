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

const ACTIVE_SESSION_KEY = "tw_active_session_v5";
const REMEMBERED_ACCOUNTS_KEY = "tw_remembered_accounts_v5";

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

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256PureJs(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";

  let i: number;
  let j: number;
  const result: string[] = [];

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i + candidate] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const asciiBytes: number[] = [];
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);

    if (j < 0x80) {
      asciiBytes.push(j);
    } else if (j < 0x800) {
      asciiBytes.push(0xc0 | (j >> 6), 0x80 | (j & 0x3f));
    } else if (j < 0xd800 || j >= 0xe000) {
      asciiBytes.push(0xe0 | (j >> 12), 0x80 | ((j >> 6) & 0x3f), 0x80 | (j & 0x3f));
    } else {
      i++;
      const surrogatePair =
        0x10000 + (((j & 0x3ff) << 10) | (ascii.charCodeAt(i) & 0x3ff));
      asciiBytes.push(
        0xf0 | (surrogatePair >> 18),
        0x80 | ((surrogatePair >> 12) & 0x3f),
        0x80 | ((surrogatePair >> 6) & 0x3f),
        0x80 | (surrogatePair & 0x3f)
      );
    }
  }

  const byteLength = asciiBytes.length;
  const bitLength = byteLength * 8;

  for (i = 0; i < byteLength; i++) {
    words[i >> 2] |= asciiBytes[i] << (24 - (i % 4) * 8);
  }

  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];

      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (((w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0)));

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result.push((b < 16 ? "0" : "") + b.toString(16));
    }
  }

  return result.join("");
}

async function hashPin(pin: string, phone: string) {
  const raw = `${normalizePhone(phone)}:${pin}`;
  return sha256PureJs(raw);
}

function readRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RememberedAccount[]) : [];
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

function readActiveSession(): { phone: string } | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { phone: string };
  } catch {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    return null;
  }
}

function saveActiveSession(phone: string) {
  sessionStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify({ phone: normalizePhone(phone) })
  );
}

function clearActiveSession() {
  sessionStorage.removeItem(ACTIVE_SESSION_KEY);
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
        const savedSession = readActiveSession();

        if (!savedSession?.phone) {
          setProfile(null);
          return;
        }

        const latest = await getAccountByPhone(savedSession.phone);

        if (!latest || !latest.isActive) {
          clearActiveSession();
          setProfile(null);
          return;
        }

        setProfile(latest);
      } catch (error) {
        console.error("Auth boot error:", error);
        clearActiveSession();
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    void boot();
  }, []);

  const refreshProfile = useCallback(async () => {
    const activePhone = profile?.phone;
    if (!activePhone) return;

    try {
      const latest = await getAccountByPhone(activePhone);

      if (!latest || !latest.isActive) {
        clearActiveSession();
        setProfile(null);
        return;
      }

      setProfile(latest);
    } catch (error) {
      console.error("Refresh profile error:", error);
    }
  }, [profile?.phone]);

  const signUpOwner = useCallback(
    async (input: {
      displayName: string;
      phone: string;
      pin: string;
      businessName: string;
    }): Promise<SignUpResult> => {
      try {
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

        saveActiveSession(nextProfile.phone);
        upsertRememberedAccount({
          phone: nextProfile.phone,
          displayName: nextProfile.displayName,
          businessName: nextProfile.businessName,
          role: nextProfile.role,
          createdAt: nextProfile.createdAt,
        });

        setProfile(nextProfile);
        return { ok: true };
      } catch (error) {
        console.error("signUpOwner error:", error);
        return { ok: false, error: "Habaye ikibazo mu gukora konti." };
      }
    },
    []
  );

  const signInWithPhonePin = useCallback(
    async (phone: string, pin: string): Promise<LoginResult> => {
      try {
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

        saveActiveSession(account.phone);
        upsertRememberedAccount({
          phone: account.phone,
          displayName: account.displayName,
          businessName: account.businessName,
          role: account.role,
          createdAt: account.createdAt,
        });

        setProfile(account);
        return "success";
      } catch (error) {
        console.error("signInWithPhonePin error:", error);
        return "not_found";
      }
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
    clearActiveSession();
    setProfile(null);
  }, []);

  const removeAccount = useCallback(
    (phone: string) => {
      const normalized = normalizePhone(phone);

      const next = readRememberedAccounts().filter(
        (item) => normalizePhone(item.phone) !== normalized
      );
      saveRememberedAccounts(next);

      if (profile && normalizePhone(profile.phone) === normalized) {
        clearActiveSession();
        setProfile(null);
      }
    },
    [profile]
  );

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