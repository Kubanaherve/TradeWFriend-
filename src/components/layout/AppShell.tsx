import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

type AppShellProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  showBack?: boolean;
  showHome?: boolean;
  onBack?: () => void;
  onHome?: () => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
};

const AppShell: React.FC<AppShellProps> = ({
  title,
  subtitle,
  children,
  showBack = true,
  showHome = false,
  onBack,
  onHome,
  headerRight,
  footer,
  contentClassName = "",
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) return onBack();
    navigate(-1);
  };

  const handleHome = () => {
    if (onHome) return onHome();
    navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900"
      style={{
        paddingTop: "max(18px, calc(env(safe-area-inset-top) + 12px))",
        paddingBottom: "max(18px, calc(env(safe-area-inset-bottom) + 12px))",
        paddingLeft: "max(12px, env(safe-area-inset-left))",
        paddingRight: "max(12px, env(safe-area-inset-right))",
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
      }}
    >
      <div className="mx-auto w-full max-w-md md:max-w-3xl xl:max-w-6xl">
        <div className="min-h-[calc(100vh-36px)] overflow-hidden rounded-[24px] bg-white shadow-xl ring-1 ring-slate-200">
          {(title || subtitle || showBack || showHome || headerRight) && (
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/92 backdrop-blur">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  {showBack && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
                      aria-label="Go back"
                    >
                      <ArrowLeft size={17} />
                    </button>
                  )}

                  <div className="min-w-0">
                    {title && (
                      <h1 className="truncate text-[15px] font-bold leading-tight md:text-base">
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p className="truncate text-[11px] text-slate-500 md:text-xs">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {headerRight}
                  {showHome && (
                    <button
                      type="button"
                      onClick={handleHome}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
                      aria-label="Go home"
                    >
                      <Home size={17} />
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          <main className={`px-4 py-4 md:px-5 md:py-5 ${contentClassName}`}>
            {children}
          </main>

          {footer && (
            <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/92 px-4 py-3 backdrop-blur md:px-5">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppShell;