import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Check, Truck, Wallet, PackageOpen, Clock, Box, Edit2, Ban, Eye, Printer, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { useSettings } from '@/store/settings';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { SearchBar, Empty, Segmented, Stat, Switch } from '@/components/ui/Common';
import { useAuth } from '@/store/auth';
import { canUse } from '@/lib/pages';
import { Modal } from '@/components/ui/Modal';
import { Field, MoneyInput, Input } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { TotalRow } from './InvoicesPage';
import type { AppSettings, Grn, Item, Supplier } from '@/types';

// Printable Goods Received Note — company letterhead, supplier block, item
// lines, totals, cheques and signature strip. Browser print → save as PDF.
function printGrnDoc(d: Grn, settings: AppSettings): void {
  const w = window.open('', '_blank', 'width=860,height=980');
  if (!w) return;
  const accent = settings.accent || '#C8102E';
  const bal = Number(d.total) - Number(d.paid);
  const statusLabel = d.status === 'paid' ? 'PAID' : d.status === 'partial' ? 'PARTIALLY PAID' : 'UNPAID';
  const sup = d.supplier;
  const rows = (d.lines ?? []).map((l, i) => `<tr>
      <td class="c">${i + 1}</td><td><b>${l.name}</b></td>
      <td class="r">${fmt0(Number(l.qty))}</td><td class="r">${fmt(Number(l.unit_price ?? l.price))}</td>
      <td class="r">${Number(l.discount ?? 0) > 0 ? Number(l.discount) + '%' : '—'}</td>
      <td class="r">${fmt(Number(l.price))}</td><td class="r"><b>${fmt(Number(l.total))}</b></td>
    </tr>`).join('');
  const cheques = (d.cheques ?? []).length === 0 ? '' : `
    <div class="sec">Cheques given</div>
    <table class="tb"><thead><tr><th>Cheque No</th><th>Cheque date</th><th class="r">Amount</th></tr></thead><tbody>
      ${(d.cheques ?? []).map((c) => `<tr><td class="mono">${c.cheque_no || '—'}</td><td>${c.cheque_date ? prettyDate(c.cheque_date) : '—'}</td><td class="r">${fmt(Number(c.amount))}</td></tr>`).join('')}
    </tbody></table>`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${d.no} — Goods Received Note</title>
    <style>
      *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-sizing:border-box}
      body{margin:0;color:#1c1f26;font-size:13px}
      .bar{height:6px;background:${accent}}
      .page{padding:34px 42px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px}
      .logo{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:11px;background:${accent};color:#fff;font-weight:800;font-size:17px}
      .co{font-size:20px;font-weight:800;letter-spacing:-.02em}
      .muted{color:#69707c;font-size:11.5px;line-height:1.55}
      .doc{font-size:11px;font-weight:700;letter-spacing:.18em;color:${accent};text-transform:uppercase}
      .no{font-family:Consolas,monospace;font-size:22px;font-weight:800;margin:2px 0}
      .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.06em}
      .pill.type{background:${accent}18;color:${accent};border:1px solid ${accent}55}
      .pill.st{background:${bal > 0 ? '#fdecec' : '#e8f6ec'};color:${bal > 0 ? '#c0392b' : '#0a7d34'};border:1px solid ${bal > 0 ? '#f5c6c0' : '#bfe5c9'}}
      .cols{display:flex;gap:18px;margin-bottom:22px}
      .card{flex:1;border:1px solid #e6e9ef;border-radius:12px;padding:14px 16px}
      .lbl{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#98a1b0;margin-bottom:6px}
      .sup{font-size:15px;font-weight:800}
      .sec{font-size:12px;font-weight:700;margin:18px 0 8px;color:#3c4350}
      table.tb{width:100%;border-collapse:collapse}
      .tb th{background:${accent}10;color:#3c4350;font-size:10px;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:8px;border-bottom:2px solid ${accent}44}
      .tb td{padding:8px;border-bottom:1px solid #eef0f2}
      .r{text-align:right} .c{text-align:center;color:#98a1b0} .mono{font-family:Consolas,monospace}
      .totwrap{display:flex;justify-content:flex-end;margin-top:14px}
      .tot{width:290px} .tot .row{display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px}
      .tot .grand{border-top:2px solid #1c1f26;margin-top:6px;padding-top:8px;font-size:16px;font-weight:800}
      .tot .due{color:#c0392b;font-weight:700}
      .sign{display:flex;gap:34px;margin-top:52px}
      .sign div{flex:1;border-top:1.5px dotted #9aa3b2;padding-top:6px;font-size:11px;color:#69707c;text-align:center}
      .foot{margin-top:30px;font-size:10.5px;color:#98a1b0;display:flex;justify-content:space-between}
      @media print{.page{padding:24px 30px}}
    </style></head><body>
    <div class="bar"></div>
    <div class="page">
      <div class="head">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span class="logo">${settings.logo || 'K'}</span>
          <div>
            <div class="co">${settings.company || 'Distributor'}</div>
            <div class="muted">
              ${settings.address ? settings.address + '<br>' : ''}
              ${[settings.phone, settings.email].filter(Boolean).join(' · ')}
              ${settings.vat_no ? '<br>VAT: ' + settings.vat_no : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="doc">Goods Received Note</div>
          <div class="no">${d.no}</div>
          <div class="muted">${prettyDate(d.date)}</div>
          <div style="margin-top:7px;display:flex;gap:6px;justify-content:flex-end">
            <span class="pill type">${d.type === 'cash' ? 'CASH' : 'CREDIT'}</span>
            <span class="pill st">${statusLabel}</span>
          </div>
        </div>
      </div>

      <div class="cols">
        <div class="card">
          <div class="lbl">Received from (supplier)</div>
          <div class="sup">${sup?.name ?? '—'}</div>
          <div class="muted" style="margin-top:4px">
            ${sup?.code ? '<span class="mono">' + sup.code + '</span><br>' : ''}
            ${sup?.contact ? sup.contact + '<br>' : ''}
            ${sup?.phone ? sup.phone + '<br>' : ''}
            ${sup?.address ?? ''}
          </div>
        </div>
        <div class="card">
          <div class="lbl">Payment summary</div>
          <div class="muted" style="line-height:2">
            Purchase total <b style="color:#1c1f26;float:right">Rs ${fmt(Number(d.total))}</b><br>
            Paid <b style="color:#0a7d34;float:right">Rs ${fmt(Number(d.paid))}</b><br>
            Payable outstanding <b style="color:${bal > 0 ? '#c0392b' : '#0a7d34'};float:right">Rs ${fmt(Math.max(bal, 0))}</b>
          </div>
        </div>
      </div>

      <div class="sec">Items received</div>
      <table class="tb">
        <thead><tr><th style="width:30px">#</th><th>Item</th><th class="r">Qty in</th><th class="r">Unit price</th><th class="r">Disc</th><th class="r">Unit cost</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totwrap"><div class="tot">
        <div class="row"><span>Subtotal</span><span>Rs ${fmt(Number(d.subtotal))}</span></div>
        ${Number(d.tax_rate) > 0 ? `<div class="row"><span>Tax / VAT (${Number(d.tax_rate)}%)</span><span>Rs ${fmt(Number(d.tax_amount))}</span></div>` : ''}
        <div class="row grand"><span>Total</span><span>Rs ${fmt(Number(d.total))}</span></div>
        <div class="row"><span>Paid</span><span>Rs ${fmt(Number(d.paid))}</span></div>
        ${bal > 0 ? `<div class="row due"><span>Payable outstanding</span><span>Rs ${fmt(bal)}</span></div>` : ''}
      </div></div>

      ${cheques}

      <div class="sign">
        <div>Prepared by</div>
        <div>Checked by</div>
        <div>Goods received by</div>
      </div>
      <div class="foot">
        <span>Generated ${new Date().toLocaleString()}</span>
        <span>Computer-generated document · ${settings.company || ''}</span>
      </div>
    </div>
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

type Tab = 'all' | 'cash' | 'credit' | 'cancelled';

interface DraftLine { item_id: number | ''; qty: string; unit_price: string; discount: string; }
const blankLine = (): DraftLine => ({ item_id: '', qty: '1', unit_price: '0', discount: '0' });
const unitCost = (l: DraftLine) => (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100);

interface ChequeRow { no: string; date: string; amount: string; }

export default function GrnsPage() {
  const { settings } = useSettings();
  const [rows, setRows] = useState<Grn[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [create, setCreate] = useState(false);
  const [editGrn, setEditGrn] = useState<Grn | null>(null);
  const [view, setView] = useState<Grn | null>(null);

  const load = () => http.get('/api/grns', { params: { q, type: tab === 'all' || tab === 'cancelled' ? undefined : tab } }).then((r) => setRows(r.data.data));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, tab]);

  // Fetch the full GRN (supplier + lines + cheques) and open the print document.
  const printGrn = async (g: Grn) => {
    try {
      const { data } = await http.get(`/api/grns/${g.id}`);
      printGrnDoc(data.data as Grn, settings);
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  // Delete cancelled GRN permanently.
  const deleteGrn = async (g: Grn) => {
    if (!(await confirmDelete({
      title: 'Delete GRN permanently?',
      confirmText: 'Yes, delete it',
      html: `Are you sure you want to permanently delete cancelled GRN <b>${g.no}</b>? This action cannot be undone.`
    }))) return;
    try {
      await http.delete(`/api/grns/${g.id}`);
      toast('GRN deleted');
      void load();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const displayedRows = useMemo(() => {
    if (tab === 'cancelled') {
      return rows.filter((g) => !!g.cancelled_at);
    }
    return rows;
  }, [rows, tab]);

  // Cancelled GRNs are void — never counted in any total.
  const live = rows.filter((g) => !g.cancelled_at);
  const cashTotal = live.filter((g) => g.type === 'cash').reduce((s, g) => s + Number(g.total), 0);
  const creditTotal = live.filter((g) => g.type === 'credit').reduce((s, g) => s + Number(g.total), 0);
  const creditDue = live.filter((g) => g.type === 'credit').reduce((s, g) => s + (Number(g.total) - Number(g.paid)), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Goods Received (GRN)"
        sub={`${rows.length} purchase notes · receive stock from suppliers on cash or credit.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New GRN</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Cash purchases" cur="Rs" value={compact(cashTotal)} icon={<Wallet size={18} />} tint="blue" foot={`${live.filter((g) => g.type === 'cash').length} GRNs`} />
        <Stat label="Credit purchases" cur="Rs" value={compact(creditTotal)} icon={<PackageOpen size={18} />} tint="amber" foot={`${live.filter((g) => g.type === 'credit').length} GRNs`} />
        <Stat label="Payable outstanding" cur="Rs" value={compact(creditDue)} icon={<Clock size={18} />} tint="red" foot="owed to suppliers" />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <SearchBar value={q} onChange={setQ} placeholder="Search GRN no. or supplier…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>Type</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {displayedRows.map((g) => {
              const st = statusBadge(g.status);
              const cancelled = !!g.cancelled_at;
              const bal = Number(g.total) - Number(g.paid);
              return (
                <tr key={g.id} className="row-click" onClick={() => setView(g)} style={cancelled ? { opacity: 0.6 } : undefined}>
                  <td className="mono font-semibold">{g.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(g.date)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Truck size={15} /></div>
                      <span className="font-semibold">{g.supplier?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td><Badge kind={g.type === 'cash' ? 'blue' : 'amber'}>{g.type === 'cash' ? 'Cash' : 'Credit'}</Badge></td>
                  <td className="num money font-bold" style={cancelled ? { textDecoration: 'line-through' } : undefined}>{fmt(g.total as number)}</td>
                  <td className="num money" style={{ color: !cancelled && bal > 0 ? 'var(--red)' : 'var(--text-faint)' }}>{!cancelled && bal > 0 ? fmt(bal) : '—'}</td>
                  <td>{cancelled ? <Badge kind="gray" dot>Cancelled</Badge> : <Badge kind={st.kind} dot>{st.label}</Badge>}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Eye size={14} />} title="View GRN" onClick={() => setView(g)} />
                      <Button variant="subtle" size="sm" icon={<Printer size={14} />} title="Print / PDF" onClick={() => void printGrn(g)} />
                      {!cancelled && <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} title="Edit" onClick={() => setEditGrn(g)} />}
                      {!cancelled && (
                        <Button variant="subtle" size="sm" icon={<Ban size={14} />} title="Cancel GRN" onClick={async () => {
                          if (!(await confirmDelete({ title: 'Cancel GRN?', confirmText: 'Yes, cancel it', html: `Cancel <b>${g.no}</b>? Received stock will be removed${g.type === 'credit' ? ", the supplier's payable reversed" : ''} and any recorded payments removed. The GRN stays in the list marked Cancelled.` }))) return;
                          try { await http.post(`/api/grns/${g.id}/cancel`); toast('GRN cancelled'); void load(); }
                          catch (e) { toast(apiErrorMessage(e), 'err'); }
                        }} />
                      )}
                      {cancelled && tab === 'cancelled' && (
                        <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} title="Delete GRN permanently" onClick={() => void deleteGrn(g)} style={{ color: 'var(--red)' }} />
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
            icon={<PackageOpen size={40} />} 
            title={tab === 'cancelled' ? "No cancelled GRNs" : "No GRNs yet"} 
            sub={tab === 'cancelled' ? "Cancelled GRNs will show up here." : "Record a goods-received note to add stock."} 
          />
        )}
      </div>

      {(create || editGrn) && (
        <CreateGrn
          editGrn={editGrn}
          onClose={() => { setCreate(false); setEditGrn(null); }}
          onSaved={() => { setCreate(false); setEditGrn(null); void load(); }}
        />
      )}
      {view && <ViewGrn grn={view} onClose={() => setView(null)} />}
    </div>
  );
}

function CreateGrn({ editGrn, onClose, onSaved }: { editGrn?: Grn | null; onClose: () => void; onSaved: () => void }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  // Tax is off unless switched on, and only users granted "Tax / VAT control"
  // (admins always) may switch it on.
  const mayTax = canUse(user, 'tax_control');
  const settingsTax = Number(settings.tax_rate ?? 0);
  const [taxOn, setTaxOn] = useState(false);
  const taxRate = mayTax && taxOn ? settingsTax : 0;
  const isEdit = !!editGrn;
  const [type, setType] = useState<'cash' | 'credit'>('credit');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [paid, setPaid] = useState('');
  const [cheques, setCheques] = useState<ChequeRow[]>([]);

  // When editing, load the full GRN (lines + cheques) and pre-fill the form.
  useEffect(() => {
    if (!editGrn) return;
    void http.get(`/api/grns/${editGrn.id}`).then((r) => {
      const d: Grn = r.data.data;
      setType(d.type);
      setTaxOn(Number(d.tax_rate) > 0);
      setSupplierId(Number(d.supplier_id));
      setLines((d.lines ?? []).map((l) => ({
        item_id: Number(l.item_id),
        qty: String(Number(l.qty)),
        unit_price: String(Number(l.unit_price ?? l.price)),
        discount: String(Number(l.discount ?? 0)),
      })));
      setPaid(d.type === 'credit' ? String(Number(d.advance ?? d.paid)) : '');
      setCheques((d.cheques ?? []).map((c) => ({ no: c.cheque_no ?? '', date: c.cheque_date ? String(c.cheque_date).slice(0, 10) : '', amount: String(Number(c.amount)) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editGrn]);

  const addCheque = () => setCheques((cs) => [...cs, { no: '', date: '', amount: '' }]);
  const delCheque = (i: number) => setCheques((cs) => cs.filter((_, idx) => idx !== i));
  const setCheque = (i: number, patch: Partial<ChequeRow>) =>
    setCheques((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

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

  const sup = suppliers.find((s) => Number(s.id) === supplierId);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: number | '') => {
    const item = items.find((x) => Number(x.id) === id);
    setLine(i, { item_id: id, unit_price: item ? Number(item.distributor_price).toFixed(2) : '0' });
  };
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const delLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const validLines = lines.filter((l) => l.item_id !== '' && Number(l.qty) > 0);
  const canSave = supplierId !== '' && validLines.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        type, supplier_id: supplierId, tax_rate: taxRate,
        paid: type === 'cash' ? totals.total : Number(paid) || 0,
        lines: validLines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty), unit_price: Number(l.unit_price) || 0, discount: Number(l.discount) || 0 })),
        cheques: type === 'credit'
          ? cheques
              .filter((c) => c.no.trim() || c.date || Number(c.amount) > 0)
              .map((c) => ({ no: c.no.trim() || null, date: c.date || null, amount: Number(c.amount) || 0 }))
          : [],
      };
      if (isEdit) await http.put(`/api/grns/${editGrn!.id}`, payload);
      else await http.post('/api/grns', payload);
      toast(isEdit ? 'GRN updated' : 'GRN created');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      xl
      title={isEdit ? `Edit GRN ${editGrn!.no}` : 'New Goods Received Note'}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3.5">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Purchase total</span>
            <span className="text-[20px] font-extrabold mono">Rs {fmt(totals.total)}</span>
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>{isEdit ? 'Save changes' : `Receive ${type === 'cash' ? 'Cash' : 'Credit'} GRN`}</Button>
        </>
      }
    >
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Purchase type</div>
          <Segmented accent value={type} onChange={(v) => setType(v as 'cash' | 'credit')} options={[{ value: 'cash', label: '💵 Cash' }, { value: 'credit', label: '📄 Credit' }]} />
        </div>
        {mayTax && (
          <label className="flex items-center gap-2.5 cursor-pointer px-3.5 py-2.5 rounded-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <Switch on={taxOn} onClick={() => setTaxOn((t) => !t)} />
            <span className="text-[13px]">
              <b>Apply tax / VAT</b>
              <span className="block text-[11.5px]" style={{ color: settingsTax <= 0 && taxOn ? 'var(--amber)' : 'var(--text-faint)' }}>
                {!taxOn ? 'Off — no tax charged'
                  : settingsTax > 0 ? `Charging ${settingsTax}% on this GRN`
                  : 'Tax rate is 0% — set it in Settings'}
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="mb-5">
        <Field label="Supplier" req hint="Who you are buying stock from">
          <SearchSelect
            items={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            allLabel="Select supplier…"
            placeholder="Search name, code or mobile…"
            subtitle={(s) => `${s.code}${s.phone ? ` · ${s.phone}` : ''}`}
          />
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
              const it = items.find((x) => Number(x.id) === l.item_id);
              return (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <SearchSelect
                      items={items}
                      value={l.item_id}
                      onChange={(v) => pickItem(i, v)}
                      allLabel="Select item…"
                      placeholder="Search item name or code…"
                      subtitle={(x) => `${x.code} · stock ${fmt0(Number(x.stock))}`}
                    />
                    {it && <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>On hand: {fmt0(it.stock)} · last cost Rs {fmt(Number(it.distributor_price))}</div>}
                  </td>
                  <td className="p-1.5"><MoneyInput className="text-right" value={l.unit_price} onChange={(v) => setLine(i, { unit_price: v })} style={{ height: 36 }} /></td>
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

          {type === 'credit' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>Cheque details</div>
                <Button variant="subtle" size="sm" icon={<Plus size={13} />} onClick={addCheque}>Add cheque</Button>
              </div>
              {cheques.length === 0 ? (
                <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>No cheques. Use “Add cheque” to record cheques given to the supplier.</div>
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
                    Recorded for reference — clear them later in Outstanding. Total: Rs {fmt(cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <TotalRow k="Subtotal" v={fmt(totals.subtotal)} />
          {/* Tax row only exists when tax is actually applied. */}
          {taxRate > 0 && <TotalRow k={`Tax / VAT (${taxRate}%)`} v={fmt(totals.taxAmt)} />}
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
  const { settings } = useSettings();
  const [data, setData] = useState<Grn>(grn);
  useEffect(() => { void http.get(`/api/grns/${grn.id}`).then((r) => setData(r.data.data)); }, [grn.id]);
  const st = statusBadge(data.status);
  const bal = Number(data.total) - Number(data.paid);
  return (
    <Modal
      title={<span className="flex items-center gap-2.5">{data.no} <Badge kind={data.type === 'cash' ? 'blue' : 'amber'}>{data.type === 'cash' ? 'Cash' : 'Credit'}</Badge></span>}
      onClose={onClose}
      footer={<><Button variant="ghost" icon={<Printer size={15} />} onClick={() => printGrnDoc(data, settings)}>Print / PDF</Button><Button variant="primary" onClick={onClose}>Close</Button></>}
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
          {Number(data.tax_rate) > 0 && <TotalRow k={`Tax (${data.tax_rate}%)`} v={fmt(data.tax_amount as number)} />}
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
