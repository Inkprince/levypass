import { en, type MessageKey } from "./en";
import { pcm } from "./pcm";
import { yo } from "./yo";
import { ig } from "./ig";
import { ha } from "./ha";

export const locales = ["en", "pcm", "yo", "ig", "ha"] as const;
export type Locale = (typeof locales)[number];
export type { MessageKey };

const dictionaries = { en, pcm, yo, ig, ha } as const;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Looks up a message, falling back to English, and fills `{name}` placeholders. */
export function t(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
