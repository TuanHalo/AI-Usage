import {
  dictionaries,
  isLang,
  translate,
  type Lang,
  type TKey,
} from '../i18n/index';
import {
  getLang,
  isTheme,
  LANG_STORAGE_KEY,
  onLangChange,
  setLang,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type Theme,
} from '../i18n/runtime';

function hasExplicitKey(key: string): key is TKey {
  return Object.prototype.hasOwnProperty.call(dictionaries.en, key);
}

export function getTheme(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.theme;
    if (isTheme(attr)) {
      return attr;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
      if (isTheme(stored)) {
        return stored;
      }
    } catch {
      // Ignore storage errors
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  return 'light';
}

export function setTheme(theme: Theme, persist = true): void {
  if (!isTheme(theme)) return;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
  if (typeof window !== 'undefined') {
    if (persist) {
      try {
        window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Ignore storage write errors
      }
    }
    window.dispatchEvent(
      new CustomEvent<{ readonly theme: Theme }>(THEME_CHANGE_EVENT, {
        detail: { theme },
      })
    );
  }
  syncThemeButtonAria(theme);
}

function syncThemeButtonAria(theme: Theme): void {
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }
}

function syncLangButtonsAria(lang: Lang): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-set-lang]');
  buttons.forEach((btn) => {
    const target = btn.dataset.setLang;
    btn.setAttribute('aria-pressed', target === lang ? 'true' : 'false');
  });
}

export function applyDomTranslations(lang: Lang): void {
  if (typeof document === 'undefined') return;

  // 1. Update document.title and meta description if keyed on <html>
  const root = document.documentElement;
  const titleKey = root.dataset.titleKey;
  if (titleKey && hasExplicitKey(titleKey)) {
    document.title = translate(lang, titleKey);
  }
  const descKey = root.dataset.descKey;
  if (descKey && hasExplicitKey(descKey)) {
    const metaDesc = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    if (metaDesc) {
      metaDesc.content = translate(lang, descKey);
    }
  }

  // 2. Update [data-i18n] textContent elements (such as <option>)
  const textNodes = document.querySelectorAll<HTMLElement>('[data-i18n]');
  textNodes.forEach((el) => {
    const key = el.dataset.i18n;
    if (key && hasExplicitKey(key)) {
      el.textContent = translate(lang, key);
    }
  });

  // 3. Update [data-i18n-attr="placeholder:key1;aria-label:key2"]
  const attrNodes = document.querySelectorAll<HTMLElement>('[data-i18n-attr]');
  attrNodes.forEach((el) => {
    const spec = el.dataset.i18nAttr;
    if (!spec) return;
    for (const pair of spec.split(';')) {
      const [attrName, keyName] = pair.split(':').map((s) => s.trim());
      if (attrName && keyName && hasExplicitKey(keyName)) {
        el.setAttribute(attrName, translate(lang, keyName));
      }
    }
  });

  syncLangButtonsAria(lang);
}

function initPreferences(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // Bind theme toggle
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn?.addEventListener('click', () => {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  });

  // Bind language buttons
  document.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      '[data-set-lang]'
    );
    if (!target) return;
    const nextLang = target.dataset.setLang;
    if (isLang(nextLang) && nextLang !== getLang()) {
      setLang(nextLang);
    }
  });

  // Follow OS theme changes when user hasn't explicitly stored a preference
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  mediaQuery?.addEventListener?.('change', (e) => {
    try {
      const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
      if (!isTheme(stored)) {
        setTheme(e.matches ? 'dark' : 'light', false);
      }
    } catch {
      setTheme(e.matches ? 'dark' : 'light', false);
    }
  });

  // Sync across browser tabs
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY && isTheme(e.newValue)) {
      setTheme(e.newValue, false);
    }
    if (e.key === LANG_STORAGE_KEY && isLang(e.newValue)) {
      setLang(e.newValue);
    }
  });

  onLangChange((lang) => {
    applyDomTranslations(lang);
  });

  syncThemeButtonAria(getTheme());
  applyDomTranslations(getLang());
}

initPreferences();
