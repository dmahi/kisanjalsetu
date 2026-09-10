import { create } from 'zustand';
import type { User } from '../api/auth';
import { authApi } from '../api/auth';
import { setAsyncTokenProvider, getToken } from '../api/client';
import { Preferences } from '@capacitor/preferences';

const AUTH_USER_KEY = 'waterapp.auth_user';

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  hydrate: () => Promise<void>;
}

export async function persistAuth(token: string, user: User): Promise<void> {
  localStorage.setItem('waterapp.token', token);
  await Preferences.set({ key: 'waterapp.token', value: token });
  await Preferences.set({ key: AUTH_USER_KEY, value: JSON.stringify(user) });
}

export async function clearStoredAuth(): Promise<void> {
  localStorage.removeItem('waterapp.token');
  await Preferences.remove({ key: 'waterapp.token' });
  await Preferences.remove({ key: AUTH_USER_KEY });
}

export async function readStoredUser(): Promise<User | null> {
  const local = localStorage.getItem(AUTH_USER_KEY);
  if (local) {
    try {
      return JSON.parse(local) as User;
    } catch {
      /* ignore */
    }
  }
  const { value } = await Preferences.get({ key: AUTH_USER_KEY });
  if (value) {
    try {
      return JSON.parse(value) as User;
    } catch {
      return null;
    }
  }
  return null;
}

async function readStoredToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: 'waterapp.token' });
  return value || getToken();
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: false,
  initialized: false,

  login: async (token, user) => {
    await persistAuth(token, user);
    set({ token, user });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* offline — still clear local */
    }
    await clearStoredAuth();
    set({ token: null, user: null });
  },

  setUser: (user) => set({ user }),

  hydrate: async () => {
    setAsyncTokenProvider(async () => readStoredToken());
    const token = await readStoredToken();
    const user = await readStoredUser();
    if (token && user) {
      set({ token, user, initialized: true });
      // Refresh profile when online.
      authApi.me().then((fresh) => set({ user: fresh })).catch(() => undefined);
    } else {
      set({ token: token ?? null, initialized: true });
    }
  },
}));