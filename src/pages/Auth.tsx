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
  LogIn,
  Smartphone,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  useAuth,
  PIN_LENGTH,
  normalizePhone,
  isValidRwandaPhone,
} from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";

type Screen =
  | "checking"
  | "welcome"
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
                height: 62,
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
    maxWidth: 400,
    padding: "30px 24px",
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
    marginBottom: 24,
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
  const { t } = useI18n();

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
    setScreen(list.length === 0 ? "welcome" : "accounts");
  }, [auth.isLoading, refreshAccounts]);

  const handlePinLoginWithValue = useCallback(
    async (pinValue: string) => {
      if (!selectedPhone) return;

      setIsLoading(true);
      setPinError("");

      const result = await auth.signInWithPhonePin(selectedPhone, pinValue);

      setIsLoading(false);

      if (result === "success") {
        toast.success(`${t("dashboard.welcome")}, ${selectedDisplayName || "User"}!`);
        setPin("");
        navigate("/dashboard", { replace: true });
        return;
      }

      if (result === "inactive") {
        triggerPinError(t("auth.accountDisabled"));
        setPin("");
        return;
      }

      if (result === "not_found") {
        triggerPinError(t("auth.accountNotFound"));
        setPin("");
        return;
      }

      triggerPinError(t("auth.wrongPin"));
      setPin("");
    },
    [auth, navigate, selectedPhone, selectedDisplayName, t, triggerPinError]
  );

  const handleOwnerConfirmWithValue = useCallback(
    async (confirmValue: string) => {
      if (pin !== confirmValue) {
        setConfirmPin("");
        triggerPinError(t("changePin.pinMismatch"));
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
        toast.error("error" in result ? result.error : t("errors.saveFailed"));
        return;
      }

      toast.success(t("auth.ownerCreated"));
      navigate("/dashboard", { replace: true });
    },
    [auth, businessName, displayName, navigate, phone, pin, t, triggerPinError]
  );

  const handleRegister = () => {
    if (!displayName.trim()) {
      toast.error(t("errors.requiredField"));
      return;
    }

    if (!businessName.trim()) {
      toast.error(t("errors.requiredField"));
      return;
    }

    const normalized = normalizePhone(phone);
    if (!isValidRwandaPhone(normalized)) {
      toast.error(t("auth.invalidPhone"));
      return;
    }

    setPhone(normalized);
    setPin("");
    setConfirmPin("");
    setScreen("pin_setup_enter");
  };

  const handlePhoneContinue = () => {
    const normalized = normalizePhone(loginPhone);
    if (!isValidRwandaPhone(normalized)) {
      toast.error(t("auth.invalidPhone"));
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

 const removeRememberedAccount = (
  phoneToRemove: string,
  e: React.MouseEvent<HTMLElement>
) => {
  e.stopPropagation();
  auth.removeAccount(phoneToRemove);
  const updated = refreshAccounts();
  if (updated.length === 0) setScreen("welcome");
};

  const title = useMemo(() => {
    if (screen === "welcome") return t("common.appName");
    if (screen === "register") return t("auth.createOwnerAccount");
    if (screen === "login_phone") return t("auth.login");
    if (screen === "pin_entry") return t("auth.enterPin");
    if (screen === "pin_setup_enter") return t("auth.setPin");
    if (screen === "pin_setup_confirm") return t("auth.confirmPin");
    return t("common.appName");
  }, [screen, t]);

  const subtitle = useMemo(() => {
    if (screen === "welcome") return t("auth.subtitle");
    if (screen === "register") return t("auth.subtitle");
    if (screen === "login_phone") return t("auth.phoneNumber");
    if (screen === "pin_entry") return selectedPhone || t("auth.pin");
    if (screen === "pin_setup_enter") return t("auth.sixDigitPin");
    if (screen === "pin_setup_confirm") return t("auth.confirmSixDigitPin");
    return t("auth.subtitle");
  }, [screen, selectedPhone, t]);

  const Header = () => (
    <>
      <div style={S.logoWrap}>
        <img
          src={logo}
          alt={t("common.appName")}
          style={{ width: 42, height: 42, objectFit: "contain" }}
        />
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
          <div style={{ textAlign: "center", color: "#64748b" }}>{t("auth.checking")}</div>
        </div>
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={S.card}>
          <Header />

          <button type="button" style={S.btn("primary")} onClick={() => setScreen("login_phone")}>
            <LogIn size={18} />
            {t("auth.login")}
          </button>

          <button type="button" style={S.btn("outline")} onClick={() => setScreen("register")}>
            <Smartphone size={18} />
            {t("auth.createOwnerAccount")}
          </button>
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
          <div
            key={acc.phone}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedPhone(acc.phone);
              setSelectedDisplayName(acc.displayName);
              setSelectedRole(acc.role);
              resetPins();
              setScreen("pin_entry");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPhone(acc.phone);
                setSelectedDisplayName(acc.displayName);
                setSelectedRole(acc.role);
                resetPins();
                setScreen("pin_entry");
              }
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
                flexShrink: 0,
              }}
            >
              {acc.displayName.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {acc.displayName}
                </span>

                {acc.role === "owner" ? (
                  <Crown size={15} color="#d97706" />
                ) : (
                  <Briefcase size={15} color="#2563eb" />
                )}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {acc.phone}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {acc.businessName}
              </div>
            </div>

            <button
              type="button"
              aria-label={`Remove ${acc.displayName}`}
              onClick={(e) => removeRememberedAccount(acc.phone, e)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>
        ))}

        <button type="button" style={S.btn("outline")} onClick={() => setScreen("login_phone")}>
          <Plus size={18} />
          {t("auth.addAnotherAccount")}
        </button>

        <button type="button" style={S.btn("ghost")} onClick={() => setScreen("register")}>
          {t("auth.createNewOwner")}
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

          <label style={S.label}>{t("auth.phoneNumber")}</label>
          <input
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
            placeholder={t("auth.phonePlaceholder")}
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button type="button" style={S.btn("primary")} onClick={handlePhoneContinue}>
            {t("auth.login")}
          </button>

          <button
            type="button"
            onClick={() => setScreen(accounts.length ? "accounts" : "welcome")}
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
            ← {t("common.back")}
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

          <label style={S.label}>{t("auth.ownerName")}</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("auth.ownerNamePlaceholder")}
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>{t("auth.phoneNumber")}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("auth.phonePlaceholder")}
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>{t("auth.businessName")}</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder={t("auth.businessNamePlaceholder")}
            style={S.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button type="button" style={S.btn("primary")} onClick={handleRegister}>
            <Building2 size={18} />
            {t("common.continue")}
          </button>

          <button
            type="button"
            onClick={() => setScreen(accounts.length ? "accounts" : "welcome")}
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
            ← {t("common.back")}
          </button>
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
              if (activePin.length >= PIN_LENGTH || isLoading) return;

              const nextPin = activePin + digit;
              setActivePin(nextPin);

              if (screen === "pin_setup_enter" && nextPin.length === PIN_LENGTH) {
                window.setTimeout(() => {
                  setScreen("pin_setup_confirm");
                }, 120);
              }

              if (screen === "pin_setup_confirm" && nextPin.length === PIN_LENGTH) {
                window.setTimeout(() => {
                  void handleOwnerConfirmWithValue(nextPin);
                }, 120);
              }
            }}
            onDelete={() => {
              if (isLoading) return;
              setActivePin((prev) => prev.slice(0, -1));
            }}
          />

          {isLoading && (
            <div style={{ textAlign: "center", marginTop: 14, color: "#64748b", fontSize: 13 }}>
              {t("common.loading")}
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
            ← {t("common.back")}
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
            if (pin.length >= PIN_LENGTH || isLoading) return;

            const nextPin = pin + digit;
            setPin(nextPin);

            if (nextPin.length === PIN_LENGTH) {
              window.setTimeout(() => {
                void handlePinLoginWithValue(nextPin);
              }, 120);
            }
          }}
          onDelete={() => {
            if (isLoading) return;
            setPin((prev) => prev.slice(0, -1));
          }}
        />

        {isLoading && (
          <div style={{ textAlign: "center", marginTop: 14, color: "#64748b", fontSize: 13 }}>
            {t("auth.checking")}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            resetPins();
            setScreen(accounts.length ? "accounts" : "welcome");
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
          {t("common.back")}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;