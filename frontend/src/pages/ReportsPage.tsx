import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, FileText, Printer } from 'lucide-react';
import { http } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Segmented, Empty } from '@/components/ui/Common';
import { Input } from '@/components/ui/Field';
import { useSettings } from '@/store/settings';
import type { Customer, Supplier, Settlement, ChequeRecord, GrnChequeRecord, Grn, Invoice } from '@/types';

type Side = 'customer' | 'supplier';
// "Advance" = the up-front "amount paid now" captured on a credit invoice / GRN.
const MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Card', 'Online', 'Advance'] as const;

interface ReportRow {
  id: string;
  date: string;
  ref: string;       // invoice / GRN no, or receipt code (RCP / PAY)
  party: string;
  mode: string;
  chequeNo: string | null;
  chequeDate: string | null;
  qty: number | null;    // supplier side only — units on the linked GRN
  grnId: number | null;  // supplier side — to total quantity per distinct GRN
  amount: number;
}

export default function ReportsPage() {
  const { settings } = useSettings();
  const [side, setSide] = useState<Side>('customer');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [grnCheques, setGrnCheques] = useState<GrnChequeRecord[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receivables, setReceivables] = useState<Customer[]>([]);
  const [payables, setPayables] = useState<Supplier[]>([]);

  const [partyId, setPartyId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ side: Side; partyId: number | ''; from: string; to: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const [{ data: cu }, { data: su }, { data: s }, { data: cq }, { data: gcq }, { data: g }, { data: o }, { data: inv }] = await Promise.all([
        http.get('/api/customers'), http.get('/api/suppliers'), http.get('/api/settlements'),
        http.get('/api/cheques'), http.get('/api/grn-cheques'), http.get('/api/grns'), http.get('/api/outstanding'), http.get('/api/invoices'),
      ]);
      setCustomers(cu.data); setSuppliers(su.data); setSettlements(s.data);
      setCheques(cq.data); setGrnCheques(gcq.data); setGrns(g.data);
      setReceivables(o.receivables); setPayables(o.payables); setInvoices(inv.data);
    })();
  }, []);

  const parties = side === 'customer' ? customers : suppliers;

  const switchSide = (v: Side) => { setSide(v); setPartyId(''); setApplied(null); };

  // Units per GRN (supplier rows show quantity bought on the linked GRN).
  const grnQty = useMemo(() => {
    const m = new Map<number, number>();
    for (const g of grns) m.set(g.id, (g.lines ?? []).reduce((acc, l) => acc + Number(l.qty), 0));
    return m;
  }, [grns]);

  const report = useMemo(() => {
    if (!applied) return null;
    const isCust = applied.side === 'customer';
    const sideKey = isCust ? 'receivable' : 'payable';

    const inRange = (d?: string | null) => {
      if (!d) return false;
      const day = String(d).slice(0, 10);
      if (applied.from && day < applied.from) return false;
      if (applied.to && day > applied.to) return false;
      return true;
    };
    const partyOk = (cid?: number | null, sid?: number | null) =>
      applied.partyId === '' ? true : (isCust ? cid === applied.partyId : sid === applied.partyId);

    const rows: ReportRow[] = [];

    // Settlements (receipts / payments) by payment mode.
    settlements
      .filter((s) => s.side === sideKey && inRange(String(s.date)) && partyOk(s.customer_id, s.supplier_id))
      .forEach((s) => rows.push({
        id: `set-${s.id}`,
        date: String(s.date).slice(0, 10),
        ref: s.code,
        party: s.customer?.name ?? s.supplier?.name ?? '—',
        mode: s.mode,
        chequeNo: s.mode === 'Cheque' ? (s.reference ?? s.cheques?.[0]?.cheque_no ?? null) : null,
        chequeDate: s.mode === 'Cheque' ? (s.cheque_date ?? null) : null,
        qty: null, grnId: null,
        amount: Number(s.amount),
      }));

    // Cleared cheques recorded straight on invoices / GRNs (collections too), plus
    // the up-front advance ("amount paid now") stored on the credit document.
    if (isCust) {
      cheques
        .filter((c) => c.cleared && inRange(c.cheque_date) && partyOk(c.customer_id, null))
        .forEach((c) => rows.push({
          id: `inv-${c.id}`, date: String(c.cheque_date).slice(0, 10), ref: c.invoice_no, party: c.customer_name,
          mode: 'Cheque', chequeNo: c.cheque_no, chequeDate: c.cheque_date, qty: null, grnId: null, amount: Number(c.amount),
        }));

      invoices
        .filter((i) => i.type === 'credit' && inRange(i.date) && partyOk(i.customer_id, null))
        .forEach((i) => {
          const advance = Number(i.advance ?? 0);
          if (advance > 0) rows.push({
            id: `adv-inv-${i.id}`, date: String(i.date).slice(0, 10), ref: i.no, party: i.customer?.name ?? '—',
            mode: 'Advance', chequeNo: null, chequeDate: null, qty: null, grnId: null, amount: advance,
          });
        });
    } else {
      grnCheques
        .filter((c) => c.cleared && inRange(c.cheque_date) && partyOk(null, c.supplier_id))
        .forEach((c) => rows.push({
          id: `grn-${c.id}`, date: String(c.cheque_date).slice(0, 10), ref: c.grn_no, party: c.supplier_name,
          mode: 'Cheque', chequeNo: c.cheque_no, chequeDate: c.cheque_date, qty: grnQty.get(c.grn_id) ?? null, grnId: c.grn_id, amount: Number(c.amount),
        }));

      grns
        .filter((g) => g.type === 'credit' && inRange(g.date) && partyOk(null, g.supplier_id))
        .forEach((g) => {
          const advance = Number(g.advance ?? 0);
          if (advance > 0) rows.push({
            id: `adv-grn-${g.id}`, date: String(g.date).slice(0, 10), ref: g.no, party: g.supplier?.name ?? '—',
            mode: 'Advance', chequeNo: null, chequeDate: null, qty: grnQty.get(g.id) ?? null, grnId: g.id, amount: advance,
          });
        });
    }

    rows.sort((a, b) => b.date.localeCompare(a.date));

    const byMode = MODES.map((m) => {
      const r = rows.filter((row) => row.mode === m);
      return { mode: m, total: r.reduce((s, x) => s + x.amount, 0), count: r.length };
    });
    const total = rows.reduce((s, r) => s + r.amount, 0);
    // Quantity counts each GRN once even if it has several payment rows.
    const grnIds = new Set<number>();
    rows.forEach((r) => { if (r.grnId != null) grnIds.add(r.grnId); });
    const totalQty = [...grnIds].reduce((s, id) => s + (grnQty.get(id) ?? 0), 0);

    const outFor = (p?: Customer | Supplier) => !p ? 0
      : (isCust ? Number((p as Customer).credit_limit) + Number((p as Customer).balance) : Number((p as Supplier).payable));
    const outstanding = applied.partyId === ''
      ? (isCust ? receivables : payables).reduce((s, p) => s + outFor(p), 0)
      : outFor((isCust ? receivables : payables).find((x) => x.id === applied.partyId));

    const partyName = applied.partyId === ''
      ? `All ${isCust ? 'customers' : 'suppliers'}`
      : (parties.find((p) => p.id === applied.partyId)?.name ?? '—');

    return { rows, byMode, total, totalQty, outstanding, isCust, partyName };
  }, [applied, settlements, cheques, grnCheques, grns, invoices, grnQty, receivables, payables, parties]);

  const periodLabel = applied
    ? (applied.from || applied.to ? `${applied.from ? prettyDate(applied.from) : '…'} → ${applied.to ? prettyDate(applied.to) : '…'}` : 'All dates')
    : '';

  const generate = () => {
    if (!report) return;
    const w = window.open('', '_blank', 'width=940,height=720');
    if (!w) return;
    const moneyHdr = report.isCust ? 'Collected' : 'Paid';
    const head = `<th>Date</th><th>${report.isCust ? 'Receipt / Invoice' : 'Payment / GRN'}</th><th>Party</th><th>Mode</th>${report.isCust ? '' : '<th class="r">Qty</th>'}<th class="r">${moneyHdr} (Rs)</th>`;
    const body = report.rows.map((r) => `<tr>
      <td>${prettyDate(r.date)}</td>
      <td>${r.ref}</td>
      <td>${r.party}</td>
      <td>${r.mode}${r.chequeNo ? ` · ${r.chequeNo}` : ''}${r.chequeDate ? ` (${prettyDate(r.chequeDate)})` : ''}</td>
      ${report.isCust ? '' : `<td class="r">${r.qty ?? '—'}</td>`}
      <td class="r">${fmt(r.amount)}</td></tr>`).join('');
    const modeSummary = report.byMode.filter((m) => m.count > 0)
      .map((m) => `<span class="chip">${m.mode}: Rs ${fmt(m.total)}</span>`).join(' ');
    const cols = report.isCust ? 5 : 6;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Report</title>
      <style>
        *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
        body{margin:32px;color:#1c1f26}
        h1{font-size:18px;margin:0 0 2px} .sub{color:#666;font-size:12px;margin-bottom:14px}
        .meta{font-size:12.5px;margin:10px 0 16px} .meta b{display:inline-block;min-width:90px;color:#666;font-weight:600}
        .chips{margin:6px 0 16px} .chip{display:inline-block;background:#f1f2f4;border-radius:20px;padding:3px 10px;font-size:11.5px;margin:0 4px 4px 0}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #eceef0}
        th{background:#f7f8f9;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:#888}
        .r{text-align:right}
        tfoot td{font-weight:700;border-top:2px solid #d8dbdf;border-bottom:none}
        .out{margin-top:14px;font-size:13px} .out b{color:#b42318}
      </style></head><body>
      <h1>${settings.company || 'Distributor'} — ${report.isCust ? 'Customer' : 'Supplier'} ${report.isCust ? 'collection' : 'payment'} report</h1>
      <div class="sub">Generated ${prettyDate(new Date().toISOString())}</div>
      <div class="meta"><div><b>Party</b> ${report.partyName}</div><div><b>Period</b> ${periodLabel}</div></div>
      <div class="chips">${modeSummary || '<span class="chip">No transactions</span>'}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols}" style="text-align:center;color:#999;padding:18px">No transactions in this period</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${report.isCust ? 4 : 4}">Total ${moneyHdr.toLowerCase()}</td>${report.isCust ? '' : `<td class="r">${report.totalQty || '—'}</td>`}<td class="r">Rs ${fmt(report.total)}</td></tr></tfoot></table>
      <div class="out">Current outstanding ${report.isCust ? 'receivable' : 'payable'}: <b>Rs ${fmt(report.outstanding)}</b></div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fade-in">
      <PageHead title="Reports" sub="Collection & payment reports by party and date range — for customers and suppliers." />

      <div className="flex gap-2.5 mb-4 items-center">
        <Segmented
          accent
          value={side}
          onChange={(v) => switchSide(v as Side)}
          options={[{ value: 'customer', label: 'Customers' }, { value: 'supplier', label: 'Suppliers' }]}
        />
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div style={{ width: 300 }}>
            <div className="text-[12px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>{side === 'customer' ? 'Customer' : 'Supplier'}</div>
            <PartyPicker parties={parties} value={partyId} onChange={setPartyId} allLabel={`All ${side === 'customer' ? 'customers' : 'suppliers'}`} />
          </div>
          <div>
            <div className="text-[12px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>From</div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ height: 38, width: 165 }} />
          </div>
          <div>
            <div className="text-[12px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>To</div>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ height: 38, width: 165 }} />
          </div>
          <Button variant="primary" onClick={() => setApplied({ side, partyId, from, to })}>Apply</Button>
          {applied && <Button variant="ghost" onClick={() => { setPartyId(''); setFrom(''); setTo(''); setApplied(null); }}>Reset</Button>}
        </div>
      </div>

      {!report ? (
        <div className="card"><Empty icon={<FileText size={40} />} title="Choose filters and apply" sub="Pick a party (or all), an optional date range, then press Apply to build the report." /></div>
      ) : (
        <>
          {/* Mode summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {report.byMode.map((m) => (
              <div key={m.mode} className="card p-3.5">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{m.mode}</div>
                <div className="mono text-[17px] font-extrabold mt-1">Rs {fmt0(m.total)}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.count} {m.count === 1 ? 'txn' : 'txns'}</div>
              </div>
            ))}
          </div>

          {/* Detail table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="text-[14.5px] font-bold">{report.isCust ? 'Collection' : 'Payment'} details</div>
                <span className="chip">{report.partyName}</span>
                <span className="chip">{periodLabel}</span>
              </div>
              <span className="chip">{report.rows.length} records</span>
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{report.isCust ? 'Receipt / Invoice' : 'Payment / GRN'}</th>
                    <th>Party</th>
                    <th>Mode</th>
                    {!report.isCust && <th className="num">Qty</th>}
                    <th className="num">{report.isCust ? 'Collected' : 'Paid'}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{prettyDate(r.date)}</td>
                      <td className="mono font-semibold">{r.ref}</td>
                      <td className="font-medium">{r.party}</td>
                      <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {r.mode}{r.chequeNo ? ` · ${r.chequeNo}` : ''}{r.chequeDate ? ` (${prettyDate(r.chequeDate)})` : ''}
                      </td>
                      {!report.isCust && <td className="num mono">{r.qty ?? '—'}</td>}
                      <td className="num money font-bold">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.rows.length === 0 && <Empty icon={<FileText size={40} />} title="No transactions" sub="No collections/payments for this party in the selected period." />}

            {/* Footer: totals + outstanding + generate */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-t border-border bg-surface-2">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Total {report.isCust ? 'collected' : 'paid'}</div>
                  <div className="mono text-[18px] font-extrabold" style={{ color: 'var(--green)' }}>Rs {fmt(report.total)}</div>
                </div>
                {!report.isCust && (
                  <div>
                    <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Total qty</div>
                    <div className="mono text-[18px] font-extrabold">{report.totalQty || '—'}</div>
                  </div>
                )}
                <div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Outstanding {report.isCust ? 'receivable' : 'payable'}</div>
                  <div className="mono text-[18px] font-extrabold" style={{ color: 'var(--red)' }}>Rs {fmt(report.outstanding)}</div>
                </div>
              </div>
              <Button variant="primary" icon={<Printer size={15} />} onClick={generate}>Generate report</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Searchable party selector — type to match by name or mobile, or pick "All".
function PartyPicker({ parties, value, onChange, allLabel }: {
  parties: (Customer | Supplier)[];
  value: number | '';
  onChange: (v: number | '') => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = parties.find((p) => p.id === value);
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? parties.filter((p) => p.name.toLowerCase().includes(ql) || String(p.phone ?? '').toLowerCase().includes(ql))
    : parties;
  const pick = (v: number | '') => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative" style={{ width: 300 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center justify-between text-left w-full" style={{ height: 38, backgroundImage: 'none', paddingRight: 12 }}>
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>{selected ? selected.name : allLabel}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)' }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input autoFocus className="input" style={{ height: 34, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or mobile…" />
            </div>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }} className="py-1">
            <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2" style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}>{allLabel}</button>
            {filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(Number(p.id))} className="w-full text-left px-3 py-2 hover:bg-surface-2" style={{ background: p.id === value ? 'var(--surface-2)' : undefined }}>
                <div className="text-[13px] font-medium">{p.name}</div>
                <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{p.code}{p.phone ? ` · ${p.phone}` : ''}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
