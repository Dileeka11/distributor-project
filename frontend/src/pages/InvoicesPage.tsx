import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Check, Wallet, Receipt, Clock, ReceiptText, Download, Edit2, Ban, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { useSettings } from '@/store/settings';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { SearchBar, Empty, Segmented, Stat, Pagination } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput, Input } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Switch } from '@/components/ui/Common';
import { useAuth } from '@/store/auth';
import { canUse } from '@/lib/pages';
import type { Customer, Invoice, Item, ItemBatch } from '@/types';

type Tab = 'all' | 'cash' | 'credit' | 'cancelled';

interface DraftLine { item_id: number | ''; batch_id: number | ''; qty: string; price: string; }
const blankLine = (): DraftLine => ({ item_id: '', batch_id: '', qty: '0', price: '0' });

interface ChequeRow { no: string; date: string; amount: string; }

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(params.has('create'));
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [view, setView] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const load = () => http.get('/api/invoices', { params: { q, type: tab === 'all' || tab === 'cancelled' ? undefined : tab } }).then((r) => setRows(r.data.data));

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, tab]);
  useEffect(() => { setPage(1); }, [q, tab, rows.length]);

  const deleteInvoice = async (inv: Invoice) => {
    if (!(await confirmDelete({
      title: 'Delete Invoice permanently?',
      confirmText: 'Yes, delete it',
      html: `Are you sure you want to permanently delete cancelled invoice <b>${inv.no}</b>? This action cannot be undone.`
    }))) return;
    try {
      await http.delete(`/api/invoices/${inv.id}`);
      toast('Invoice deleted');
      void load();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const displayedRows = useMemo(() => {
    if (tab === 'cancelled') {
      return rows.filter((i) => !!i.cancelled_at);
    }
    return rows;
  }, [rows, tab]);

  const paginated = useMemo(() => {
    return displayedRows.slice((page - 1) * perPage, page * perPage);
  }, [displayedRows, page, perPage]);
  useEffect(() => {
    if (params.has('create')) { setCreate(true); params.delete('create'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  // Cancelled invoices are void — never counted in any total.
  const live = rows.filter((i) => !i.cancelled_at);
  const cashTotal = live.filter((i) => i.type === 'cash').reduce((s, i) => s + Number(i.total), 0);
  const creditTotal = live.filter((i) => i.type === 'credit').reduce((s, i) => s + Number(i.total), 0);
  const creditDue = live.filter((i) => i.type === 'credit').reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Invoices"
        sub={`${rows.length} invoices · cash & credit billing.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New Invoice</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Cash sales" cur="Rs" value={compact(cashTotal)} icon={<Wallet size={18} />} tint="blue" foot={`${live.filter((i) => i.type === 'cash').length} invoices`} />
        <Stat label="Credit sales" cur="Rs" value={compact(creditTotal)} icon={<Receipt size={18} />} tint="amber" foot={`${live.filter((i) => i.type === 'credit').length} invoices`} />
        <Stat label="Credit outstanding" cur="Rs" value={compact(creditDue)} icon={<Clock size={18} />} tint="red" foot="awaiting settlement" />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search invoice no. or customer…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Type</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {paginated.map((inv) => {
              const st = statusBadge(inv.status);
              const cancelled = !!inv.cancelled_at;
              const bal = Number(inv.total) - Number(inv.paid);
              return (
                <tr key={inv.id} className="row-click" onClick={() => setView(inv)} style={cancelled ? { opacity: 0.6 } : undefined}>
                  <td className="mono font-semibold">{inv.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(inv.date)}</td>
                  <td className="font-semibold">{inv.customer?.name ?? '—'}</td>
                  <td><Badge kind={inv.type === 'cash' ? 'blue' : 'amber'}>{inv.type === 'cash' ? 'Cash' : 'Credit'}</Badge></td>
                  <td className="num money font-bold" style={cancelled ? { textDecoration: 'line-through' } : undefined}>{fmt(inv.total as number)}</td>
                  <td className="num money" style={{ color: !cancelled && bal > 0 ? 'var(--red)' : 'var(--text-faint)' }}>{!cancelled && bal > 0 ? fmt(bal) : '—'}</td>
                  <td>{cancelled ? <Badge kind="gray" dot>Cancelled</Badge> : <Badge kind={st.kind} dot>{st.label}</Badge>}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-end">
                      {!cancelled && <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} title="Edit" onClick={() => setEditInv(inv)} />}
                      {!cancelled && (
                        <Button variant="subtle" size="sm" icon={<Ban size={14} />} title="Cancel invoice" onClick={async () => {
                          if (!(await confirmDelete({ title: 'Cancel invoice?', confirmText: 'Yes, cancel it', html: `Cancel <b>${inv.no}</b>? Item stock will be restored${inv.type === 'credit' ? ", the customer's outstanding reversed" : ''} and any recorded receipts removed. The invoice stays in the list marked Cancelled.` }))) return;
                          try { await http.post(`/api/invoices/${inv.id}/cancel`); toast('Invoice cancelled'); void load(); }
                          catch (e) { toast(apiErrorMessage(e), 'err'); }
                        }} />
                      )}
                      {cancelled && tab === 'cancelled' && (
                        <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} title="Delete invoice permanently" onClick={() => void deleteInvoice(inv)} style={{ color: 'var(--red)' }} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayedRows.length === 0 && (
          <Empty 
            icon={<ReceiptText size={40} />} 
            title={tab === 'cancelled' ? "No cancelled invoices" : "No invoices yet"} 
            sub={tab === 'cancelled' ? "Cancelled invoices will show up here." : "Create your first invoice to get started."} 
          />
        )}
        {displayedRows.length > 0 && (
          <Pagination
            totalItems={displayedRows.length}
            currentPage={page}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
          />
        )}
      </div>

      {(create || editInv) && (
        <CreateInvoice
          editInvoice={editInv}
          onClose={() => { setCreate(false); setEditInv(null); }}
          onSaved={() => { setCreate(false); setEditInv(null); void load(); }}
        />
      )}
      {view && <ViewInvoice inv={view} onClose={() => setView(null)} />}
    </div>
  );
}

function CreateInvoice({ editInvoice, onClose, onSaved }: { editInvoice?: Invoice | null; onClose: () => void; onSaved: () => void }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  // Tax is off unless switched on, and only users granted "Tax / VAT control"
  // (admins always) may switch it on.
  const mayTax = canUse(user, 'tax_control');
  const settingsTax = Number(settings.tax_rate ?? 0);
  const [taxOn, setTaxOn] = useState(false);
  const isEdit = !!editInvoice;
  const [type, setType] = useState<'cash' | 'credit'>('cash');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [discCash, setDiscCash] = useState(false);
  const [discCheque, setDiscCheque] = useState(false);
  const [cashPctVal, setCashPctVal] = useState('0');
  const [chequePctVal, setChequePctVal] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [paid, setPaid] = useState('');
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const taxRate = mayTax && taxOn ? settingsTax : 0;

  // When editing, load the full invoice (lines + cheques) and pre-fill the form.
  useEffect(() => {
    if (!editInvoice) return;
    void http.get(`/api/invoices/${editInvoice.id}`).then((r) => {
      const d: Invoice = r.data.data;
      setType(d.type);
      setCustomerId(Number(d.customer_id));
      setDiscCash(Number(d.cash_discount) > 0);
      setCashPctVal(String(Number(d.cash_discount ?? 0)));
      setDiscCheque(Number(d.cheque_discount) > 0);
      setChequePctVal(String(Number(d.cheque_discount ?? 0)));
      setTaxOn(Number(d.tax_rate) > 0);
      setLines((d.lines ?? []).map((l) => ({ item_id: Number(l.item_id), batch_id: l.batch_id ? Number(l.batch_id) : '', qty: String(Number(l.qty)), price: String(Number(l.price)) })));
      (d.lines ?? []).forEach((l) => loadBatches(Number(l.item_id)));
      setPaid(d.type === 'credit' ? String(Number(d.advance ?? d.paid)) : '');
      setCheques((d.cheques ?? []).map((c) => ({ no: c.cheque_no ?? '', date: c.cheque_date ? String(c.cheque_date).slice(0, 10) : '', amount: String(Number(c.amount)) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editInvoice]);

  const addCheque = () => setCheques((cs) => [...cs, { no: '', date: '', amount: '' }]);
  const delCheque = (i: number) => setCheques((cs) => cs.filter((_, idx) => idx !== i));
  const setCheque = (i: number, patch: Partial<ChequeRow>) =>
    setCheques((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [batchesByItem, setBatchesByItem] = useState<Record<number, ItemBatch[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void http.get('/api/customers').then((r) => setCustomers(r.data.data));
    void http.get('/api/items').then((r) => setItems(r.data.data));
  }, []);

  const loadBatches = (itemId: number) => {
    if (!itemId) return;
    void http.get(`/api/items/${itemId}/batches`).then((r) => setBatchesByItem((m) => ({ ...m, [itemId]: r.data.data })));
  };
  const batchesFor = (l: DraftLine) => (l.item_id ? batchesByItem[Number(l.item_id)] ?? [] : []);
  const batchFor = (l: DraftLine) => batchesFor(l).find((b) => Number(b.id) === l.batch_id);

  const cust = customers.find((c) => Number(c.id) === customerId);

  useEffect(() => {
    if (cust && !isEdit) {
      setCashPctVal(String(Number(cust.cash_discount ?? 0)));
      setChequePctVal(String(Number(cust.cheque_discount ?? 0)));
    }
  }, [customerId, cust, isEdit]);


  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const cashAmt = (subtotal * (discCash ? Number(cashPctVal) || 0 : 0)) / 100;
    const chequeAmt = (subtotal * (discCheque ? Number(chequePctVal) || 0 : 0)) / 100;
    const discountAmt = cashAmt + chequeAmt;
    const taxable = subtotal - discountAmt;
    const taxAmt = (taxable * taxRate) / 100;
    const total = taxable + taxAmt;
    const paidNum = type === 'cash' ? total : Math.min(Number(paid) || 0, total);
    const balance = total - paidNum;
    return { subtotal, cashAmt, chequeAmt, discountAmt, taxable, taxAmt, total, paidNum, balance };
  }, [lines, taxRate, type, paid, discCash, discCheque, cashPctVal, chequePctVal]);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => Number(x.id) === id);
    setLine(i, { item_id: id, batch_id: '', price: item ? Number(item.wholesale_price).toFixed(2) : '0' });
    if (id) loadBatches(Number(id));
  };
  // Out-of-stock items can't be sold — keep them out of the picker (except a
  // line's already-selected item when editing an old invoice).
  const pickableItems = (l: DraftLine) => items.filter((x) => Number(x.stock) > 0 || Number(x.id) === l.item_id);

  // Qty of an item / cost-batch already committed on the OTHER invoice lines, so
  // each line shows the stock that is still live after the earlier lines.
  const usedElsewhere = (itemId: number | '', exceptIdx: number) =>
    itemId === '' ? 0 : lines.reduce((s, l, idx) => s + (idx !== exceptIdx && Number(l.item_id) === Number(itemId) ? (Number(l.qty) || 0) : 0), 0);
  const batchUsedElsewhere = (batchId: number | '', exceptIdx: number) =>
    batchId === '' ? 0 : lines.reduce((s, l, idx) => s + (idx !== exceptIdx && Number(l.batch_id) === Number(batchId) ? (Number(l.qty) || 0) : 0), 0);
  // "Old stock" = the item's stock that is NOT held in any cost-batch (opening
  // stock + anything received without a batch). Shown as its own pickable row.
  const looseFor = (it: Item) =>
    Number(it.stock) - (batchesByItem[Number(it.id)] ?? []).reduce((s, b) => s + Number(b.qty_remaining), 0);
  // Selling price for an item's old/opening stock = price minus its opening discount.
  const oldStockPrice = (it: Item) =>
    Number(it.wholesale_price) * (1 - (Number(it.opening_discount ?? 0) || 0) / 100);

  // Stock still available for one line, given which pool it draws from (a chosen
  // cost-batch, the old-stock pool, or — when no batches — plain item stock),
  // minus what the other lines already took from the same pool.
  const lineCap = (l: DraftLine, idx: number) => {
    const it = items.find((x) => Number(x.id) === l.item_id);
    if (!it) return Infinity;
    if (l.batch_id === 0) return looseFor(it) - batchUsedElsewhere(0, idx);   // old stock
    const batch = batchFor(l);
    return batch
      ? Number(batch.qty_remaining) - batchUsedElsewhere(l.batch_id, idx)
      : Number(it.stock) - usedElsewhere(l.item_id, idx);
  };
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0 && (batchesFor(l).length === 0 || l.batch_id !== ''));
  // No line (nor the running total for a repeated item) may exceed live stock.
  const overStock = lines.some((l, i) => l.item_id !== '' && Number(l.qty) > 0 && Number(l.qty) > lineCap(l, i));
  const canSave = customerId !== '' && validLines.length > 0 && !overStock && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        type, customer_id: customerId, tax_rate: taxRate,
        cash_discount: discCash ? Number(cashPctVal) || 0 : 0,
        cheque_discount: discCheque ? Number(chequePctVal) || 0 : 0,
        paid: type === 'cash' ? totals.total : Number(paid) || 0,
        lines: validLines.map((l) => ({ item_id: l.item_id, batch_id: l.batch_id || null, qty: Number(l.qty), price: Number(l.price) })),
        cheques: type === 'credit'
          ? cheques
              .filter((c) => c.no.trim() || c.date || Number(c.amount) > 0)
              .map((c) => ({ no: c.no.trim() || null, date: c.date || null, amount: Number(c.amount) || 0 }))
          : [],
      };
      if (isEdit) await http.put(`/api/invoices/${editInvoice!.id}`, payload);
      else await http.post('/api/invoices', payload);
      toast(isEdit ? 'Invoice updated' : 'Invoice created');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title={isEdit ? `Edit Invoice ${editInvoice!.no}` : 'Create Invoice'}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3.5">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Total payable</span>
            <span className="text-[20px] font-extrabold mono">Rs {fmt(totals.total)}</span>
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>{isEdit ? 'Save changes' : `Create ${type === 'cash' ? 'Cash' : 'Credit'} Invoice`}</Button>
        </>
      }
    >
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Invoice type</div>
          <Segmented accent value={type} onChange={(v) => setType(v as 'cash' | 'credit')} options={[{ value: 'cash', label: '💵 Cash' }, { value: 'credit', label: '📄 Credit' }]} />
        </div>
        {mayTax && (
          <label className="flex items-center gap-2.5 cursor-pointer px-3.5 py-2.5 rounded-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <Switch on={taxOn} onClick={() => setTaxOn((t) => !t)} />
            <span className="text-[13px]">
              <b>Apply tax / VAT</b>
              <span className="block text-[11.5px]" style={{ color: settingsTax <= 0 && taxOn ? 'var(--amber)' : 'var(--text-faint)' }}>
                {!taxOn ? 'Off — no tax charged'
                  : settingsTax > 0 ? `Charging ${settingsTax}% on this invoice`
                  : 'Tax rate is 0% — set it in Settings'}
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="mb-5" style={{ maxWidth: 440 }}>
        <Field label="Customer" req hint="Who is buying">
          <SearchSelect
            items={customers}
            value={customerId}
            onChange={(v) => { setCustomerId(v); setDiscCash(false); setDiscCheque(false); }}
            allLabel="Select customer…"
            placeholder="Search name, code or mobile…"
            subtitle={(c) => `${c.code}${c.phone ? ` · ${c.phone}` : ''}`}
          />
        </Field>
      </div>

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Items</div>
      <div className="card p-2.5 mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)', width: '44%' }}>Product</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 70 }}>Qty</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Price</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)' }}>Amount</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => Number(x.id) === l.item_id);
              const batch = batchFor(l);
              const thisQty = Number(l.qty) || 0;
              const cap = it ? lineCap(l, i) : 0;              // stock available to this line (excludes its own qty)
              const short = it ? thisQty > cap : false;
              const remaining = Math.max(0, cap - thisQty); // stock left AFTER this line's qty is billed
              // "left" for a batch/old-stock option: pool available to this line,
              // minus this line's qty when that option is the one selected.
              const optLeft = (poolId: number, poolTotal: number) =>
                fmt0(Math.max(0, poolTotal - batchUsedElsewhere(poolId, i) - (Number(l.batch_id) === poolId ? thisQty : 0)));
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <SearchSelect
                      items={pickableItems(l)}
                      value={l.item_id}
                      onChange={(v) => pickItem(i, v)}
                      allLabel="Select item…"
                      placeholder="Search item name or code…"
                      subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock) - usedElsewhere(x.id, i))}`}
                    />
                    {batchesFor(l).length > 0 && (
                      <Select value={l.batch_id === '' ? '' : String(l.batch_id)} onChange={(e) => {
                        const v = e.target.value === '' ? '' : Number(e.target.value);
                        // Old stock (0) sells at the item's discounted price; a GRN
                        // lot at the full selling price.
                        const patch: Partial<DraftLine> = { batch_id: v };
                        if (it && v === 0) patch.price = oldStockPrice(it).toFixed(2);
                        else if (it && typeof v === 'number') patch.price = Number(it.wholesale_price).toFixed(2);
                        setLine(i, patch);
                      }} style={{ height: 32, fontSize: 12, marginTop: 6 }}>
                        <option value="">Select stock / batch…</option>
                        {it && looseFor(it) > 0 && (
                          <option value="0">old stock · Rs {fmt(oldStockPrice(it))}{Number(it.opening_discount ?? 0) > 0 ? ` (−${fmt(Number(it.opening_discount))}%)` : ''} · {optLeft(0, looseFor(it))} left</option>
                        )}
                        {batchesFor(l).map((b) => <option key={b.id} value={b.id}>cost Rs {fmt(b.unit_cost as number)} · {optLeft(Number(b.id), Number(b.qty_remaining))} left</option>)}
                      </Select>
                    )}
                    {it && (
                      <div className="text-[12px] mt-1" style={{ color: short ? 'var(--red)' : 'var(--text-muted)' }}>
                        Stock: {fmt0(remaining)} left{l.batch_id === 0 ? ' (old stock)' : batch ? ' (this batch)' : ''} · {it.product
                          ? <>Actual Rs {fmt(Number(it.product.actual_price))}</>
                          : <>WP Rs {fmt(it.wholesale_price as number)}</>}
                        {short ? ` — only ${fmt0(cap)} available` : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 36, borderColor: short ? 'var(--red)' : undefined }} /></td>
                  <td className="p-1.5"><MoneyInput className="text-right" value={l.price} onChange={(v) => setLine(i, { price: v })} style={{ height: 36 }} /></td>
                  <td className="p-1.5 text-right money font-semibold">{fmt((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                  <td className="p-1.5 text-right">
                    <button className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => delLine(i)} type="button"><X size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Button variant="subtle" size="sm" icon={<Plus size={14} />} onClick={addLine} style={{ margin: 8 }}>Add item</Button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <Field label="Discount" hint="Apply cash and / or cheque discount.">
            <div className="flex flex-col gap-2.5 mt-2 p-3 rounded-[10px] border border-border bg-surface">
              {/* Cash Discount Option */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setDiscCash(!discCash)}
                  disabled={!cust}
                  className="flex items-center gap-2.5 text-left disabled:opacity-45"
                >
                  <span
                    className="grid place-items-center w-[18px] h-[18px] rounded-[5px] border flex-shrink-0 transition"
                    style={{ background: discCash ? 'var(--accent)' : 'var(--surface)', borderColor: discCash ? 'var(--accent)' : 'var(--border-strong)' }}
                  >
                    {discCash && <Check size={13} color="white" strokeWidth={3} />}
                  </span>
                  <span className="text-[13.5px] font-medium">Cash discount</span>
                </button>
                {discCash && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Input
                      type="text"
                      className="mono text-right py-0.5 px-2"
                      style={{ width: 70, height: 28 }}
                      value={cashPctVal}
                      onChange={(e) => setCashPctVal(e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <span className="text-[13px] font-semibold text-muted">%</span>
                  </div>
                )}
              </div>

              {/* Cheque Discount Option */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setDiscCheque(!discCheque)}
                  disabled={!cust}
                  className="flex items-center gap-2.5 text-left disabled:opacity-45"
                >
                  <span
                    className="grid place-items-center w-[18px] h-[18px] rounded-[5px] border flex-shrink-0 transition"
                    style={{ background: discCheque ? 'var(--accent)' : 'var(--surface)', borderColor: discCheque ? 'var(--accent)' : 'var(--border-strong)' }}
                  >
                    {discCheque && <Check size={13} color="white" strokeWidth={3} />}
                  </span>
                  <span className="text-[13.5px] font-medium">Cheque discount</span>
                </button>
                {discCheque && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Input
                      type="text"
                      className="mono text-right py-0.5 px-2"
                      style={{ width: 70, height: 28 }}
                      value={chequePctVal}
                      onChange={(e) => setChequePctVal(e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <span className="text-[13px] font-semibold text-muted">%</span>
                  </div>
                )}
              </div>
            </div>
          </Field>

          <div className="h-4" />

          {type === 'credit' && (
            <Field label="Advance / amount paid now (LKR)" hint="Remaining goes to outstanding.">
              <MoneyInput value={paid} onChange={setPaid} />
            </Field>
          )}
          {type === 'cash' && (
            <div className="p-3 rounded-[10px] flex gap-2.5 items-center text-[12.5px]" style={{ background: 'var(--green-soft)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Check size={16} style={{ color: 'var(--green)' }} /> Full amount collected at point of sale — marked Paid.
            </div>
          )}

          {type === 'credit' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>Cheque details</div>
              <Button variant="subtle" size="sm" icon={<Plus size={13} />} onClick={addCheque}>Add cheque</Button>
            </div>
            {cheques.length === 0 ? (
              <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>No cheques. Use “Add cheque” to record cheque no., date and value.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {cheques.map((c, i) => (
                  <div key={i} className="flex gap-1.5 items-center">
                    <Input placeholder="Cheque no." value={c.no} onChange={(e) => setCheque(i, { no: e.target.value })} className="mono" style={{ height: 34, flex: 1, minWidth: 0 }} />
                    <Input type="date" value={c.date} onChange={(e) => setCheque(i, { date: e.target.value })} style={{ height: 34, width: 140 }} />
                    <MoneyInput value={c.amount} onChange={(v) => setCheque(i, { amount: v })} className="text-right" style={{ height: 34, width: 96 }} />
                    <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2 flex-shrink-0" onClick={() => delCheque(i)}><X size={14} /></button>
                  </div>
                ))}
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  Recorded for reference — does not change the amount paid. Total cheques: Rs {fmt(cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Subtotal" v={fmt(totals.subtotal)} />
          {totals.cashAmt > 0 && <TotalRow k="Cash discount" v={`-${fmt(totals.cashAmt)}`} />}
          {totals.chequeAmt > 0 && <TotalRow k="Cheque discount" v={`-${fmt(totals.chequeAmt)}`} />}
          {/* Tax row only exists when tax is actually applied. */}
          {taxRate > 0 && <TotalRow k={`Tax / VAT (${taxRate}%)`} v={fmt(totals.taxAmt)} />}
          <div className="h-px my-2.5" style={{ background: 'var(--border)' }} />
          <TotalRow k="Total" v={fmt(totals.total)} big />
          {type === 'credit' && (<>
            <TotalRow k="Paid now" v={fmt(totals.paidNum)} />
            <TotalRow k="Balance (outstanding)" v={fmt(totals.balance)} accent />
          </>)}
        </div>
      </div>
    </Modal>
  );
}



export function TotalRow({ k, v, big, accent }: { k: string; v: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline" style={{ padding: big ? '2px 0' : '3px 0' }}>
      <span className="text-[13px] font-medium" style={{ color: 'var(--text-muted)', fontWeight: big ? 700 : 500 }}>{k}</span>
      <span className="money" style={{ fontSize: big ? 19 : 13.5, fontWeight: big ? 800 : 600, color: accent ? 'var(--accent)' : 'var(--text)' }}>Rs {v}</span>
    </div>
  );
}

function ViewInvoice({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const [data, setData] = useState<Invoice>(inv);
  useEffect(() => { void http.get(`/api/invoices/${inv.id}`).then((r) => setData(r.data.data)); }, [inv.id]);
  const st = statusBadge(data.status);
  const bal = Number(data.total) - Number(data.paid);
  return (
    <Modal
      title={<span className="flex items-center gap-2.5">{data.no} <Badge kind={data.type === 'cash' ? 'blue' : 'amber'}>{data.type === 'cash' ? 'Cash' : 'Credit'}</Badge></span>}
      onClose={onClose}
      footer={<><Button variant="ghost" icon={<Download size={15} />} onClick={onClose}>Download</Button><Button variant="primary" onClick={onClose}>Close</Button></>}
    >
      <div className="flex justify-between mb-5">
        <div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Billed to</div>
          <div className="font-bold text-[15px]">{data.customer?.name}</div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{data.customer?.address}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Date</div>
          <div className="font-semibold">{prettyDate(data.date)}</div>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {(data.lines ?? []).map((l, i) => (
              <tr key={i}>
                <td className="font-semibold">{l.name}</td>
                <td className="num mono">{l.qty}</td>
                <td className="num money">{fmt(l.price as number)}</td>
                <td className="num money font-semibold">{fmt(l.total as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data.cheques ?? []).length > 0 && (
        <div className="mb-4">
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Cheques</div>
          <div className="card overflow-hidden">
            <table className="tbl">
              <thead><tr><th>Cheque No</th><th>Date</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {(data.cheques ?? []).map((c, i) => (
                  <tr key={i}>
                    <td className="mono font-semibold">{c.cheque_no || '—'}</td>
                    <td>{c.cheque_date ? prettyDate(c.cheque_date) : '—'}</td>
                    <td className="num money">{fmt(c.amount as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <div className="w-[280px] rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Subtotal" v={fmt(data.subtotal as number)} />
          {Number(data.cash_discount) > 0 && <TotalRow k="Cash discount" v={`-${fmt(Number(data.subtotal) * Number(data.cash_discount) / 100)}`} />}
          {Number(data.cheque_discount) > 0 && <TotalRow k="Cheque discount" v={`-${fmt(Number(data.subtotal) * Number(data.cheque_discount) / 100)}`} />}
          {Number(data.tax_rate) > 0 && <TotalRow k={`Tax (${data.tax_rate}%)`} v={fmt(data.tax_amount as number)} />}
          <div className="h-px my-2" style={{ background: 'var(--border)' }} />
          <TotalRow k="Total" v={fmt(data.total as number)} big />
          <TotalRow k="Paid" v={fmt(data.paid as number)} />
          {bal > 0 && <TotalRow k="Balance" v={fmt(bal)} accent />}
          <div className="mt-2.5 text-right"><Badge kind={st.kind} dot>{st.label}</Badge></div>
        </div>
      </div>
    </Modal>
  );
}
