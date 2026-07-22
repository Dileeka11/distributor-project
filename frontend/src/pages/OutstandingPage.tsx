import { useEffect, useRef, useState } from 'react';
import { Truck, Wallet, Scale, Check, Plus, X, Edit2, Trash2, ChevronDown, Search, Banknote, Printer } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate, initials } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented, Stat, Empty, Avatar } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput, Input } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useSettings } from '@/store/settings';
import { cn } from '@/lib/cn';
import type { ChequeRecord, Customer, GrnChequeRecord, ID, Settlement, SettlementChequeRecord, Supplier } from '@/types';

type Tab = 'receivable' | 'payable';

// One unified cheque row across invoice (customer) / GRN (supplier) / settlement
// sources, as rendered in the cheque-details table on the page and in the modal.
type ChequeTxnRow = {
  kind: 'grn' | 'invoice' | 'settlement';
  id: ID;
  partyId?: ID;
  ref: string;
  party: string;
  no: string | null;
  date: string | null;
  amount: string | number;
  total: string | number;
  cleared: boolean;
};

export default function OutstandingPage() {
  const [tab, setTab] = useState<Tab>('receivable');
  const [receivables, setReceivables] = useState<Customer[]>([]);
  const [payables, setPayables] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [grnCheques, setGrnCheques] = useState<GrnChequeRecord[]>([]);
  const [settlementCheques, setSettlementCheques] = useState<SettlementChequeRecord[]>([]);
  // Full party lists for the filter — so every customer / supplier is selectable,
  // not only those that currently carry an outstanding balance.
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [partyFilter, setPartyFilter] = useState<number | ''>('');
  const [target, setTarget] = useState<{ side: Tab; rec: Customer | Supplier } | null>(null);
  const [chequeReport, setChequeReport] = useState<Tab | null>(null);
  const [editTarget, setEditTarget] = useState<{ side: Tab; rec: Customer | Supplier; settlement: Settlement; outstanding: number } | null>(null);

  const load = async () => {
    const [{ data: o }, { data: s }, { data: cq }, { data: gcq }, { data: scq }, { data: cu }, { data: su }] = await Promise.all([
      http.get('/api/outstanding'),
      http.get('/api/settlements'),
      http.get('/api/cheques'),
      http.get('/api/grn-cheques'),
      http.get('/api/settlement-cheques'),
      http.get('/api/customers'),
      http.get('/api/suppliers'),
    ]);
    setReceivables(o.receivables);
    setPayables(o.payables);
    setHistory(s.data);
    setCheques(cq.data);
    setGrnCheques(gcq.data);
    setSettlementCheques(scq.data);
    setAllCustomers(cu.data);
    setAllSuppliers(su.data);
  };
  useEffect(() => { void load(); }, []);

  // Unified cheque rows for the active tab: customer (invoice) cheques on
  // receivables, supplier (GRN) cheques on payables, plus cheques captured while
  // settling outstanding (Collect / Pay) — referenced by their receipt code.
  // Number() the party ids: older PHP/MySQL stacks serialize them as strings.
  const txnRows = tab === 'payable'
    ? grnCheques.map((c) => ({ kind: 'grn' as const, id: c.id, partyId: Number(c.supplier_id), ref: c.grn_no, party: c.supplier_name, no: c.cheque_no, date: c.cheque_date, amount: c.amount, total: c.grn_total, cleared: c.cleared }))
    : cheques.map((c) => ({ kind: 'invoice' as const, id: c.id, partyId: Number(c.customer_id), ref: c.invoice_no, party: c.customer_name, no: c.cheque_no, date: c.cheque_date, amount: c.amount, total: c.invoice_total, cleared: c.cleared }));
  const settleRows = settlementCheques
    .filter((c) => c.side === tab)
    .map((c) => {
      const pid = tab === 'payable' ? c.supplier_id : c.customer_id;
      return { kind: 'settlement' as const, id: c.id, partyId: pid == null ? undefined : Number(pid), ref: c.settlement_code, party: c.party_name ?? '—', no: c.cheque_no, date: c.cheque_date, amount: c.amount, total: c.settlement_amount, cleared: c.cleared };
    });
  const allChequeRows: ChequeTxnRow[] = [...txnRows, ...settleRows];

  const toggleChequeRow = async (r: ChequeTxnRow) => {
    const isSettlement = r.kind === 'settlement';
    const who = tab === 'payable' ? "supplier's payable" : "customer's outstanding";
    const ok = await confirmDelete({
      title: r.cleared ? (isSettlement ? 'Mark cheque as not passed?' : 'Un-clear this cheque?') : 'Mark cheque as passed?',
      html: isSettlement
        ? (r.cleared
            ? `Mark <b>${r.no || 'cheque'}</b> on receipt <b>${r.ref}</b> as not passed? Removes Rs ${fmt0(Number(r.amount))} from ${r.party}'s paid and restores their outstanding.`
            : `Mark <b>${r.no || 'cheque'}</b> (Rs ${fmt0(Number(r.amount))}) on receipt <b>${r.ref}</b> as passed? Adds Rs ${fmt0(Number(r.amount))} to ${r.party}'s paid and reduces their outstanding.`)
        : (r.cleared
            ? `Reverse <b>${r.no || 'cheque'}</b> (Rs ${fmt0(Number(r.amount))})? Adds Rs ${fmt0(Number(r.amount))} back to ${r.party}'s ${who.replace("'s", '')}.`
            : `Cheque <b>${r.no || ''}</b> for <b>Rs ${fmt0(Number(r.amount))}</b> passed? Reduces ${r.party}'s ${who.replace("'s", '')} by Rs ${fmt0(Number(r.amount))}.`),
      confirmText: r.cleared ? (isSettlement ? 'Yes, not passed' : 'Yes, reverse') : 'Yes, passed',
    });
    if (!ok) return;
    const url = r.kind === 'grn' ? `/api/grn-cheques/${r.id}/toggle`
      : r.kind === 'settlement' ? `/api/settlement-cheques/${r.id}/toggle`
      : `/api/cheques/${r.id}/toggle`;
    try {
      await http.post(url);
      toast(r.cleared ? (isSettlement ? 'Cheque marked not passed' : 'Cheque reversed') : 'Cheque cleared');
      void load();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const totalRecv = receivables.reduce((s, c) => s + Number(c.credit_limit) + Number(c.balance), 0);
  const totalPay = payables.reduce((s, c) => s + Number(c.payable), 0);
  const parties = tab === 'receivable' ? receivables : payables;
  const comboParties = tab === 'receivable' ? allCustomers : allSuppliers; // every party, for the filter
  const rows = parties.filter((r) => partyFilter === '' || r.id === partyFilter);
  const historyRows = history.filter((s) => {
    if (s.side !== tab) return false; // customer vs supplier settlements are kept separate
    if (partyFilter === '') return true;
    return tab === 'payable' ? s.supplier_id === partyFilter : s.customer_id === partyFilter;
  });

  // A passed invoice (receivable) / GRN (payable) cheque is a collection too, but
  // it posts straight to the document instead of through a settlement. Surface the
  // cleared ones in the history (as full cheque rows) so they show their invoice +
  // cheque number and can be reversed — restoring the outstanding — from here.
  const chequeHist = allChequeRows.filter(
    (r) => (r.kind === 'invoice' || r.kind === 'grn') && r.cleared && (partyFilter === '' || r.partyId === partyFilter),
  );

  type HistItem = { kind: 'settlement'; date: string; s: Settlement } | { kind: 'cheque'; date: string; c: ChequeTxnRow };
  const histItems: HistItem[] = [
    ...historyRows.map((s) => ({ kind: 'settlement' as const, date: String(s.date), s })),
    ...chequeHist.map((c) => ({ kind: 'cheque' as const, date: c.date ?? '', c })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Reopen the Collect/Pay modal pre-filled. The party's available outstanding is
  // its current outstanding plus whatever this settlement already posted (since
  // editing reverses the old settlement before re-applying).
  const openEditSettlement = (s: Settlement) => {
    const side: Tab = s.side;
    const partyId = (side === 'receivable' ? s.customer_id : s.supplier_id) ?? undefined;
    const listed = (side === 'receivable' ? receivables : payables).find((r) => r.id === partyId);
    const baseOut = listed
      ? (side === 'receivable'
          ? Number((listed as Customer).credit_limit) + Number((listed as Customer).balance)
          : Number((listed as Supplier).payable))
      : 0;
    const appliedAmt = s.mode !== 'Cheque' ? Number(s.amount) : (s.passed ? Number(s.amount) : 0);
    const rec = listed ?? ({
      id: partyId, name: s.customer?.name ?? s.supplier?.name ?? '—',
      code: s.customer?.code ?? s.supplier?.code ?? '', credit_limit: 0, balance: 0, payable: 0,
    } as unknown as Customer | Supplier);
    setEditTarget({ side, rec, settlement: s, outstanding: baseOut + appliedAmt });
  };

  const deleteSettlement = async (s: Settlement) => {
    const ok = await confirmDelete({
      title: 'Delete settlement?',
      html: `Delete <b>${s.code}</b> (Rs ${fmt0(Number(s.amount))})? The whole settlement is removed and its effect on ${s.customer?.name ?? s.supplier?.name ?? 'the party'}'s outstanding is reversed.`,
    });
    if (!ok) return;
    try { await http.delete(`/api/settlements/${s.id}`); toast('Settlement deleted'); void load(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Outstanding & Settlement"
        sub="Track and clear credit dues — receivables from customers and payables to suppliers."
        actions={
          <>
            <Button variant="subtle" icon={<Banknote size={16} />} onClick={() => setChequeReport('receivable')}>Customer cheques</Button>
            <Button variant="subtle" icon={<Banknote size={16} />} onClick={() => setChequeReport('payable')}>Supplier cheques</Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total receivable" cur="Rs" value={compact(totalRecv)} icon={<Wallet size={18} />} tint="amber" foot={`${receivables.length} customers`} />
        <Stat label="Total payable" cur="Rs" value={compact(totalPay)} icon={<Truck size={18} />} tint="blue" foot={`${payables.length} suppliers`} />
        <Stat label="Net position" cur="Rs" value={compact(totalRecv - totalPay)} icon={<Scale size={18} />} tint={totalRecv - totalPay >= 0 ? 'green' : 'red'} foot={totalRecv - totalPay >= 0 ? 'net inflow expected' : 'net outflow'} />
      </div>

      <div className="flex gap-2.5 mb-4 items-center">
        <Segmented accent value={tab} onChange={(v) => { setTab(v); setPartyFilter(''); }} options={[{ value: 'receivable', label: 'Receivables (Customers)' }, { value: 'payable', label: 'Payables (Suppliers)' }]} />
        <PartyCombo
          parties={comboParties}
          value={partyFilter}
          onChange={setPartyFilter}
          allLabel={`All ${tab === 'payable' ? 'suppliers' : 'customers'}`}
        />
      </div>

      <div className="card overflow-hidden mb-6">
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tab === 'receivable' ? 'Customer' : 'Supplier'}</th>
              <th>Contact</th>
              {tab === 'receivable' && <th>Paid / Outstanding</th>}
              <th className="num">Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isRec = tab === 'receivable';
              const cust = r as Customer;
              const paid = isRec ? Number(cust.paid_total ?? 0) + Number(cust.opening_collected ?? 0) : 0;
              const outstanding = isRec ? Number(cust.credit_limit) + Number(cust.balance) : Number((r as Supplier).payable);
              const payPct = isRec && paid + outstanding > 0 ? Math.min(100, (paid / (paid + outstanding)) * 100) : 0;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {tab === 'receivable'
                        ? <Avatar name={r.name} />
                        : <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Truck size={16} /></div>
                      }
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{r.code}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{r.contact}</div>
                    <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{r.phone}</div>
                  </td>
                  {isRec && (
                    <td style={{ minWidth: 160 }}>
                      <div className="flex justify-between text-[11.5px] mb-1.5">
                        <span className="mono" style={{ color: 'var(--green)' }}>{fmt0(paid)}</span>
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>{fmt0(outstanding)}</span>
                      </div>
                      <div className="bar"><span style={{ width: `${payPct}%`, background: 'var(--green)' }} /></div>
                    </td>
                  )}
                  <td className="num money font-bold" style={{ color: 'var(--red)' }}>{fmt(outstanding)}</td>
                  <td className="num">
                    <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={() => setTarget({ side: tab, rec: r })}>
                      {tab === 'receivable' ? 'Collect' : 'Pay'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {rows.length === 0 && <Empty icon={<Check size={40} />} title="All settled" sub={`No outstanding ${tab === 'receivable' ? 'receivables' : 'payables'}.`} />}
      </div>


      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-[14.5px] font-bold">{tab === 'payable' ? 'Supplier' : 'Customer'} settlement history</div>
          <span className="chip">{histItems.length} records</span>
        </div>
        <div style={{ maxHeight: 285, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Receipt / Invoice</th><th>Date</th><th>Party</th><th>Direction</th><th>Mode</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {histItems.map((it) => it.kind === 'settlement' ? (
                <tr key={`s-${it.s.id}`}>
                  <td className="mono font-semibold">{it.s.code}</td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{prettyDate(it.s.date)}</td>
                  <td className="font-semibold">{it.s.customer?.name ?? it.s.supplier?.name ?? '—'}</td>
                  <td><Badge kind={it.s.side === 'receivable' ? 'green' : 'blue'}>{it.s.side === 'receivable' ? 'Collected' : 'Paid out'}</Badge></td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-2">
                      <span>
                        {it.s.mode}
                        {it.s.mode === 'Cheque' && (it.s.cheques?.length ?? 0) > 1
                          ? ` · ${it.s.cheques!.length} cheques`
                          : <>
                              {it.s.mode === 'Cheque' && it.s.reference ? ` · ${it.s.reference}` : ''}
                              {it.s.mode === 'Cheque' && it.s.cheque_date ? ` (${prettyDate(it.s.cheque_date)})` : ''}
                            </>}
                      </span>
                      {it.s.mode === 'Cheque' && (it.s.cheques?.length ?? 0) > 0 && (
                        it.s.passed ? <Badge kind="green">Passed</Badge> : <Badge kind="amber">Not Passed</Badge>
                      )}
                    </span>
                  </td>
                  <td className="num money font-bold">{fmt(it.s.amount as number)}</td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => openEditSettlement(it.s)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void deleteSettlement(it.s)} />
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={`c-${it.c.kind}-${it.c.id}`} style={{ background: 'var(--green-soft)' }}>
                  <td className="mono font-semibold">
                    {it.c.ref}
                    <span className="chip ml-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{tab === 'payable' ? 'GRN cheque' : 'Invoice cheque'}</span>
                  </td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{it.c.date ? prettyDate(it.c.date) : '—'}</td>
                  <td className="font-semibold">{it.c.party}</td>
                  <td><Badge kind={tab === 'receivable' ? 'green' : 'blue'}>{tab === 'receivable' ? 'Collected' : 'Paid out'}</Badge></td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-2">
                      <span>Cheque{it.c.no ? ` · ${it.c.no}` : ''}{it.c.date ? ` (${prettyDate(it.c.date)})` : ''}</span>
                      <Badge kind="green">Passed</Badge>
                    </span>
                  </td>
                  <td className="num money font-bold">{fmt(it.c.amount as number)}</td>
                  <td className="num" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {chequeReport && (
        <PartyChequesModal
          side={chequeReport}
          parties={chequeReport === 'payable' ? allSuppliers : allCustomers}
          txnCheques={chequeReport === 'payable' ? grnCheques : cheques}
          settlementCheques={settlementCheques}
          onClose={() => setChequeReport(null)}
        />
      )}

      {target && (
        <SettleModal
          side={target.side}
          rec={target.rec}
          chequeRows={allChequeRows.filter((r) => r.partyId === Number(target.rec.id))}
          onToggleCheque={toggleChequeRow}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); void load(); }}
        />
      )}
      {editTarget && (
        <SettleModal
          side={editTarget.side}
          rec={editTarget.rec}
          editSettlement={editTarget.settlement}
          outstandingOverride={editTarget.outstanding}
          chequeRows={allChequeRows.filter((r) => r.partyId === Number(editTarget.rec.id))}
          onToggleCheque={toggleChequeRow}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); void load(); }}
        />
      )}
    </div>
  );
}

// All cheques for one side of the ledger — customer cheques received against
// invoices / receipts, or supplier cheques written against GRNs / payments —
// with a searchable party filter, pending / passed view and a print report.
function PartyChequesModal({ side, parties, txnCheques, settlementCheques, onClose }: {
  side: Tab;
  parties: (Customer | Supplier)[];
  txnCheques: ChequeRecord[] | GrnChequeRecord[];
  settlementCheques: SettlementChequeRecord[];
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const [partyId, setPartyId] = useState<number | ''>('');
  const [status, setStatus] = useState<'pending' | 'passed' | 'all'>('pending');

  const isPayable = side === 'payable';
  const partyWord = isPayable ? 'Supplier' : 'Customer';
  const allLabel = isPayable ? 'All suppliers' : 'All customers';
  const refHead = isPayable ? 'GRN / Pay total' : 'Invoice / Receipt total';
  const pendingLabel = isPayable ? 'To pay (pending)' : 'To receive (pending)';

  // Unify the transaction cheques (invoice / GRN) with settlement cheques.
  const rows = [
    ...txnCheques.map((c) => {
      const g = c as GrnChequeRecord;
      const i = c as ChequeRecord;
      return isPayable
        ? { key: `t${g.id}`, ref: g.grn_no, partyId: Number(g.supplier_id), party: g.supplier_name, no: g.cheque_no, date: g.cheque_date, amount: Number(g.amount), refTotal: Number(g.grn_total), cleared: g.cleared }
        : { key: `t${i.id}`, ref: i.invoice_no, partyId: Number(i.customer_id), party: i.customer_name, no: i.cheque_no, date: i.cheque_date, amount: Number(i.amount), refTotal: Number(i.invoice_total), cleared: i.cleared };
    }),
    ...settlementCheques.filter((c) => c.side === side).map((c) => ({
      key: `s${c.id}`, ref: c.settlement_code, partyId: Number((isPayable ? c.supplier_id : c.customer_id) ?? 0), party: c.party_name ?? '—',
      no: c.cheque_no, date: c.cheque_date, amount: Number(c.amount), refTotal: Number(c.settlement_amount), cleared: c.cleared,
    })),
  ]
    .filter((r) => (partyId === '' || r.partyId === partyId))
    .filter((r) => (status === 'all' ? true : status === 'passed' ? r.cleared : !r.cleared))
    // Oldest cheque date first — the ones due soonest at the top.
    .sort((a, b) => String(a.date ?? '9999').localeCompare(String(b.date ?? '9999')));

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pendingCount = rows.filter((r) => !r.cleared).length;

  // Print the filtered list — the browser dialog lets the user save as PDF.
  const printReport = () => {
    const w = window.open('', '_blank', 'width=840,height=900');
    if (!w) return;
    const title = `${partyWord} cheques`;
    const partyName = partyId === '' ? allLabel : (parties.find((p) => Number(p.id) === partyId)?.name ?? '');
    const statusLabel = status === 'pending' ? pendingLabel : status === 'passed' ? 'Passed' : 'All';
    const tr = rows.map((r) => `<tr>
      <td class="mono">${r.no ?? '—'}</td><td>${r.party}</td><td class="mono">${r.ref}</td>
      <td>${r.date ? prettyDate(r.date) : '—'}</td><td class="r">${fmt(r.amount)}</td>
      <td class="r">${fmt(r.refTotal)}</td><td>${r.cleared ? 'Passed' : 'Pending'}</td>
    </tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title} — ${partyName}</title>
      <style>
        *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
        body{margin:36px;color:#1c1f26} h1{font-size:19px;margin:0} .sub{color:#666;font-size:12px;margin-top:4px}
        table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:18px}
        th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#777;padding:7px 6px;border-bottom:2px solid #d8dce2}
        th.r,td.r{text-align:right} td{padding:7px 6px;border-bottom:1px solid #eef0f2}
        .mono{font-family:Consolas,monospace}
        .total{margin-top:14px;display:flex;justify-content:space-between;font-size:15px;font-weight:800}
      </style></head><body>
      <h1>${settings.company || 'Distributor'} — ${title}</h1>
      <div class="sub">${partyName} · ${statusLabel} · generated ${prettyDate(new Date().toISOString())}</div>
      <table>
        <thead><tr><th>Cheque No</th><th>${partyWord}</th><th>Against</th><th>Cheque date</th><th class="r">Value</th><th class="r">${refHead}</th><th>Status</th></tr></thead>
        <tbody>${tr || '<tr><td colspan="7">No cheques for this filter.</td></tr>'}</tbody>
      </table>
      <div class="total"><span>${rows.length} cheque${rows.length === 1 ? '' : 's'}</span><span>Rs ${fmt(total)}</span></div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Modal
      lg
      title={<span className="flex items-center gap-2.5"><Banknote size={20} style={{ color: isPayable ? 'var(--blue)' : 'var(--green)' }} /> {partyWord} cheques</span>}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3.5">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {rows.length} cheque{rows.length === 1 ? '' : 's'}{status === 'all' ? ` · ${pendingCount} pending` : ''}
            </span>
            <span className="text-[19px] font-extrabold mono">Rs {fmt(total)}</span>
          </div>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <SearchSelect
          items={parties}
          value={partyId}
          onChange={setPartyId}
          allLabel={allLabel}
          placeholder="Search name, code or mobile…"
          width={280}
          subtitle={(p) => `${p.code}${p.phone ? ` · ${p.phone}` : ''}`}
        />
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as 'pending' | 'passed' | 'all')}
          options={[{ value: 'pending', label: pendingLabel }, { value: 'passed', label: 'Passed' }, { value: 'all', label: 'All' }]}
        />
        <Button variant="subtle" icon={<Printer size={15} />} className="ml-auto" onClick={printReport}>Print / PDF</Button>
      </div>

      <div className="card overflow-hidden">
        <div style={{ maxHeight: 380, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Cheque No</th><th>{partyWord}</th><th>Against</th><th>Cheque date</th><th className="num">Value</th><th className="num">{refHead}</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="mono font-semibold">{r.no || '—'}</td>
                  <td className="font-semibold">{r.party}</td>
                  <td className="mono text-[12.5px]" style={{ color: 'var(--text-muted)' }}>{r.ref}</td>
                  <td className="text-[12.5px] whitespace-nowrap">{r.date ? prettyDate(r.date) : '—'}</td>
                  <td className="num money font-bold">{fmt(r.amount)}</td>
                  <td className="num money" style={{ color: 'var(--text-muted)' }}>{fmt(r.refTotal)}</td>
                  <td><Badge kind={r.cleared ? 'green' : 'amber'} dot>{r.cleared ? 'Passed' : 'Pending'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="text-center py-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>
            {status === 'pending' ? `No pending cheques to ${isPayable ? 'pay' : 'receive'}.` : 'No cheques found for this filter.'}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ChequeRow { no: string; date: string; amount: string; }

// Searchable party filter — type to match by name or mobile, or pick "All".
function PartyCombo({ parties, value, onChange, allLabel }: {
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
    <div ref={ref} className="relative ml-auto" style={{ width: 300 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="select flex items-center justify-between text-left"
        style={{ height: 38, backgroundImage: 'none', paddingRight: 12 }}
      >
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>
          {selected ? selected.name : allLabel}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)' }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input
                autoFocus
                className="input"
                style={{ height: 34, paddingLeft: 32 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or mobile…"
              />
            </div>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }} className="py-1">
            <button
              type="button"
              onClick={() => pick('')}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2"
              style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}
            >
              {allLabel}
            </button>
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(Number(p.id))}
                className="w-full text-left px-3 py-2 hover:bg-surface-2"
                style={{ background: p.id === value ? 'var(--surface-2)' : undefined }}
              >
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

// Cheque-details table shared by the Outstanding page and the Collect/Pay modal.
// Carries its own search box and the passed/clear toggle so "all functions" work
// identically wherever it is embedded.
function ChequeDetailsCard({ rows, tab, onToggle, maxHeight = 285, className }: {
  rows: ChequeTxnRow[];
  tab: Tab;
  onToggle: (r: ChequeTxnRow) => void;
  maxHeight?: number;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const filtered = rows.filter((c) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (c.no ?? '').toLowerCase().includes(query)
      || (c.ref ?? '').toLowerCase().includes(query)
      || (c.party ?? '').toLowerCase().includes(query);
  });

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="text-[14.5px] font-bold whitespace-nowrap">{tab === 'payable' ? 'Supplier' : 'Customer'} cheque details</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cheque no…" style={{ height: 34, width: 260 }} />
        </div>
        <span className="chip whitespace-nowrap">{rows.filter((c) => !c.cleared).length} pending</span>
      </div>
      <div style={{ maxHeight, overflow: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tab === 'payable' ? 'GRN / Payment' : 'Invoice / Receipt'}</th><th>{tab === 'payable' ? 'Supplier' : 'Customer'}</th><th>Cheque No</th><th>Date</th>
              <th className="num">Value</th><th className="num">{tab === 'payable' ? 'GRN total' : 'Invoice total'}</th><th>Passed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={`${c.kind}-${c.id}`} style={c.cleared ? { background: 'var(--green-soft)' } : undefined}>
                <td className="mono font-semibold">
                  {c.ref}
                  {c.kind === 'settlement' && <span className="chip ml-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Receipt</span>}
                </td>
                <td className="font-medium">{c.party}</td>
                <td className="mono">{c.no || '—'}</td>
                <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{c.date ? prettyDate(c.date) : '—'}</td>
                <td className="num money font-bold">{fmt(c.amount as number)}</td>
                <td className="num money" style={{ color: 'var(--text-muted)' }}>{fmt(c.total as number)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void onToggle(c)}
                    className="flex items-center gap-2 text-[13px]"
                    title={c.cleared ? 'Cleared — click to reverse' : 'Mark as cleared'}
                  >
                    <span className="grid place-items-center w-[18px] h-[18px] rounded-[5px] border flex-shrink-0"
                      style={{ background: c.cleared ? 'var(--green)' : 'var(--surface)', borderColor: c.cleared ? 'var(--green)' : 'var(--border-strong)' }}>
                      {c.cleared && <Check size={13} color="white" strokeWidth={3} />}
                    </span>
                    <span style={{ color: c.cleared ? 'var(--green)' : 'var(--text-muted)' }}>{c.cleared ? 'Cleared' : 'Pending'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty icon={<Check size={40} />} title="No cheques" sub={tab === 'payable' ? 'Cheques recorded on credit GRNs appear here.' : 'Cheques recorded on credit invoices appear here.'} />}
    </div>
  );
}

function SettleModal({ side, rec, editSettlement, outstandingOverride, chequeRows, onToggleCheque, onClose, onSaved }: {
  side: Tab; rec: Customer | Supplier; editSettlement?: Settlement | null; outstandingOverride?: number;
  chequeRows?: ChequeTxnRow[]; onToggleCheque?: (r: ChequeTxnRow) => void;
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editSettlement;
  const outstanding = outstandingOverride ?? (side === 'receivable'
    ? Number((rec as Customer).credit_limit) + Number((rec as Customer).balance)
    : Number((rec as Supplier).payable));
  const [amount, setAmount] = useState(isEdit ? String(Number(editSettlement!.amount)) : String(outstanding));
  const [mode, setMode] = useState(isEdit ? editSettlement!.mode : 'Bank Transfer');
  const [cheques, setCheques] = useState<ChequeRow[]>(
    isEdit
      ? (editSettlement!.cheques ?? []).map((c) => ({ no: c.cheque_no ?? '', date: c.cheque_date ? String(c.cheque_date).slice(0, 10) : '', amount: String(Number(c.amount)) }))
      : []
  );
  const [busy, setBusy] = useState(false);

  const isCheque = mode === 'Cheque';
  const chequeTotal = cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const amt = Math.min(isCheque ? chequeTotal : (Number(amount) || 0), outstanding);
  const remaining = outstanding - amt;

  const addCheque = () => setCheques((cs) => [...cs, { no: '', date: '', amount: '' }]);
  const delCheque = (i: number) => setCheques((cs) => cs.filter((_, idx) => idx !== i));
  const setCheque = (i: number, patch: Partial<ChequeRow>) =>
    setCheques((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const onModeChange = (m: string) => {
    setMode(m);
    // Seed the first cheque row with the outstanding amount for convenience.
    if (m === 'Cheque' && cheques.length === 0) setCheques([{ no: '', date: '', amount: amount }]);
  };

  const save = async () => {
    if (amt <= 0) return;
    setBusy(true);
    try {
      const payload = {
        side, party_id: rec.id, amount: amt, mode,
        cheques: isCheque
          ? cheques.filter((c) => c.no.trim() || c.date || Number(c.amount) > 0)
          : [],
      };
      if (isEdit) await http.put(`/api/settlements/${editSettlement!.id}`, payload);
      else await http.post('/api/settlements', payload);
      toast(isEdit ? 'Settlement updated' : (side === 'receivable' ? 'Receipt recorded' : 'Payment recorded'));
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title={(isEdit ? (side === 'receivable' ? 'Edit receipt — ' : 'Edit payment — ') : (side === 'receivable' ? 'Collect payment — ' : 'Pay supplier — ')) + rec.name}
      onClose={onClose}
      footer={(chequeRows?.length ?? 0) > 0 && onToggleCheque ? (
        <>
          <Button variant="primary" className="mr-auto" disabled={amt <= 0 || busy} onClick={save}>
            {isEdit ? 'Save changes' : (side === 'receivable' ? 'Record receipt' : 'Record payment')} · Rs {fmt0(amt)}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {/* Passed toggles already persist on click; this just confirms & closes
              the cheque section without recording an amount-based receipt. */}
          <Button variant="primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => { toast('Passed cheques saved'); onClose(); }}>
            Save passed cheque
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={amt <= 0 || busy} onClick={save}>
            {isEdit ? 'Save changes' : (side === 'receivable' ? 'Record receipt' : 'Record payment')} · Rs {fmt0(amt)}
          </Button>
        </>
      )}
    >
      <div className="rounded-[10px] p-4 mb-5 flex justify-between items-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Current outstanding</div>
          <div className="mono text-[22px] font-extrabold" style={{ color: 'var(--red)' }}>Rs {fmt(outstanding)}</div>
        </div>
        <div className="grid place-items-center w-11 h-11 rounded-[9px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{initials(rec.name)}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (LKR)" req hint={isCheque ? 'Sum of cheque values below.' : undefined}>
          {isCheque
            ? <Input className="mono" value={fmt(amt)} readOnly tabIndex={-1} style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            : <MoneyInput value={amount} onChange={setAmount} />}
        </Field>
        <Field label="Payment mode"><Select value={mode} onChange={(e) => onModeChange(e.target.value)}>{['Bank Transfer', 'Cash', 'Cheque', 'Card', 'Online'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
      </div>

      {isCheque && (
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
                  <Input type="date" value={c.date} onChange={(e) => setCheque(i, { date: e.target.value })} style={{ height: 34, width: 150 }} />
                  <MoneyInput value={c.amount} onChange={(v) => setCheque(i, { amount: v })} className="text-right" style={{ height: 34, width: 110 }} />
                  <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2 flex-shrink-0" onClick={() => delCheque(i)}><X size={14} /></button>
                </div>
              ))}
              <div className="text-[11.5px] mt-0.5" style={{ color: chequeTotal > outstanding ? 'var(--amber)' : 'var(--text-faint)' }}>
                Total cheques: Rs {fmt(chequeTotal)}{chequeTotal > outstanding ? ` · exceeds outstanding — will record Rs ${fmt(outstanding)}` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="h-px my-4" style={{ background: 'var(--border)' }} />
      <div className="flex justify-between text-[14px]">
        <span style={{ color: 'var(--text-muted)' }}>Remaining after settlement</span>
        <span className="money font-bold" style={{ color: remaining > 0 ? 'var(--amber)' : 'var(--green)' }}>Rs {fmt(remaining)}</span>
      </div>

      {chequeRows && onToggleCheque && (
        <ChequeDetailsCard rows={chequeRows} tab={side} onToggle={onToggleCheque} maxHeight={240} className="mt-5" />
      )}
    </Modal>
  );
}
