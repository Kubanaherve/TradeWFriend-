import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Phone, User, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, normalizePhone } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
  due_date: string | null;
  image_url?: string | null;
}

const ClientsPage = () => {
  const navigate = useNavigate();
  const { isOwner, profile } = useAuth();
  const { t } = useI18n();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const actorIdentifier = profile?.phone ?? "";

  const fetchClients = async () => {
    setIsLoading(true);

    try {
      const response = await (supabase as any)
        .from("customers")
        .select("id, name, phone, created_at, due_date, image_url")
        .order("created_at", { ascending: false });

      if (response.error) throw response.error;

      const data = (response.data ?? []) as Client[];

      const uniqueClients = data.reduce((acc, client) => {
        const existing = acc.find(
          (c) =>
            c.name.trim().toLowerCase() === client.name.trim().toLowerCase() ||
            (!!c.phone && !!client.phone && c.phone === client.phone)
        );

        if (!existing) {
          acc.push(client);
        }

        return acc;
      }, [] as Client[]);

      setClients(uniqueClients);
    } catch (error) {
      console.error("Fetch clients error:", error);
      toast.error(t("clients.fetchFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        (client.phone || "").toLowerCase().includes(query)
    );
  }, [clients, search]);

  const handleSave = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim() ? normalizePhone(phone) : null;

    if (!cleanName) {
      toast.error(t("clients.customerName"));
      return;
    }

    setIsSaving(true);

    try {
      const existingResponseByPhone = cleanPhone
        ? await (supabase as any)
            .from("customers")
            .select("id, name, phone")
            .eq("phone", cleanPhone)
            .maybeSingle()
        : null;

      if (existingResponseByPhone?.error) throw existingResponseByPhone.error;

      const existingByPhone = existingResponseByPhone?.data as
        | { id: string; name: string; phone: string | null }
        | null;

      const existingResponseByName = await (supabase as any)
        .from("customers")
        .select("id, name, phone")
        .eq("name", cleanName)
        .maybeSingle();

      if (existingResponseByName.error) throw existingResponseByName.error;

      const existingByName = existingResponseByName.data as
        | { id: string; name: string; phone: string | null }
        | null;

      const existingClient = existingByPhone ?? existingByName;

      if (existingClient) {
        const updatePayload: Record<string, string | null> = {};

        if (cleanPhone && cleanPhone !== existingClient.phone) {
          updatePayload.phone = cleanPhone;
        }

        if (Object.keys(updatePayload).length > 0) {
          const updateResponse = await (supabase as any)
            .from("customers")
            .update(updatePayload)
            .eq("id", existingClient.id);

          if (updateResponse.error) throw updateResponse.error;
        }

        toast.success(t("clients.customerUpdated"));
      } else {
        const nowIso = new Date().toISOString();

        const insertResponse = await (supabase as any)
          .from("customers")
          .insert({
            name: cleanName,
            phone: cleanPhone,
            items: "[]",
            amount: 0,
            is_paid: true,
            due_date: null,
            created_at: nowIso,
            updated_at: nowIso,
            added_by: actorIdentifier || null,
          });

        if (insertResponse.error) throw insertResponse.error;

        toast.success(t("clients.customerSaved"));
      }

      setName("");
      setPhone("");
      await fetchClients();
    } catch (error) {
      console.error("Save client error:", error);
      toast.error(t("clients.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: Client) => {
    const confirmed = window.confirm(
      `${t("clients.confirmDeleteCustomer")} ${client.name}?`
    );
    if (!confirmed) return;

    try {
      const debtItemsResponse = await (supabase as any)
        .from("debt_items")
        .select("id")
        .eq("customer_id", client.id)
        .limit(1);

      if (debtItemsResponse.error) throw debtItemsResponse.error;

      const paymentsResponse = await (supabase as any)
        .from("debt_payments")
        .select("id")
        .eq("customer_id", client.id)
        .limit(1);

      if (paymentsResponse.error) throw paymentsResponse.error;

      const hasDebtHistory =
        (debtItemsResponse.data ?? []).length > 0 ||
        (paymentsResponse.data ?? []).length > 0;

      if (hasDebtHistory) {
        const forceDelete = window.confirm(t("clients.forceDeleteWithHistory"));
        if (!forceDelete) return;
      }

      const deleteResponse = await (supabase as any)
        .from("customers")
        .delete()
        .eq("id", client.id);

      if (deleteResponse.error) throw deleteResponse.error;

      toast.success(t("clients.customerDeleted"));

      window.dispatchEvent(new CustomEvent("clientDeleted"));
      window.dispatchEvent(new CustomEvent("debtDeleted"));

      await fetchClients();
    } catch (error) {
      console.error("Delete client error:", error);
      toast.error(t("clients.deleteFailed"));
    }
  };

 if (!isOwner) {
  return (
    <AppShell
      title={t("clients.title")}
      subtitle={t("clients.subtitle")}
      showBack
      showHome
      contentClassName="pt-2 md:pt-3"
    >
      <div className="mx-auto max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-3 text-xl font-bold">{t("settings.accessRestricted")}</h1>
        <p className="mb-6 text-sm text-slate-600">{t("clients.noPermission")}</p>
        <Button onClick={() => navigate("/dashboard")} className="h-11 w-full rounded-2xl">
          {t("clients.backToDashboard")}
        </Button>
      </div>
    </AppShell>
  );
}
return (
  <AppShell
    title={t("clients.title")}
    subtitle={t("clients.subtitle")}
    showBack
    showHome
    contentClassName="pt-2 md:pt-3"
  >
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserPlus size={18} className="text-primary" />
          {t("clients.addCustomer")}
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              <User size={14} className="mr-1 inline" />
              {t("clients.customerName")} *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("clients.customerNamePlaceholder")}
              className="h-12 rounded-2xl bg-white text-base"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              <Phone size={14} className="mr-1 inline" />
              {t("clients.phoneNumber")}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("clients.phonePlaceholder")}
              className="h-12 rounded-2xl bg-white text-base"
              inputMode="tel"
              autoComplete="off"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="h-12 w-full rounded-2xl text-base"
          >
            {isSaving ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
            ) : (
              <>
                <UserPlus size={18} className="mr-2" />
                {t("clients.saveCustomer")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("common.search")}...`}
              className="rounded-2xl pl-10"
            />
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-500">
          {t("clients.allCustomers")} ({filteredClients.length})
        </h2>

        {isLoading ? (
          <div className="rounded-[24px] bg-white py-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <User size={32} className="mx-auto mb-3 text-slate-400/60" />
            <p className="text-sm text-slate-500">{t("clients.noCustomers")}</p>
            <p className="mt-1 text-xs text-slate-400">
              {t("clients.firstCustomerHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {client.image_url ? (
                    <img
                      src={client.image_url}
                      alt={client.name}
                      className="h-10 w-10 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User size={18} className="text-primary" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{client.name}</p>
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex items-center gap-1 text-xs text-primary"
                      >
                        <Phone size={10} />
                        {client.phone}
                      </a>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(client)}
                  className="p-2 text-slate-400 transition-colors hover:text-destructive"
                  title={t("common.delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </AppShell>
);
};

export default ClientsPage;