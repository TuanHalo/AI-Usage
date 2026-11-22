import {
  isLang,
  translate,
  type Lang,
  type TKey,
  type TParams,
} from './index';

export const LANG_STORAGE_KEY = 'ai-usage:lang';
export const THEME_STORAGE_KEY = 'ai-usage:theme';
export const LANG_CHANGE_EVENT = 'ai-usage:langchange';
export const THEME_CHANGE_EVENT = 'ai-usage:themechange';

export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function getLang(): Lang {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.lang;
    if (isLang(attr)) {
      return attr;
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (isLang(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return 'en';
}

export function setLang(lang: Lang): void {
  if (!isLang(lang)) return;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = lang;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage write errors
    }
    window.dispatchEvent(
      new CustomEvent<{ readonly lang: Lang }>(LANG_CHANGE_EVENT, {
        detail: { lang },
      })
    );
  }
}

export function t(key: TKey, params?: TParams): string {
  return translate(getLang(), key, params);
}

export function onLangChange(callback: (lang: Lang) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ readonly lang?: Lang }>;
    callback(custom.detail?.lang ?? getLang());
  };
  window.addEventListener(LANG_CHANGE_EVENT, handler);
  return () => window.removeEventListener(LANG_CHANGE_EVENT, handler);
}
