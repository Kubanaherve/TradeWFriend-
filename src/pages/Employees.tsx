import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  UserPlus,
  Users,
  Phone,
  User,
  ShieldBan,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  PIN_LENGTH,
  normalizePhone,
  isValidRwandaPhone,
  hashPin,
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
  card: {
    background: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 8px 26px rgba(15,23,42,0.06)",
    padding: 18,
  } as CSSProperties,
};

const Employees = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t } = useI18n();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);

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

    const { data, error } = await (supabase as any)
      .from("employees")
      .select("*")
      .eq("created_by", ownerIdentifier)
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch employees error:", error);
      toast.error(error.message || t("employees.fetchFailed"));
      setEmployees([]);
      setLoading(false);
      return;
    }

    setEmployees((data ?? []) as EmployeeRow[]);
    setLoading(false);
  }, [ownerIdentifier, t]);

  useEffect(() => {
    if (!canUsePage) {
      setLoading(false);
      return;
    }

    void loadEmployees();
  }, [canUsePage, loadEmployees]);

  const resetForm = () => {
    setDisplayName("");
    setPhone("");
    setPin("");
  };

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
        .select("id, is_active")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingByPhone) {
        toast.error(
          "This phone number already exists in the database. Delete that employee first if you want to reuse the same number."
        );
        return;
      }

      const pinHash = await hashPin(cleanPin, cleanPhone);

      const { error } = await (supabase as any)
        .from("employees")
        .insert({
          display_name: cleanName,
          phone: cleanPhone,
          pin_hash: pinHash,
          business_name: businessName || "My Business",
          created_by: ownerIdentifier,
          role: "employee",
          is_active: true,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success(t("employees.employeeCreated"));
      resetForm();
      await loadEmployees();
    } catch (error: any) {
      console.error("Create employee error:", error);
      toast.error(error?.message || t("employees.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateEmployee = async (
    employeeId: string,
    employeeName: string
  ) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const confirmed = window.confirm(
      `${t("employees.confirmDisable")} ${employeeName}?`
    );
    if (!confirmed) return;

    setBusyEmployeeId(employeeId);

    try {
      const { error } = await (supabase as any)
        .from("employees")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employeeId)
        .eq("created_by", ownerIdentifier);

      if (error) throw error;

      toast.success(t("employees.employeeDisabled"));
      await loadEmployees();
    } catch (error: any) {
      console.error("Disable employee error:", error);
      toast.error(error?.message || t("employees.disableFailed"));
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const handleActivateEmployee = async (
    employeeId: string,
    employeeName: string
  ) => {
    if (!isOwner) {
      toast.error(t("errors.noPermission"));
      return;
    }

    const confirmed = window.confirm(`Restore ${employeeName}'s account?`);
    if (!confirmed) return;

    setBusyEmployeeId(employeeId);

    try {
      const { error } = await (supabase as any)
        .from("employees")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employeeId)
        .eq("created_by", ownerIdentifier);

      if (error) throw error;

      toast.success("Employee restored successfully");
      await loadEmployees();
    } catch (error: any) {
      console.error("Restore employee error:", error);
      toast.error(error?.message || "Failed to restore employee");
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const handleDeleteEmployee = async (
    employeeId: string,
    employeeName: string,
    employeePhone: string
  ) => {
    if (!isOwner) {
      toast.error("Permission denied");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${employeeName} permanently?\n\nPhone: ${employeePhone}\n\nThis will free the number so you can create another employee using the same phone.`
    );

    if (!confirmed) return;

    setBusyEmployeeId(employeeId);

    try {
      const { error } = await (supabase as any)
        .from("employees")
        .delete()
        .eq("id", employeeId)
        .eq("created_by", ownerIdentifier);

      if (error) throw error;

      setEmployees((prev) => prev.filter((employee) => employee.id !== employeeId));
      toast.success("Employee deleted permanently");
    } catch (error: any) {
      console.error("Failed to delete employee:", error);
      toast.error(error?.message || "Failed to delete employee");
    } finally {
      setBusyEmployeeId(null);
    }
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
          <div className="rounded-[20px] border bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              {t("employees.totalEmployees")}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {employees.length}
            </p>
          </div>

          <div className="rounded-[20px] border bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              {t("employees.activeEmployees")}
            </p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border bg-white p-5 shadow-sm">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UserPlus size={16} className="text-blue-600" />
              {t("employees.addEmployee")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Add a new employee. If you want to reuse an old phone number, permanently delete the old employee first.
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
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("employees.pinPlaceholder")}
              type="password"
            />

            <Button
              onClick={handleAddEmployee}
              disabled={saving}
              className="h-11 w-full"
            >
              {saving ? t("common.saving") : t("employees.addEmployee")}
            </Button>
          </div>
        </div>

        <div className="rounded-[24px] border bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Users size={16} />
            {t("employees.employeeList")}
          </h2>

          {employees.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              {t("employees.noEmployees")}
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((employee) => {
                const active = employee.is_active !== false;
                const busy = busyEmployeeId === employee.id;

                return (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <User size={16} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          {employee.display_name}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone size={10} />
                          {employee.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {active ? t("employees.active") : t("employees.disabled")}
                      </span>

                      {active ? (
                        <button
                          onClick={() =>
                            void handleDeactivateEmployee(
                              employee.id,
                              employee.display_name
                            )
                          }
                          disabled={busy}
                          className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                          type="button"
                          title="Disable employee"
                        >
                          <ShieldBan size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            void handleActivateEmployee(
                              employee.id,
                              employee.display_name
                            )
                          }
                          disabled={busy}
                          className="rounded-lg p-2 text-green-600 hover:bg-green-50 disabled:opacity-50"
                          type="button"
                          title="Restore employee"
                        >
                          <User size={16} />
                        </button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleDeleteEmployee(
                            employee.id,
                            employee.display_name,
                            employee.phone
                          )
                        }
                        disabled={busy}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                      </Button>
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