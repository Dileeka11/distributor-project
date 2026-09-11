import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Edit2, Ban, Trash2, ClipboardList, ReceiptText, CalendarClock, CalendarDays, AlertTriangle } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { dayISO, dueOf, type Due } from '@/lib/orders';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchBar, Empty, Segmented, Stat, Pagination } from '@/components/ui/Common';
import { usePagination } from '@/lib/usePagination';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DiamondInvoiceModal } from '@/components/DiamondInvoiceModal';
import { CreateInvoice } from '@/pages/InvoicesPage';
import { useAuth } from '@/store/auth';
import { canAccess } from '@/lib/pages';
import type { Customer, Invoice, Item, SalesOrder } from '@/types';

type Tab = 'pending' | 'invoiced' | 'cancelled' | 'all';

const DUE_BADGE: Record<Exclude<Due, 'later'>, { kind: 'red' | 'amber' | 'blue'; label: string }> = {
  overdue: { kind: 'red', label: 'Overdue' },
  today: { kind: 'amber', label: 'Today' },
  tomorrow: { kind: 'blue', label: 'Tomorrow' },
};

/**
 * Sales orders: what a customer wants and on which day, taken down ahead of
 * time. An order takes no stock and picks no cost lot; "Invoice" turns it into
 * a normal invoice, where both are decided.
 */
export default function SalesOrdersPage() {
  const { user } = useAuth();
  const mayInvoice = canAccess(user, 'invoices');
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [pending, setPending] = useState<SalesOrder[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('pending');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<SalesOrder | 'new' | null>(null);
  const [invoicing, setInvoicing] = useState<SalesOrder | null>(null);
  const [slip, setSlip] = useState<Invoice | null>(null);
  const refresh = () => setReload((n) => n + 1);

  useEffect(() => {
    void http.get('/api/sales-orders', { params: { q: q || undefined, status: tab === 'all' ? undefined : tab } })
      .then((r) => setRows(r.data.data));
  }, [q, tab, reload]);
  // The tiles always count what is still to go out, whichever tab is open.
  useEffect(() => {
    void http.get('/api/sales-orders', { params: { status: 'pending' } }).then((r) => setPending(r.data.data));
  }, [reload]);

  // Pending: soonest first. Invoiced / cancelled: most recent first.
  const shown = useMemo(() => (tab === 'pending' ? rows : [...rows].reverse()), [rows, tab]);
  const pager = usePagination(shown, `${q}|${tab}|${rows.length}`);
  const count = (w: Due) => pending.filter((o) => dueOf(o.due_date) === w).length;

  const cancel = async (o: SalesOrder) => {
    if (!(await confirmDelete({ title: 'Cancel order?', confirmText: 'Yes, cancel it', html: `Cancel order <b>${o.no}</b>? It stays in the list marked Cancelled.` }))) return;
    try { await http.post(`/api/sales-orders/${o.id}/cancel`); toast('Order cancelled'); refresh(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };
  const remove = async (o: SalesOrder) => {
    if (!(await confirmDelete({ title: 'Delete order?', confirmText: 'Yes, delete it', html: `Permanently delete cancelled order <b>${o.no}</b>?` }))) return;
    try { await http.delete(`/api/sales-orders/${o.id}`); toast('Order deleted'); refresh(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Sales Orders"
        sub="Take a customer's order ahead of the day — it becomes an invoice when it goes out."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>New Order</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Pending orders" value={fmt0(pending.length)} icon={<ClipboardList size={18} />} tint="blue"
          foot={count('overdue') ? `${count('overdue')} overdue` : 'waiting to be invoiced'} />
        <Stat label="Due today" value={fmt0(count('today'))} icon={<CalendarDays size={18} />} tint="red" foot={prettyDate(dayISO())} />
        <Stat label="Due tomorrow" value={fmt0(count('tomorrow'))} icon={<CalendarClock size={18} />} tint="amber" foot={prettyDate(dayISO(1))} />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending' }, { value: 'invoiced', label: 'Invoiced' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search order no. or customer…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Order</th><th>Deliver on</th><th>Customer</th><th>Items</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {pager.slice.map((o) => {
              const lines = o.lines ?? [];
              const units = lines.reduce((s, l) => s + Number(l.qty), 0);
              const due = o.status === 'pending' ? dueOf(o.due_date) : 'later';
              return (
                <tr key={o.id} style={o.status === 'cancelled' ? { opacity: 0.6 } : undefined}>
                  <td>
                    <div className="mono font-semibold">{o.no}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>taken {prettyDate(o.date)}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{prettyDate(o.due_date)}</span>
                      {due !== 'later' && <Badge kind={DUE_BADGE[due].kind}>{DUE_BADGE[due].label}</Badge>}
                    </div>
                  </td>
                  <td className="font-semibold">{o.customer?.name ?? '—'}</td>
                  <td className="text-[12.5px]" style={{ color: 'var(--text-muted)', maxWidth: 380 }}>
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>{lines.length} item{lines.length === 1 ? '' : 's'} · {fmt0(units)} units</div>
                    <div className="truncate">{lines.map((l) => `${fmt0(l.qty)} × ${l.name}`).join(' · ')}</div>
                  </td>
                  <td>
                    {o.status === 'pending' && <Badge kind="amber" dot>Pending</Badge>}
                    {o.status === 'invoiced' && (
                      <span className="flex items-center gap-2">
                        <Badge kind="green" dot>Invoiced</Badge>
                        {o.invoice && <span className="mono text-[12px]">{o.invoice.no}</span>}
                      </span>
                    )}
                    {o.status === 'cancelled' && <Badge kind="gray" dot>Cancelled</Badge>}
                  </td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      {o.status === 'pending' && mayInvoice && (
                        <Button variant="primary" size="sm" icon={<ReceiptText size={14} />} title="Turn this order into an invoice" onClick={() => setInvoicing(o)}>Invoice</Button>
                      )}
                      {o.status === 'pending' && <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} title="Edit order" onClick={() => setEditing(o)} />}
                      {o.status === 'pending' && <Button variant="subtle" size="sm" icon={<Ban size={14} />} title="Cancel order" onClick={() => void cancel(o)} />}
                      {o.status === 'cancelled' && <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} title="Delete order" onClick={() => void remove(o)} style={{ color: 'var(--red)' }} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <Empty icon={<ClipboardList size={40} />} title={tab === 'pending' ? 'No pending orders' : 'No orders here'}
            sub="Take down what a customer wants and the day they want it." />
        )}
        {shown.length > 0 && <Pagination {...pager.props} />}
      </div>

      {editing && (
        <OrderModal rec={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
      {invoicing && (
        <CreateInvoice
          fromOrder={invoicing}
          onClose={() => setInvoicing(null)}
          onSaved={(inv) => { setInvoicing(null); refresh(); if (inv) setSlip(inv); }}
        />
      )}
      {slip && <DiamondInvoiceModal inv={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}

interface DraftLine { item_id: number | ''; qty: string; }
const blankLine = (): DraftLine => ({ item_id: '', qty: '1' });

/**
 * Take down (or change) an order: who, what, how many, and the day it is
 * wanted. No cost lot is chosen and no stock is touched here.
 */
function OrderModal({ rec, onClose, onSaved }: { rec: SalesOrder | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !rec;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>(rec ? Number(rec.customer_id) : '');
  const [dueDate, setDueDate] = useState(rec ? rec.due_date.slice(0, 10) : dayISO(1));
  const [note, setNote] = useState(rec?.note ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() => (rec?.lines?.length
    ? rec.lines.map((l) => ({ item_id: Number(l.item_id), qty: String(l.qty) }))
    : [blankLine()]));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void http.get('/api/customers').then((r) => setCustomers(r.data.data));
    void http.get('/api/items').then((r) => setItems(r.data.data));
  }, []);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0);
  const canSave = customerId !== '' && dueDate !== '' && validLines.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        customer_id: customerId,
        due_date: dueDate,
        note: note.trim() || null,
        lines: validLines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty) })),
      };
      if (isNew) await http.post('/api/sales-orders', payload);
      else await http.put(`/api/sales-orders/${rec!.id}`, payload);
      toast(isNew ? 'Order saved' : 'Order updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title={isNew ? 'New Sales Order' : `Edit Order ${rec!.no}`}
      onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>{isNew ? 'Save order' : 'Save changes'}</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Field label="Customer" req hint="Who the order is for">
          <SearchSelect
            items={customers}
            value={customerId}
            onChange={setCustomerId}
            allLabel="Select customer…"
            placeholder="Search name, code or mobile…"
            subtitle={(c) => `${c.code}${c.phone ? ` · ${c.phone}` : ''}`}
          />
        </Field>
        <Field label="Deliver on" req hint="Reminded the day before, and on the morning of this day.">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ height: 40 }} />
        </Field>
      </div>

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        Items <span className="font-medium" style={{ color: 'var(--text-faint)' }}>· items and products with the quantity wanted — no cost lot or stock is taken now</span>
      </div>
      <div className="card p-2.5 mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)' }}>Item</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Qty</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => Number(x.id) === l.item_id);
              const low = it ? (Number(l.qty) || 0) > Number(it.stock) : false;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <SearchSelect
                      items={items}
                      value={l.item_id}
                      onChange={(v) => setLine(i, { item_id: v })}
                      allLabel="Select item…"
                      placeholder="Search item name or code…"
                      subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock))}`}
                    />
                    {it && low && (
                      <div className="text-[12px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
                        <AlertTriangle size={13} /> Only {fmt0(Number(it.stock))} in stock now — more is needed by the delivery day.
                      </div>
                    )}
                  </td>
                  <td className="p-1.5 align-top">
                    <Input className="mono text-right" inputMode="numeric" value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 40 }} />
                  </td>
                  <td className="p-1.5 text-right align-top">
                    <button className="grid place-items-center w-7 h-7 mt-1.5 rounded-md hover:bg-surface-2" onClick={() => delLine(i)} type="button" aria-label="Remove line"><X size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Button variant="subtle" size="sm" icon={<Plus size={14} />} onClick={addLine} style={{ margin: 8 }}>Add item</Button>
      </div>

      <Field label="Note" hint="Anything to remember for this order (optional).">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. deliver before 10 am" />
      </Field>
    </Modal>
  );
}
