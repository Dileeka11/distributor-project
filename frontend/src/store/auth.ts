import { create } from 'zustand';
import { http } from '@/lib/http';
import { clearSeen, isLoginRoute, isNewBrowserVisit, markSeen } from '@/lib/sessionGuard';
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
    // Two ways in that must always cost credentials: opening the app after the
    // browser was closed (where the browser may have restored the cookie for
    // us), and going to /login directly, which is a request to sign in.
    if (isNewBrowserVisit() || isLoginRoute()) {
      clearSeen();
      set({ user: null, ready: true });
      // End the restored session too — but only when there is one. Posting
      // blind on a first visit costs a CSRF handshake that races the other
      // boot requests for the session, and comes back 419.
      try {
        await http.get('/api/auth/me');
        await http.post('/api/auth/logout');
      } catch { /* nothing signed in, or it is already gone */ }
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
