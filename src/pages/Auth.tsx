import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Gem, UserPlus, LogIn, Plus, X, Delete } from "lucide-react";
import logo from "@/assets/logo.png";
import { PinDialPad } from "@/components/PinDialPad";
import { useAuth } from "@/contexts/AuthContext";
import {
  hashPin,
  loadLocalAccounts,
  saveLocalAccount,
  findLocalAccount,
  removeLocalAccount,
  loadRememberedAccounts,
  getCurrentLocalAccount,
  setCurrentLocalAccount,
} from "@/lib/localAuth";

const PIN_LENGTH = 6;

interface RememberedAccount {
  phone: string;
  displayName: string;
}


/* ─── Styles ───────────────────────────────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: "relative" as const,
    overflow: "hidden",
  },
  blob1: {
    position: "absolute" as const,
    top: -120,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  blob2: {
    position: "absolute" as const,
    bottom: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  },
  card: {
    background: "white",
    borderRadius: 28,
    boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "32px 28px",
    width: "100%",
    maxWidth: 380,
    position: "relative" as const,
    zIndex: 1,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 32px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.2)",
  },
  appName: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center" as const,
    letterSpacing: "-0.5px",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center" as const,
    marginBottom: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tab: (active: boolean) => ({
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s",
    background: active ? "linear-gradient(135deg,#0f172a,#1e40af)" : "transparent",
    color: active ? "white" : "#64748b",
    boxShadow: active ? "0 4px 12px rgba(15,23,42,0.2)" : "none",
  }),
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
  btn: {
    width: "100%",
    padding: "14px",
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    background: "linear-gradient(135deg,#0f172a 0%,#1e40af 100%)",
    color: "white",
    boxShadow: "0 4px 20px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.15)",
    letterSpacing: "0.2px",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  neonLine: {
    height: 2,
    borderRadius: 99,
    background: "linear-gradient(90deg,transparent,#3b82f6,#06b6d4,transparent)",
    margin: "20px 0",
    opacity: 0.5,
  },
  accountCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 18,
    border: "1.5px solid #e2e8f0",
    background: "white",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    transition: "all 0.2s",
    position: "relative" as const,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "linear-gradient(135deg,#0f172a,#1e40af)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: "0 0 12px rgba(59,130,246,0.3)",
  },
};

/* ═══════════════════════════════════════════════════════ */
const AuthPage = () => {
  const navigate = useNavigate();
  const { loginLocal } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<RememberedAccount | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);

  useEffect(() => {
    const accounts = loadRememberedAccounts();
    setRememberedAccounts(accounts);

    const currentPhone = getCurrentLocalAccount();
    if (currentPhone) {
      const account = accounts.find(
        (item) => item.phone.replace(/\D/g, "") === currentPhone,
      );
      if (account) {
        setSelectedAccount(account);
      }
    } else if (accounts.length === 1) {
      setSelectedAccount(accounts[0]);
    } else if (accounts.length > 1) {
      setShowAccountPicker(true);
    }

    setIsCheckingAuth(false);
  }, []);

  const saveAccount = async (phoneNum: string, name: string, newPin?: string) => {
    if (newPin) {
      await saveLocalAccount(phoneNum, name, newPin);
    }
    const accounts = loadRememberedAccounts();
    setRememberedAccounts(accounts);
  };

  const removeAccount = (phoneNum: string) => {
    const accounts = removeLocalAccount(phoneNum);
    setRememberedAccounts(accounts.map((account) => ({
      phone: account.phone,
      displayName: account.displayName,
    })));
    if (accounts.length === 0) {
      setShowAccountPicker(false);
      setShowFullForm(false);
      setSelectedAccount(null);
      setCurrentLocalAccount(null);
    }
  };

  const handlePinLogin = async (enteredPin: string) => {
    if (!selectedAccount) return;
    setIsLoading(true);
    try {
      const account = findLocalAccount(selectedAccount.phone);
      if (!account) {
        toast.error("Konti ntiyabonetse");
        setIsLoading(false);
        return;
      }

      const hash = await hashPin(enteredPin);
      if (hash !== account.pinHash) {
        toast.error("PIN sibyo, ongera ugerageze");
        setIsLoading(false);
        return;
      }

      loginLocal({
        id: account.phone,
        phone: account.phone,
        display_name: account.displayName,
      });
      toast.success(`Murakaza neza, ${account.displayName}! 💎`);
      navigate("/dashboard");
    } catch {
      toast.error("Habaye ikosa");
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !pin) return toast.error("Uzuza numero na PIN");
    if (pin.length < PIN_LENGTH) return toast.error(`PIN igomba kuba imibare ${PIN_LENGTH}`);
    setIsLoading(true);

    const account = findLocalAccount(phone);
    if (!account) {
      toast.error("Konti ntiboneka. Iyandikishe cyangwa ongera ugerageze.");
      setIsLoading(false);
      return;
    }

    const hash = await hashPin(pin);
    if (hash !== account.pinHash) {
      toast.error("Numero cyangwa PIN sibyo");
      setIsLoading(false);
      return;
    }

    loginLocal({
      id: account.phone,
      phone: account.phone,
      display_name: account.displayName,
    });

    toast.success("Murakaza neza! 💎");
    navigate("/dashboard");
  };

  const handleSignup = async () => {
    if (!phone || !pin || !displayName) return toast.error("Uzuza ibisabwa byose");
    if (pin.length < PIN_LENGTH) return toast.error(`PIN igomba kuba imibare ${PIN_LENGTH}`);
    setIsLoading(true);

    const existing = findLocalAccount(phone);
    if (existing) {
      toast.error("Iyi numero isanzwe ikoreshwa. Injira cyangwa koresha indi numero.");
      setIsLoading(false);
      return;
    }

    await saveAccount(phone, displayName, pin);
    loginLocal({
      id: phone.replace(/\D/g, ""),
      phone: phone.replace(/\D/g, ""),
      display_name: displayName,
    });

    toast.success("Konti yawe yaremewe! 🎉");
    navigate("/dashboard");
  };

  /* ── Loading ── */
  if (isCheckingAuth) return (
    <div style={{ ...S.page, gap: 0 }}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── Logo Header shared ── */
  const LogoHeader = ({ sub }: { sub?: string }) => (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <div style={S.logoWrap}>
        <img src={logo} alt="Logo" style={{ width: 44, height: 44, objectFit: "contain" }} />
      </div>
      <div style={S.appName}>TradeWFriend+</div>
      <div style={S.subtitle}>
        <Gem size={13} color="#3b82f6" />
        <span>{sub || "Track your business with ease"}</span>
      </div>
    </div>
  );

  /* ── PIN Dial Screen ── */
  if (selectedAccount) return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader sub={`Murakaza, ${selectedAccount.displayName}`} />
        <div style={S.neonLine} />
        <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginBottom: 0 }}>Injiza PIN yawe (imibare {PIN_LENGTH})</p>
        <PinDialPad
          displayName={selectedAccount.displayName}
          isLoading={isLoading}
          onComplete={handlePinLogin}
        />
        <button onClick={() => { setSelectedAccount(null); setIsLoading(false); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, display: "block", margin: "20px auto 0", padding: "8px 16px" }}>
          ← Subira inyuma
        </button>
      </div>
    </div>
  );

  /* ── Account Picker ── */
  if (showAccountPicker && rememberedAccounts.length > 0) return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader sub="Hitamo konti yawe" />
        <div style={S.neonLine} />
        {rememberedAccounts.map(acc => (
          <div key={acc.phone} style={{ position: "relative" }}>
            <button onClick={() => setSelectedAccount(acc)} style={S.accountCard}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(59,130,246,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>
              <div style={S.avatar}>{acc.displayName.charAt(0).toUpperCase()}</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{acc.displayName}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{acc.phone}</div>
              </div>
            </button>
            <button onClick={() => removeAccount(acc.phone)}
              style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: 6, borderRadius: 8, transition: "color 0.2s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#ef4444")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#cbd5e1")}>
              <X size={15} />
            </button>
          </div>
        ))}
        <button onClick={() => { setShowAccountPicker(false); setShowFullForm(true); setSelectedAccount(null); }}
          style={{ ...S.accountCard, border: "1.5px dashed #cbd5e1", justifyContent: "flex-start" }}>
          <div style={{ ...S.avatar, background: "#f1f5f9", boxShadow: "none" }}>
            <Plus size={22} color="#3b82f6" />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>Ongeraho konti</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Iyandikishe cyangwa injira</div>
          </div>
        </button>
      </div>
    </div>
  );

  /* ── Full Login / Signup Form ── */
  return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader />
        {showFullForm && rememberedAccounts.length > 0 && (
          <button onClick={() => { setShowFullForm(false); setShowAccountPicker(true); setPhone(""); setPin(""); setDisplayName(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, marginBottom: 16, padding: 0 }}>
            ← Subira ku makonti
          </button>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", borderRadius: 14, padding: 5, marginBottom: 24 }}>
          <button onClick={() => setIsLogin(true)} style={S.tab(isLogin)}>
            <LogIn size={13} style={{ display: "inline", marginRight: 5 }} />Injira
          </button>
          <button onClick={() => setIsLogin(false)} style={S.tab(!isLogin)}>
            <UserPlus size={13} style={{ display: "inline", marginRight: 5 }} />Iyandikishe
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && (
            <div>
              <label style={S.label}>Izina ryawe</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Urugero: Jeanne" style={S.input}
                onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
            </div>
          )}
          <div>
            <label style={S.label}>📱 Numero ya Telefone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="0788 123 456" style={S.input} inputMode="tel"
              onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
          </div>
          <div>
            <label style={S.label}>🔒 PIN (Imibare {PIN_LENGTH})</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="• • • • •" style={{ ...S.input, textAlign: "center", fontSize: 26, letterSpacing: 12 }}
              maxLength={PIN_LENGTH} inputMode="numeric"
              onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
          </div>

          <button onClick={isLogin ? handleLogin : handleSignup} disabled={isLoading}
            style={{ ...S.btn, opacity: isLoading ? 0.7 : 1 }}
            onMouseEnter={e => !isLoading && ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = "translateY(0)")}>
            {isLoading
              ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
              : isLogin ? <><LogIn size={17} />Injira</> : <><UserPlus size={17} />Iyandikishe</>}
          </button>
        </div>

        <div style={S.neonLine} />
        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", margin: 0 }}>
          💎 App izakwibuka iteka
        </p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

export default AuthPage;