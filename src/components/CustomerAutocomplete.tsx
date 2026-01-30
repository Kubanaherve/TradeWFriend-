import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CustomerSuggestion {
  name: string;
  phone: string | null;
}

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (customer: CustomerSuggestion) => void;
  suggestions: CustomerSuggestion[];
  placeholder?: string;
  className?: string;
}

export function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
}: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<CustomerSuggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length >= 2) {
      const filtered = suggestions.filter(s =>
        s.name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setActiveSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (customer: CustomerSuggestion) => {
    onSelect(customer);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("bg-white/50 input-glow", className)}
        onFocus={() => {
          if (activeSuggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
      />
      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          {activeSuggestions.map((customer, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(customer)}
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex justify-between items-center"
            >
              <span className="font-medium text-sm">{customer.name}</span>
              {customer.phone && (
                <span className="text-xs text-muted-foreground">{customer.phone}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
