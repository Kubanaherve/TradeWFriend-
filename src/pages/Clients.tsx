import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Phone, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { labels } from "@/lib/kinyarwanda";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

const ClientsPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Get unique clients by name (latest entry)
      const uniqueClients = data.reduce((acc, client) => {
        const existing = acc.find(c => c.name.toLowerCase() === client.name.toLowerCase());
        if (!existing) {
          acc.push(client);
        }
        return acc;
      }, [] as Client[]);
      setClients(uniqueClients);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Andika izina ry'umukiriya");
      return;
    }

    setIsSaving(true);
    try {
      // Check if client already exists
      const existingClient = clients.find(
        c => c.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (existingClient) {
        // Update existing client's phone if provided
        if (phone.trim()) {
          await supabase
            .from("customers")
            .update({ phone: phone.trim() })
            .eq("name", existingClient.name);
        }
        toast.success("Umukiriya yahinduwe neza ✨");
      } else {
        // Add as a contact-only entry (no debt)
        await supabase.from("customers").insert({
          name: name.trim(),
          phone: phone.trim() || null,
          items: "",
          amount: 0,
          is_paid: true, // Mark as paid so it doesn't show in debt list
        });
        toast.success("Umukiriya yongeweho neza ✨");
      }

      setName("");
      setPhone("");
      fetchClients();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (clientName: string) => {
    try {
      // Only delete contact-only entries (items="" and amount=0)
      await supabase
        .from("customers")
        .delete()
        .eq("name", clientName)
        .eq("items", "")
        .eq("amount", 0);
      
      toast.success("Umukiriya yasibwe");
      fetchClients();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Habaye ikosa");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-3 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">Abakiriya (Clients)</h1>
            <p className="text-[10px] text-muted-foreground">
              Andika no kubika amakuru y'abakiriya
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 pb-8 space-y-6 max-w-lg mx-auto">
        {/* Add Client Form */}
        <div className="glass-card p-5 animate-fade-in">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            Ongeraho Umukiriya
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-1.5 block">
                <User size={14} className="inline mr-1" />
                Izina ry'umukiriya *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Andika izina..."
                className="bg-white/50 input-glow text-base h-12"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
                <Phone size={14} className="inline mr-1" />
                Numero ya Telefone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07X XXX XXXX"
                className="bg-white/50 input-glow text-base h-12"
                inputMode="tel"
                autoComplete="off"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="w-full h-12 text-base btn-gold"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} className="mr-2" />
                  Emeza
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Clients List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Abakiriya bose ({clients.length})
          </h2>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : clients.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <User size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nta mukiriya uhari</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Ongeraho umukiriya wa mbere hejuru
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="glass-card p-4 flex items-center justify-between animate-fade-in"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{client.name}</p>
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="text-xs text-primary flex items-center gap-1"
                        >
                          <Phone size={10} />
                          {client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(client.name)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    title="Siba"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ClientsPage;
