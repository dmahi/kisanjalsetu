import { create } from 'zustand';
import { selectOptionsApi, type SelectOptionsMap, type SelectOption } from '../api/selectOptions';

type SelectOptionsState = {
  data: SelectOptionsMap;
  loading: boolean;
  load: (categories: string[]) => Promise<void>;
  getOptions: (category: string) => SelectOption[];
};

export const useSelectOptionsStore = create<SelectOptionsState>((set, get) => ({
  data: {},
  loading: false,
  load: async (categories) => {
    const pending = categories.filter((c) => !get().data[c]);
    if (pending.length === 0) return;
    if (get().loading) return;
    set({ loading: true });
    try {
      const fresh = await selectOptionsApi.list(categories);
      set((s) => ({ data: { ...s.data, ...fresh } }));
    } catch {
      /* keep fallbacks */
    } finally {
      set({ loading: false });
    }
  },
  getOptions: (category) => get().data[category] || [],
}));

interface LocalizedOption {
  code: string;
  label: string;
}

/** Localize a cached option group using the current app locale. */
export function localizeOptions(options: SelectOption[], locale: string): LocalizedOption[] {
  return (options || []).map((o) => ({
    code: o.code,
    label: o.label?.[locale] || o.label?.en || o.code,
  }));
}

/** Resolve a single code to its localized label. */
export function optionLabel(code: string, options: SelectOption[], locale: string): string {
  const found = (options || []).find((o) => o.code === code);
  if (!found) return code;
  return found.label?.[locale] || found.label?.en || code;
}

export function useSelectOptions(categories: string[]) {
  return useSelectOptionsStore((s) => ({
    options: s.data,
    loading: s.loading,
  }));
}