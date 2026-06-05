import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Wallet, Truck, AlertCircle, Plus, ChevronRight, Package } from 'lucide-react';
import { http } from '@/lib/http';
import { fmt0, compact, prettyDate, todayISO } from '@/lib/format';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge, stockBadge } from '@/components/ui/Badge';
import { Stat } from '@/components/ui/Common';
import { SalesBarChart, Donut, BarList } from '@/components/Charts';
import type { DashboardPayload } from '@/types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    void http.get<DashboardPayload>('/api/dashboard').then((r) => setData(r.data));
  }, []);

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Loading dashboard…</div>;

  const t = data.totals;
  const maxBal = Math.max(...data.top_receivables.map((c) => Number(c.balance)), 1);

  return (
    <div className="fade-in">
      <PageHead
        title="Good morning, Admin 👋"
        sub={`Here's what's happening across your distribution today — ${prettyDate(todayISO())}.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/invoices?create=1')}>New Invoice</Button>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="Total Sales" cur="Rs" value={compact(t.sales)} icon={<TrendingUp size={18} />} tint="accent" foot="all invoices" />
        <Stat label="Receivable" cur="Rs" value={compact(t.receivable)} icon={<Wallet size={18} />} tint="amber" foot="from customers" />
        <Stat label="Payable" cur="Rs" value={compact(t.payable)} icon={<Truck size={18} />} tint="blue" foot="to suppliers" />
        <Stat label="Low / Out of Stock" value={t.low_stock_count} icon={<AlertCircle size={18} />} tint="red" foot="needs reordering" />
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <div className="text-[14.5px] font-bold">Sales — last 14 days</div>
              <div className="flex gap-4 mt-1.5">
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--blue)' }} />Cash</span>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent)' }} />Credit</span>
              </div>
            </div>
            <span className="chip mono">Rs {compact(t.cash + t.credit)}</span>
          </div>
          <div className="p-5"><SalesBarChart data={data.sales_series} /></div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-border"><div className="text-[14.5px] font-bold">Cash vs Credit</div></div>
          <div className="p-5">
            <Donut
              centerLabel="Total"
              centerValue={compact(t.cash + t.credit)}
              segments={[
                { label: 'Cash', value: t.cash, color: 'var(--blue)' },
                { label: 'Credit', value: t.credit, color: 'var(--accent)' },
              ]}
            />
            <div className="my-5 h-px" style={{ background: 'var(--border)' }} />
            <div className="text-[12.5px] font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Inventory value by category</div>
            <BarList rows={data.inventory_by_category} />
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[14.5px] font-bold">Recent invoices</div>
            <Button variant="subtle" size="sm" icon={<ChevronRight size={14} />} onClick={() => navigate('/invoices')}>View all</Button>
          </div>
          <div className="overflow-hidden">
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Type</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recent_invoices.map((inv) => {
                  const st = statusBadge(inv.status);
                  return (
                    <tr key={inv.id} className="row-click" onClick={() => navigate('/invoices')}>
                      <td className="mono font-semibold">{inv.no}</td>
                      <td>
                        <div className="font-semibold">{inv.customer?.name ?? '—'}</div>
                        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{prettyDate(inv.date)}</div>
                      </td>
                      <td><Badge kind={inv.type === 'cash' ? 'blue' : 'amber'}>{inv.type === 'cash' ? 'Cash' : 'Credit'}</Badge></td>
                      <td className="num money">{fmt0(inv.total as number)}</td>
                      <td><Badge kind={st.kind} dot>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="px-5 py-4 border-b border-border"><div className="text-[14.5px] font-bold">Top receivables</div></div>
            <div className="p-5 flex flex-col gap-4">
              {data.top_receivables.map((c) => {
                const bal = Number(c.balance), lim = Number(c.credit_limit);
                return (
                  <div key={c.id}>
                    <div className="flex justify-between mb-1.5 text-[13px]">
                      <span className="font-semibold">{c.name}</span>
                      <span className="money">{bal > 0 ? fmt0(bal) : 'Settled'}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${(bal / maxBal) * 100}%`, background: bal > lim * 0.8 ? 'var(--red)' : 'var(--accent)' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-[14.5px] font-bold" style={{ color: 'var(--red)' }}>Stock alerts</div>
              <span className="chip">{data.low_stock.length}</span>
            </div>
            {data.low_stock.length === 0 && <div className="p-5 text-[13px]" style={{ color: 'var(--text-faint)' }}>All items well stocked 🎉</div>}
            {data.low_stock.slice(0, 4).map((it) => {
              const sb = stockBadge(it.stock);
              return (
                <div key={it.id} className="flex items-center gap-3 px-5 py-3 border-t border-border">
                  <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}><Package size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] truncate">{it.name}</div>
                    <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{it.code}</div>
                  </div>
                  <Badge kind={sb.kind}>{it.stock} left</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
