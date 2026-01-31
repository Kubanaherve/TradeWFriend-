import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/kinyarwanda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gem, Phone, Lock, UserPlus, LogIn, Plus, User, X } from "lucide-react";
import { PinDialPad } from "@/components/PinDialPad";
import logo from "@/assets/logo.png";

// Local storage key for remembered accounts
const ACCOUNTS_STORAGE_KEY = "jfj_remembered_accounts";

interface RememberedAccount {
  phone: string;
  displayName: string;
}

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Multiple accounts support
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<RememberedAccount | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);

  useEffect(() => {
    // Load remembered accounts
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (stored) {
      try {
        const accounts = JSON.parse(stored) as RememberedAccount[];
        setRememberedAccounts(accounts);
        if (accounts.length > 0) {
          setShowAccountPicker(true);
        }
      } catch {
        localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      }
    }

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
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@phone.local`;
  };

  const saveAccount = (phoneNum: string, name: string) => {
    const newAccount: RememberedAccount = { phone: phoneNum, displayName: name };
    const existing = rememberedAccounts.filter(
      a => a.phone.replace(/\D/g, '') !== phoneNum.replace(/\D/g, '')
    );
    const updated = [...existing, newAccount];
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
    setRememberedAccounts(updated);
  };

  const removeAccount = (phoneNum: string) => {
    const updated = rememberedAccounts.filter(
      a => a.phone.replace(/\D/g, '') !== phoneNum.replace(/\D/g, '')
    );
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
    setRememberedAccounts(updated);
    if (updated.length === 0) {
      setShowAccountPicker(false);
      setShowFullForm(false);
    }
  };

  const handleSelectAccount = (account: RememberedAccount) => {
    setSelectedAccount(account);
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setIsLoading(false);
  };

  const handleAddNewAccount = () => {
    setShowAccountPicker(false);
    setShowFullForm(true);
    setSelectedAccount(null);
  };

  const handleBackToAccountPicker = () => {
    setShowFullForm(false);
    setShowAccountPicker(true);
    setPhone("");
    setPin("");
    setDisplayName("");
  };

  const handlePinLogin = async (enteredPin: string) => {
    if (!selectedAccount) return;

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(selectedAccount.phone);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: enteredPin,
      });

      if (error) {
        toast.error("PIN sibyo, ongera ugerageze");
        setIsLoading(false);
        return;
      }

      toast.success(`Murakaza neza, ${selectedAccount.displayName}! 💎`);
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Habaye ikosa");
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !pin) {
      toast.error("Uzuza numero na PIN");
      return;
    }

    if (pin.length < 5) {
      toast.error("PIN igomba kuba nibura imibare 5");
      return;
    }

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(phone);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Numero cyangwa PIN sibyo");
        } else {
          toast.error(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Get profile for display name
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        // Save this account
        saveAccount(phone, profile?.display_name || "User");
      }

      toast.success("Murakaza neza! 💎");
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Habaye ikosa");
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!phone || !pin || !displayName) {
      toast.error("Uzuza ibisabwa byose");
      return;
    }

    if (pin.length < 5) {
      toast.error("PIN igomba kuba nibura imibare 5");
      return;
    }

    setIsLoading(true);
    try {
      const email = formatPhoneToEmail(phone);
      
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
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Create profile
        await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            phone: phone,
            display_name: displayName,
          });

        // Save this account
        saveAccount(phone, displayName);

        toast.success("Konti yawe yaremewe! 🎉");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error("Habaye ikosa");
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

  // PIN Dial Pad Screen for selected account
  if (selectedAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-navy-light to-primary flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-premium">
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">{labels.appName}</h1>
        </div>

        {/* PIN Dial Pad */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <PinDialPad
            onComplete={handlePinLogin}
            isLoading={isLoading}
            displayName={selectedAccount.displayName}
          />
        </div>

        {/* Back Button */}
        <button
          onClick={handleBackToAccounts}
          className="mt-8 flex items-center gap-2 text-white/50 text-sm hover:text-white/70 transition-colors animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          ← Subira inyuma
        </button>
      </div>
    );
  }

  // Account Picker Screen (when multiple accounts are remembered)
  if (showAccountPicker && rememberedAccounts.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-navy-light to-primary flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-premium">
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">{labels.appName}</h1>
          <p className="text-white/60 text-sm">Hitamo konti yawe</p>
        </div>

        {/* Account List */}
        <div className="w-full max-w-sm space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {rememberedAccounts.map((account, index) => (
            <div
              key={account.phone}
              className="relative group"
            >
              <button
                onClick={() => handleSelectAccount(account)}
                className="w-full glass-card p-4 flex items-center gap-4 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-gold-light flex items-center justify-center text-xl font-bold text-primary">
                  {account.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-foreground text-lg">{account.displayName}</p>
                  <p className="text-sm text-muted-foreground">{account.phone}</p>
                </div>
              </button>
              {/* Remove account button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeAccount(account.phone);
                }}
                className="absolute top-2 right-2 p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Siba konti"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Add Another Account */}
          <button
            onClick={handleAddNewAccount}
            className="w-full glass-card p-4 flex items-center gap-4 hover:bg-white/10 transition-all border-dashed border-2 border-white/20"
          >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Plus size={24} className="text-white/70" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Ongeraho konti</p>
              <p className="text-sm text-muted-foreground">Iyandikishe cyangwa injira</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Full Login/Signup Form
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
        {/* Back button if coming from account picker */}
        {showFullForm && rememberedAccounts.length > 0 && (
          <button
            onClick={handleBackToAccountPicker}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Subira ku makonti
          </button>
        )}

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
                placeholder="Urugero: Mama cyangwa Papa"
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
              PIN (Imibare 5+)
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
