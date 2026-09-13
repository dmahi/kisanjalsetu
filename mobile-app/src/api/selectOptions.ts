import { apiRequest } from './client';

export interface SelectOption {
  code: string;
  label: Record<string, string>;
  sortOrder: number;
}

export type SelectOptionsMap = Record<string, SelectOption[]>;

export const selectOptionsApi = {
  list: (categories: string[]): Promise<SelectOptionsMap> =>
    apiRequest({ url: '/select-options', method: 'GET', params: { categories: categories.join(',') } }),
};