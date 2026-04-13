import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Crown,
  Gem,
  Plus,
  X,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  useAuth,
  PIN_LENGTH,
  normalizePhone,
  isValidRwandaPhone,
} from "@/contexts/AuthContext";

type Screen =
  | "checking"
  | "accounts"
  | "login_phone"
  | "pin_entry"
  | "register"
  | "pin_setup_enter"
  | "pin_setup_confirm";

function NumPad({
  pin,
  onPress,
  onDelete,
  disabled = false,
}: {
  pin: string;
  onPress: (digit: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: i < pin.length ? "#0f172a" : "#dbe4ee",
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {keys.map((key, index) => {
          if (key === "") return <div key={`empty-${index}`} />;

          const isDelete = key === "⌫";

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                if (isDelete) onDelete();
                else onPress(key);
              }}
              style={{
                height: 64,
                borderRadius: 18,
                border: "none",
                background: isDelete ? "transparent" : "white",
                boxShadow: isDelete
                  ? "none"
                  : "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
                fontSize: 22,
                fontWeight: 700,
                color: isDelete ? "#94a3b8" : "#0f172a",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
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
    top: -140,
    right: -140,
    width: 420,
    height: 420,
    borderRadius: "50%",
    pointerEvents: "none" as const,
    background: "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)",
  },
  blob2: {
    position: "absolute" as const,
    bottom: -120,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    pointerEvents: "none" as const,
    background: "radial-gradient(circle, rgba(6,182,212,0.11) 0%, transparent 70%)",
  },
  card: {
    background: "white",
    borderRadius: 28,
    width: "100%",
    maxWidth: 390,
    padding: "32px 28px",
    position: "relative" as const,
    zIndex: 1,
    boxShadow:
      "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    margin: "0 auto 14px",
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 32px rgba(15,23,42,0.28), 0 0 0 1px rgba(59,130,246,0.2)",
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
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
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
  btn: (variant: "primary" | "outline" | "ghost" = "primary") =>
    ({
      width: "100%",
      padding: "14px",
      borderRadius: 16,
      cursor: "pointer",
      fontSize: 15,
      fontWeight: 700,
      letterSpacing: "0.2px",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      ...(variant === "primary"
        ? {
            background: "linear-gradient(135deg,#0f172a 0%,#1e40af 100%)",
            color: "white",
            border: "none",
          }
        : variant === "outline"
        ? {
            background: "white",
            color: "#0f172a",
            border: "1.5px solid #e2e8f0",
          }
        : {
            background: "none",
            color: "#94a3b8",
            border: "none",
          }),
    }) as React.CSSProperties,
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
    marginBottom: 10,
    position: "relative" as const,
  },
};

function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#3b82f6";
  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
}

function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#e2e8f0";
  e.target.style.boxShadow = "none";
}

const AuthPage = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [screen, setScreen] = useState<Screen>("checking");
  const [accounts, setAccounts] = useState<ReturnType<typeof auth.getAllAccounts>>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedDisplayName, setSelectedDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"owner" | "employee">("employee");

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const shakeRef = useRef<number | null>(null);

  const refreshAccounts = useCallback(() => {
    const list = auth.getAllAccounts();
    setAccounts(list);
    return list;
  }, [auth]);

  const resetPins = () => {
    setPin("");
    setConfirmPin("");
    setPinError("");
  };

  const triggerPinError = useCallback((message: string) => {
    setPinError(message);
    if (shakeRef.current) window.clearTimeout(shakeRef.current);
    shakeRef.current = window.setTimeout(() => setPinError(""), 1800);
  }, []);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  useEffect(() => {
    if (auth.isLoading) return;

    const list = refreshAccounts();

    if (list.length === 0) {
      setScreen("register");
      return;
    }

    setScreen("accounts");
  }, [auth.isLoading, refreshAccounts]);

  useEffect(() => {
    if (screen === "pin_entry" && pin.length === PIN_LENGTH && !isLoading) {
      void handlePinLogin();
    }
  }, [pin, screen, isLoading]);

  useEffect(() => {
    if (screen === "pin_setup_enter" && pin.length === PIN_LENGTH) {
      const t = window.setTimeout(() => setScreen("pin_setup_confirm"), 140);
      return () => window.clearTimeout(t);
    }
  }, [pin, screen]);

  useEffect(() => {
    if (screen === "pin_setup_confirm" && confirmPin.length === PIN_LENGTH && !isLoading) {
      void handleOwnerConfirm();
    }
  }, [confirmPin, screen, isLoading]);

  const handlePinLogin = useCallback(async () => {
    if (!selectedPhone) return;

    setIsLoading(true);
    setPinError("");

    const result = await auth.signInWithPhonePin(selectedPhone, pin);

    setIsLoading(false);

    if (result === "success") {
      toast.success(`Murakaza neza, ${selectedDisplayName || "umukoresha"}!`);
      navigate("/dashboard", { replace: true });
      return;
    }

    if (result === "inactive") {
      triggerPinError("Iyi konti yahagaritswe.");
      setPin("");
      return;
    }

    if (result === "not_found") {
      triggerPinError("Konti ntiboneka.");
      setPin("");
      return;
    }

    triggerPinError("PIN siyo.");
    setPin("");
  }, [auth, navigate, pin, selectedDisplayName, selectedPhone, triggerPinError]);

  const handleRegister = () => {
    if (!displayName.trim()) {
      toast.error("Andika izina.");
      return;
    }

    if (!businessName.trim()) {
      toast.error("Andika izina ry'ubucuruzi.");
      return;
    }

    const normalized = normalizePhone(phone);
    if (!isValidRwandaPhone(normalized)) {
      toast.error("Andika nimero y'u Rwanda neza.");
      return;
    }

    setPhone(normalized);
    setScreen("pin_setup_enter");
  };

  const handleOwnerConfirm = useCallback(async () => {
    if (pin !== confirmPin) {
      setConfirmPin("");
      triggerPinError("PIN ntizihuye.");
      return;
    }

    setIsLoading(true);

    const result = await auth.signUpOwner({
      displayName: displayName.trim(),
      phone,
      pin,
      businessName: businessName.trim(),
    });

    setIsLoading(false);

   if (!result.ok) {
      toast.error("error" in result ? result.error : "Konti ya owner ntiyakozwe.");
      return;
    }
    toast.success("Owner account yakozwe neza.");
    navigate("/dashboard", { replace: true });
  }, [auth, businessName, confirmPin, displayName, navigate, phone, pin, triggerPinError]);

  const handlePhoneContinue = () => {
    const normalized = normalizePhone(loginPhone);
    if (!isValidRwandaPhone(normalized)) {
      toast.error("Andika nimero y'u Rwanda neza.");
      return;
    }

    const remembered = auth
      .getAllAccounts()
      .find((item) => normalizePhone(item.phone) === normalized);

    setSelectedPhone(normalized);
    setSelectedDisplayName(remembered?.displayName ?? normalized);
    setSelectedRole(remembered?.role ?? "employee");
    resetPins();
    setScreen("pin_entry");
  };

  const removeRememberedAccount = (phoneToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    auth.removeAccount(phoneToRemove);
    refreshAccounts();
  };

  const title = useMemo(() => {
    if (screen === "register") return "Fungura owner account";
    if (screen === "login_phone") return "Injira";
    if (screen === "pin_entry") return "Injiza PIN";
    if (screen === "pin_setup_enter") return "Shyiraho PIN";
    if (screen === "pin_setup_confirm") return "Emeza PIN";
    return "TradeWFriend+";
  }, [screen]);

  const subtitle = useMemo(() => {
    if (screen === "register") return "Nimero y'u Rwanda + PIN";
    if (screen === "login_phone") return "Andika nimero ya telefone";
    if (screen === "pin_entry") return selectedPhone || "PIN";
    if (screen === "pin_setup_enter") return "PIN y'imibare 6";
    if (screen === "pin_setup_confirm") return "Ongera uyandike";
    return "Smart business manager";
  }, [screen, selectedPhone]);

  const Header = () => (
    <>
      <div style={S.logoWrap}>
        <img src={logo} alt="TradeWFriend+" style={{ width: 42, height: 42, objectFit: "contain" }} />
      </div>
      <div style={S.appName}>{title}</div>
      <div style={S.subtitle}>
        <Gem size={14} />
        {subtitle}
      </div>
    </>
  );

  if (auth.isLoading || screen === "checking") {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />
          <div style={{ textAlign: "center", color: "#64748b" }}>Birimo gutegurwa...</div>
        </div>
      </div>
    );
  }

  if (screen === "accounts") {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />

          {accounts.map((acc) => (
            <button
              key={acc.phone}
              type="button"
              onClick={() => {
                setSelectedPhone(acc.phone);
                setSelectedDisplayName(acc.displayName);
                setSelectedRole(acc.role);
                resetPins();
                setScreen("pin_entry");
              }}
              style={S.accountCard}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#dbeafe,#e0f2fe)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {acc.displayName.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  {acc.displayName}
                  {acc.role === "owner" ? (
                    <Crown size={15} color="#d97706" />
                  ) : (
                    <Briefcase size={15} color="#2563eb" />
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{acc.phone}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  {acc.businessName}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => removeRememberedAccount(acc.phone, e)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </button>
          ))}

          <button type="button" style={S.btn("outline")} onClick={() => setScreen("login_phone")}>
            <Plus size={18} />
            Injiza indi konti
          </button>

          <button type="button" style={S.btn("ghost")} onClick={() => setScreen("register")}>
            Fungura owner account nshya
          </button>
        </div>
      </div>
    );
  }

  if (screen === "login_phone") {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />

          <label style={S.label}>Numero ya telefone</label>
          <input
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
            placeholder="07xxxxxxxx"
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button type="button" style={S.btn("primary")} onClick={handlePhoneContinue}>
            Injira
          </button>

          <button
            type="button"
            onClick={() => setScreen(accounts.length ? "accounts" : "register")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 13,
              display: "block",
              margin: "18px auto 0",
            }}
          >
            ← Subira inyuma
          </button>
        </div>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />

          <label style={S.label}>Izina rya owner</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Urugero: Friend"
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>Numero ya telefone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07xxxxxxxx"
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>Izina ry'ubucuruzi</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Urugero: TradeWFriend Shop"
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button type="button" style={S.btn("primary")} onClick={handleRegister}>
            <Building2 size={18} />
            Komeza
          </button>

          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => setScreen("accounts")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 13,
                display: "block",
                margin: "18px auto 0",
              }}
            >
              ← Subira inyuma
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "pin_setup_enter" || screen === "pin_setup_confirm") {
    const activePin = screen === "pin_setup_enter" ? pin : confirmPin;
    const setActivePin = screen === "pin_setup_enter" ? setPin : setConfirmPin;

    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />

          {pinError && (
            <div style={{ marginBottom: 14, color: "#dc2626", fontSize: 13, textAlign: "center" }}>
              {pinError}
            </div>
          )}

          <NumPad
            pin={activePin}
            disabled={isLoading}
            onPress={(digit) => {
              if (activePin.length >= PIN_LENGTH) return;
              setActivePin((prev) => prev + digit);
            }}
            onDelete={() => setActivePin((prev) => prev.slice(0, -1))}
          />

          {isLoading && (
            <div style={{ textAlign: "center", marginTop: 14, color: "#64748b", fontSize: 13 }}>
              Birimo gukora...
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              resetPins();
              setScreen(screen === "pin_setup_enter" ? "register" : "pin_setup_enter");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 13,
              display: "block",
              margin: "18px auto 0",
            }}
          >
            ← Subira inyuma
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} />
      <div style={S.blob2} />
      <div style={S.card}>
        <Header />

        {(selectedDisplayName || selectedPhone) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              color: "#475569",
              fontSize: 13,
              marginBottom: 14,
              alignItems: "center",
            }}
          >
            {selectedRole === "owner" ? (
              <Crown size={15} color="#d97706" />
            ) : (
              <Briefcase size={15} color="#2563eb" />
            )}
            <span>{selectedDisplayName || selectedPhone}</span>
          </div>
        )}

        {pinError && (
          <div style={{ marginBottom: 14, color: "#dc2626", fontSize: 13, textAlign: "center" }}>
            {pinError}
          </div>
        )}

        <NumPad
          pin={pin}
          disabled={isLoading}
          onPress={(digit) => {
            if (pin.length >= PIN_LENGTH) return;
            setPin((prev) => prev + digit);
          }}
          onDelete={() => setPin((prev) => prev.slice(0, -1))}
        />

        {isLoading && (
          <div style={{ textAlign: "center", marginTop: 14, color: "#64748b", fontSize: 13 }}>
            Birimo kugenzurwa...
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            resetPins();
            setScreen(accounts.length ? "accounts" : "login_phone");
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 13,
            display: "block",
            margin: "18px auto 0",
          }}
        >
          <ArrowLeft size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Subira inyuma
        </button>
      </div>
    </div>
  );
};

export default AuthPage;