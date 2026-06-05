export function fmt(n: number | string | null | undefined, dec = 2): string {
  return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmt0(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 });
}

export function compact(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

export function initials(name: string | null | undefined): string {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function prettyDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
