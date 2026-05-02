import { en } from "./en";
import { rw } from "./rw";
import { fr } from "./fr";
import { hi } from "./hi";

type DeepStringValues<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringValues<T[K]>;
};

export type TranslationDictionary = DeepStringValues<typeof en>;
export type AppLanguage = "en" | "rw" | "fr" | "hi";

export const dictionaries: Record<AppLanguage, TranslationDictionary> = {
  en: en as TranslationDictionary,
  rw: rw as TranslationDictionary,
  fr: fr as TranslationDictionary,
  hi: hi as unknown as TranslationDictionary,
};
