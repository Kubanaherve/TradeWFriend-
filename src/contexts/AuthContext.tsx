import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';

// ─────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────
export type UserRole = 'owner' | 'employee';

export interface LocalAccount {
  phone: string;
  displayName: string;
  pinHash: string;
  role: UserRole;
  businessName: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  phone: string;
  display_name: string | null;
  role: UserRole;
  businessName: string;
}

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const ACCOUNTS_KEY     = 'tw_accounts_v3';
const CURRENT_KEY      = 'tw_current_v3';
const LAST_ACTIVE_KEY  = 'tw_last_active_v3';
const ATT_PFX          = 'tw_att_v3_';
const LOCK_PFX         = 'tw_lck_v3_';
const PIN_SALT         = 'tradewfriend_secure_2024';
const PIN_TIMEOUT_MS   = 5 * 60 * 1000;   // 5 minutes idle → lock
const MAX_ATTEMPTS     = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;  // 30-minute lockout
const EMPLOYEE_REVEAL  = 30 * 1000;        // 30s auto-hide for employees

// ─────────────────────────────────────────────────────────────────
//  Crypto helpers (exported for Auth.tsx)
// ─────────────────────────────────────────────────────────────────
export async function hashPin(pin: string, phone: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${PIN_SALT}:${phone.replace(/\s/g, '')}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────
//  localStorage helpers
// ─────────────────────────────────────────────────────────────────
function readAccounts(): LocalAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]'); }
  catch { return []; }
}
function writeAccounts(list: LocalAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

// ─────────────────────────────────────────────────────────────────
//  Context interface
// ─────────────────────────────────────────────────────────────────
interface AuthContextType {
  // ── state ──
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: Profile | null;
  /** Shim for legacy code that checks `user` */
  user: null;
  requiresPinVerification: boolean;
  canViewFinancials: boolean;
  pinAttempts: number;
  maxPinAttempts: number;
  isPinLocked: boolean;
  pinLockMinutesLeft: number;
  // ── actions ──
  loginWithPin: (phone: string, pin: string) =>
    Promise<'success' | 'wrong' | 'locked' | 'not_found'>;
  /** Legacy compat – prefer loginWithPin */
  loginLocal: (p: {
    id: string; phone: string; display_name: string | null;
    role?: UserRole; businessName?: string;
  }) => void;
  verifyPin: (pin: string) => Promise<'success' | 'wrong' | 'locked'>;
  logout: () => void;
  // ── account CRUD ──
  getAllAccounts: () => LocalAccount[];
  saveAccount: (a: Omit<LocalAccount, 'createdAt'>) => void;
  removeAccount: (phone: string) => void;
  findAccount: (phone: string) => LocalAccount | undefined;
  // ── UI ──
  toggleFinancials: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [isLocalAuth, setIsLocalAuth]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [requiresPin, setRequiresPin]   = useState(false);
  const [canSeeMoney, setCanSeeMoney]   = useState(false);
  const [pinAttempts, setPinAttempts]   = useState(0);
  const [isPinLocked, setIsPinLocked]   = useState(false);
  const [lockMinsLeft, setLockMinsLeft] = useState(0);

  const pinTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthRef      = useRef(false);  // non-reactive ref for callbacks

  // ── helpers ──────────────────────────────────────────────────
  const checkLock = useCallback((phone: string): boolean => {
    const raw = localStorage.getItem(LOCK_PFX + phone);
    if (!raw) { setIsPinLocked(false); setLockMinsLeft(0); return false; }
    const expiry = parseInt(raw);
    if (Date.now() >= expiry) {
      localStorage.removeItem(LOCK_PFX + phone);
      localStorage.removeItem(ATT_PFX + phone);
      setIsPinLocked(false); setLockMinsLeft(0); return false;
    }
    setIsPinLocked(true);
    setLockMinsLeft(Math.ceil((expiry - Date.now()) / 60_000));
    return true;
  }, []);

  const startPinTimer = useCallback(() => {
    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    pinTimerRef.current = setTimeout(() => {
      if (isAuthRef.current) setRequiresPin(true);
    }, PIN_TIMEOUT_MS);
  }, []);

  // ── Activity resets the timer ────────────────────────────────
  useEffect(() => {
    if (!isLocalAuth) return;
    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 30_000) {
        localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
        lastWrite = now;
      }
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
      pinTimerRef.current = setTimeout(() => {
        if (isAuthRef.current) setRequiresPin(true);
      }, PIN_TIMEOUT_MS);
    };
    const events = ['click', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));
    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity));
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    };
  }, [isLocalAuth]);

  // ── Visibility change (app minimize / tab switch) ────────────
  // Force PIN verification immediately when app is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isAuthRef.current) return;

      // When the user swipes up, closes the tab, or minimizes the app
      if (document.visibilityState === 'hidden') {
        setRequiresPin(true); // Force PIN dial box
        localStorage.setItem(LAST_ACTIVE_KEY, '0'); // Reset timer to 0
        
        if (pinTimerRef.current) {
          clearTimeout(pinTimerRef.current);
          pinTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Lock countdown ───────────────────────────────────────────
  useEffect(() => {
    if (!isPinLocked || !profile) return;
    lockIntervalRef.current = setInterval(() => checkLock(profile.phone), 15_000);
    return () => { if (lockIntervalRef.current) clearInterval(lockIntervalRef.current); };
  }, [isPinLocked, profile, checkLock]);

  // ── Initial session restore ──────────────────────────────────
  useEffect(() => {
    const currentPhone = localStorage.getItem(CURRENT_KEY);
    if (currentPhone) {
      const acct = readAccounts().find(a => a.phone === currentPhone);
      if (acct) {
        const p: Profile = {
          id: acct.phone, phone: acct.phone,
          display_name: acct.displayName, role: acct.role,
          businessName: acct.businessName,
        };
        setProfile(p);
        setIsLocalAuth(true);
        isAuthRef.current = true;
        setCanSeeMoney(acct.role === 'owner');
        checkLock(currentPhone);
        const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) ?? '0');
        const elapsed = Date.now() - lastActive;
        if (!lastActive || elapsed >= PIN_TIMEOUT_MS) {
          setRequiresPin(true);
        } else {
          startPinTimer();
        }
      }
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── loginWithPin (primary login) ─────────────────────────────
  const loginWithPin = useCallback(async (
    phone: string, pin: string,
  ): Promise<'success' | 'wrong' | 'locked' | 'not_found'> => {
    const cleanPhone = phone.replace(/\s/g, '');
    const acct = readAccounts().find(a =>
      a.phone === cleanPhone || a.phone === phone,
    );
    if (!acct) return 'not_found';
    if (checkLock(acct.phone)) return 'locked';

    const hash = await hashPin(pin, acct.phone);
    if (hash !== acct.pinHash) {
      const att = parseInt(localStorage.getItem(ATT_PFX + acct.phone) ?? '0') + 1;
      localStorage.setItem(ATT_PFX + acct.phone, att.toString());
      setPinAttempts(att);
      if (att >= MAX_ATTEMPTS) {
        const exp = Date.now() + LOCK_DURATION_MS;
        localStorage.setItem(LOCK_PFX + acct.phone, exp.toString());
        setIsPinLocked(true); setLockMinsLeft(30);
        return 'locked';
      }
      return 'wrong';
    }

    // ✓ correct PIN
    localStorage.removeItem(ATT_PFX + acct.phone);
    localStorage.removeItem(LOCK_PFX + acct.phone);
    localStorage.setItem(CURRENT_KEY, acct.phone);
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    setPinAttempts(0); setIsPinLocked(false);
    const p: Profile = {
      id: acct.phone, phone: acct.phone, display_name: acct.displayName,
      role: acct.role, businessName: acct.businessName,
    };
    setProfile(p);
    setIsLocalAuth(true);
    isAuthRef.current = true;
    setCanSeeMoney(acct.role === 'owner');
    setRequiresPin(false);
    startPinTimer();
    return 'success';
  }, [checkLock, startPinTimer]);

  // ── verifyPin (app lock re-auth) ─────────────────────────────
  const verifyPin = useCallback(async (pin: string): Promise<'success' | 'wrong' | 'locked'> => {
    if (!profile) return 'wrong';
    if (checkLock(profile.phone)) return 'locked';
    const acct = readAccounts().find(a => a.phone === profile.phone);
    if (!acct) return 'wrong';
    const hash = await hashPin(pin, acct.phone);
    if (hash !== acct.pinHash) {
      const att = parseInt(localStorage.getItem(ATT_PFX + profile.phone) ?? '0') + 1;
      localStorage.setItem(ATT_PFX + profile.phone, att.toString());
      setPinAttempts(att);
      if (att >= MAX_ATTEMPTS) {
        const exp = Date.now() + LOCK_DURATION_MS;
        localStorage.setItem(LOCK_PFX + profile.phone, exp.toString());
        setIsPinLocked(true); setLockMinsLeft(30);
        return 'locked';
      }
      return 'wrong';
    }
    localStorage.removeItem(ATT_PFX + profile.phone);
    localStorage.removeItem(LOCK_PFX + profile.phone);
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    setPinAttempts(0); setIsPinLocked(false);
    setRequiresPin(false);
    startPinTimer();
    return 'success';
  }, [profile, checkLock, startPinTimer]);

  // ── logout ───────────────────────────────────────────────────
  const logout = useCallback(() => {
    [pinTimerRef, lockIntervalRef, revealTimerRef].forEach(r => {
      if (r.current) { clearTimeout(r.current as any); r.current = null; }
    });
    localStorage.removeItem(CURRENT_KEY);
    isAuthRef.current = false;
    setProfile(null); setIsLocalAuth(false); setRequiresPin(false);
    setCanSeeMoney(false); setPinAttempts(0); setIsPinLocked(false);
  }, []);

  // ── loginLocal (legacy shim) ──────────────────────────────────
  const loginLocal = useCallback((p: {
    id: string; phone: string; display_name: string | null;
    role?: UserRole; businessName?: string;
  }) => {
    const full: Profile = {
      id: p.id, phone: p.phone, display_name: p.display_name,
      role: p.role ?? 'owner', businessName: p.businessName ?? '',
    };
    setProfile(full);
    setIsLocalAuth(true);
    isAuthRef.current = true;
    setCanSeeMoney((p.role ?? 'owner') === 'owner');
    setRequiresPin(false);
    setIsLoading(false);
    localStorage.setItem(CURRENT_KEY, p.phone);
    startPinTimer();
  }, [startPinTimer]);

  // ── account CRUD ─────────────────────────────────────────────
  const getAllAccounts  = useCallback(() => readAccounts(), []);
  const findAccount    = useCallback((phone: string) =>
    readAccounts().find(a => a.phone === phone), []);
  const removeAccount  = useCallback((phone: string) => {
    writeAccounts(readAccounts().filter(a => a.phone !== phone));
    localStorage.removeItem(ATT_PFX + phone);
    localStorage.removeItem(LOCK_PFX + phone);
  }, []);
  const saveAccount    = useCallback((a: Omit<LocalAccount, 'createdAt'>) => {
    const list = readAccounts();
    const idx  = list.findIndex(x => x.phone === a.phone);
    const full: LocalAccount = {
      ...a, createdAt: idx >= 0 ? list[idx].createdAt : new Date().toISOString(),
    };
    if (idx >= 0) list[idx] = full; else list.push(full);
    writeAccounts(list);
  }, []);

  // ── toggleFinancials ─────────────────────────────────────────
  const toggleFinancials = useCallback(() => {
    setCanSeeMoney(prev => {
      const next = !prev;
      if (next && profile?.role === 'employee') {
        // Auto-hide after 30 s for employees
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
        revealTimerRef.current = setTimeout(() => setCanSeeMoney(false), EMPLOYEE_REVEAL);
      } else {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      }
      return next;
    });
  }, [profile]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: isLocalAuth && !!profile,
      isLoading,
      profile,
      user: null,
      requiresPinVerification: requiresPin,
      canViewFinancials: canSeeMoney,
      pinAttempts,
      maxPinAttempts: MAX_ATTEMPTS,
      isPinLocked,
      pinLockMinutesLeft: lockMinsLeft,
      loginWithPin,
      loginLocal,
      verifyPin,
      logout,
      getAllAccounts,
      saveAccount,
      removeAccount,
      findAccount,
      toggleFinancials,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}