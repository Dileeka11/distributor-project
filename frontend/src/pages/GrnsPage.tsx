import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Check, Truck, Wallet, PackageOpen, Clock, Box, Download } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useSettings } from '@/store/settings';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { SearchBar, Empty, Segmented, Stat } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput, Input } from '@/components/ui/Field';
import { TotalRow } from './InvoicesPage';
import type { Grn, Item, Supplier } from '@/types';

type Tab = 'all' | 'cash' | 'credit';

interface DraftLine { item_id: number | ''; qty: string; unit_price: string; discount: string; }
const blankLine = (): DraftLine => ({ item_id: '', qty: '1', unit_price: '0', discount: '0' });
const unitCost = (l: DraftLine) => (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100);

export default function GrnsPage() {
  const [rows, setRows] = useState<Grn[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [create, setCreate] = useState(false);
  const [view, setView] = useState<Grn | null>(null);

  const load = () => http.get('/api/grns', { params: { q, type: tab === 'all' ? undefined : tab } }).then((r) => setRows(r.data.data));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, tab]);

  const cashTotal = rows.filter((g) => g.type === 'cash').reduce((s, g) => s + Number(g.total), 0);
  const creditTotal = rows.filter((g) => g.type === 'credit').reduce((s, g) => s + Number(g.total), 0);
  const creditDue = rows.filter((g) => g.type === 'credit').reduce((s, g) => s + (Number(g.total) - Number(g.paid)), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Goods Received (GRN)"
        sub={`${rows.length} purchase notes · receive stock from suppliers on cash or credit.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New GRN</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Cash purchases" cur="Rs" value={compact(cashTotal)} icon={<Wallet size={18} />} tint="blue" foot={`${rows.filter((g) => g.type === 'cash').length} GRNs`} />
        <Stat label="Credit purchases" cur="Rs" value={compact(creditTotal)} icon={<PackageOpen size={18} />} tint="amber" foot={`${rows.filter((g) => g.type === 'credit').length} GRNs`} />
        <Stat label="Payable outstanding" cur="Rs" value={compact(creditDue)} icon={<Clock size={18} />} tint="red" foot="owed to suppliers" />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search GRN no. or supplier…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>Type</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((g) => {
              const st = statusBadge(g.status);
              const bal = Number(g.total) - Number(g.paid);
              return (
                <tr key={g.id} className="row-click" onClick={() => setView(g)}>
                  <td className="mono font-semibold">{g.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(g.date)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Truck size={15} /></div>
                      <span className="font-semibold">{g.supplier?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td><Badge kind={g.type === 'cash' ? 'blue' : 'amber'}>{g.type === 'cash' ? 'Cash' : 'Credit'}</Badge></td>
                  <td className="num money font-bold">{fmt(g.total as number)}</td>
                  <td className="num money" style={{ color: bal > 0 ? 'var(--red)' : 'var(--text-faint)' }}>{bal > 0 ? fmt(bal) : '—'}</td>
                  <td><Badge kind={st.kind} dot>{st.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon={<PackageOpen size={40} />} title="No GRNs yet" sub="Record a goods-received note to add stock." />}
      </div>

      {create && <CreateGrn onClose={() => setCreate(false)} onSaved={() => { setCreate(false); void load(); }} />}
      {view && <ViewGrn grn={view} onClose={() => setView(null)} />}
    </div>
  );
}

function CreateGrn({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { settings } = useSettings();
  const taxRate = Number(settings.tax_rate ?? 0);
  const [type, setType] = useState<'cash' | 'credit'>('credit');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [paid, setPaid] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void http.get('/api/suppliers').then((r) => setSuppliers(r.data.data));
    void http.get('/api/items').then((r) => setItems(r.data.data));
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * unitCost(l), 0);
    const taxAmt = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmt;
    const paidNum = type === 'cash' ? total : Math.min(Number(paid) || 0, total);
    const balance = total - paidNum;
    return { subtotal, taxAmt, total, paidNum, balance };
  }, [lines, taxRate, type, paid]);

  const sup = suppliers.find((s) => s.id === supplierId);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => x.id === id);
    setLine(i, { item_id: id, unit_price: item ? String(item.distributor_price) : '0' });
  };
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0);
  const canSave = supplierId !== '' && validLines.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await http.post('/api/grns', {
        type, supplier_id: supplierId, tax_rate: taxRate,
        paid: type === 'cash' ? totals.total : Number(paid) || 0,
        lines: validLines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty), unit_price: Number(l.unit_price) || 0, discount: Number(l.discount) || 0 })),
      });
      toast('GRN created');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      xl
      title="New Goods Received Note"
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3.5">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Purchase total</span>
            <span className="text-[20px] font-extrabold mono">Rs {fmt(totals.total)}</span>
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>Receive {type === 'cash' ? 'Cash' : 'Credit'} GRN</Button>
        </>
      }
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Purchase type</div>
          <Segmented accent value={type} onChange={(v) => setType(v as 'cash' | 'credit')} options={[{ value: 'cash', label: '💵 Cash' }, { value: 'credit', label: '📄 Credit' }]} />
        </div>
      </div>

      <div className="mb-5">
        <Field label="Supplier" req hint="Who you are buying stock from">
          <Select value={supplierId === '' ? '' : String(supplierId)} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>

      {type === 'credit' && sup && (
        <div className="flex items-center gap-3.5 p-3 rounded-[10px] mb-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Truck size={18} style={{ color: 'var(--text-muted)' }} />
          <div className="flex-1 text-[12.5px]">
            <div className="flex justify-between">
              <span className="font-semibold">Current payable to {sup.name}</span>
              <span className="mono">Rs {fmt0(sup.payable as number)} → Rs {fmt0(Number(sup.payable) + totals.balance)}</span>
            </div>
            <div className="mt-1" style={{ color: 'var(--text-faint)' }}>Terms: {sup.terms_days} days · this GRN adds Rs {fmt0(totals.balance)} to outstanding</div>
          </div>
        </div>
      )}

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Items received <span className="font-medium" style={{ color: 'var(--text-faint)' }}>· price defaults to distributor cost</span></div>
      <div className="card p-2.5 mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider font-bold p-2" style={{ color: 'var(--text-faint)', width: '30%' }}>Product</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 110 }}>Unit price</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 80 }}>Disc %</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 100 }}>Unit cost</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)', width: 70 }}>Qty in</th>
              <th className="text-right text-[11px] uppercase font-bold p-2" style={{ color: 'var(--text-faint)' }}>Total cost</th>
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
                      {items.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                    </Select>
                    {it && <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>On hand: {fmt0(it.stock)} · last cost Rs {fmt(it.distributor_price as number)}</div>}
                  </td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value.replace(/[^\d.]/g, '') })} style={{ height: 36 }} /></td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value.replace(/[^\d.]/g, '') })} style={{ height: 36 }} /></td>
                  <td className="p-1.5 text-right money" style={{ color: 'var(--text-muted)' }}>{fmt(unitCost(l))}</td>
                  <td className="p-1.5"><Input className="mono text-right" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, '') })} style={{ height: 36 }} /></td>
                  <td className="p-1.5 text-right money font-semibold">{fmt((Number(l.qty) || 0) * unitCost(l))}</td>
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
            <Field label="Amount paid now (LKR)" hint="Remaining becomes a supplier payable."><MoneyInput value={paid} onChange={setPaid} /></Field>
          )}
          {type === 'cash' && (
            <div className="p-3 rounded-[10px] flex gap-2.5 items-center text-[12.5px]" style={{ background: 'var(--green-soft)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Check size={16} style={{ color: 'var(--green)' }} /> Paid to supplier in full — no payable created.
            </div>
          )}
          <div className="mt-3 text-[12px] flex gap-2 items-center" style={{ color: 'var(--text-faint)' }}>
            <Box size={15} /> {validLines.reduce((s, l) => s + (Number(l.qty) || 0), 0).toLocaleString()} units will be added to stock.
          </div>
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Subtotal" v={fmt(totals.subtotal)} />
          <TotalRow k={`Tax / VAT (${taxRate}%)`} v={fmt(totals.taxAmt)} />
          <div className="h-px my-2.5" style={{ background: 'var(--border)' }} />
          <TotalRow k="Total" v={fmt(totals.total)} big />
          {type === 'credit' && (<>
            <TotalRow k="Paid now" v={fmt(totals.paidNum)} />
            <TotalRow k="Payable (outstanding)" v={fmt(totals.balance)} accent />
          </>)}
        </div>
      </div>
    </Modal>
  );
}

function ViewGrn({ grn, onClose }: { grn: Grn; onClose: () => void }) {
  const [data, setData] = useState<Grn>(grn);
  useEffect(() => { void http.get(`/api/grns/${grn.id}`).then((r) => setData(r.data.data)); }, [grn.id]);
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
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Received from</div>
          <div className="font-bold text-[15px]">{data.supplier?.name}</div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{data.supplier?.address}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Date</div>
          <div className="font-semibold">{prettyDate(data.date)}</div>
        </div>
      </div>
      <div className="card overflow-hidden mb-4">
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Qty in</th><th className="num">Cost</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {(data.lines ?? []).map((l, i) => (
              <tr key={i}>
                <td className="font-semibold">{l.name}</td>
                <td className="num mono">{fmt0(l.qty as number)}</td>
                <td className="num money">{fmt(l.price as number)}</td>
                <td className="num money font-semibold">{fmt(l.total as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <div className="w-[280px] rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Subtotal" v={fmt(data.subtotal as number)} />
          <TotalRow k={`Tax (${data.tax_rate}%)`} v={fmt(data.tax_amount as number)} />
          <div className="h-px my-2" style={{ background: 'var(--border)' }} />
          <TotalRow k="Total" v={fmt(data.total as number)} big />
          <TotalRow k="Paid" v={fmt(data.paid as number)} />
          {bal > 0 && <TotalRow k="Payable" v={fmt(bal)} accent />}
          <div className="mt-2.5 text-right"><Badge kind={st.kind} dot>{st.label}</Badge></div>
        </div>
      </div>
    </Modal>
  );
}
