import { Suspense, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Package, Boxes, SlidersHorizontal, Truck, Users, ReceiptText, PackageOpen, Scale, FileBarChart2, UserCog, CalendarCheck, Wallet, ShieldCheck, ChevronDown, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { canAccess } from '@/lib/pages';
import { Notifications } from '@/components/Notifications';

interface NavEntry { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; group: string; perm: string; }
const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview', perm: 'dashboard' },
  { to: '/items', label: 'Items', icon: Package, group: 'Masters', perm: 'items' },
  { to: '/products', label: 'Products', icon: Boxes, group: 'Masters', perm: 'products' },
  { to: '/stock-adjust', label: 'Stock Adjust', icon: SlidersHorizontal, group: 'Masters', perm: 'stock_adjust' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, group: 'Masters', perm: 'suppliers' },
  { to: '/customers', label: 'Customers', icon: Users, group: 'Masters', perm: 'customers' },
  { to: '/employees', label: 'Employees', icon: UserCog, group: 'Masters', perm: 'employees' },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText, group: 'Transactions', perm: 'invoices' },
  { to: '/grns', label: 'Purchases (GRN)', icon: PackageOpen, group: 'Transactions', perm: 'grns' },
  { to: '/outstanding', label: 'Outstanding', icon: Scale, group: 'Transactions', perm: 'outstanding' },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, group: 'Transactions', perm: 'reports' },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, group: 'HR', perm: 'attendance' },
  { to: '/payroll', label: 'Payroll', icon: Wallet, group: 'HR', perm: 'payroll' },
  { to: '/users', label: 'System Users', icon: ShieldCheck, group: 'System', perm: 'users' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, group: 'System', perm: 'settings' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  const wide = pathname.startsWith('/payroll');

  // Only show pages this user is allowed to open (admins see everything).
  const visible = NAV.filter((n) => canAccess(user, n.perm));
  const groups = Array.from(new Set(visible.map((n) => n.group)));

  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[244px] flex-shrink-0 bg-surface border-r border-border flex flex-col px-3.5 py-4 gap-1">
        <div className="flex items-center gap-3 px-2 pb-4">
          <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px] font-extrabold text-white" style={{ background: 'var(--accent)' }}>
            {settings.logo}
          </div>
          <div>
            <div className="font-bold text-[15px] leading-tight tracking-tight">{settings.company}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>Distributor System</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.map((g) => (
            <div key={g}>
              <div className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 pt-3.5 pb-1.5" style={{ color: 'var(--text-faint)' }}>{g}</div>
              {visible.filter((n) => n.group === g).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <n.icon size={18} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mt-2">
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <div className="grid place-items-center w-9 h-9 rounded-[9px] text-[13px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {(user?.name ?? 'U')[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{user?.name}</div>
              <div className="text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>{user?.is_admin ? 'Administrator' : 'User'}</div>
            </div>
          </div>
          <button className="nav-item" onClick={logout}><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="relative z-30 h-[62px] flex-shrink-0 border-b border-border flex items-center gap-4 px-7" style={{ background: 'color-mix(in oklab, var(--surface) 80%, transparent)', backdropFilter: 'blur(8px)' }}>
          <div className="text-[18px] font-bold tracking-tight">{current?.label ?? 'Dashboard'}</div>

          <div className="ml-auto flex items-center gap-2.5">
          <Notifications />

          {/* Account menu */}
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-surface-2" style={{ border: '1px solid var(--border)' }}>
              <span className="grid place-items-center w-8 h-8 rounded-full text-[13px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{(user?.name ?? 'U')[0]}</span>
              <span className="text-[13px] font-semibold hidden sm:block">{user?.name}</span>
              <ChevronDown size={15} style={{ color: 'var(--text-faint)' }} />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-64 rounded-[12px] border border-border shadow-lg z-40 overflow-hidden" style={{ background: 'var(--surface)' }}>
                <div className="px-4 py-3.5 border-b border-border">
                  <div className="font-bold text-[14px]">{user?.name}</div>
                  <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{user?.username ?? user?.email}</div>
                  <span className="chip mt-2 inline-flex" style={user?.is_admin ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}>
                    {user?.is_admin ? 'Administrator' : `${user?.permissions?.length ?? 0} pages`}
                  </span>
                </div>
                <button className="flex items-center gap-2.5 w-full px-4 py-3 text-[13.5px] hover:bg-surface-2" onClick={logout}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-7 py-6 pb-16">
          <div className={wide ? 'w-full' : 'max-w-[1180px] mx-auto'}>
            <Suspense fallback={<div className="grid place-items-center py-20 text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
