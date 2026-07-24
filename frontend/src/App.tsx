import { lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { canAccess, firstAllowed } from '@/lib/pages';
import { AppShell } from '@/components/AppShell';
import LoginPage from '@/pages/LoginPage';

// Authenticated pages are code-split: each loads as its own chunk on first
// visit, so the initial download stays small instead of shipping every page.
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ItemsPage = lazy(() => import('@/pages/ItemsPage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const StockAdjustPage = lazy(() => import('@/pages/StockAdjustPage'));
const StockTransactionsPage = lazy(() => import('@/pages/StockTransactionsPage'));
const SuppliersPage = lazy(() => import('@/pages/SuppliersPage'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const GrnsPage = lazy(() => import('@/pages/GrnsPage'));
const OutstandingPage = lazy(() => import('@/pages/OutstandingPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage'));
const AttendancePage = lazy(() => import('@/pages/AttendancePage'));
const PayrollPage = lazy(() => import('@/pages/PayrollPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// Renders the page only if the current user has the permission, else redirects
// to the first page they can access.
function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { user } = useAuth();
  return canAccess(user, perm) ? <>{children}</> : <Navigate to={firstAllowed(user)} replace />;
}

export default function App() {
  const { user, ready, bootstrap } = useAuth();
  const { load } = useSettings();

  useEffect(() => {
    void load();
    void bootstrap();
  }, [bootstrap, load]);

  if (!ready) {
    return <div className="grid place-items-center h-screen text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<Guard perm="dashboard"><DashboardPage /></Guard>} />
        <Route path="items" element={<Guard perm="items"><ItemsPage /></Guard>} />
        <Route path="products" element={<Guard perm="products"><ProductsPage /></Guard>} />
        <Route path="stock-adjust" element={<Guard perm="stock_adjust"><StockAdjustPage /></Guard>} />
        <Route path="stock-transactions" element={<Guard perm="stock_txn"><StockTransactionsPage /></Guard>} />
        <Route path="suppliers" element={<Guard perm="suppliers"><SuppliersPage /></Guard>} />
        <Route path="customers" element={<Guard perm="customers"><CustomersPage /></Guard>} />
        <Route path="employees" element={<Guard perm="employees"><EmployeesPage /></Guard>} />
        <Route path="invoices" element={<Guard perm="invoices"><InvoicesPage /></Guard>} />
        <Route path="grns" element={<Guard perm="grns"><GrnsPage /></Guard>} />
        <Route path="outstanding" element={<Guard perm="outstanding"><OutstandingPage /></Guard>} />
        <Route path="reports" element={<Guard perm="reports"><ReportsPage /></Guard>} />
        <Route path="attendance" element={<Guard perm="attendance"><AttendancePage /></Guard>} />
        <Route path="payroll" element={<Guard perm="payroll"><PayrollPage /></Guard>} />
        <Route path="users" element={<Guard perm="users"><UsersPage /></Guard>} />
        <Route path="settings" element={<Guard perm="settings"><SettingsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
