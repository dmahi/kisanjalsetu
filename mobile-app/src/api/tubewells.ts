import { apiRequest } from './client';
import type { User } from './auth';
import type { Field } from './common';

export interface Tubewell {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  address: string;
  village?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  ownerName?: string;
  settings: {
    ratePerHourPaise: number;
    operatingStartTime?: string | null;
    operatingEndTime?: string | null;
    allowCustomerRequest: boolean;
    maxSessionMinutes: number;
  };
}

/** Public/search shape (flat). ratePerHour is in rupees. */
export interface TubewellSearchResult {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  address: string;
  village?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  ratePerHour: number;
  allowCustomerRequest?: boolean;
}

export const tubewellApi = {
  search: (query: { search?: string; latitude?: number; longitude?: number; maxDistanceKm?: number }): Promise<TubewellSearchResult[]> =>
    apiRequest({ url: '/tubewells', method: 'GET', params: query }),

  publicDetail: (id: string): Promise<TubewellSearchResult> =>
    apiRequest({ url: `/tubewells/public/${id}`, method: 'GET' }),

  detail: (id: string): Promise<Tubewell> =>
    apiRequest({ url: `/tubewells/${id}`, method: 'GET' }),

  mine: (): Promise<Tubewell[]> => apiRequest({ url: '/tubewells/mine', method: 'GET' }),

  create: (data: {
    name: string;
    code: string;
    description?: string;
    address: string;
    village?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<Tubewell> => apiRequest({ url: '/tubewells', method: 'POST', data }),

  update: (id: string, data: Partial<{ name: string; description: string; address: string; village: string; latitude: number; longitude: number }>): Promise<Tubewell> =>
    apiRequest({ url: `/tubewells/${id}`, method: 'PUT', data }),

  updateSettings: (
    id: string,
    data: Partial<{
      ratePerHourPaise: number;
      operatingStartTime: string;
      operatingEndTime: string;
      allowCustomerRequest: boolean;
      maxSessionMinutes: number;
    }>,
  ): Promise<Tubewell> => apiRequest({ url: `/tubewells/${id}/settings`, method: 'PUT', data }),

  remove: (id: string): Promise<{ deleted: boolean }> =>
    apiRequest({ url: `/tubewells/${id}`, method: 'DELETE' }),
};

export interface CustomerMembership {
  id: string;
  tubewellId: string;
  customerId: string;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  customer?: Partial<User>;
}

export const customerTubewellApi = {
  myTubewells: (): Promise<{ data: CustomerMembership[] } | any> =>
    apiRequest({ url: '/customer/tubewells', method: 'GET' }),

  requestJoin: (tubewellId: string): Promise<{ message: string }> =>
    apiRequest({ url: `/customer/tubewells/${tubewellId}/request`, method: 'POST' }),
};

export interface CustomerSummary {
  membershipId: string;
  customerId: string;
  name: string;
  phone: string;
  status: string;
  requestedAt?: string | null;
  approvedAt?: string | null;
}

export const ownerCustomerApi = {
  list: (tubewellId: string, search?: string): Promise<CustomerSummary[]> =>
    apiRequest({
      url: '/tubewell/customers',
      method: 'GET',
      params: { tubewellId, search },
    }),

  approve: (customerId: string, tubewellId: string): Promise<{ message: string }> =>
    apiRequest({ url: `/tubewell/customers/${customerId}/approve`, method: 'POST', data: { tubewellId } }),

  reject: (customerId: string, tubewellId: string): Promise<{ message: string }> =>
    apiRequest({ url: `/tubewell/customers/${customerId}/reject`, method: 'POST', data: { tubewellId } }),

  customerFields: (customerId: string, tubewellId: string): Promise<Field[]> =>
    apiRequest({
      url: `/tubewell/customers/${customerId}/fields`,
      method: 'GET',
      params: { tubewellId },
    }),
};