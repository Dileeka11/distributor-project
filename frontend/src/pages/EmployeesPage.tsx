import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt0 } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, Avatar } from '@/components/ui/Common';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, MoneyInput } from '@/components/ui/Field';
import type { Employee, JobRole } from '@/types';

interface EmpForm {
  code: string; name: string; role: string; phone: string; email: string;
  basic_salary: string; hourly_rate: string; work_hours: string; ot_rate: string;
  join_date: string; active: boolean;
}

const nextEmployeeCode = (rows: Employee[]): string => {
  const max = rows.reduce((m, e) => Math.max(m, parseInt(e.code.replace(/\D/g, ''), 10) || 0), 1000);
  return 'EMP-' + String(max + 1);
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);

  const load = () => http.get('/api/employees', { params: { role: roleFilter === 'All' ? undefined : roleFilter } }).then((r) => setRows(r.data.data));
  const loadRoles = () => http.get('/api/job-roles').then((r) => setRoles(r.data.data));
  useEffect(() => { void loadRoles(); }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [roleFilter]);

  const filtered = employeeId === '' ? rows : rows.filter((e) => Number(e.id) === employeeId);
  const monthlyWage = rows.reduce((s, e) => s + Number(e.basic_salary), 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Employees"
        sub={`${rows.length} employees · Rs ${fmt0(monthlyWage)} total basic salary / month.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add Employee</Button>}
      />
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setEmployeeId(''); }} style={{ width: 200, height: 40 }}>
          <option value="All">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </Select>
        <SearchSelect items={rows} value={employeeId} onChange={setEmployeeId} allLabel="All employees" placeholder="Search name, code or mobile…" width={300} subtitle={(e) => `${e.code}${e.role ? ` · ${e.role}` : ''}`} />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Code</th><th>Employee</th><th>Role</th><th>Contact</th><th className="num">Basic salary</th><th className="num">Hourly rate</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="mono font-semibold">{e.code}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} />
                    <div className="font-semibold">{e.name}</div>
                  </div>
                </td>
                <td>{e.role || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                <td>
                  <div className="font-medium">{e.phone || '—'}</div>
                  <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{e.email}</div>
                </td>
                <td className="num money">{fmt0(Number(e.basic_salary))}</td>
                <td className="num money">{fmt0(Number(e.hourly_rate))}</td>
                <td><Badge kind={e.active ? 'green' : 'gray'}>{e.active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="num">
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(e)} />
                    <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                      if (!(await confirmDelete({ title: 'Delete employee?', html: `Remove <b>${e.name}</b>? Their attendance and payroll records are removed too.` }))) return;
                      try { await http.delete(`/api/employees/${e.id}`); toast('Employee deleted'); void load(); }
                      catch (err) { toast(apiErrorMessage(err), 'err'); }
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty icon={<UserCog size={40} />} title="No employees yet" sub="Add your first employee to start tracking attendance and payroll." />}
      </div>

      {editing && (
        <EmployeeModal
          rec={editing === 'new' ? null : editing}
          nextCode={nextEmployeeCode(rows)}
          roles={roles}
          onRolesChanged={loadRoles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ rec, nextCode, roles, onRolesChanged, onClose, onSaved }: {
  rec: Employee | null; nextCode: string; roles: JobRole[];
  onRolesChanged: () => void | Promise<void>; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !rec;
  const [f, setF] = useState<EmpForm>(() => rec
    ? {
        code: rec.code, name: rec.name, role: rec.role ?? '', phone: rec.phone ?? '', email: rec.email ?? '',
        basic_salary: String(Number(rec.basic_salary)), hourly_rate: String(Number(rec.hourly_rate)),
        work_hours: String(Number(rec.work_hours ?? 8)), ot_rate: String(Number(rec.ot_rate ?? 0)),
        join_date: rec.join_date ? String(rec.join_date).slice(0, 10) : '', active: rec.active,
      }
    : { code: nextCode, name: '', role: '', phone: '', email: '', basic_salary: '', hourly_rate: '', work_hours: '8', ot_rate: '', join_date: '', active: true });
  const [busy, setBusy] = useState(false);
  const [mgrOpen, setMgrOpen] = useState(false);
  const valid = f.code.trim() && f.name.trim();

  // Keep the employee's current role selectable even if it's not in the managed list.
  const roleOptions = useMemo(() => {
    const names = roles.map((r) => r.name);
    return f.role && !names.includes(f.role) ? [f.role, ...names] : names;
  }, [roles, f.role]);

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        code: f.code.trim(), name: f.name.trim(), role: f.role.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null,
        basic_salary: Number(f.basic_salary) || 0, hourly_rate: Number(f.hourly_rate) || 0,
        work_hours: Number(f.work_hours) || 0, ot_rate: Number(f.ot_rate) || 0,
        join_date: f.join_date || null, active: f.active,
      };
      if (isNew) await http.post('/api/employees', payload);
      else await http.put(`/api/employees/${rec!.id}`, payload);
      toast(isNew ? 'Employee created' : 'Employee updated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <>
    <Modal
      title={(isNew ? 'Add ' : 'Edit ') + 'Employee'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" req hint="Auto-generated — editable."><Input className="mono" value={f.code} disabled={!isNew} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Full name" req><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Nimal Perera" /></Field>
        <Field label="Role / designation" hint="Use + to add, edit or remove roles.">
          <div className="flex gap-2">
            <Select className="flex-1" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="">— Select role —</option>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Button variant="subtle" icon={<Plus size={16} />} onClick={() => setMgrOpen(true)} aria-label="Manage job roles" title="Manage job roles" />
          </div>
        </Field>
        <Field label="Phone"><Input className="mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Join date"><Input type="date" value={f.join_date} onChange={(e) => setF({ ...f, join_date: e.target.value })} /></Field>
        <Field label="Basic salary (LKR / month)"><MoneyInput value={f.basic_salary} onChange={(v) => setF({ ...f, basic_salary: v })} placeholder="0" /></Field>
        <Field label="Hourly rate (LKR / hour)" hint="Used with attendance hours in payroll."><MoneyInput value={f.hourly_rate} onChange={(v) => setF({ ...f, hourly_rate: v })} placeholder="0" /></Field>
        <Field label="Working hours / day" hint="Overtime starts beyond this each day."><MoneyInput value={f.work_hours} onChange={(v) => setF({ ...f, work_hours: v })} placeholder="8" /></Field>
        <Field label="OT hour rate (LKR / hour)" hint="Paid on hours worked over the daily limit."><MoneyInput value={f.ot_rate} onChange={(v) => setF({ ...f, ot_rate: v })} placeholder="0" /></Field>
        <Field label="Status" full>
          <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active employee
          </label>
        </Field>
      </div>
    </Modal>
    {mgrOpen && (
      <RoleManager
        roles={roles}
        selected={f.role}
        onSelect={(name) => setF((cur) => ({ ...cur, role: name }))}
        onChanged={onRolesChanged}
        onClose={() => setMgrOpen(false)}
      />
    )}
    </>
  );
}

function RoleManager({ roles, selected, onSelect, onChanged, onClose }: {
  roles: JobRole[];
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
      await http.post('/api/job-roles', { name });
      setNewName('');
      onSelect(name);
      await onChanged();
      toast('Job role added');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const saveEdit = async (r: JobRole) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await http.put(`/api/job-roles/${r.id}`, { name });
      setEditId(null);
      if (selected === r.name) onSelect(name);
      await onChanged();
      toast('Job role updated');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  const remove = async (r: JobRole) => {
    if (busy) return;
    setBusy(true);
    try {
      await http.delete(`/api/job-roles/${r.id}`);
      setConfirmId(null);
      await onChanged();
      toast('Job role deleted');
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Manage Job Roles" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="flex gap-2 mb-4">
        <Input
          className="flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          placeholder="New job role"
        />
        <Button variant="primary" icon={<Plus size={16} />} disabled={!newName.trim() || busy} onClick={() => void add()}>Add</Button>
      </div>

      <div className="flex flex-col">
        {roles.length === 0 && (
          <div className="text-[13px] py-2" style={{ color: 'var(--text-faint)' }}>No job roles yet. Add one above.</div>
        )}
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
            {editId === r.id ? (
              <>
                <Input
                  className="flex-1"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveEdit(r); }
                    if (e.key === 'Escape') setEditId(null);
                  }}
                />
                <Button variant="primary" size="sm" disabled={!editName.trim() || busy} onClick={() => void saveEdit(r)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
              </>
            ) : confirmId === r.id ? (
              <>
                <span className="flex-1 text-[13.5px]">Delete <strong>{r.name}</strong>?</span>
                <Button variant="primary" size="sm" style={{ background: 'var(--red)' }} disabled={busy} onClick={() => void remove(r)}>Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[14px] font-medium">{r.name}</span>
                <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} aria-label={`Edit ${r.name}`} onClick={() => { setEditId(r.id as number); setEditName(r.name); setConfirmId(null); }} />
                <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} aria-label={`Delete ${r.name}`} onClick={() => { setConfirmId(r.id as number); setEditId(null); }} />
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
