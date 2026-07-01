import { create } from 'zustand';
import { http } from '@/lib/http';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  async bootstrap() {
    try {
      const { data } = await http.get('/api/auth/me');
      set({ user: data.user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  async login(username, password, remember) {
    const { data } = await http.post('/api/auth/login', { username, password, remember });
    set({ user: data.user });
  },
  async logout() {
    try { await http.post('/api/auth/logout'); } finally { set({ user: null }); }
  },
}));
