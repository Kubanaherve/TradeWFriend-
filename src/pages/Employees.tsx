import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  Users,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, PIN_LENGTH, normalizePhone, isValidRwandaPhone } from "@/contexts/AuthContext";
type SimpleEmployeeQueryRow = {
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
    boxShadow:
      "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
    padding: "32px 28px",
    width: "100%",
    maxWidth: 460,
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
  },
  section: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    background: "#fff",
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
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.3px",
  },
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
  btnPrimary: {
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  } as CSSProperties,
  employeeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "14px 16px",
    background: "#fff",
    marginTop: 12,
  } as CSSProperties,
  employeeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  } as CSSProperties,
  status: (active: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: active ? "#ecfdf5" : "#fef2f2",
      color: active ? "#047857" : "#b91c1c",
      marginTop: 8,
    }) as CSSProperties,
  dangerBtn: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSProperties,
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
      toast.error("Only the owner can access employee management.");
      navigate("/settings", { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, isOwner, navigate]);

  const loadEmployees = async () => {
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
  toast.error("Failed to load employees.");
  setEmployees([]);
  setLoading(false);
  return;
}

setEmployees(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!canUsePage) {
      setLoading(false);
      return;
    }

    void loadEmployees();
  }, [canUsePage, ownerIdentifier]);

  const handleAddEmployee = async () => {
    if (!isOwner) {
      toast.error("Only the owner can add employees.");
      return;
    }

    const cleanName = displayName.trim();
    const cleanPhone = normalizePhone(phone);
    const cleanPin = pin.trim();

    if (!cleanName) {
      toast.error("Enter employee name.");
      return;
    }

    if (!isValidRwandaPhone(cleanPhone)) {
      toast.error("Enter a valid Rwanda phone number.");
      return;
    }

    if (!/^\d{6}$/.test(cleanPin) || cleanPin.length !== PIN_LENGTH) {
      toast.error("PIN must be exactly 6 digits.");
      return;
    }

    if (!ownerIdentifier) {
      toast.error("Owner account not found.");
      return;
    }

    setSaving(true);

    try {
     const existingResponse = await (supabase as any)
  .from("employees")
  .select("id")
  .eq("phone", cleanPhone)
  .maybeSingle();

const checkError = existingResponse.error as Error | null;
const existingByPhone = existingResponse.data as { id: string } | null;

      if (checkError) throw checkError;

      if (existingByPhone) {
        toast.error("That phone number already has an account.");
        setSaving(false);
        return;
      }

      const pinHash = await hashPin(cleanPin, cleanPhone);
const insertResponse = await (supabase as any).from("employees").insert({
  display_name: cleanName,
  phone: cleanPhone,
  pin_hash: pinHash,
  business_name: businessName || "My Business",
  created_by: ownerIdentifier,
  role: "employee",
  is_active: true,
});

if (insertResponse.error) throw insertResponse.error;
      toast.success("Employee account created successfully.");
      setDisplayName("");
      setPhone("");
      setPin("");

      await loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create employee account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateEmployee = async (employeeId: string, employeeName: string) => {
    if (!isOwner) {
      toast.error("Only the owner can remove employees.");
      return;
    }

    const confirmed = window.confirm(
      `Disable ${employeeName}'s account? They will no longer be able to log in.`
    );
    if (!confirmed) return;

   const updateResponse = await (supabase as any)
  .from("employees")
  .update({
    is_active: false,
    updated_at: new Date().toISOString(),
  })
  .eq("id", employeeId)
  .eq("created_by", ownerIdentifier);

if (updateResponse.error) {
  console.error(updateResponse.error);
  toast.error("Failed to disable employee.");
  return;
}

    toast.success("Employee account disabled.");
    await loadEmployees();
  };

  if (auth.isLoading || loading) {
    return <div style={{ padding: 24 }}>Loading employees...</div>;
  }

  if (!canUsePage) {
    return null;
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} />
      <div style={S.blob2} />

      <button
        type="button"
        onClick={() => navigate("/settings")}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,255,255,0.9)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <div style={S.card}>
        <div style={S.logoWrap}>
          <img
            src={logo}
            alt="TradeWFriend+"
            style={{ width: 42, height: 42, objectFit: "contain" }}
          />
        </div>

        <div style={S.appName}>Employees</div>
        <div style={S.subtitle}>
          Create and control employee accounts under the owner only
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <UserPlus size={16} color="#2563eb" />
            Add Employee
          </div>
          <div style={S.sectionText}>
            Employees are created only by the owner from settings and stay under this business.
          </div>

          <label style={S.label}>Employee Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter employee name"
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07xxxxxxxx"
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>6-Digit PIN</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="******"
            style={S.input}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />

          <button
            type="button"
            style={S.btnPrimary}
            onClick={handleAddEmployee}
            disabled={saving}
          >
            <Plus size={18} />
            {saving ? "Creating..." : "Add Employee"}
          </button>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>
            <Users size={16} color="#0f172a" />
            Employee List
          </div>
          <div style={S.sectionText}>
            Only employees created under this owner appear here.
          </div>

          {employees.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>No employees added yet.</div>
          ) : (
            employees.map((employee) => {
              const active = employee.is_active !== false;

              return (
                <div key={employee.id} style={S.employeeCard}>
                  <div style={S.employeeRow}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>
                        {employee.display_name}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        {employee.phone}
                      </div>
                      <div style={S.status(active)}>
                        <ShieldCheck size={13} />
                        {active ? "Active" : "Disabled"}
                      </div>
                    </div>

                    {active && (
                      <button
                        type="button"
                        style={S.dangerBtn}
                        onClick={() =>
                          void handleDeactivateEmployee(employee.id, employee.display_name)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Employees;