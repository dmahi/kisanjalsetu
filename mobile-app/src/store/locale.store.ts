import { create } from 'zustand';
import { translations, interpolate, LOCALES, type Locale } from '../i18n/translations';

const LOCALE_KEY = 'kjs.locale';

type Locals = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
  } catch {
    /* ignore */
  }
  return 'en';
}

export const useLocale = create<Locals>((set, get) => ({
  locale: loadLocale(),
  setLocale: (l: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
    set({ locale: l });
  },
  t: (key, vars) => {
    const dict = translations[get().locale] ?? translations.en;
    const template = dict[key] ?? translations.en[key] ?? key;
    return interpolate(template, vars);
  },
}));

export { LOCALES };
export type { Locale };

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  return useLocale((s) => s.t);
}