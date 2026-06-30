import { LayoutDashboard, Package, Truck, Users, ReceiptText, PackageOpen, Scale, FileBarChart2, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';

interface NavEntry { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; group: string; }
const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
  { to: '/items', label: 'Items', icon: Package, group: 'Masters' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, group: 'Masters' },
  { to: '/customers', label: 'Customers', icon: Users, group: 'Masters' },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText, group: 'Transactions' },
  { to: '/grns', label: 'Purchases (GRN)', icon: PackageOpen, group: 'Transactions' },
  { to: '/outstanding', label: 'Outstanding', icon: Scale, group: 'Transactions' },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, group: 'Transactions' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, group: 'System' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

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
              {NAV.filter((n) => n.group === g).map((n) => (
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
              <div className="text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>{user?.email}</div>
            </div>
          </div>
          <button className="nav-item" onClick={logout}><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-[62px] flex-shrink-0 border-b border-border flex items-center gap-4 px-7" style={{ background: 'color-mix(in oklab, var(--surface) 80%, transparent)', backdropFilter: 'blur(8px)' }}>
          <div className="text-[18px] font-bold tracking-tight">{current?.label ?? 'Dashboard'}</div>
        </header>
        <div className="flex-1 overflow-y-auto px-7 py-6 pb-16">
          <div className="max-w-[1180px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
