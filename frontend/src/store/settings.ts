import { create } from 'zustand';
import { http } from '@/lib/http';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  company: 'Kadurata Kuda',
  logo: 'KK',
  accent: '#C8102E',
  accent_press: '#a60d26',
  mode: 'light',
  currency: 'LKR',
  symbol: 'Rs',
  tax_rate: 8,
  invoice_prefix: 'INV',
};

interface SettingsState {
  settings: AppSettings;
  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
  setLocal: (patch: Partial<AppSettings>) => void;
}

function applyTheme(s: AppSettings) {
  const root = document.documentElement;
  if (s.accent) root.style.setProperty('--accent', s.accent);
  if (s.accent_press) root.style.setProperty('--accent-press', s.accent_press);
  root.setAttribute('data-mode', s.mode === 'dark' ? 'dark' : 'light');

  // Live favicon from accent + monogram
  const accent = (s.accent || '#C8102E').replace('#', '%23');
  const ch = (s.logo || 'K').slice(0, 1).toUpperCase();
  const fav = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='${accent}'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-size='18' font-weight='800' fill='white'%3E${ch}%3C/text%3E%3C/svg%3E`;
  const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (link) link.href = fav;

  document.title = `${s.company || 'Kadurata Kuda'} — Distributor System`;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  async load() {
    try {
      const { data } = await http.get('/api/settings');
      const merged = { ...DEFAULT_SETTINGS, ...data.data };
      set({ settings: merged });
      applyTheme(merged);
    } catch {
      applyTheme(DEFAULT_SETTINGS);
    }
  },
  async save(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    applyTheme(next);
    const { data } = await http.put('/api/settings', patch);
    const merged = { ...DEFAULT_SETTINGS, ...data.data };
    set({ settings: merged });
    applyTheme(merged);
  },
  setLocal(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    applyTheme(next);
  },
}));
