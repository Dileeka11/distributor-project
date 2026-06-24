import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Truck } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { SearchBar, Empty } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { Supplier } from '@/types';

interface SupForm {
  code: string; name: string; contact: string; phone: string; email: string; address: string; terms_days: string;
}

const nextSupplierCode = (rows: Supplier[]): string => {
  const max = rows.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0);
  return 'SUP-' + String(max + 1).padStart(3, '0');
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  const load = () => http.get('/api/suppliers', { params: { q } }).then((r) => setRows(r.data.data));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const totalPayable = rows.reduce((s, r) => s + Number(r.payable), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Supplier Master"
        sub={`${rows.length} suppliers · Rs ${fmt0(totalPayable)} total payable.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Supplier</Button>}
      />
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search suppliers…" />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Terms</th><th className="num">Payable</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
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
        {rows.length === 0 && <Empty icon={<Truck size={40} />} title="No suppliers found" />}
      </div>

      {editing && (
        <SupplierModal
          rec={editing === 'new' ? null : editing}
          nextCode={nextSupplierCode(rows)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
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
