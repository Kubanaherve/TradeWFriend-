import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Check, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-6"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="glass-card text-center animate-fade-in">
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg">
            <img src={logo} alt="JF Jewelry" className="w-full h-full object-cover" />
          </div>

          <h1 className="text-xl font-bold mb-2">Jeanne Friend Jewelry</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Install app kuri telefone yawe
          </p>

          {isInstalled ? (
            <div className="bg-green-50 text-green-600 p-4 rounded-xl mb-6">
              <Check size={32} className="mx-auto mb-2" />
              <p className="font-medium">App yamaze ku-installwa!</p>
              <p className="text-sm mt-1">Ushobora kuyifungura kuri home screen</p>
            </div>
          ) : isIOS ? (
            <div className="space-y-4 text-left bg-muted/50 p-4 rounded-xl mb-6">
              <p className="font-medium text-center mb-4">
                <Smartphone className="inline mr-2" size={20} />
                Ku iPhone/iPad:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">1</span>
                  <span>Kanda kuri <strong>Share</strong> button (icon ifite arrow yerekeza hejuru)</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">2</span>
                  <span>Scroll ushakishemo <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">3</span>
                  <span>Kanda <strong>"Add"</strong></span>
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            <Button
              onClick={handleInstall}
              className="btn-navy w-full py-6 text-base mb-6"
            >
              <Download size={20} className="mr-2" />
              Install App
            </Button>
          ) : (
            <div className="space-y-4 text-left bg-muted/50 p-4 rounded-xl mb-6">
              <p className="font-medium text-center mb-4">
                <Smartphone className="inline mr-2" size={20} />
                Ku Android:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">1</span>
                  <span>Kanda kuri menu ya browser (⋮ cyangwa ⋯)</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">2</span>
                  <span>Hitamo <strong>"Install app"</strong> cyangwa <strong>"Add to Home screen"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">3</span>
                  <span>Kanda <strong>"Install"</strong></span>
                </li>
              </ol>
            </div>
          )}

          {/* Features */}
          <div className="text-left space-y-3 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-3">Ibyiza bya app:</p>
            <div className="flex items-center gap-3 text-sm">
              <Check size={16} className="text-green-600" />
              <span>Ikora offline</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check size={16} className="text-green-600" />
              <span>Yihuse nka app ya nyayo</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check size={16} className="text-green-600" />
              <span>Nta data nyinshi isaba</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPage;
