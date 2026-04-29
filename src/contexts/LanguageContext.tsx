import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type AppLanguage, type TranslationDictionary } from "@/lib/i18n";
import { LanguageContext, type LanguageContextType } from "./LanguageContextCore";

const STORAGE_KEY = "tw_app_language";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : path;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("rw");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (saved && saved in dictionaries) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    localStorage.setItem(STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  const dictionary = dictionaries[language] ?? dictionaries.rw;

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      dictionary,
      t: (path: string) =>
        getNestedValue(dictionary as unknown as Record<string, unknown>, path),
    }),
    [language, dictionary]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
