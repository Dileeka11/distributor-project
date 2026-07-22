import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Truck, Eye, Phone, Mail, MapPin, UserRound, CalendarClock } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Common';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { Grn, Supplier } from '@/types';

interface SupForm {
  code: string; name: string; contact: string; phone: string; email: string; address: string; terms_days: string;
}

const nextSupplierCode = (rows: Supplier[]): string => {
  const max = rows.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0);
  return 'SUP-' + String(max + 1).padStart(3, '0');
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const load = () => http.get('/api/suppliers').then((r) => setRows(r.data.data));
  useEffect(() => { void load(); }, []);

  const filtered = supplierId === '' ? rows : rows.filter((s) => Number(s.id) === supplierId);
  const totalPayable = rows.reduce((s, r) => s + Number(r.payable), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Supplier Master"
        sub={`${rows.length} suppliers · Rs ${fmt0(totalPayable)} total payable.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Supplier</Button>}
      />
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <SearchSelect items={rows} value={supplierId} onChange={setSupplierId} allLabel="All suppliers" placeholder="Search name, code or mobile…" width={300} subtitle={(s) => `${s.code}${s.phone ? ` · ${s.phone}` : ''}`} />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Terms</th><th className="num">Payable</th><th></th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="mono font-semibold">{s.code}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Truck size={16} /></div>
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{s.address}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="font-medium">{s.contact}</div>
                  <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{s.phone}</div>
                </td>
                <td><span className="chip" style={{ height: 24 }}>{s.terms_days} days</span></td>
                <td className="num">
                  <span className="money font-bold" style={{ color: Number(s.payable) > 0 ? 'var(--red)' : 'var(--text-faint)' }}>
                    {Number(s.payable) > 0 ? fmt0(s.payable as number) : '—'}
                  </span>
                </td>
                <td className="num">
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="subtle" size="sm" icon={<Eye size={14} />} title="View supplier" onClick={() => setViewing(s)} />
                    <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(s)} />
                    <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                      if (!(await confirmDelete({ title: 'Delete supplier?', html: `Remove <b>${s.name}</b>?` }))) return;
                      try { await http.delete(`/api/suppliers/${s.id}`); toast('Supplier deleted'); void load(); }
                      catch (e) { toast(apiErrorMessage(e), 'err'); }
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty icon={<Truck size={40} />} title="No suppliers found" />}
      </div>

      {editing && (
        <SupplierModal
          rec={editing === 'new' ? null : editing}
          nextCode={nextSupplierCode(rows)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}

      {viewing && (
        <SupplierViewModal
          sup={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setViewing(null); setEditing(viewing); }}
        />
      )}
    </div>
  );
}

// Read-only supplier card: profile details + the outstanding amount payable
// to this supplier, with the unpaid GRNs that make it up.
function SupplierViewModal({ sup, onClose, onEdit }: { sup: Supplier; onClose: () => void; onEdit: () => void }) {
  const [grns, setGrns] = useState<Grn[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void http.get('/api/grns')
      .then((r) => setGrns((r.data.data as Grn[]).filter((g) => Number(g.supplier_id) === Number(sup.id))))
      .finally(() => setLoaded(true));
  }, [sup.id]);

  const unpaid = grns.filter((g) => Number(g.total) - Number(g.paid) > 0);
  const payable = Number(sup.payable);

  const rows: { icon: typeof Phone; label: string; value: string | null }[] = [
    { icon: UserRound, label: 'Contact person', value: sup.contact },
    { icon: Phone, label: 'Phone', value: sup.phone },
    { icon: Mail, label: 'Email', value: sup.email },
    { icon: MapPin, label: 'Address', value: sup.address },
    { icon: CalendarClock, label: 'Payment terms', value: `${sup.terms_days} days` },
  ];

  return (
    <Modal
      lg
      title={
        <span className="flex items-center gap-3">
          <span className="grid place-items-center w-[38px] h-[38px] rounded-[10px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Truck size={18} /></span>
          <span>
            {sup.name}
            <span className="block text-[12px] mono font-medium" style={{ color: 'var(--text-muted)' }}>{sup.code}</span>
          </span>
        </span>
      }
      onClose={onClose}
      footer={<><Button variant="ghost" icon={<Edit2 size={15} />} onClick={onEdit}>Edit</Button><Button variant="primary" onClick={onClose}>Close</Button></>}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-2.5">
                <r.icon size={15} style={{ color: 'var(--text-faint)', marginTop: 2, flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{r.label}</div>
                  <div className="text-[13px] font-medium break-words">{r.value || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] p-4 flex flex-col justify-center items-center text-center"
          style={{ background: payable > 0 ? 'var(--red-soft, #fdecec)' : 'var(--green-soft)', border: '1px solid var(--border)' }}>
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Outstanding payable</div>
          <div className="mono text-[30px] font-extrabold" style={{ color: payable > 0 ? 'var(--red)' : 'var(--green)' }}>
            Rs {fmt(payable)}
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {payable > 0 ? `to be paid to ${sup.name}` : 'Nothing to pay — all settled.'}
          </div>
        </div>
      </div>

      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Unpaid purchases (GRN)</div>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>GRN</th><th>Date</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th></tr></thead>
          <tbody>
            {unpaid.map((g) => {
              const st = statusBadge(g.status);
              const bal = Number(g.total) - Number(g.paid);
              return (
                <tr key={g.id}>
                  <td className="mono font-semibold">{g.no}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{prettyDate(g.date)}</td>
                  <td className="num money">{fmt(Number(g.total))}</td>
                  <td className="num money">{fmt(Number(g.paid))}</td>
                  <td className="num money font-bold" style={{ color: 'var(--red)' }}>{fmt(bal)}</td>
                  <td><Badge kind={st.kind} dot>{st.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loaded && unpaid.length === 0 && (
          <div className="text-center py-6 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>No unpaid purchases for this supplier.</div>
        )}
      </div>
    </Modal>
  );
}

function SupplierModal({ rec, nextCode, onClose, onSaved }: { rec: Supplier | null; nextCode: string; onClose: () => void; onSaved: () => void }) {
  const isNew = !rec;
  const [f, setF] = useState<SupForm>(() => rec
    ? { code: rec.code, name: rec.name, contact: rec.contact ?? '', phone: rec.phone ?? '', email: rec.email ?? '', address: rec.address ?? '', terms_days: String(rec.terms_days) }
    : { code: nextCode, name: '', contact: '', phone: '', email: '', address: '', terms_days: '30' });
  const [busy, setBusy] = useState(false);
  const valid = f.code.trim() && f.name.trim();

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        code: f.code.trim(), name: f.name.trim(), contact: f.contact.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null, address: f.address.trim() || null,
        terms_days: Number(f.terms_days) || 0,
      };
      if (isNew) await http.post('/api/suppliers', payload);
      else await http.put(`/api/suppliers/${rec!.id}`, payload);
      toast(isNew ? 'Supplier created' : 'Supplier updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={(isNew ? 'Add ' : 'Edit ') + 'Supplier'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req hint="Auto-generated — editable."><Input className="mono" value={f.code} disabled={!isNew} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Supplier name" req><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Lanka Pharma Imports" /></Field>
        <Field label="Contact person"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <Field label="Phone"><Input className="mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Payment terms (days)"><Input className="mono" inputMode="numeric" value={f.terms_days} onChange={(e) => setF({ ...f, terms_days: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Address" full><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
