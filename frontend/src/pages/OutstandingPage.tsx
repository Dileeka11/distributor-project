import { useEffect, useState } from 'react';
import { Truck, Wallet, Scale, Check, Plus, X } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate, initials } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented, Stat, Empty, Avatar } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput, Input } from '@/components/ui/Field';
import type { ChequeRecord, Customer, GrnChequeRecord, Settlement, Supplier } from '@/types';

type Tab = 'receivable' | 'payable';

export default function OutstandingPage() {
  const [tab, setTab] = useState<Tab>('receivable');
  const [receivables, setReceivables] = useState<Customer[]>([]);
  const [payables, setPayables] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [grnCheques, setGrnCheques] = useState<GrnChequeRecord[]>([]);
  const [chequeQ, setChequeQ] = useState('');
  const [target, setTarget] = useState<{ side: Tab; rec: Customer | Supplier } | null>(null);

  const load = async () => {
    const [{ data: o }, { data: s }, { data: cq }, { data: gcq }] = await Promise.all([
      http.get('/api/outstanding'),
      http.get('/api/settlements'),
      http.get('/api/cheques'),
      http.get('/api/grn-cheques'),
    ]);
    setReceivables(o.receivables);
    setPayables(o.payables);
    setHistory(s.data);
    setCheques(cq.data);
    setGrnCheques(gcq.data);
  };
  useEffect(() => { void load(); }, []);

  // Unified cheque rows for the active tab: customer (invoice) cheques on
  // receivables, supplier (GRN) cheques on payables.
  const chequeRows = tab === 'payable'
    ? grnCheques.map((c) => ({ kind: 'grn' as const, id: c.id, ref: c.grn_no, party: c.supplier_name, no: c.cheque_no, date: c.cheque_date, amount: c.amount, total: c.grn_total, cleared: c.cleared }))
    : cheques.map((c) => ({ kind: 'invoice' as const, id: c.id, ref: c.invoice_no, party: c.customer_name, no: c.cheque_no, date: c.cheque_date, amount: c.amount, total: c.invoice_total, cleared: c.cleared }));

  const toggleChequeRow = async (r: typeof chequeRows[number]) => {
    const who = tab === 'payable' ? "supplier's payable" : "customer's outstanding";
    const ok = await confirmDelete({
      title: r.cleared ? 'Un-clear this cheque?' : 'Mark cheque as passed?',
      html: r.cleared
        ? `Reverse <b>${r.no || 'cheque'}</b> (Rs ${fmt0(Number(r.amount))})? Adds Rs ${fmt0(Number(r.amount))} back to ${r.party}'s ${who.replace("'s", '')}.`
        : `Cheque <b>${r.no || ''}</b> for <b>Rs ${fmt0(Number(r.amount))}</b> passed? Reduces ${r.party}'s ${who.replace("'s", '')} by Rs ${fmt0(Number(r.amount))}.`,
      confirmText: r.cleared ? 'Yes, reverse' : 'Yes, passed',
    });
    if (!ok) return;
    const url = r.kind === 'grn' ? `/api/grn-cheques/${r.id}/toggle` : `/api/cheques/${r.id}/toggle`;
    try {
      await http.post(url);
      toast(r.cleared ? 'Cheque reversed' : 'Cheque cleared');
      void load();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const totalRecv = receivables.reduce((s, c) => s + Number(c.credit_limit) + Number(c.balance), 0);
  const totalPay = payables.reduce((s, c) => s + Number(c.payable), 0);
  const rows = tab === 'receivable' ? receivables : payables;

  return (
    <div className="fade-in">
      <PageHead title="Outstanding & Settlement" sub="Track and clear credit dues — receivables from customers and payables to suppliers." />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total receivable" cur="Rs" value={compact(totalRecv)} icon={<Wallet size={18} />} tint="amber" foot={`${receivables.length} customers`} />
        <Stat label="Total payable" cur="Rs" value={compact(totalPay)} icon={<Truck size={18} />} tint="blue" foot={`${payables.length} suppliers`} />
        <Stat label="Net position" cur="Rs" value={compact(totalRecv - totalPay)} icon={<Scale size={18} />} tint={totalRecv - totalPay >= 0 ? 'green' : 'red'} foot={totalRecv - totalPay >= 0 ? 'net inflow expected' : 'net outflow'} />
      </div>

      <div className="flex gap-2.5 mb-4">
        <Segmented accent value={tab} onChange={setTab} options={[{ value: 'receivable', label: 'Receivables (Customers)' }, { value: 'payable', label: 'Payables (Suppliers)' }]} />
      </div>

      <div className="card overflow-hidden mb-6">
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
              const paid = isRec ? Number(cust.paid_total ?? 0) : 0;
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
        {rows.length === 0 && <Empty icon={<Check size={40} />} title="All settled" sub={`No outstanding ${tab === 'receivable' ? 'receivables' : 'payables'}.`} />}
      </div>

      <div className="card overflow-hidden mb-6">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="text-[14.5px] font-bold whitespace-nowrap">Cheque details</div>
            <Input value={chequeQ} onChange={(e) => setChequeQ(e.target.value)} placeholder="Search cheque no…" style={{ height: 34, width: 260 }} />
          </div>
          <span className="chip whitespace-nowrap">{chequeRows.filter((c) => !c.cleared).length} pending</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tab === 'payable' ? 'GRN' : 'Invoice'}</th><th>{tab === 'payable' ? 'Supplier' : 'Customer'}</th><th>Cheque No</th><th>Date</th>
              <th className="num">Value</th><th className="num">{tab === 'payable' ? 'GRN total' : 'Invoice total'}</th><th>Passed</th>
            </tr>
          </thead>
          <tbody>
            {chequeRows
              .filter((c) => {
                const q = chequeQ.trim().toLowerCase();
                if (!q) return true;
                return (c.no ?? '').toLowerCase().includes(q)
                  || (c.ref ?? '').toLowerCase().includes(q)
                  || (c.party ?? '').toLowerCase().includes(q);
              })
              .map((c) => (
              <tr key={c.id} style={c.cleared ? { background: 'var(--green-soft)' } : undefined}>
                <td className="mono font-semibold">{c.ref}</td>
                <td className="font-medium">{c.party}</td>
                <td className="mono">{c.no || '—'}</td>
                <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{c.date ? prettyDate(c.date) : '—'}</td>
                <td className="num money font-bold">{fmt(c.amount as number)}</td>
                <td className="num money" style={{ color: 'var(--text-muted)' }}>{fmt(c.total as number)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void toggleChequeRow(c)}
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
        {chequeRows.length === 0 && <Empty icon={<Check size={40} />} title="No cheques" sub={tab === 'payable' ? 'Cheques recorded on credit GRNs appear here.' : 'Cheques recorded on credit invoices appear here.'} />}
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-[14.5px] font-bold">Settlement history</div>
          <span className="chip">{history.length} records</span>
        </div>
        <div className="overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Receipt</th><th>Date</th><th>Party</th><th>Direction</th><th>Mode</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="mono font-semibold">{s.code}</td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{prettyDate(s.date)}</td>
                  <td className="font-semibold">{s.customer?.name ?? s.supplier?.name ?? '—'}</td>
                  <td><Badge kind={s.side === 'receivable' ? 'green' : 'blue'}>{s.side === 'receivable' ? 'Collected' : 'Paid out'}</Badge></td>
                  <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {s.mode}
                    {s.mode === 'Cheque' && (s.cheques?.length ?? 0) > 1
                      ? ` · ${s.cheques!.length} cheques`
                      : <>
                          {s.mode === 'Cheque' && s.reference ? ` · ${s.reference}` : ''}
                          {s.mode === 'Cheque' && s.cheque_date ? ` (${prettyDate(s.cheque_date)})` : ''}
                        </>}
                  </td>
                  <td className="num money font-bold">{fmt(s.amount as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {target && <SettleModal side={target.side} rec={target.rec} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); void load(); }} />}
    </div>
  );
}

interface ChequeRow { no: string; date: string; amount: string; }

function SettleModal({ side, rec, onClose, onSaved }: { side: Tab; rec: Customer | Supplier; onClose: () => void; onSaved: () => void }) {
  const outstanding = side === 'receivable'
    ? Number((rec as Customer).credit_limit) + Number((rec as Customer).balance)
    : Number((rec as Supplier).payable);
  const [amount, setAmount] = useState(String(outstanding));
  const [mode, setMode] = useState('Bank Transfer');
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
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
      await http.post('/api/settlements', {
        side, party_id: rec.id, amount: amt, mode,
        cheques: isCheque
          ? cheques.filter((c) => c.no.trim() || c.date || Number(c.amount) > 0)
          : [],
      });
      toast(side === 'receivable' ? 'Receipt recorded' : 'Payment recorded');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={(side === 'receivable' ? 'Collect payment — ' : 'Pay supplier — ') + rec.name}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={amt <= 0 || busy} onClick={save}>
          {side === 'receivable' ? 'Record receipt' : 'Record payment'} · Rs {fmt0(amt)}
        </Button>
      </>}
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
                  <Input placeholder="0.00" inputMode="decimal" value={c.amount} onChange={(e) => setCheque(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} className="mono text-right" style={{ height: 34, width: 110 }} />
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
    </Modal>
  );
}
