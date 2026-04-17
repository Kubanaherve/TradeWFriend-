import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  Users,
  ShieldCheck,
  Phone,
  User,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  PIN_LENGTH,
  normalizePhone,
  isValidRwandaPhone,
} from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import AppShell from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type EmployeeRow = {
  id: string;
  display_name: string;
  phone: string;
  business_name: string;
  created_by: string;
  pin_hash: string;
  created_at: string;
  role?: "owner" | "employee";
  is_active?: boolean;
  updated_at?: string;
};

const S = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0 16px 24px",
    fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
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
  shell: {
    width: "100%",
    maxWidth: 980,
    zIndex: 1,
  },
  header: {
    position: "sticky" as const,
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.84)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid rgba(226,232,240,0.9)",
    padding: "14px 0",
    marginBottom: 16,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "none",
    background: "#e2e8f0",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  } as CSSProperties,
  logoWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 24px rgba(15,23,42,0.18)",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 1.3,
  },
  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "1fr",
  } as CSSProperties,
  summaryGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(2, 1fr)",
  } as CSSProperties,
  card: {
    background: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 8px 26px rgba(15,23,42,0.06)",
    padding: 18,
  } as CSSProperties,
  summaryCard: {
    background: "rgba(255,255,255,0.94)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
    padding: 16,
  } as CSSProperties,
  summaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 14,
    lineHeight: 1.5,
  },
  formGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1fr",
  } as CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.02em",
  },
  input: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  },
  btnPrimary: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    background: "linear-gradient(135deg,#0f172a 0%,#1e40af 100%)",
    color: "white",
    boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as CSSProperties,
  employeeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "14px 14px",
    background: "#fff",
    marginTop: 12,
  } as CSSProperties,
  employeeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  } as CSSProperties,
  employeeLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  } as CSSProperties,
  avatar: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#dbeafe,#e0f2fe)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f172a",
    fontWeight: 800,
    flexShrink: 0,
  } as CSSProperties,
  employeeName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  employeePhone: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  status: (active: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 800,
      background: active ? "#ecfdf5" : "#fef2f2",
      color: active ? "#047857" : "#b91c1c",
      marginTop: 8,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }) as CSSProperties,
  dangerBtn: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 12,
    width: 40,
    height: 40,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as CSSProperties,
  emptyState: {
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "22px 16px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: 14,
  },
};

function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#3b82f6";
  e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
}

function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "#e2e8f0";
  e.target.style.boxShadow = "none";
}

async function hashPin(pin: string, phone: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${normalizePhone(phone)}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const Employees = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useI18n();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const isOwner = auth.profile?.role === "owner";
  const ownerIdentifier = auth.profile?.phone ?? "";
  const businessName = auth.profile?.businessName ?? "";

  const canUsePage = useMemo(
    () => auth.isAuthenticated && !!auth.profile && isOwner,
    [auth.isAuthenticated, auth.profile, isOwner]
  );

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    if (!auth.isLoading && auth.isAuthenticated && !isOwner) {
      toast.error(t("errors.noPermission"));
      navigate("/settings", { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, isOwner, navigate, t]);

  const loadEmployees = useCallback(async () => {
    if (!ownerIdentifier) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const response = await (supabase as any)
      .from("employees")
      .select("*")
      .eq("created_by", ownerIdentifier)
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    const error = response.error as Error | null;
    const data = (response.data ?? []) as EmployeeRow[];

    if (error) {
      console.error(error);
      toast.error(t("employees.fetchFailed"));
      setEmployees([]);
      setLoading(false);
      return;
    }

    setEmployees(data);
    setLoading(false);
  }, [ownerIdentifier, t]);

  useEffect(() => {
    if (!canUsePage) {
      setLoading(false);
      return;
    }

    void loadEmployees();
  }, [canUsePage, loadEmployees]);

  const handleAddEmployee = async () => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const cleanName = displayName.trim();
    const cleanPhone = normalizePhone(phone);
    const cleanPin = pin.trim();

    if (!cleanName) {
      toast.error(t("employees.enterName"));
      return;
    }

    if (!isValidRwandaPhone(cleanPhone)) {
      toast.error(t("auth.invalidPhone"));
      return;
    }

    if (!/^\d{6}$/.test(cleanPin) || cleanPin.length !== PIN_LENGTH) {
      toast.error(t("employees.pinSixDigits"));
      return;
    }

    if (!ownerIdentifier) {
      toast.error(t("employees.ownerNotFound"));
      return;
    }

    setSaving(true);

    try {
      const { data: existingByPhone, error: checkError } = await (supabase as any)
        .from("employees")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingByPhone) {
        toast.error(t("employees.phoneAlreadyExists"));
        setSaving(false);
        return;
      }

      const pinHash = await hashPin(cleanPin, cleanPhone);

      const { error } = await (supabase as any).from("employees").insert({
        display_name: cleanName,
        phone: cleanPhone,
        pin_hash: pinHash,
        business_name: businessName || "My Business",
        created_by: ownerIdentifier,
        role: "employee",
        is_active: true,
      });

      if (error) throw error;

      toast.success(t("employees.employeeCreated"));
      setDisplayName("");
      setPhone("");
      setPin("");

      await loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error(t("employees.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateEmployee = async (employeeId: string, employeeName: string) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const confirmed = window.confirm(
      `${t("employees.confirmDisable")} ${employeeName}?`
    );
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("employees")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employeeId)
      .eq("created_by", ownerIdentifier);

    if (error) {
      console.error(error);
      toast.error(t("employees.disableFailed"));
      return;
    }

    toast.success(t("employees.employeeDisabled"));
    await loadEmployees();
  };

  const activeCount = employees.filter((e) => e.is_active !== false).length;

  if (auth.isLoading || loading) {
    return (
      <div style={S.page}>
        <div style={S.blob1} />
        <div style={S.blob2} />
        <div style={{ ...S.shell, paddingTop: 32 }}>
          <div style={S.card}>
            <div style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>
              {t("common.loading")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canUsePage) {
    return null;
  }

return (
  <AppShell
    title={t("employees.title")}
    subtitle={t("employees.subtitle")}
    showBack
    showHome
    contentClassName="pt-2 md:pt-3"
  >
    <div className="mx-auto w-full max-w-5xl space-y-4">
      
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[20px] bg-white p-4 shadow-sm border">
          <p className="text-[11px] font-semibold uppercase text-slate-500">
            {t("employees.totalEmployees")}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {employees.length}
          </p>
        </div>

        <div className="rounded-[20px] bg-white p-4 shadow-sm border">
          <p className="text-[11px] font-semibold uppercase text-slate-500">
            {t("employees.activeEmployees")}
          </p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {activeCount}
          </p>
        </div>
      </div>

      {/* ADD EMPLOYEE */}
      <div className="rounded-[24px] bg-white p-5 shadow-sm border space-y-4">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <UserPlus size={16} className="text-blue-600" />
            {t("employees.addEmployee")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t("employees.addEmployeeHelp")}
          </p>
        </div>

        <div className="space-y-3">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("employees.employeeNamePlaceholder")}
          />

          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("auth.phonePlaceholder")}
          />

          <Input
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder={t("employees.pinPlaceholder")}
          />

          <Button
            onClick={handleAddEmployee}
            disabled={saving}
            className="w-full h-11"
          >
            {saving ? t("common.saving") : t("employees.addEmployee")}
          </Button>
        </div>
      </div>

      {/* EMPLOYEES LIST */}
      <div className="rounded-[24px] bg-white p-5 shadow-sm border">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
          <Users size={16} />
          {t("employees.employeeList")}
        </h2>

        {employees.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-6">
            {t("employees.noEmployees")}
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => {
              const active = employee.is_active !== false;

              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {employee.display_name}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone size={10} />
                        {employee.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {active
                        ? t("employees.active")
                        : t("employees.disabled")}
                    </span>

                    {active && (
                      <button
                        onClick={() =>
                          void handleDeactivateEmployee(
                            employee.id,
                            employee.display_name
                          )
                        }
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  </AppShell>
);
};

export default Employees;