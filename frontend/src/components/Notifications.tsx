import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Package, Clock, Wallet, Truck, CheckCircle2, CalendarClock, CalendarDays } from 'lucide-react';
import { http } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { warnDialog } from '@/lib/toast';
import { dayISO, dueOf, type Due } from '@/lib/orders';
import { useAuth } from '@/store/auth';
import { canAccess } from '@/lib/pages';
import type { DashboardPayload, ChequeRecord, GrnChequeRecord, SalesOrder } from '@/types';

interface Note { id: string; icon: ReactNode; tone: string; title: string; desc: string; to: string; perm: string; }
type DueOrder = { o: SalesOrder; when: Exclude<Due, 'later'> };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const DUE_TEXT: Record<Exclude<Due, 'later'>, string> = { overdue: 'overdue', today: 'due today', tomorrow: 'due tomorrow' };
// Pending orders are re-checked this often while the app stays open, so a new
// day's reminders come through without a reload.
const ORDER_CHECK_MS = 15 * 60 * 1000;
// The once-a-day reminder pop-up waits for the morning.
const MORNING_HOUR = 7;

export function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [orderNotes, setOrderNotes] = useState<Note[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ data: dash }, { data: cq }, { data: gcq }] = await Promise.all([
          http.get('/api/dashboard'),
          http.get('/api/cheques'),
          http.get('/api/grn-cheques'),
        ]);
        const d = dash as DashboardPayload;
        const low = d.low_stock ?? [];
        const list: Note[] = [];

        low.filter((i) => Number(i.stock) <= 0).forEach((i) => list.push({
          id: `oos-${i.id}`, icon: <AlertTriangle size={16} />, tone: 'var(--red)',
          title: 'Out of stock', desc: `${i.name} (${i.code})`, to: '/items', perm: 'items',
        }));
        const lowOnly = low.filter((i) => Number(i.stock) > 0);
        if (lowOnly.length) list.push({
          id: 'low', icon: <Package size={16} />, tone: 'var(--amber)',
          title: 'Low stock', desc: `${lowOnly.length} item${lowOnly.length > 1 ? 's' : ''} below reorder level`, to: '/items', perm: 'items',
        });

        const pending = (cq.data as ChequeRecord[]).filter((c) => !c.cleared).length
          + (gcq.data as GrnChequeRecord[]).filter((c) => !c.cleared).length;
        if (pending > 0) list.push({
          id: 'chq', icon: <Clock size={16} />, tone: 'var(--amber)',
          title: 'Cheques pending', desc: `${pending} cheque${pending > 1 ? 's' : ''} awaiting clearance`, to: '/outstanding', perm: 'outstanding',
        });

        if (Number(d.totals?.receivable) > 0) list.push({
          id: 'recv', icon: <Wallet size={16} />, tone: 'var(--blue)',
          title: 'Receivables due', desc: `Rs ${fmt0(Number(d.totals.receivable))} to collect from customers`, to: '/outstanding', perm: 'outstanding',
        });
        if (Number(d.totals?.payable) > 0) list.push({
          id: 'pay', icon: <Truck size={16} />, tone: 'var(--blue)',
          title: 'Payables due', desc: `Rs ${fmt0(Number(d.totals.payable))} to pay suppliers`, to: '/outstanding', perm: 'outstanding',
        });

        setNotes(list.filter((n) => canAccess(user, n.perm)));
      } catch { /* keep silent — notifications are best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Sales-order reminders: the day before an order is due, and on the day.
  // Fetched on their own so a failure here never hides the other notices.
  useEffect(() => {
    if (!user || !canAccess(user, 'sales_orders')) return;
    const remindedKey = `so-reminded-${user.id}`;

    // Once a day, from the morning: a pop-up listing what is due.
    const popUpOnce = async (due: DueOrder[]) => {
      if (due.length === 0 || new Date().getHours() < MORNING_HOUR) return;
      try {
        if (localStorage.getItem(remindedKey) === dayISO()) return;
        localStorage.setItem(remindedKey, dayISO());
      } catch { return; } // no storage: the bell still lists them
      const html = '<div style="text-align:left;font-size:14px;line-height:1.7">'
        + due.map(({ o, when }) => `<div><b>${esc(o.no)}</b> · ${esc(o.customer?.name ?? '')} — ${DUE_TEXT[when]}</div>`).join('')
        + '</div>';
      if (await warnDialog({ title: 'Sales order reminder', html, icon: 'info', confirmText: 'View orders', cancelText: 'Later' })) {
        navigate('/sales-orders');
      }
    };

    const check = () => {
      void http.get('/api/sales-orders', { params: { status: 'pending' } })
        .then((r) => {
          const due = (r.data.data as SalesOrder[])
            .map((o) => ({ o, when: dueOf(o.due_date) }))
            .filter((x): x is DueOrder => x.when !== 'later');
          setOrderNotes(due.map(({ o, when }) => ({
            // Keyed by the day too, so a dismissed "tomorrow" comes back as "today".
            id: `so-${o.id}-${when}`,
            icon: when === 'tomorrow' ? <CalendarClock size={16} /> : <CalendarDays size={16} />,
            tone: when === 'tomorrow' ? 'var(--blue)' : when === 'today' ? 'var(--amber)' : 'var(--red)',
            title: when === 'overdue' ? 'Order overdue' : when === 'today' ? 'Order due today' : 'Order due tomorrow',
            desc: `${o.no} · ${o.customer?.name ?? ''}`,
            to: '/sales-orders', perm: 'sales_orders',
          })));
          void popUpOnce(due);
        })
        .catch(() => { /* best-effort, like the rest */ });
    };

    check();
    const timer = window.setInterval(check, ORDER_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [user, navigate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const visible = [...notes, ...orderNotes].filter((n) => !dismissed.has(n.id));
  const dismiss = (ids: string[]) => setDismissed((s) => { const next = new Set(s); ids.forEach((id) => next.add(id)); return next; });
  // Dismiss the clicked notification, then navigate to its page.
  const go = (n: Note) => { dismiss([n.id]); setOpen(false); navigate(n.to); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-surface-2 relative" style={{ border: '1px solid var(--border)' }} title="Notifications" aria-label="Notifications">
        <Bell size={18} />
        {visible.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--red)' }}>{visible.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] rounded-[13px] border border-border shadow-lg z-40 overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-bold text-[14px]">Notifications</div>
            <div className="flex items-center gap-2.5">
              <span className="chip">{visible.length}</span>
              {visible.length > 0 && (
                <button type="button" onClick={() => dismiss(visible.map((n) => n.id))} className="text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>Clear all</button>
              )}
            </div>
          </div>
          <div style={{ maxHeight: 336, overflow: 'auto' }}>
            {visible.length === 0 ? (
              <div className="grid place-items-center py-10 gap-2 text-center">
                <CheckCircle2 size={30} style={{ color: 'var(--green)' }} />
                <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>You're all caught up.</div>
              </div>
            ) : visible.map((n) => (
              <button key={n.id} type="button" onClick={() => go(n)} className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-surface-2 border-b border-border last:border-0">
                <span className="grid place-items-center w-8 h-8 rounded-[9px] flex-shrink-0 mt-0.5" style={{ background: `color-mix(in oklab, ${n.tone} 15%, transparent)`, color: n.tone }}>{n.icon}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{n.title}</div>
                  <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{n.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
