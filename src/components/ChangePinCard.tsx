import { useState } from "react";
import { Lock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function ChangePinCard() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"current" | "new" | "confirm">("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneToEmail = (phoneNumber: string): string => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@phone.local`;
  };

  const resetForm = () => {
    setStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setIsLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const verifyCurrentPin = async () => {
    if (currentPin.length < 5) {
      toast.error("PIN igomba kuba nibura imibare 5");
      return;
    }

    if (!profile?.phone) {
      toast.error("Ntibishoboka kubona numero yawe");
      return;
    }

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(profile.phone);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: currentPin,
      });

      if (error) {
        toast.error("PIN yubwa sibyo");
        setIsLoading(false);
        return;
      }

      setStep("new");
      setIsLoading(false);
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Habaye ikosa");
      setIsLoading(false);
    }
  };

  const handleNewPin = () => {
    if (newPin.length < 5) {
      toast.error("PIN nshya igomba kuba nibura imibare 5");
      return;
    }
    setStep("confirm");
  };

  const handleChangePin = async () => {
    if (confirmPin !== newPin) {
      toast.error("PIN nshya ntizihura");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPin,
      });

      if (error) {
        toast.error("Ntibyashobotse guhindura PIN: " + error.message);
        setIsLoading(false);
        return;
      }

      toast.success("PIN yahinduwe neza! 🎉");
      handleClose();
    } catch (error) {
      console.error("Change PIN error:", error);
      toast.error("Habaye ikosa");
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Change PIN Card */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full glass-card p-4 flex items-center gap-4 hover:bg-accent/50 transition-all active:scale-[0.98] text-left"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Hindura PIN</p>
          <p className="text-sm text-muted-foreground">Guhindura ijambo ry'ibanga</p>
        </div>
      </button>

      {/* Change PIN Dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Hindura PIN
            </DialogTitle>
            <DialogDescription>
              {step === "current" && "Injiza PIN yawe y'ubu kugira ngo ukomeze"}
              {step === "new" && "Injiza PIN nshya (imibare 5+)"}
              {step === "confirm" && "Ongera wandike PIN nshya kugira ngo wemeze"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {step === "current" && (
              <>
                <Input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN y'ubu"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <Button
                  onClick={verifyCurrentPin}
                  disabled={isLoading || currentPin.length < 5}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                  ) : (
                    "Komeza"
                  )}
                </Button>
              </>
            )}

            {step === "new" && (
              <>
                <Input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN nshya"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <Button
                  onClick={handleNewPin}
                  disabled={newPin.length < 5}
                  className="w-full"
                >
                  Komeza
                </Button>
              </>
            )}

            {step === "confirm" && (
              <>
                <Input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Emeza PIN nshya"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep("new")}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Inyuma
                  </Button>
                  <Button
                    onClick={handleChangePin}
                    disabled={isLoading || confirmPin.length < 5}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Emeza
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
