import type { User } from '@/types';

/** Every navigable page and its permission key. Order = sidebar order. */
export interface PageDef { key: string; label: string; to: string; group: string; }

export const PAGES: PageDef[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', group: 'Overview' },
  { key: 'items', label: 'Items', to: '/items', group: 'Masters' },
  { key: 'products', label: 'Products', to: '/products', group: 'Masters' },
  { key: 'suppliers', label: 'Suppliers', to: '/suppliers', group: 'Masters' },
  { key: 'customers', label: 'Customers', to: '/customers', group: 'Masters' },
  { key: 'employees', label: 'Employees', to: '/employees', group: 'Masters' },
  { key: 'invoices', label: 'Invoices', to: '/invoices', group: 'Transactions' },
  { key: 'grns', label: 'Purchases (GRN)', to: '/grns', group: 'Transactions' },
  { key: 'outstanding', label: 'Outstanding', to: '/outstanding', group: 'Transactions' },
  { key: 'reports', label: 'Reports', to: '/reports', group: 'Transactions' },
  { key: 'attendance', label: 'Attendance', to: '/attendance', group: 'HR' },
  { key: 'payroll', label: 'Payroll', to: '/payroll', group: 'HR' },
  { key: 'users', label: 'System Users', to: '/users', group: 'System' },
  { key: 'settings', label: 'Settings', to: '/settings', group: 'System' },
];

// Pages an admin implicitly owns exclusively, and one everyone can always land on.
const ADMIN_ONLY = new Set(['users']);
const ALWAYS = new Set(['dashboard']);

/** Can this user open the page with the given permission key? */
export function canAccess(user: User | null, key: string): boolean {
  if (!user) return false;
  if (user.is_admin) return true;
  if (ADMIN_ONLY.has(key)) return false;
  if (ALWAYS.has(key)) return true;
  return (user.permissions ?? []).includes(key);
}

/** The first page (route) this user is allowed to see — used for redirects. */
export function firstAllowed(user: User | null): string {
  const p = PAGES.find((pg) => canAccess(user, pg.key));
  return p?.to ?? '/';
}
