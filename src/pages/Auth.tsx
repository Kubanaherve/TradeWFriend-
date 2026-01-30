import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gem, Phone, Lock, UserPlus, LogIn } from "lucide-react";
import logo from "@/assets/logo.png";

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
      setIsCheckingAuth(false);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const formatPhoneToEmail = (phoneNumber: string): string => {
    // Convert phone to a fake email for Supabase auth
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@phone.local`;
  };

  const handleLogin = async () => {
    if (!phone || !pin) {
      toast.error("Uzuza numero na PIN");
      return;
    }

    if (pin.length < 4) {
      toast.error("PIN igomba kuba nibura imibare 4");
      return;
    }

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(phone);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Numero cyangwa PIN sibyo");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Murakaza neza! 💎");
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!phone || !pin || !displayName) {
      toast.error("Uzuza ibisabwa byose");
      return;
    }

    if (pin.length < 4) {
      toast.error("PIN igomba kuba nibura imibare 4");
      return;
    }

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(phone);
      
      // Sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pin,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Iyi numero isanzwe ikoreshwa");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            phone: phone,
            display_name: displayName,
          });

        if (profileError) {
          console.error("Profile error:", profileError);
        }

        toast.success("Konti yawe yaremewe! 🎉");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error("Habaye ikosa");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-navy-light to-primary flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-navy-light to-primary flex flex-col items-center justify-center p-6">
      {/* Logo & Title */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-premium">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{labels.appName}</h1>
        <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
          <Gem size={14} />
          <span>{labels.jewelryBusiness}</span>
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm glass-card p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              isLogin ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
            }`}
          >
            <LogIn size={14} className="inline mr-1" />
            Injira
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              !isLogin ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
            }`}
          >
            <UserPlus size={14} className="inline mr-1" />
            Iyandikishe
          </button>
        </div>

        <div className="space-y-4">
          {/* Display Name - Only for signup */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                Izina ryawe
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Urugero: Mama"
                className="bg-muted/50 input-glow"
              />
            </div>
          )}

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
              <Phone size={12} className="inline mr-1" />
              Numero ya Telefone
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0788 123 456"
              className="bg-muted/50 input-glow"
              inputMode="tel"
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
              <Lock size={12} className="inline mr-1" />
              PIN (Imibare 4+)
            </label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="bg-muted/50 input-glow text-center text-2xl tracking-widest"
              maxLength={6}
              inputMode="numeric"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={isLogin ? handleLogin : handleSignup}
            className="w-full btn-gold h-12 text-base"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn size={18} className="mr-2" />
                Injira
              </>
            ) : (
              <>
                <UserPlus size={18} className="mr-2" />
                Iyandikishe
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <p className="text-white/50 text-xs mt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        App izakwibuka iteka 💎
      </p>
    </div>
  );
};

export default AuthPage;
