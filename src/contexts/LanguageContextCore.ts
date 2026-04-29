import { createContext } from "react";
import type { AppLanguage, TranslationDictionary } from "@/lib/i18n";

export type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  dictionary: TranslationDictionary;
  t: (path: string) => string;
};

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
