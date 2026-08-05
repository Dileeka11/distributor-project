import { useEffect, useMemo, useState } from 'react';
import { Plus, Undo2, Wallet, PackageCheck, Trash2 } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, compact, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchBar, Empty, Stat, Pagination } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Customer, Invoice, ReturnableInvoice, ReturnableLine, SalesReturn } from '@/types';

/** What the operator has typed against one invoice line. */
interface Draft { qty: string; }

export default function SalesReturnsPage() {
  const [rows, setRows] = useState<SalesReturn[]>([]);
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(false);
  const [view, setView] = useState<SalesReturn | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const load = () => http.get('/api/sales-returns', { params: { q } }).then((r) => setRows(r.data.data));

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  useEffect(() => { setPage(1); }, [q, rows.length]);

  const paginated = useMemo(
    () => rows.slice((page - 1) * perPage, page * perPage),
    [rows, page, perPage],
  );

  const returnedTotal = rows.reduce((s, r) => s + Number(r.total), 0);
  const creditLeft = rows.reduce((s, r) => s + (Number(r.total) - Number(r.used ?? 0)), 0);

  const remove = async (rec: SalesReturn) => {
    if (!(await confirmDelete({
      title: 'Delete this return?',
      confirmText: 'Yes, delete it',
      html: `Delete <b>${rec.no}</b>? The credit it created goes with it. Stock is not affected.`,
    }))) return;
    try {
      await http.delete(`/api/sales-returns/${rec.id}`);
      toast('Sales return deleted');
      void load();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Sales Returns"
        sub={`${rows.length} returns · goods taken back off a customer invoice.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreate(true)}>New Return</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Returned value" cur="Rs" value={compact(returnedTotal)} icon={<Undo2 size={18} />} tint="amber" foot={`${rows.length} returns`} />
        <Stat label="Credit not yet used" cur="Rs" value={compact(creditLeft)} icon={<Wallet size={18} />} tint="blue" foot="comes off the next invoice" />
        <Stat label="Credit already applied" cur="Rs" value={compact(returnedTotal - creditLeft)} icon={<PackageCheck size={18} />} tint="green" foot="billed against later invoices" />
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search return no., invoice no. or customer…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Return</th><th>Date</th><th>Customer</th><th>Against invoice</th><th className="num">Items</th><th className="num">Value</th><th>Credit</th><th></th></tr></thead>
          <tbody>
            {paginated.map((r) => {
              const left = Number(r.total) - Number(r.used ?? 0);
              return (
                <tr key={r.id} className="row-click" onClick={() => setView(r)}>
                  <td className="mono font-semibold">{r.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(r.date)}</td>
                  <td className="font-semibold">{r.customer?.name ?? '—'}</td>
                  <td className="mono">{r.invoice?.no ?? '—'}</td>
                  <td className="num">{fmt0((r.lines ?? []).reduce((s, l) => s + Number(l.qty), 0))}</td>
                  <td className="num money font-bold">{fmt(r.total)}</td>
                  <td>
                    {left <= 0
                      ? <Badge kind="green" dot>Used</Badge>
                      : <Badge kind="blue" dot>Rs {fmt(left)} left</Badge>}
                  </td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} title="Delete return" onClick={() => void remove(r)} style={{ color: 'var(--red)' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty
            icon={<Undo2 size={40} />}
            title="No sales returns yet"
            sub="Take goods back off an invoice with New Return."
          />
        )}
        {rows.length > 0 && (
          <Pagination
            totalItems={rows.length}
            currentPage={page}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          />
        )}
      </div>

      {create && <CreateReturn onClose={() => setCreate(false)} onSaved={() => { setCreate(false); void load(); }} />}
      {view && <ViewReturn rec={view} onClose={() => setView(null)} />}
    </div>
  );
}

function CreateReturn({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState<number | ''>('');
  const [detail, setDetail] = useState<ReturnableInvoice | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void http.get('/api/customers').then((r) => setCustomers(r.data.data)); }, []);

  // The picker searches on `name`, so each invoice goes in under its number.
  const invoicePicks = useMemo(
    () => invoices.map((i) => ({
      id: Number(i.id),
      name: i.no,
      sub: `${prettyDate(i.date)} · Rs ${fmt(i.total)}`,
    })),
    [invoices],
  );

  // Picking a customer narrows the invoice list to theirs.
  useEffect(() => {
    setInvoiceId(''); setDetail(null); setDrafts({});
    if (customerId === '') { setInvoices([]); return; }
    void http.get('/api/sales-returns/customer-invoices', { params: { customer_id: customerId } })
      .then((r) => setInvoices(r.data.data));
  }, [customerId]);

  // Viewing an invoice pulls its lines already priced the way they were billed.
  useEffect(() => {
    setDetail(null); setDrafts({});
    if (invoiceId === '') return;
    void http.get(`/api/sales-returns/invoice/${invoiceId}`)
      .then((r) => setDetail(r.data.data))
      .catch((e) => toast(apiErrorMessage(e), 'err'));
  }, [invoiceId]);

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { qty: '' }), ...patch } }));

  const lineValue = (l: ReturnableLine) => {
    const qty = Number(drafts[Number(l.invoice_line_id)]?.qty) || 0;
    return round2(qty * l.unit_net);
  };
  const total = (detail?.lines ?? []).reduce((s, l) => s + lineValue(l), 0);

  const overQty = (detail?.lines ?? []).some((l) => {
    const qty = Number(drafts[Number(l.invoice_line_id)]?.qty) || 0;
    return qty > l.returnable_qty;
  });
  const picked = (detail?.lines ?? []).filter((l) => (Number(drafts[Number(l.invoice_line_id)]?.qty) || 0) > 0);
  const canSave = !!detail && picked.length > 0 && !overQty && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await http.post('/api/sales-returns', {
        invoice_id: invoiceId,
        note: note.trim() || null,
        lines: picked.map((l) => ({
          invoice_line_id: l.invoice_line_id,
          qty: Number(drafts[Number(l.invoice_line_id)]?.qty) || 0,
        })),
      });
      toast('Sales return saved');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      lg
      title="New Sales Return"
      onClose={onClose}
      footer={<>
        <span className="mr-auto text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Return value <b className="money" style={{ color: 'var(--text)', fontSize: 17 }}>Rs {fmt(total)}</b>
        </span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>Save Return</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Field label="Customer" req hint="Who is bringing the goods back">
          <SearchSelect
            items={customers}
            value={customerId}
            onChange={setCustomerId}
            allLabel="Select customer…"
            placeholder="Search name, code or mobile…"
            subtitle={(c) => `${c.code}${c.phone ? ` · ${c.phone}` : ''}`}
          />
        </Field>
        <Field label="Invoice" req hint="The bill the goods went out on">
          <SearchSelect
            items={invoicePicks}
            value={invoiceId}
            onChange={setInvoiceId}
            allLabel={customerId === '' ? 'Pick a customer first' : 'Select invoice…'}
            placeholder="Search invoice no.…"
            subtitle={(i) => i.sub}
          />
        </Field>
      </div>

      {detail && (
        <>
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[13px] font-semibold">Items on {detail.invoice.no}</div>
            {detail.discount_rate > 0 && (
              <Badge kind="amber">Invoice discount {detail.discount_rate}% — already in each price below</Badge>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {detail.lines.map((l) => {
              const id = Number(l.invoice_line_id);
              const d = drafts[id];
              const qty = Number(d?.qty) || 0;
              const over = qty > l.returnable_qty;
              const spent = l.returnable_qty <= 0;
              return (
                <div
                  key={id}
                  className="p-3 rounded-[10px] border"
                  style={{
                    borderColor: qty > 0 ? 'var(--accent)' : 'var(--border)',
                    background: spent ? 'var(--surface-2)' : 'var(--surface)',
                    opacity: spent ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-[13.5px]">{l.name}</div>
                      <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>
                        {l.code ?? '—'} · sold {fmt0(l.qty)} @ Rs {fmt(l.price)}
                        {l.discount_rate > 0 && <> · after {l.discount_rate}% = <b>Rs {fmt(l.unit_net)}</b> each</>}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {l.returned_qty > 0 ? `${fmt0(l.returned_qty)} already returned · ` : ''}
                        {spent ? 'nothing left to return' : `${fmt0(l.returnable_qty)} can still come back`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Return qty</div>
                        <Input
                          className="mono text-right"
                          inputMode="numeric"
                          style={{ width: 78, height: 32, borderColor: over ? 'var(--red)' : undefined }}
                          disabled={spent}
                          value={d?.qty ?? ''}
                          onChange={(e) => setDraft(id, { qty: e.target.value.replace(/\D/g, '') })}
                          placeholder="0"
                        />
                      </div>
                      <div className="text-right" style={{ minWidth: 96 }}>
                        <div className="text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Value</div>
                        <div className="money font-bold text-[15px]">{fmt(lineValue(l))}</div>
                      </div>
                    </div>
                  </div>

                  {over && (
                    <div className="text-[12px] mt-1.5" style={{ color: 'var(--red)' }}>
                      Only {fmt0(l.returnable_qty)} left to return on this invoice.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Field label="Note" hint="Why the goods came back (optional)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. wrong size delivered" />
            </Field>
          </div>

          <div className="mt-4 p-3 rounded-[10px] flex gap-2.5 items-start text-[12.5px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Wallet size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              This does not change invoice <b>{detail.invoice.no}</b>, and it does not touch stock —
              the goods are recorded on this return only. It becomes credit for{' '}
              <b>{detail.customer?.name}</b>, offered on their next invoice and taken off the bill
              after any discount.
            </span>
          </div>
        </>
      )}

      {!detail && (
        <Empty
          icon={<Undo2 size={40} />}
          title="Pick a customer and invoice"
          sub="The items on that invoice appear here, priced the way they were billed."
        />
      )}
    </Modal>
  );
}

function ViewReturn({ rec, onClose }: { rec: SalesReturn; onClose: () => void }) {
  const [data, setData] = useState<SalesReturn>(rec);
  useEffect(() => { void http.get(`/api/sales-returns/${rec.id}`).then((r) => setData(r.data.data)); }, [rec.id]);

  return (
    <Modal title={<span className="flex items-center gap-2.5">{data.no} <Badge kind="amber">Sales Return</Badge></span>} onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      <div className="flex justify-between mb-5">
        <div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Returned by</div>
          <div className="font-bold text-[15px]">{data.customer?.name}</div>
          <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>
            against {data.invoice?.no ?? '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Date</div>
          <div className="font-semibold">{prettyDate(data.date)}</div>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit value</th><th className="num">Value</th></tr></thead>
          <tbody>
            {(data.lines ?? []).map((l, i) => (
              <tr key={l.id ?? i}>
                <td>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{l.item?.code ?? ''}</div>
                </td>
                <td className="num">{fmt0(l.qty)}</td>
                <td className="num money">{fmt(Number(l.total) / (Number(l.qty) || 1))}</td>
                <td className="num money font-bold">{fmt(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.note && (
        <div className="text-[12.5px] mb-4" style={{ color: 'var(--text-muted)' }}>
          <b>Note:</b> {data.note}
        </div>
      )}

      <div className="flex justify-between items-baseline pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>Credit created</span>
        <span className="money font-extrabold text-[19px]">Rs {fmt(data.total)}</span>
      </div>
    </Modal>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
