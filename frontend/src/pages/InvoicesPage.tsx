import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Check, Wallet, Receipt, Clock, ReceiptText, Download, Edit2, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { useSettings } from '@/store/settings';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { SearchBar, Empty, Segmented, Stat } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput, Input } from '@/components/ui/Field';
import type { Customer, Invoice, Item } from '@/types';

type Tab = 'all' | 'cash' | 'credit';

interface DraftLine { item_id: number | ''; qty: string; price: string; }
const blankLine = (): DraftLine => ({ item_id: '', qty: '1', price: '0' });

interface ChequeRow { no: string; date: string; amount: string; }

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(params.has('create'));
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [view, setView] = useState<Invoice | null>(null);

  const load = () => http.get('/api/invoices', { params: { q, type: tab === 'all' ? undefined : tab } }).then((r) => setRows(r.data.data));

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, tab]);
  useEffect(() => {
    if (params.has('create')) { setCreate(true); params.delete('create'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const cashTotal = rows.filter((i) => i.type === 'cash').reduce((s, i) => s + Number(i.total), 0);
  const creditTotal = rows.filter((i) => i.type === 'credit').reduce((s, i) => s + Number(i.total), 0);
  const creditDue = rows.filter((i) => i.type === 'credit').reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Invoices"
        sub={`${rows.length} invoices · cash & credit billing.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New Invoice</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Cash sales" cur="Rs" value={compact(cashTotal)} icon={<Wallet size={18} />} tint="blue" foot={`${rows.filter((i) => i.type === 'cash').length} invoices`} />
        <Stat label="Credit sales" cur="Rs" value={compact(creditTotal)} icon={<Receipt size={18} />} tint="amber" foot={`${rows.filter((i) => i.type === 'credit').length} invoices`} />
        <Stat label="Credit outstanding" cur="Rs" value={compact(creditDue)} icon={<Clock size={18} />} tint="red" foot="awaiting settlement" />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search invoice no. or customer…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Type</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((inv) => {
              const st = statusBadge(inv.status);
              const bal = Number(inv.total) - Number(inv.paid);
              return (
                <tr key={inv.id} className="row-click" onClick={() => setView(inv)}>
                  <td className="mono font-semibold">{inv.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(inv.date)}</td>
                  <td className="font-semibold">{inv.customer?.name ?? '—'}</td>
                  <td><Badge kind={inv.type === 'cash' ? 'blue' : 'amber'}>{inv.type === 'cash' ? 'Cash' : 'Credit'}</Badge></td>
                  <td className="num money font-bold">{fmt(inv.total as number)}</td>
                  <td className="num money" style={{ color: bal > 0 ? 'var(--red)' : 'var(--text-faint)' }}>{bal > 0 ? fmt(bal) : '—'}</td>
                  <td><Badge kind={st.kind} dot>{st.label}</Badge></td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditInv(inv)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                        if (!(await confirmDelete({ title: 'Delete invoice?', html: `Delete <b>${inv.no}</b>? Item stock will be restored${inv.type === 'credit' ? " and the customer's outstanding reversed" : ''}.` }))) return;
                        try { await http.delete(`/api/invoices/${inv.id}`); toast('Invoice deleted'); void load(); }
                        catch (e) { toast(apiErrorMessage(e), 'err'); }
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon={<ReceiptText size={40} />} title="No invoices yet" sub="Create your first invoice to get started." />}
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
  const taxDefault = Number(settings.tax_rate ?? 0);
  const isEdit = !!editInvoice;

  const [type, setType] = useState<'cash' | 'credit'>('cash');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [discCash, setDiscCash] = useState(false);
  const [discCheque, setDiscCheque] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [paid, setPaid] = useState('');
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [taxRate, setTaxRate] = useState(taxDefault);

  // When editing, load the full invoice (lines + cheques) and pre-fill the form.
  useEffect(() => {
    if (!editInvoice) return;
    void http.get(`/api/invoices/${editInvoice.id}`).then((r) => {
      const d: Invoice = r.data.data;
      setType(d.type);
      setCustomerId(Number(d.customer_id));
      setDiscCash(Number(d.cash_discount) > 0);
      setDiscCheque(Number(d.cheque_discount) > 0);
      setTaxRate(Number(d.tax_rate));
      setLines((d.lines ?? []).map((l) => ({ item_id: Number(l.item_id), qty: String(Number(l.qty)), price: String(Number(l.price)) })));
      setPaid(d.type === 'credit' ? String(Number(d.paid)) : '');
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void http.get('/api/customers').then((r) => setCustomers(r.data.data));
    void http.get('/api/items').then((r) => setItems(r.data.data));
  }, []);

  const cust = customers.find((c) => c.id === customerId);
  const cashPct = cust ? Number(cust.cash_discount) : 0;
  const chequePct = cust ? Number(cust.cheque_discount) : 0;

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const cashAmt = (subtotal * (discCash ? cashPct : 0)) / 100;
    const chequeAmt = (subtotal * (discCheque ? chequePct : 0)) / 100;
    const discountAmt = cashAmt + chequeAmt;
    const taxable = subtotal - discountAmt;
    const taxAmt = (taxable * taxRate) / 100;
    const total = taxable + taxAmt;
    const paidNum = type === 'cash' ? total : Math.min(Number(paid) || 0, total);
    const balance = total - paidNum;
    return { subtotal, cashAmt, chequeAmt, discountAmt, taxable, taxAmt, total, paidNum, balance };
  }, [lines, taxRate, type, paid, discCash, discCheque, cashPct, chequePct]);

  const newExposure = cust ? Number(cust.balance) + totals.balance : 0;
  const overLimit = type === 'credit' && cust && newExposure > Number(cust.credit_limit);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => x.id === id);
    setLine(i, { item_id: id, price: item ? String(item.wholesale_price) : '0' });
  };
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0);
  const canSave = customerId !== '' && validLines.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        type, customer_id: customerId, tax_rate: taxRate, cash_discount: discCash, cheque_discount: discCheque,
        paid: type === 'cash' ? totals.total : Number(paid) || 0,
        lines: validLines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty), price: Number(l.price) })),
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Invoice type</div>
          <Segmented accent value={type} onChange={(v) => setType(v as 'cash' | 'credit')} options={[{ value: 'cash', label: '💵 Cash' }, { value: 'credit', label: '📄 Credit' }]} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Field label="Customer" req hint="Who is buying">
          <Select value={customerId === '' ? '' : String(customerId)} onChange={(e) => { setCustomerId(e.target.value ? Number(e.target.value) : ''); setDiscCash(false); setDiscCheque(false); }}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Discount" hint="Tick to apply the customer's cash and / or cheque discount.">
          <div className="flex flex-col gap-2 pt-1.5">
            <DiscountTick label="Cash discount" pct={cashPct} on={discCash} disabled={!cust || cashPct <= 0} onToggle={() => setDiscCash((v) => !v)} />
            <DiscountTick label="Cheque discount" pct={chequePct} on={discCheque} disabled={!cust || chequePct <= 0} onToggle={() => setDiscCheque((v) => !v)} />
          </div>
        </Field>
      </div>

      {type === 'credit' && cust && (
        <div className="flex items-center gap-3.5 p-3 rounded-[10px] mb-5"
             style={{ background: overLimit ? 'var(--red-soft)' : 'var(--surface-2)', border: `1px solid ${overLimit ? 'var(--red)' : 'var(--border)'}` }}>
          <Wallet size={18} style={{ color: overLimit ? 'var(--red)' : 'var(--text-muted)' }} />
          <div className="flex-1 text-[12.5px]">
            <div className="flex justify-between mb-1">
              <span className="font-semibold">Credit exposure after this invoice</span>
              <span className="mono">Rs {fmt0(newExposure)} / {fmt0(cust.credit_limit as number)}</span>
            </div>
            <div className="bar"><span style={{ width: `${Math.min(100, (newExposure / (Number(cust.credit_limit) || 1)) * 100)}%`, background: overLimit ? 'var(--red)' : 'var(--accent)' }} /></div>
          </div>
          {overLimit && <Badge kind="red">Over limit</Badge>}
        </div>
      )}

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
              const it = items.find((x) => x.id === l.item_id);
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <Select value={l.item_id === '' ? '' : String(l.item_id)} onChange={(e) => pickItem(i, e.target.value ? Number(e.target.value) : '')} style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select item…</option>
                      {items.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.stock <= 0}>
                          {x.code} · {x.name}{x.stock <= 0 ? ' (out)' : ''}
                        </option>
                      ))}
                    </Select>
                    {it && <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Stock: {fmt0(it.stock)} · WP Rs {fmt(it.wholesale_price as number)}</div>}
                  </td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 36 }} /></td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.price} onChange={(e) => setLine(i, { price: e.target.value.replace(/[^\d.]/g, '') })} style={{ height: 36 }} /></td>
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
                    <Input placeholder="0.00" inputMode="decimal" value={c.amount} onChange={(e) => setCheque(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} className="mono text-right" style={{ height: 34, width: 96 }} />
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
          {totals.cashAmt > 0 && <TotalRow k={`Cash discount (${cashPct}%)`} v={`-${fmt(totals.cashAmt)}`} />}
          {totals.chequeAmt > 0 && <TotalRow k={`Cheque discount (${chequePct}%)`} v={`-${fmt(totals.chequeAmt)}`} />}
          <TotalRow k={`Tax / VAT (${taxRate}%)`} v={fmt(totals.taxAmt)} />
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

function DiscountTick({ label, pct, on, disabled, onToggle }: {
  label: string; pct: number; on: boolean; disabled?: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex items-center gap-2.5 text-left disabled:opacity-45 disabled:cursor-not-allowed"
    >
      <span
        className="grid place-items-center w-[18px] h-[18px] rounded-[5px] border flex-shrink-0 transition"
        style={{ background: on ? 'var(--accent)' : 'var(--surface)', borderColor: on ? 'var(--accent)' : 'var(--border-strong)' }}
      >
        {on && <Check size={13} color="white" strokeWidth={3} />}
      </span>
      <span className="text-[13.5px]">
        {label} <span className="mono font-semibold" style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
      </span>
    </button>
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
          {Number(data.cash_discount) > 0 && <TotalRow k={`Cash discount (${data.cash_discount}%)`} v={`-${fmt(Number(data.subtotal) * Number(data.cash_discount) / 100)}`} />}
          {Number(data.cheque_discount) > 0 && <TotalRow k={`Cheque discount (${data.cheque_discount}%)`} v={`-${fmt(Number(data.subtotal) * Number(data.cheque_discount) / 100)}`} />}
          <TotalRow k={`Tax (${data.tax_rate}%)`} v={fmt(data.tax_amount as number)} />
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
