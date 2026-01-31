import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/kinyarwanda";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, thankYouMessage: string) => void;
  customerName: string;
  totalAmount: number;
}

const PaymentModal = ({
  isOpen,
  onClose,
  onConfirm,
  customerName,
  totalAmount,
}: PaymentModalProps) => {
  const [paymentAmount, setPaymentAmount] = useState<string>(totalAmount.toString());
  const [thankYouMessage, setThankYouMessage] = useState<string>(
    `Thank you very much!! Mugire ibihe byiza.`
  );
  const [error, setError] = useState<string>("");

  const handleConfirm = () => {
    const amount = Number(paymentAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setError("Andika umubare w'amafaranga yemewe");
      return;
    }
    
    if (amount > totalAmount) {
      setError(`Amafaranga ntashobora kurenza ${formatCurrency(totalAmount)}`);
      return;
    }

    setError("");
    onConfirm(amount, thankYouMessage);
    
    // Reset form
    setPaymentAmount(totalAmount.toString());
    setError("");
  };

  const handleClose = () => {
    setPaymentAmount(totalAmount.toString());
    setError("");
    onClose();
  };

  const remainingAfterPayment = totalAmount - Number(paymentAmount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kwishyura kwa {customerName}</DialogTitle>
          <DialogDescription>
            Ideni ryose: <strong>{formatCurrency(totalAmount)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amafaranga yishyuye</Label>
            <Input
              id="amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => {
                setPaymentAmount(e.target.value);
                setError("");
              }}
              placeholder="Andika amafaranga"
              className="input-glow"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {remainingAfterPayment > 0 && Number(paymentAmount) > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Amafaranga azasigara: <strong>{formatCurrency(remainingAfterPayment)}</strong>
              </p>
            </div>
          )}

          {remainingAfterPayment === 0 && Number(paymentAmount) > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Ideni ryose rizishyurwa burundu!
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Ubutumwa bwo gushimira</Label>
            <Input
              id="message"
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Murakoze cyane..."
              className="input-glow"
            />
            <p className="text-xs text-muted-foreground">
              Ubu butumwa buzagaragara nyuma yo kwishyura
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Bireke
          </Button>
          <Button onClick={handleConfirm} className="btn-gold">
            Emeza Kwishyura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
