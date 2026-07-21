import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Package, Clock, Wallet, Truck, CheckCircle2 } from 'lucide-react';
import { http } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { canAccess } from '@/lib/pages';
import type { DashboardPayload, ChequeRecord, GrnChequeRecord } from '@/types';

interface Note { id: string; icon: ReactNode; tone: string; title: string; desc: string; to: string; perm: string; }

export function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Dismiss the clicked notification, then navigate to its page.
  const go = (n: Note) => { setNotes((cur) => cur.filter((x) => x.id !== n.id)); setOpen(false); navigate(n.to); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-surface-2 relative" style={{ border: '1px solid var(--border)' }} title="Notifications" aria-label="Notifications">
        <Bell size={18} />
        {notes.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--red)' }}>{notes.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] rounded-[13px] border border-border shadow-lg z-40 overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-bold text-[14px]">Notifications</div>
            <div className="flex items-center gap-2.5">
              <span className="chip">{notes.length}</span>
              {notes.length > 0 && (
                <button type="button" onClick={() => setNotes([])} className="text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>Clear all</button>
              )}
            </div>
          </div>
          <div style={{ maxHeight: 336, overflow: 'auto' }}>
            {notes.length === 0 ? (
              <div className="grid place-items-center py-10 gap-2 text-center">
                <CheckCircle2 size={30} style={{ color: 'var(--green)' }} />
                <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>You're all caught up.</div>
              </div>
            ) : notes.map((n) => (
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
