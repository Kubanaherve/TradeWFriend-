import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/kinyarwanda";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gem, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

const LoginPage = () => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (pin.length < 4) {
      toast.error("PIN igomba kuba nibura imibare 4");
      return;
    }

    setIsLoading(true);
    try {
      // Check mom's PIN
      const { data: momData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "mom_pin")
        .maybeSingle();

      if (momData?.setting_value === pin) {
        login("mom");
        toast.success(`${labels.welcome}, Mama! 💎`);
        navigate("/dashboard");
        return;
      }

      // Check dad's PIN
      const { data: dadData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "dad_pin")
        .maybeSingle();

      if (dadData?.setting_value === pin) {
        login("dad");
        toast.success(`${labels.welcome}, Papa! 💎`);
        navigate("/dashboard");
        return;
      }

      toast.error(labels.invalidPin);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Habaye ikosa. Ongera ugerageze.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, "");
    setPin(numericValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      {/* Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="glass-card w-full max-w-sm animate-scale-in relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 mb-4 relative animate-float">
            <img 
              src={logo} 
              alt="Jeanne Friend Jewelry" 
              className="w-full h-full object-contain drop-shadow-lg"
            />
            <div className="absolute inset-0 gold-glow rounded-full opacity-50" />
          </div>
          <h1 className="text-xl font-bold text-gradient-navy">
            {labels.appName}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {labels.jewelryBusiness}
          </p>
        </div>

        {/* PIN Input */}
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-foreground mb-2">
              {labels.pin}
            </label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="• • • •"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] h-14 bg-white/50 border-border/50 focus:border-secondary input-glow font-mono"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={isLoading || pin.length < 4}
            className="w-full h-12 btn-navy text-base font-semibold rounded-xl gold-glow-hover"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Gem size={18} />
                {labels.login}
              </span>
            )}
          </Button>
        </div>

        {/* Quick PIN Hint */}
        <p className="text-center text-[10px] text-muted-foreground mt-6">
          Mama: 1234 • Papa: 5678
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
