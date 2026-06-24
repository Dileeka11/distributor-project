import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchBar, Empty, Avatar } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea, MoneyInput } from '@/components/ui/Field';
import type { Customer, CustomerType } from '@/types';

interface CusForm {
  code: string; name: string; contact: string; phone: string; email: string;
  address: string; city: string; type: string;
  cash_discount: string; cheque_discount: string; terms_days: string;
  credit_limit: string; description: string;
}

const nextCustomerCode = (rows: Customer[]): string => {
  const max = rows.reduce((m, c) => Math.max(m, parseInt(c.code.replace(/\D/g, ''), 10) || 0), 1000);
  return 'CUS-' + String(max + 1);
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [types, setTypes] = useState<CustomerType[]>([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);

  const load = () => http.get('/api/customers', { params: { q, type: typeFilter === 'All' ? undefined : typeFilter } }).then((r) => setRows(r.data.data));
  const loadTypes = () => http.get('/api/customer-types').then((r) => setTypes(r.data.data));

  useEffect(() => { void loadTypes(); }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, typeFilter]);

  const totalOutstanding = rows.reduce((s, c) => s + Number(c.credit_limit) + Number(c.balance), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Customer Master"
        sub={`${rows.length} customers · Rs ${fmt0(totalOutstanding)} total outstanding.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Customer</Button>}
      />
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <SearchBar value={q} onChange={setQ} placeholder="Search customers…" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 200, height: 40 }}>
          <option value="All">All types</option>
          {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </Select>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Customer</th><th>Contact</th><th>City</th><th>Type</th><th>Paid / Outstanding</th><th className="num">Outstanding</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const bal = Number(c.balance), lim = Number(c.credit_limit);
              const paid = Number(c.paid_total ?? 0);
              const outstanding = lim + bal;
              const payPct = paid + outstanding > 0 ? Math.min(100, (paid / (paid + outstanding)) * 100) : 0;
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
                  <td>{c.city || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td><Badge kind="gray">{c.type}</Badge></td>
                  <td style={{ minWidth: 160 }}>
                    <div className="flex justify-between text-[11.5px] mb-1.5">
                      <span className="mono" style={{ color: 'var(--green)' }}>{fmt0(paid)}</span>
                      <span className="mono" style={{ color: 'var(--text-muted)' }}>{fmt0(outstanding)}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${payPct}%`, background: 'var(--green)' }} /></div>
                  </td>
                  <td className="num">
                    <span className="money font-bold" style={{ color: outstanding > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
                      {outstanding > 0 ? fmt0(outstanding) : '—'}
                    </span>
                  </td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(c)} />
                      <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                        if (!(await confirmDelete({ title: 'Delete customer?', html: `Remove <b>${c.name}</b>?` }))) return;
                        try { await http.delete(`/api/customers/${c.id}`); toast('Customer deleted'); void load(); }
                        catch (e) { toast(apiErrorMessage(e), 'err'); }
                      }} />
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
          types={types}
          onTypesChanged={loadTypes}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function CustomerModal({
  rec, nextCode, types, onTypesChanged, onClose, onSaved,
}: {
  rec: Customer | null; nextCode: string; types: CustomerType[];
  onTypesChanged: () => void | Promise<void>; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !rec;
  const [f, setF] = useState<CusForm>(() => rec
    ? {
        code: rec.code, name: rec.name, contact: rec.contact ?? '', phone: rec.phone ?? '',
        email: rec.email ?? '', address: rec.address ?? '', city: rec.city ?? '', type: rec.type ?? '',
        cash_discount: String(rec.cash_discount ?? ''), cheque_discount: String(rec.cheque_discount ?? ''),
        terms_days: String(rec.terms_days ?? ''), credit_limit: String(rec.credit_limit), description: rec.description ?? '',
      }
    : {
        code: nextCode, name: '', contact: '', phone: '', email: '', address: '', city: '',
        type: types[0]?.name ?? '', cash_discount: '', cheque_discount: '', terms_days: '', credit_limit: '', description: '',
      });
  const [busy, setBusy] = useState(false);
  const [mgrOpen, setMgrOpen] = useState(false);
  const valid = f.code.trim() && f.name.trim();

  // Keep the customer's current type selectable even if it's not in the managed list.
  const typeOptions = useMemo(() => {
    const names = types.map((t) => t.name);
    return f.type && !names.includes(f.type) ? [f.type, ...names] : names;
  }, [types, f.type]);

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        code: f.code.trim(), name: f.name.trim(),
        contact: f.contact.trim() || null, phone: f.phone.trim() || null,
        email: f.email.trim() || null, address: f.address.trim() || null,
        city: f.city.trim() || null, type: f.type || null,
        cash_discount: Number(f.cash_discount) || 0, cheque_discount: Number(f.cheque_discount) || 0,
        terms_days: Number(f.terms_days) || 0, credit_limit: Number(f.credit_limit) || 0,
        description: f.description.trim() || null,
      };
      if (isNew) await http.post('/api/customers', payload);
      else await http.put(`/api/customers/${rec!.id}`, payload);
      toast(isNew ? 'Customer created' : 'Customer updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <>
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
        <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="e.g. Colombo" /></Field>
        <Field label="Customer type" hint="Use + to add, edit or remove types.">
          <div className="flex gap-2">
            <Select className="flex-1" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {typeOptions.length === 0 && <option value="">No types — click + to add</option>}
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Button variant="subtle" icon={<Plus size={16} />} onClick={() => setMgrOpen(true)} aria-label="Manage customer types" title="Manage customer types" />
          </div>
        </Field>
        <Field label="Payment terms (days)" hint="Credit period before payment is due.">
          <Input className="mono" inputMode="numeric" value={f.terms_days} onChange={(e) => setF({ ...f, terms_days: e.target.value.replace(/\D/g, '') })} placeholder="0" />
        </Field>
        <Field label="Cash discount (%)"><MoneyInput value={f.cash_discount} onChange={(v) => setF({ ...f, cash_discount: v })} placeholder="0" /></Field>
        <Field label="Cheque discount (%)"><MoneyInput value={f.cheque_discount} onChange={(v) => setF({ ...f, cheque_discount: v })} placeholder="0" /></Field>
        <Field label="Address" full><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Credit balance (LKR)" full hint="Counts as current outstanding — adds into the customer's Outstanding.">
          <MoneyInput value={f.credit_limit} onChange={(v) => setF({ ...f, credit_limit: v })} />
        </Field>
        <Field label="Description" full><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Notes about this customer…" /></Field>
      </div>
    </Modal>
    {mgrOpen && (
      <CustomerTypeManager
        types={types}
        selected={f.type}
        onSelect={(name) => setF((cur) => ({ ...cur, type: name }))}
        onChanged={onTypesChanged}
        onClose={() => setMgrOpen(false)}
      />
    )}
    </>
  );
}

function CustomerTypeManager({
  types, selected, onSelect, onChanged, onClose,
}: {
  types: CustomerType[];
  selected: string;
  onSelect: (name: string) => void;
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await http.post('/api/customer-types', { name });
      setNewName('');
      onSelect(name);
      await onChanged();
      toast('Customer type added');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const saveEdit = async (t: CustomerType) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await http.put(`/api/customer-types/${t.id}`, { name });
      setEditId(null);
      if (selected === t.name) onSelect(name);
      await onChanged();
      toast('Customer type updated');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const remove = async (t: CustomerType) => {
    if (busy) return;
    setBusy(true);
    try {
      await http.delete(`/api/customer-types/${t.id}`);
      setConfirmId(null);
      await onChanged();
      toast('Customer type deleted');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Manage Customer Types" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="flex gap-2 mb-4">
        <Input
          className="flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          placeholder="New customer type"
        />
        <Button variant="primary" icon={<Plus size={16} />} disabled={!newName.trim() || busy} onClick={() => void add()}>Add</Button>
      </div>

      <div className="flex flex-col">
        {types.length === 0 && (
          <div className="text-[13px] py-2" style={{ color: 'var(--text-faint)' }}>No customer types yet. Add one above.</div>
        )}
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
            {editId === t.id ? (
              <>
                <Input
                  className="flex-1"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveEdit(t); }
                    if (e.key === 'Escape') setEditId(null);
                  }}
                />
                <Button variant="primary" size="sm" disabled={!editName.trim() || busy} onClick={() => void saveEdit(t)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
              </>
            ) : confirmId === t.id ? (
              <>
                <span className="flex-1 text-[13.5px]">Delete <strong>{t.name}</strong>?</span>
                <Button variant="primary" size="sm" style={{ background: 'var(--red)' }} disabled={busy} onClick={() => void remove(t)}>Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[14px] font-medium">{t.name}</span>
                <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} aria-label={`Edit ${t.name}`} onClick={() => { setEditId(t.id as number); setEditName(t.name); setConfirmId(null); }} />
                <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} aria-label={`Delete ${t.name}`} onClick={() => { setConfirmId(t.id as number); setEditId(null); }} />
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
