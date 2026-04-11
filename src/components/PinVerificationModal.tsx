import { useState, useEffect, useCallback, useRef } from 'react';
import { Crown, Briefcase, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const PIN_LENGTH = 6;

// ─────────────────────────────────────────────────────────────────
//  NumPad (internal, styled for lock screen)
// ─────────────────────────────────────────────────────────────────
function LockNumPad({
  pin,
  onPress,
  onDelete,
  disabled,
}: {
  pin: string;
  onPress: (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div>
      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 36 }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 15, height: 15, borderRadius: '50%',
              background: i < pin.length
                ? 'linear-gradient(135deg,#60a5fa,#a78bfa)'
                : 'rgba(255,255,255,0.2)',
              transition: 'all 0.15s',
              transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
              boxShadow: i < pin.length ? '0 0 10px rgba(96,165,250,0.7)' : 'none',
              border: i < pin.length ? 'none' : '2px solid rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>

      {/* Keys */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
        maxWidth: 270, margin: '0 auto', opacity: disabled ? 0.5 : 1 }}>
        {keys.map((k, i) => {
          if (k === '') return <div key={i} />;
          const isDel = k === '⌫';
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => !disabled && (isDel ? onDelete() : onPress(k))}
              style={{
                height: 68, borderRadius: 20, border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: isDel
                  ? 'transparent'
                  : 'rgba(255,255,255,0.12)',
                backdropFilter: isDel ? 'none' : 'blur(8px)',
                color: 'white', fontSize: 22, fontWeight: 600,
                transition: 'all 0.1s', fontFamily: "'DM Sans', system-ui, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none',
                boxShadow: isDel ? 'none' : '0 0 0 1px rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.2)',
              }}
              onMouseDown={e => {
                if (!disabled) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.90)';
                  if (!isDel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.22)';
                }
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                if (!isDel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
              }}
              onTouchStart={e => {
                if (!disabled) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.90)';
                  if (!isDel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.22)';
                }
              }}
              onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                if (!isDel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
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
//  Main Component
// ─────────────────────────────────────────────────────────────────
export function PinVerificationModal() {
  const auth = useAuth();

  const [pin, setPin]             = useState('');
  const [shake, setShake]         = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const [isChecking, setChecking] = useState(false);
  const [lockCountdown, setCountdown] = useState(0);
  const [showLogout, setShowLogout]   = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  const shakeRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show only when required
  const visible = auth.requiresPinVerification;

  // ── Countdown timer when locked ─────────────────────────────
  useEffect(() => {
    if (!visible || !auth.isPinLocked) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    setCountdown(auth.pinLockMinutesLeft * 60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [visible, auth.isPinLocked, auth.pinLockMinutesLeft]);

  // ── Auto-submit when PIN complete ───────────────────────────
  useEffect(() => {
    if (pin.length === PIN_LENGTH && visible && !auth.isPinLocked) {
      handleVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // ── Reset on open ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setPin(''); setErrMsg(''); setSuccessAnim(false); setShowLogout(false);
    }
  }, [visible]);

  // ── Trigger shake ───────────────────────────────────────────
  const triggerShake = useCallback((msg: string) => {
    setShake(true);
    setErrMsg(msg);
    if (shakeRef.current) clearTimeout(shakeRef.current);
    shakeRef.current = setTimeout(() => {
      setShake(false);
      setPin('');
    }, 600);
  }, []);

  // ── Verify ──────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (isChecking) return;
    setChecking(true);
    try {
      const result = await auth.verifyPin(pin);
      if (result === 'success') {
        setSuccessAnim(true);
        setErrMsg('');
        // Small delay so user sees success before modal closes
        setTimeout(() => { setPin(''); setSuccessAnim(false); }, 500);
      } else if (result === 'locked') {
        triggerShake(`Konti irafunzwe kugeza ${auth.pinLockMinutesLeft} min.`);
        setShowLogout(true);
      } else {
        const left = auth.maxPinAttempts - auth.pinAttempts;
        const msg = left <= 0
          ? 'PIN sibyo. Konti igiye gufungwa.'
          : left === 1
            ? `PIN sibyo. Ugeretse ugerageze 1 gusa!`
            : `PIN sibyo. Ugeretse ${left} ugerageze.`;
        triggerShake(msg);
        if (left <= 2) setShowLogout(true);
      }
    } finally {
      setChecking(false);
    }
  }, [pin, isChecking, auth, triggerShake]);

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/';
  };

  if (!visible) return null;

  const profile = auth.profile;
  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ─────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes tw_spin  { to { transform: rotate(360deg) } }
        @keyframes tw_shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-12px)}
          40%{transform:translateX(12px)}
          60%{transform:translateX(-9px)}
          80%{transform:translateX(9px)}
        }
        @keyframes tw_fadeup {
          from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none}
        }
        @keyframes tw_pulse_ring {
          0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(96,165,250,0.4)}
          70%{transform:scale(1);box-shadow:0 0 0 18px rgba(96,165,250,0)}
          100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(96,165,250,0)}
        }
        @keyframes tw_success_scale {
          0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)}
        }
        .tw-pin-card {
          animation: tw_fadeup 0.35s ease;
        }
        .tw-pin-card.shaking {
          animation: tw_shake 0.5s ease !important;
        }
      `}</style>

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', fontFamily: "'DM Sans', system-ui, sans-serif",
        overflowY: 'auto',
      }}>

        {/* Background decorations */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, left: -80, width: 320, height: 320,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        }} />

        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 16, marginBottom: 24,
          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
        }}>
          <img src={logo} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        </div>

        {/* Card */}
        <div
          className={`tw-pin-card ${shake ? 'shaking' : ''}`}
          style={{
            width: '100%', maxWidth: 360, position: 'relative', zIndex: 1,
          }}
        >
          {/* Profile section */}
          {profile && (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 26, margin: '0 auto 14px',
                background: profile.role === 'owner'
                  ? 'linear-gradient(135deg,#1e40af,#3b82f6)'
                  : 'linear-gradient(135deg,#065f46,#059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 30, fontWeight: 800,
                boxShadow: successAnim
                  ? '0 0 0 0 rgba(96,165,250,0), 0 0 32px rgba(96,165,250,0.6)'
                  : '0 8px 32px rgba(0,0,0,0.4)',
                animation: successAnim ? 'tw_success_scale 0.4s ease' : 'none',
                transition: 'box-shadow 0.3s',
              }}>
                {successAnim
                  ? <ShieldCheck size={36} color="white" />
                  : (profile.display_name ?? profile.phone).charAt(0).toUpperCase()
                }
              </div>

              <div style={{ color: 'white', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
                {profile.display_name ?? profile.phone}
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)',
                borderRadius: 20, padding: '5px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
              }}>
                {profile.role === 'owner'
                  ? <Crown size={12} color="#fcd34d" />
                  : <Briefcase size={12} color="#6ee7b7" />}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: profile.role === 'owner' ? '#fcd34d' : '#6ee7b7',
                }}>
                  {profile.role === 'owner' ? "Nyir'ubucuruzi" : 'Umukozi'}
                </span>
                {profile.businessName && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>•</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      {profile.businessName}
                    </span>
                  </>
                )}
              </div>

              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 14 }}>
                {auth.isPinLocked ? '🔒 Konti irafunzwe' : 'Injiza PIN yawe kuzunguruka'}
              </div>
            </div>
          )}

          {/* ── Locked state ── */}
          {auth.isPinLocked ? (
            <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
              <AlertTriangle size={40} color="#fbbf24" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Konti irafunzwe by'agateganyo
              </p>
              {lockCountdown > 0 && (
                <div style={{
                  display: 'inline-block', background: 'rgba(239,68,68,0.15)',
                  borderRadius: 16, padding: '10px 24px', marginBottom: 16,
                  border: '1px solid rgba(239,68,68,0.3)',
                }}>
                  <span style={{ color: '#fca5a5', fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
                    {formatCountdown(lockCountdown)}
                  </span>
                </div>
              )}
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                Winjije PIN yibeshye inshuro {auth.maxPinAttempts}.<br />
                Subira nyuma mu minota {auth.pinLockMinutesLeft}.
              </p>
            </div>
          ) : (
            <>
              {/* ── Error message ── */}
              {errMsg && !successAnim && (
                <div style={{
                  background: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: '10px 16px',
                  marginBottom: 20, border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  animation: 'tw_fadeup 0.25s ease',
                }}>
                  <AlertTriangle size={14} color="#fca5a5" />
                  <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>{errMsg}</span>
                </div>
              )}

              {/* ── Success message ── */}
              {successAnim && (
                <div style={{
                  background: 'rgba(34,197,94,0.15)', borderRadius: 12, padding: '10px 16px',
                  marginBottom: 20, border: '1px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  animation: 'tw_fadeup 0.25s ease',
                }}>
                  <ShieldCheck size={14} color="#86efac" />
                  <span style={{ color: '#86efac', fontSize: 13, fontWeight: 600 }}>
                    Byemejwe! Murakaza neza 💎
                  </span>
                </div>
              )}

              {/* ── Numpad ── */}
              <LockNumPad
                pin={pin}
                onPress={d => { if (pin.length < PIN_LENGTH && !isChecking && !successAnim) setPin(p => p + d); }}
                onDelete={() => { if (!isChecking && !successAnim) setPin(p => p.slice(0, -1)); }}
                disabled={isChecking || successAnim}
              />

              {/* Loading */}
              {isChecking && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#60a5fa',
                    animation: 'tw_spin 0.8s linear infinite' }} />
                </div>
              )}

              {/* Attempt warning bar */}
              {auth.pinAttempts > 0 && auth.pinAttempts < auth.maxPinAttempts && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    {Array.from({ length: auth.maxPinAttempts }).map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 99, margin: '0 2px',
                        background: i < auth.pinAttempts ? '#ef4444' : 'rgba(255,255,255,0.2)',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                    {auth.maxPinAttempts - auth.pinAttempts} ugerageze usigaye mbere yo gufungwa
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Logout / forgot link ── */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            {showLogout || auth.isPinLocked ? (
              <button
                onClick={handleLogout}
                style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', fontSize: 13, fontWeight: 600, padding: '10px 24px',
                  borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.22)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                }}
              >
                <LogOut size={14} />
                Sohoka · Hindura konti
              </button>
            ) : (
              <button
                onClick={() => setShowLogout(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: '8px', fontFamily: 'inherit' }}
              >
                Wibagiwe PIN? → Sohoka
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default PinVerificationModal;