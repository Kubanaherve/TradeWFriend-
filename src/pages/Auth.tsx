import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Gem, ArrowLeft, Crown, Briefcase, X, Plus,
  Eye, EyeOff, CheckCircle2, AlertCircle, Building2,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth, hashPin, type UserRole, type LocalAccount } from "@/contexts/AuthContext";

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const PIN_LENGTH = 6;

type Screen =
  | 'checking'
  | 'accounts'
  | 'pin_entry'
  | 'register'
  | 'login_phone'
  | 'pin_setup_enter'
  | 'pin_setup_confirm';

// ─────────────────────────────────────────────────────────────────
//  Numpad Component (shared by pin_entry and pin_setup)
// ─────────────────────────────────────────────────────────────────
function NumPad({
  pin,
  onPress,
  onDelete,
  pinLength = PIN_LENGTH,
}: {
  pin: string;
  onPress: (d: string) => void;
  onDelete: () => void;
  pinLength?: number;
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div>
      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 32 }}>
        {Array.from({ length: pinLength }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i < pin.length
                ? 'linear-gradient(135deg,#1e40af,#3b82f6)'
                : '#e2e8f0',
              transition: 'background 0.15s, transform 0.15s',
              transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
              boxShadow: i < pin.length ? '0 0 8px rgba(59,130,246,0.5)' : 'none',
            }}
          />
        ))}
      </div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 260, margin: '0 auto' }}>
        {keys.map((k, i) => {
          if (k === '') return <div key={i} />;
          const isDelete = k === '⌫';
          return (
            <button
              key={i}
              onClick={() => isDelete ? onDelete() : onPress(k)}
              style={{
                height: 64,
                borderRadius: 18,
                border: 'none',
                background: isDelete ? 'transparent' : 'white',
                boxShadow: isDelete ? 'none' : '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
                fontSize: isDelete ? 22 : 22,
                fontWeight: 600,
                color: isDelete ? '#94a3b8' : '#0f172a',
                cursor: 'pointer',
                transition: 'all 0.1s',
                fontFamily: "'DM Sans', system-ui, sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
              onMouseDown={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
                (e.currentTarget as HTMLElement).style.background = isDelete ? 'transparent' : '#f1f5f9';
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.background = isDelete ? 'transparent' : 'white';
              }}
              onTouchStart={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
                (e.currentTarget as HTMLElement).style.background = isDelete ? 'transparent' : '#f1f5f9';
              }}
              onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.background = isDelete ? 'transparent' : 'white';
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh', background: '#f0f4f8',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px', fontFamily: "'DM Sans', system-ui, sans-serif",
    position: 'relative' as const, overflow: 'hidden',
  },
  blob1: {
    position: 'absolute' as const, top: -140, right: -140,
    width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none' as const,
    background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)',
  },
  blob2: {
    position: 'absolute' as const, bottom: -120, left: -120,
    width: 360, height: 360, borderRadius: '50%', pointerEvents: 'none' as const,
    background: 'radial-gradient(circle, rgba(6,182,212,0.11) 0%, transparent 70%)',
  },
  card: {
    background: 'white', borderRadius: 28, width: '100%', maxWidth: 390,
    padding: '32px 28px', position: 'relative' as const, zIndex: 1,
    boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20, margin: '0 auto 14px',
    background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(15,23,42,0.28), 0 0 0 1px rgba(59,130,246,0.2)',
  },
  appName: {
    fontSize: 22, fontWeight: 700, color: '#0f172a',
    textAlign: 'center' as const, letterSpacing: '-0.5px', marginBottom: 4,
  },
  subtitle: {
    fontSize: 13, color: '#64748b', textAlign: 'center' as const, marginBottom: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  input: {
    width: '100%', padding: '13px 16px', borderRadius: 14,
    border: '1.5px solid #e2e8f0', background: '#f8fafc',
    fontSize: 15, color: '#0f172a', outline: 'none',
    boxSizing: 'border-box' as const, transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  label: {
    fontSize: 12, fontWeight: 600, color: '#475569',
    marginBottom: 6, display: 'block', letterSpacing: '0.3px',
  },
  btn: (variant: 'primary' | 'outline' | 'ghost' = 'primary') => ({
    width: '100%', padding: '14px', borderRadius: 16, cursor: 'pointer',
    fontSize: 15, fontWeight: 700, letterSpacing: '0.2px', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg,#0f172a 0%,#1e40af 100%)', color: 'white', border: 'none',
      boxShadow: '0 4px 20px rgba(15,23,42,0.25), 0 0 0 1px rgba(59,130,246,0.15)',
    } : variant === 'outline' ? {
      background: 'white', color: '#0f172a', border: '1.5px solid #e2e8f0', boxShadow: 'none',
    } : {
      background: 'none', color: '#94a3b8', border: 'none', boxShadow: 'none',
    }),
  }),
  divider: {
    height: 2, borderRadius: 99, margin: '22px 0', opacity: 0.4,
    background: 'linear-gradient(90deg,transparent,#3b82f6,#06b6d4,transparent)',
  },
  accountCard: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
    borderRadius: 18, border: '1.5px solid #e2e8f0', background: 'white',
    cursor: 'pointer', width: '100%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'all 0.18s',
    position: 'relative' as const, marginBottom: 10, fontFamily: 'inherit',
  },
};

function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#3b82f6';
  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
}
function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#e2e8f0';
  e.target.style.boxShadow = 'none';
}

// ─────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────
const AuthPage = () => {
  const navigate    = useNavigate();
  const auth        = useAuth();

  const [screen, setScreen]           = useState<Screen>('checking');
  const [accounts, setAccounts]       = useState<LocalAccount[]>([]);
  const [selected, setSelected]       = useState<LocalAccount | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone]             = useState('');
  const [businessName, setBusiness]   = useState('');
  const [role, setRole]               = useState<UserRole>('owner');
  const [showPw, setShowPw]           = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [loginPhone, setLoginPhone]   = useState('');

  // PIN state
  const [pin, setPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [shake, setShake]     = useState(false);
  const [pinError, setPinError] = useState('');

  const shakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerShake = useCallback((msg?: string) => {
    setShake(true);
    if (msg) setPinError(msg);
    if (shakeRef.current) clearTimeout(shakeRef.current);
    shakeRef.current = setTimeout(() => { setShake(false); setPin(''); }, 600);
  }, []);

  // ── Initial check ──────────────────────────────────────────
  useEffect(() => {
    const list = auth.getAllAccounts();
    setAccounts(list);
    if (list.length === 0) {
      setScreen('register');
    } else if (list.length === 1) {
      setSelected(list[0]);
      setScreen('pin_entry');
    } else {
      setScreen('accounts');
    }
  }, []);  // eslint-disable-line

  // ── PIN entry auto-submit ──────────────────────────────────
  useEffect(() => {
    if (screen === 'pin_entry' && pin.length === PIN_LENGTH) {
      handlePinLogin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, screen]);

  // ── PIN setup confirm auto-submit ──────────────────────────
  useEffect(() => {
    if (screen === 'pin_setup_confirm' && confirmPin.length === PIN_LENGTH) {
      handlePinConfirm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, screen]);

  // ── PIN setup enter auto-advance ───────────────────────────
  useEffect(() => {
    if (screen === 'pin_setup_enter' && pin.length === PIN_LENGTH) {
      setTimeout(() => setScreen('pin_setup_confirm'), 200);
    }
  }, [pin, screen]);

  // ─────────────────────────────────────────────────────────────
  //  Handlers
  // ─────────────────────────────────────────────────────────────
  const handlePinLogin = useCallback(async () => {
    if (!selected || pin.length < PIN_LENGTH) return;
    setIsLoading(true);
    const result = await auth.loginWithPin(selected.phone, pin);
    setIsLoading(false);
    if (result === 'success') {
      toast.success(`Murakaza neza, ${selected.displayName}! 💎`);
      navigate('/dashboard');
    } else if (result === 'locked') {
      triggerShake(`Konti irafunze. Subira nyuma iminota ${auth.pinLockMinutesLeft}.`);
    } else if (result === 'wrong') {
      const left = auth.maxPinAttempts - (auth.pinAttempts);
      triggerShake(left > 0 ? `PIN sibyo. Ugeretse ${left} ugerageze.` : 'Gerageza nanone.');
    } else {
      triggerShake('Konti ntiboneka.');
    }
  }, [selected, pin, auth, navigate, triggerShake]);

  const handleRegister = async () => {
    if (!displayName.trim()) return toast.error('Andika izina ryawe');
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9)
      return toast.error('Andika numero ya telefone ikoreshwa neza');
    if (!businessName.trim()) return toast.error('Andika izina ry\'ubucuruzi');
    const cleanPhone = phone.replace(/\s/g, '');
    if (auth.findAccount(cleanPhone)) {
      return toast.error('Iyi numero isanzwe ikoreshwa. Injira hejuru.');
    }
    setPhone(cleanPhone);
    setScreen('pin_setup_enter');
  };

  const handlePinConfirm = useCallback(async () => {
    if (confirmPin !== pin) {
      setConfirmPin('');
      triggerShake('PIN ntizihura. Ongera ugerageze.');
      return;
    }
    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/\s/g, '');
      const pinHash = await hashPin(pin, cleanPhone);
      auth.saveAccount({
        phone: cleanPhone, displayName: displayName.trim(),
        pinHash, role, businessName: businessName.trim(),
      });
      auth.loginLocal({
        id: cleanPhone, phone: cleanPhone,
        display_name: displayName.trim(), role, businessName: businessName.trim(),
      });
      toast.success('Konti yawe yaremewe neza! 🎉');
      navigate('/dashboard');
    } catch {
      toast.error('Habaye ikosa. Ongera ugerageze.');
    } finally {
      setIsLoading(false);
    }
  }, [confirmPin, pin, phone, displayName, role, businessName, auth, navigate, triggerShake]);

  const handleLoginForm = async () => {
    if (!loginPhone.trim()) return toast.error('Andika numero ya telefone');
    const acct = auth.findAccount(loginPhone.replace(/\s/g, ''));
    if (!acct) return toast.error('Konti ntiboneka kuri iyi numero.');
    setSelected(acct);
    setScreen('pin_entry');
  };

  const removeAccount = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Ushaka gusiba iyi konti?')) return;
    auth.removeAccount(phone);
    const updated = auth.getAllAccounts();
    setAccounts(updated);
    if (updated.length === 0) setScreen('register');
  };

  // ─────────────────────────────────────────────────────────────
  //  Shared sub-components
  // ─────────────────────────────────────────────────────────────
  const LogoHeader = ({ sub }: { sub?: string }) => (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={S.logoWrap}>
        <img src={logo} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
      </div>
      <div style={S.appName}>TradeWFriend+</div>
      <div style={S.subtitle}>
        <Gem size={13} color="#3b82f6" />
        <span>{sub ?? 'Smart business manager'}</span>
      </div>
    </div>
  );

  const BackBtn = ({ to, label = '← Subira inyuma' }: { to: Screen; label?: string }) => (
    <button
      onClick={() => { setPin(''); setConfirmPin(''); setPinError(''); setScreen(to); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
        fontSize: 13, display: 'block', margin: '18px auto 0', padding: '6px 12px', fontFamily: 'inherit' }}
    >
      {label}
    </button>
  );

  const Spinner = () => (
    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)',
      borderTopColor: 'white', animation: 'tw_spin 0.8s linear infinite' }} />
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: Checking
  // ─────────────────────────────────────────────────────────────
  if (screen === 'checking') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={{ width: 44, height: 44, borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#3b82f6',
        animation: 'tw_spin 0.8s linear infinite' }} />
      <style>{`@keyframes tw_spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: Account Picker
  // ─────────────────────────────────────────────────────────────
  if (screen === 'accounts') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader sub="Hitamo konti yawe" />
        <div style={S.divider} />

        {accounts.map(acc => (
          <button
            key={acc.phone}
            onClick={() => { setSelected(acc); setPin(''); setScreen('pin_entry'); }}
            style={S.accountCard}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(59,130,246,0.14)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 50, height: 50, borderRadius: 15, flexShrink: 0, color: 'white',
              background: acc.role === 'owner'
                ? 'linear-gradient(135deg,#0f172a,#1e40af)'
                : 'linear-gradient(135deg,#065f46,#059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, boxShadow: '0 0 12px rgba(59,130,246,0.25)',
            }}>
              {acc.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
                  {acc.displayName}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  background: acc.role === 'owner' ? '#fef3c7' : '#d1fae5',
                  color: acc.role === 'owner' ? '#92400e' : '#065f46',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {acc.role === 'owner' ? <Crown size={9} /> : <Briefcase size={9} />}
                  {acc.role === 'owner' ? 'Nyir\'ubucuruzi' : 'Umukozi'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{acc.phone}</div>
              {acc.businessName && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={10} /> {acc.businessName}
                </div>
              )}
            </div>
            <button
              onClick={(e) => removeAccount(acc.phone, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: '#cbd5e1', padding: 6, borderRadius: 8, transition: 'color 0.2s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#cbd5e1')}
            >
              <X size={15} />
            </button>
          </button>
        ))}

        {/* Add account */}
        <button
          onClick={() => setScreen('register')}
          style={{ ...S.accountCard, border: '1.5px dashed #cbd5e1', justifyContent: 'flex-start' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#3b82f6')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1')}
        >
          <div style={{ width: 50, height: 50, borderRadius: 15, background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={22} color="#3b82f6" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>Ongeraho konti</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Iyandikishe konti nshya</div>
          </div>
        </button>

        <button onClick={() => setScreen('login_phone')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
            fontSize: 13, display: 'block', margin: '8px auto 0', padding: '6px 12px', fontFamily: 'inherit' }}>
          Wari ufite konti? Injira
        </button>
      </div>
      <style>{`@keyframes tw_spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: PIN Entry (login)
  // ─────────────────────────────────────────────────────────────
  if (screen === 'pin_entry' && selected) return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={{ ...S.card, animation: shake ? 'tw_shake 0.5s ease' : 'none' }}>
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22, margin: '0 auto 12px',
            background: selected.role === 'owner'
              ? 'linear-gradient(135deg,#0f172a,#1e40af)'
              : 'linear-gradient(135deg,#065f46,#059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 28, fontWeight: 800,
            boxShadow: '0 8px 32px rgba(15,23,42,0.25)',
          }}>
            {selected.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>
            {selected.displayName}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
            background: selected.role === 'owner' ? '#fef3c7' : '#d1fae5',
            color: selected.role === 'owner' ? '#92400e' : '#065f46',
          }}>
            {selected.role === 'owner' ? <Crown size={10} /> : <Briefcase size={10} />}
            {selected.role === 'owner' ? "Nyir'ubucuruzi" : 'Umukozi'}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
            Injiza PIN yawe
          </div>
        </div>

        <div style={S.divider} />

        {auth.isPinLocked ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Konti irafunzwe</p>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Ongera ugerageze mu minota {auth.pinLockMinutesLeft}.
            </p>
          </div>
        ) : (
          <>
            {pinError && (
              <p style={{ textAlign: 'center', color: '#ef4444', fontSize: 13,
                fontWeight: 600, marginBottom: 16, animation: 'tw_fadein 0.3s' }}>
                {pinError}
              </p>
            )}
            {auth.pinAttempts > 0 && !pinError && (
              <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: 12, marginBottom: 12 }}>
                Ugeretse {auth.maxPinAttempts - auth.pinAttempts} ugerageze
              </p>
            )}
            <NumPad
              pin={pin}
              onPress={d => { if (pin.length < PIN_LENGTH && !isLoading) setPin(prev => prev + d); }}
              onDelete={() => setPin(prev => prev.slice(0, -1))}
            />
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%',
                  border: '3px solid #e2e8f0', borderTopColor: '#3b82f6',
                  animation: 'tw_spin 0.8s linear infinite' }} />
              </div>
            )}
          </>
        )}

        <BackBtn
          to={accounts.length > 1 ? 'accounts' : 'register'}
          label={accounts.length > 1 ? '← Subira ku makonti' : '← Iyandikishe'}
        />
      </div>
      <style>{`
        @keyframes tw_spin { to { transform: rotate(360deg) } }
        @keyframes tw_shake {
          0%,100% { transform: translateX(0) }
          20% { transform: translateX(-10px) }
          40% { transform: translateX(10px) }
          60% { transform: translateX(-8px) }
          80% { transform: translateX(8px) }
        }
        @keyframes tw_fadein { from { opacity:0; transform: translateY(-4px) } to { opacity:1; transform:none } }
      `}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: Login by phone (manual entry)
  // ─────────────────────────────────────────────────────────────
  if (screen === 'login_phone') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader sub="Injira muri konti yawe" />
        <div>
          <label style={S.label}>📱 Numero ya Telefone</label>
          <input
            type="tel" value={loginPhone}
            onChange={e => setLoginPhone(e.target.value)}
            placeholder="07XX XXX XXX" style={S.input}
            inputMode="tel" autoComplete="off"
            onFocus={inputFocus} onBlur={inputBlur}
          />
        </div>
        <button
          onClick={handleLoginForm} style={S.btn()}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}
        >
          Komeza
        </button>
        <BackBtn to="accounts" label="← Subira" />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: Register
  // ─────────────────────────────────────────────────────────────
  if (screen === 'register') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={{ ...S.card, overflowY: 'auto', maxHeight: '95vh' }}>
        <LogoHeader sub="Fungura konti nshya" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={S.label}>👤 Izina ryawe</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Urugero: Jeanne" style={S.input}
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>
          {/* Phone */}
          <div>
            <label style={S.label}>📱 Numero ya Telefone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="07XX XXX XXX" style={S.input} inputMode="tel"
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>
          {/* Business */}
          <div>
            <label style={S.label}>🏬 Izina ry'ubucuruzi</label>
            <input value={businessName} onChange={e => setBusiness(e.target.value)}
              placeholder="Urugero: Chez Marie Shop" style={S.input}
              onFocus={inputFocus} onBlur={inputBlur} />
          </div>

          {/* Role selection */}
          <div>
            <label style={S.label}>👥 Uruhare rwawe</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['owner', 'employee'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    padding: '14px 12px', borderRadius: 16, cursor: 'pointer',
                    border: role === r ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                    background: role === r ? '#eff6ff' : 'white',
                    transition: 'all 0.18s', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 8, fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: r === 'owner' ? '#fef3c7' : '#d1fae5',
                  }}>
                    {r === 'owner' ? <Crown size={20} color="#92400e" /> : <Briefcase size={20} color="#065f46" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {r === 'owner' ? "Nyir'ubucuruzi" : 'Umukozi'}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      {r === 'owner' ? 'Uburenganzira bwose' : 'Uburenganzira bwimwe'}
                    </div>
                  </div>
                  {role === r && (
                    <CheckCircle2 size={16} color="#3b82f6" style={{ position: 'absolute' as any }} />
                  )}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
              {role === 'owner'
                ? '👑 Ubona amafaranga yose, raporo, na byose.'
                : '💼 Ubona stock na madeni gusa. Amafaranga afunzwe.'}
            </p>
          </div>

          <button
            onClick={handleRegister} disabled={isLoading}
            style={{ ...S.btn(), opacity: isLoading ? 0.7 : 1 }}
            onMouseEnter={e => !isLoading && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}
          >
            {isLoading ? <Spinner /> : 'Komeza → Shyiraho PIN'}
          </button>
        </div>

        <div style={S.divider} />
        {accounts.length > 0 && (
          <BackBtn to="accounts" label="← Konti zihari" />
        )}
        <button onClick={() => setScreen('login_phone')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
            fontSize: 13, display: 'block', margin: '8px auto 0', padding: '6px 12px', fontFamily: 'inherit' }}>
          Wari ufite konti? Injira
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: PIN Setup - Enter
  // ─────────────────────────────────────────────────────────────
  if (screen === 'pin_setup_enter') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card}>
        <LogoHeader sub="Shyiraho PIN yawe" />
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#f0f9ff', borderRadius: 12, padding: '8px 16px', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
              🔒 PIN ya nimero {PIN_LENGTH} izabika konti yawe iri mwihangane
            </span>
          </div>
        </div>
        <div style={S.divider} />
        <NumPad
          pin={pin}
          onPress={d => { if (pin.length < PIN_LENGTH) setPin(prev => prev + d); }}
          onDelete={() => setPin(prev => prev.slice(0, -1))}
        />
        <BackBtn to="register" />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  //  SCREEN: PIN Setup - Confirm
  // ─────────────────────────────────────────────────────────────
  if (screen === 'pin_setup_confirm') return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={{ ...S.card, animation: shake ? 'tw_shake 0.5s ease' : 'none' }}>
        <LogoHeader sub="Emeza PIN yawe" />
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 13, color: '#64748b' }}>Ongera injiza PIN nshya kuyemeza</p>
          {pinError && (
            <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, marginTop: 6,
              animation: 'tw_fadein 0.3s' }}>
              {pinError}
            </p>
          )}
        </div>
        <div style={S.divider} />
        <NumPad
          pin={confirmPin}
          onPress={d => { if (confirmPin.length < PIN_LENGTH && !isLoading) setConfirmPin(prev => prev + d); }}
          onDelete={() => setConfirmPin(prev => prev.slice(0, -1))}
        />
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%',
              border: '3px solid #e2e8f0', borderTopColor: '#3b82f6',
              animation: 'tw_spin 0.8s linear infinite' }} />
          </div>
        )}
        <button
          onClick={() => { setConfirmPin(''); setPinError(''); setScreen('pin_setup_enter'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
            fontSize: 13, display: 'block', margin: '18px auto 0', padding: '6px 12px', fontFamily: 'inherit' }}
        >
          ← Hindura PIN
        </button>
      </div>
      <style>{`
        @keyframes tw_spin { to { transform: rotate(360deg) } }
        @keyframes tw_shake {
          0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}
          40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}
        }
        @keyframes tw_fadein { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );

  return null;
};

export default AuthPage;