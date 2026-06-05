import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { toast } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchBar, Empty, Avatar } from '@/components/ui/Common';
import { Modal, Confirm } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea, MoneyInput } from '@/components/ui/Field';
import type { Customer } from '@/types';

const TYPES = ['Pharmacy', 'Hospital', 'Chain', 'Clinic', 'Wholesaler'];

interface CusForm {
  code: string; name: string; contact: string; phone: string; email: string;
  address: string; type: string; credit_limit: string;
}

const nextCustomerCode = (rows: Customer[]): string => {
  const max = rows.reduce((m, c) => Math.max(m, parseInt(c.code.replace(/\D/g, ''), 10) || 0), 1000);
  return 'CUS-' + String(max + 1);
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const load = () => http.get('/api/customers', { params: { q } }).then((r) => setRows(r.data.data));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const totalRecv = rows.reduce((s, c) => s + Number(c.balance), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Customer Master"
        sub={`${rows.length} customers · Rs ${fmt0(totalRecv)} total receivable.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Customer</Button>}
      />
      <div className="flex gap-2.5 mb-4 flex-wrap"><SearchBar value={q} onChange={setQ} placeholder="Search customers…" /></div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Customer</th><th>Contact</th><th>Type</th><th>Credit usage</th><th className="num">Outstanding</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const bal = Number(c.balance), lim = Number(c.credit_limit);
              const pct = lim ? Math.min(100, (bal / lim) * 100) : 0;
              const over = bal > lim;
              return (
                <tr key={c.id}>
                  <td className="mono font-semibold">{c.code}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{c.address}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">{c.contact}</div>
                    <div className="text-[12px] mono" style={{ color: 'var(--text-muted)' }}>{c.phone}</div>
                  </td>
                  <td><Badge kind="gray">{c.type}</Badge></td>
                  <td style={{ minWidth: 150 }}>
                    <div className="flex justify-between text-[11.5px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span className="mono">{fmt0(bal)}</span><span className="mono">/ {fmt0(lim)}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${pct}%`, background: over ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--accent)' }} /></div>
                  </td>
                  <td className="num">
                    <span className="money font-bold" style={{ color: bal > 0 ? 'var(--text)' : 'var(--text-faint)' }}>
                      {bal > 0 ? fmt0(bal) : '—'}
                    </span>
                  </td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(c)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleting(c)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon={<Users size={40} />} title="No customers found" />}
      </div>

      {editing && (
        <CustomerModal
          rec={editing === 'new' ? null : editing}
          nextCode={nextCustomerCode(rows)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
      {deleting && (
        <Confirm
          title="Delete customer?" danger confirmLabel="Delete"
          message={<>Remove <strong>{deleting.name}</strong>?</>}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try { await http.delete(`/api/customers/${deleting.id}`); toast('Customer deleted'); void load(); }
            catch (e) { toast(apiErrorMessage(e), 'err'); }
          }}
        />
      )}
    </div>
  );
}

function CustomerModal({ rec, nextCode, onClose, onSaved }: { rec: Customer | null; nextCode: string; onClose: () => void; onSaved: () => void }) {
  const isNew = !rec;
  const [f, setF] = useState<CusForm>(() => rec
    ? { code: rec.code, name: rec.name, contact: rec.contact ?? '', phone: rec.phone ?? '', email: rec.email ?? '', address: rec.address ?? '', type: rec.type, credit_limit: String(rec.credit_limit) }
    : { code: nextCode, name: '', contact: '', phone: '', email: '', address: '', type: 'Pharmacy', credit_limit: '' });
  const [busy, setBusy] = useState(false);
  const valid = f.code.trim() && f.name.trim();

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        code: f.code.trim(), name: f.name.trim(),
        contact: f.contact.trim() || null, phone: f.phone.trim() || null,
        email: f.email.trim() || null, address: f.address.trim() || null,
        type: f.type, credit_limit: Number(f.credit_limit) || 0,
      };
      if (isNew) await http.post('/api/customers', payload);
      else await http.put(`/api/customers/${rec!.id}`, payload);
      toast(isNew ? 'Customer created' : 'Customer updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={(isNew ? 'Add ' : 'Edit ') + 'Customer'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req hint="Auto-generated — editable."><Input className="mono" value={f.code} disabled={!isNew} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Customer name" req><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. City Care Pharmacy" /></Field>
        <Field label="Contact person"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <Field label="Phone"><Input className="mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Customer type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Address" full><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Credit limit (LKR)" full hint="Maximum outstanding allowed for credit invoices.">
          <MoneyInput value={f.credit_limit} onChange={(v) => setF({ ...f, credit_limit: v })} />
        </Field>
      </div>
    </Modal>
  );
}
