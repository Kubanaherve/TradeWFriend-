import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ItemAutocompleteSuggestion {
  item_name: string;
}

interface ItemAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: string) => void;
  suggestions: ItemAutocompleteSuggestion[];
  placeholder?: string;
  className?: string;
}

export const ItemAutocomplete = ({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
}: ItemAutocompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ItemAutocompleteSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get the last word being typed (after last comma or the whole string)
    const parts = value.split(",");
    const currentWord = parts[parts.length - 1].trim().toLowerCase();
    
    if (currentWord.length >= 1) {
      const filtered = suggestions.filter((item) =>
        item.item_name.toLowerCase().includes(currentWord)
      );
      setFilteredSuggestions(filtered.slice(0, 5));
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setIsOpen(false);
    }
  }, [value, suggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: ItemAutocompleteSuggestion) => {
    // Split by comma to get all parts
    const parts = value.split(",");
    // Replace the last part (current word being typed) with the selected item
    parts[parts.length - 1] = " " + item.item_name;
    // Join back, trim the first space if needed
    const newValue = parts.map((p, i) => i === 0 ? p.trim() : p).join(",");
    onChange(newValue.trim());
    onSelect?.(item.item_name);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("bg-white/50 input-glow", className)}
        onFocus={() => {
          if (value.length >= 1 && filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
      />
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {filteredSuggestions.map((item, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
              onClick={() => handleSelect(item)}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {item.item_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium">{item.item_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
