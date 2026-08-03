import { create } from 'zustand';
import { http } from '@/lib/http';
import { clearSeen, isNewBrowserVisit, markSeen } from '@/lib/sessionGuard';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  async bootstrap() {
    // Opening the app after the browser was closed always starts at sign-in,
    // even where the browser restored the session cookie for us.
    if (isNewBrowserVisit()) {
      try { await http.post('/api/auth/logout'); } catch { /* no session to end */ }
      set({ user: null, ready: true });
      return;
    }
    try {
      const { data } = await http.get('/api/auth/me');
      set({ user: data.user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  async login(username, password) {
    const { data } = await http.post('/api/auth/login', { username, password });
    markSeen();
    set({ user: data.user });
  },
  async logout() {
    try { await http.post('/api/auth/logout'); } finally {
      clearSeen();
      set({ user: null });
    }
  },
}));
