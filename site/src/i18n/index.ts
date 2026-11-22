import { en } from './en';
import { vi } from './vi';

export const LANGS = ['en', 'vi'] as const;
export type Lang = (typeof LANGS)[number];
export type TKey = keyof typeof en;
export type TParams = Readonly<Record<string, string | number>>;

export const dictionaries: Readonly<Record<Lang, Readonly<Record<TKey, string>>>> = {
  en,
  vi,
};

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'vi';
}

export function translate(
  lang: Lang,
  key: TKey,
  params?: TParams
): string {
  const dict = dictionaries[lang] ?? dictionaries.en;
  const raw = dict[key] ?? dictionaries.en[key] ?? String(key);
  if (!params) {
    return raw;
  }
  return raw.replace(/\{(\w+)\}/g, (match, token: string) => {
    const val = params[token];
    return val !== undefined ? String(val) : match;
  });
}
