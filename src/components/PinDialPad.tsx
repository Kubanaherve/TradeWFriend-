import { useState } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinDialPadProps {
  onComplete: (pin: string) => void;
  isLoading?: boolean;
  displayName?: string;
}

export function PinDialPad({ onComplete, isLoading, displayName }: PinDialPadProps) {
  const [pin, setPin] = useState("");
  const maxLength = 6;

  const handlePress = (digit: string) => {
    if (pin.length < maxLength) {
      const newPin = pin + digit;
      setPin(newPin);

      // Add haptic feedback simulation with visual feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      if (newPin.length === maxLength) {
        // Faster completion - reduced delay
        setTimeout(() => onComplete(newPin), 100);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="flex flex-col items-center">
      {/* Greeting */}
      {displayName && (
        <p className="text-white/80 text-sm mb-2">
          Muraho, {displayName}! 👋
        </p>
      )}

      {/* PIN Dots */}
      <div className="flex gap-3 mb-8">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ease-out ${
              i < pin.length
                ? "bg-secondary scale-125 shadow-lg shadow-secondary/60 animate-bounce-custom"
                : "bg-white/20 border border-white/30"
            }`}
            style={{
              animation: i < pin.length ? 'bounce 0.6s ease-out' : 'none',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-4">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Dial Pad */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-[280px]">
        {digits.map((digit, index) => {
          if (digit === "") {
            return <div key={index} className="w-14 h-14 sm:w-16 sm:h-16" />;
          }

          if (digit === "del") {
            return (
              <button
                key={index}
                onClick={handleDelete}
                onDoubleClick={handleClear}
                disabled={isLoading || pin.length === 0}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-slate-900/80 hover:bg-slate-100 active:bg-slate-200 transition-all duration-150 disabled:opacity-30 mx-auto shadow-lg hover:shadow-xl active:scale-95 active:shadow-md touch-manipulation"
                style={{
                  transform: 'translateZ(0)', // Hardware acceleration
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: '44px', // iOS touch target minimum
                  minWidth: '44px'
                }}
              >
                <Delete size={20} className="sm:w-6 sm:h-6" />
              </button>
            );
          }

          return (
            <button
              key={index}
              onClick={() => handlePress(digit)}
              disabled={isLoading}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-xl sm:text-2xl font-semibold text-slate-900 hover:bg-white active:bg-slate-100 active:scale-95 transition-all duration-150 disabled:opacity-50 mx-auto shadow-lg hover:shadow-xl active:shadow-md touch-manipulation"
              style={{
                transform: 'translateZ(0)', // Hardware acceleration
                WebkitTapHighlightColor: 'transparent',
                minHeight: '44px', // iOS touch target minimum
                minWidth: '44px'
              }}
            >
              {digit}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p className="text-white/40 text-xs mt-6">
        Injiza PIN yawe (imibare 6)
      </p>
    </div>
  );
}
