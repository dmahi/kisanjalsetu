import { useEffect, useMemo } from 'react';
import { useLocale } from '../store/locale.store';
import { localizeOptions, optionLabel, useSelectOptions, useSelectOptionsStore } from '../store/selectOptions.store';

export interface LocalizedSelectOption {
  code: string;
  label: string;
}

/**
 * Fetch + cache admin-managed select options for the given categories and
 * localize them to the current app locale.
 */
export function useDynamicOptions(categories: string[]): {
  options: Record<string, LocalizedSelectOption[]>;
  loading: boolean;
} {
  const locale = useLocale((s) => s.locale);
  const { options, loading } = useSelectOptions(categories);
  const load = useSelectOptionsStore((s) => s.load);
  const key = categories.join(',');

  useEffect(() => {
    void load(categories);
  }, [key, load]);

  const localized = useMemo(() => {
    const out: Record<string, LocalizedSelectOption[]> = {};
    for (const c of categories) {
      out[c] = localizeOptions(options[c] || [], locale);
    }
    return out;
  }, [options, locale, key]);

  return { options: localized, loading };
}

/** Resolve the localized label for a single code in a category. */
export function useSelectOptionLabel(category: string, code: string, fallback: string): string {
  const locale = useLocale((s) => s.locale);
  const opts = useSelectOptionsStore((s) => s.data[category]);
  const label = optionLabel(code, opts, locale);
  return label || fallback;
}

/** Localized display name for a crop (uses labels when present). */
export function cropLabel(crop: { name: string; labels?: Record<string, string> }, locale: string): string {
  if (crop.labels && crop.labels[locale]) return crop.labels[locale]!;
  return crop.name;
}