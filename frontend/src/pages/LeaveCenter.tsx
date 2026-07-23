import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, X, Plus, Trash2, Bell, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Common';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useAuth } from '@/store/auth';
import type { Attendance, Employee, Leave, LeaveBalance, LeaveCategory } from '@/types';

type Tab = 'apply' | 'requests' | 'calendar' | 'categories';

// Add `days` calendar days to a YYYY-MM-DD string, returning the covered dates.
const coveredDates = (from: string, days: number): string[] => {
  const out: string[] = [];
  const d = new Date(from + 'T00:00:00');
  for (let i = 0; i < Math.max(1, days); i++) {
    out.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

export function LeaveCenter({ employees, onClose, onChanged }: {
  employees: Employee[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>('apply');
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);

  const loadCategories = () => http.get('/api/leave-categories').then((r) => setCategories(r.data.data));
  const loadLeaves = () => http.get('/api/leaves').then((r) => setLeaves(r.data.data));
  const reload = () => { void loadLeaves(); onChanged(); };
  useEffect(() => { void loadCategories(); void loadLeaves(); }, []);

  const pending = leaves.filter((l) => l.status === 'pending');

  return (
    <Modal
      lg
      title={<span className="flex items-center gap-2.5"><CalendarDays size={20} style={{ color: 'var(--accent)' }} /> Leave</span>}
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    >
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'apply', label: 'Apply' },
            { value: 'requests', label: `Requests${pending.length ? ` · ${pending.length}` : ''}` },
            { value: 'calendar', label: 'Calendar' },
            ...(isAdmin ? [{ value: 'categories', label: 'Categories' }] : []),
          ]}
        />
        {pending.length > 0 && (
          <span className="chip inline-flex items-center gap-1.5" style={{ background: 'var(--amber-soft, #fef3c7)', color: 'var(--amber)' }}>
            <Bell size={13} /> {pending.length} pending {isAdmin ? 'to review' : 'awaiting approval'}
          </span>
        )}
      </div>

      {tab === 'apply' && <ApplyTab employees={employees} categories={categories} onApplied={reload} />}
      {tab === 'requests' && <RequestsTab leaves={leaves} isAdmin={isAdmin} onChanged={reload} />}
      {tab === 'calendar' && <CalendarTab employees={employees} categories={categories} />}
      {tab === 'categories' && isAdmin && <CategoriesTab categories={categories} onChanged={() => { void loadCategories(); }} />}
    </Modal>
  );
}

// ---- Apply for leave ---------------------------------------------------------
function ApplyTab({ employees, categories, onApplied }: {
  employees: Employee[]; categories: LeaveCategory[]; onApplied: () => void;
}) {
  const today = new Date().toLocaleDateString('en-CA');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState(today);
  const [days, setDays] = useState('1');
  const [description, setDescription] = useState('');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (employeeId === '') { setBalances([]); return; }
    void http.get('/api/leaves/balances', { params: { employee_id: employeeId } }).then((r) => setBalances(r.data.data));
  }, [employeeId]);

  const bal = balances.find((b) => Number(b.category_id) === categoryId);
  const valid = employeeId !== '' && categoryId !== '' && Number(days) > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await http.post('/api/leaves', {
        employee_id: employeeId, leave_category_id: categoryId,
        from_date: fromDate, days: Number(days), description: description.trim() || null,
      });
      toast('Leave request submitted — pending approval');
      setCategoryId(''); setDays('1'); setDescription('');
      void http.get('/api/leaves/balances', { params: { employee_id: employeeId } }).then((r) => setBalances(r.data.data));
      onApplied();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="flex flex-col gap-3.5">
        <Field label="Employee" req>
          <SearchSelect items={employees} value={employeeId} onChange={(v) => { setEmployeeId(v); setCategoryId(''); }}
            allLabel="Select employee…" placeholder="Search name, code or mobile…" subtitle={(e) => `${e.code}${e.role ? ` · ${e.role}` : ''}`} />
        </Field>
        <Field label="Leave category" req>
          <Select value={categoryId === '' ? '' : String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select category…</option>
            {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {bal && (
            <div className="text-[11.5px] mt-1" style={{ color: bal.remaining > 0 ? 'var(--text-muted)' : 'var(--red)' }}>
              Allowance {bal.allowance} · used {bal.used} · <b>{bal.remaining} days left</b> this year
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date" req><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
          <Field label="Days" req><Input className="mono text-right" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} onBlur={() => { if (!(Number(days) > 0)) setDays('1'); }} /></Field>
        </div>
        <Field label="Reason / description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why is this leave needed?" /></Field>
        <Button variant="primary" icon={<Send size={15} />} disabled={!valid || busy} onClick={submit}>Submit for approval</Button>
      </div>

      <div className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--text-muted)' }}>Leave balance {employeeId === '' ? '' : `· ${new Date().getFullYear()}`}</div>
        {employeeId === '' ? (
          <div className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>Select an employee to see their remaining leave by category.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {balances.map((b) => (
              <div key={b.category_id} className="flex items-center justify-between text-[13px]">
                <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>
                <span className="mono"><b>{b.remaining}</b> <span style={{ color: 'var(--text-faint)' }}>/ {b.allowance}</span></span>
              </div>
            ))}
            {balances.length === 0 && <div className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>No leave categories yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Requests / approval -----------------------------------------------------
function RequestsTab({ leaves, isAdmin, onChanged }: { leaves: Leave[]; isAdmin: boolean; onChanged: () => void }) {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const rows = leaves.filter((l) => filter === 'all' || l.status === filter);

  const decide = async (l: Leave, status: 'approved' | 'rejected') => {
    const note = window.prompt(status === 'approved' ? 'Approval note (optional):' : 'Reason for rejecting (optional):', '');
    if (note === null) return; // cancelled
    try {
      await http.post(`/api/leaves/${l.id}/decide`, { status, admin_note: note.trim() || null });
      toast(status === 'approved' ? 'Leave approved' : 'Leave rejected');
      onChanged();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };
  const del = async (l: Leave) => {
    if (!(await confirmDelete({ title: 'Delete leave record?', html: `Remove this ${l.category?.name ?? ''} leave for <b>${l.employee?.name ?? ''}</b>?` }))) return;
    try { await http.delete(`/api/leaves/${l.id}`); toast('Leave deleted'); onChanged(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const badge = (s: Leave['status']) => s === 'approved' ? <Badge kind="green" dot>Approved</Badge> : s === 'rejected' ? <Badge kind="red" dot>Rejected</Badge> : <Badge kind="amber" dot>Pending</Badge>;

  return (
    <div>
      <div className="mb-3">
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />
      </div>
      <div className="card overflow-hidden">
        <div style={{ maxHeight: 380, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Employee</th><th>Category</th><th>From</th><th className="num">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="font-semibold">{l.employee?.name ?? '—'}</td>
                  <td><span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: l.category?.color ?? '#999' }} />{l.category?.name ?? '—'}</span></td>
                  <td className="text-[12.5px] whitespace-nowrap">{prettyDate(l.from_date)}</td>
                  <td className="num mono">{l.days}</td>
                  <td className="text-[12.5px]" style={{ color: 'var(--text-muted)', maxWidth: 200 }}>
                    {l.description || '—'}
                    {l.admin_note && <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Note: {l.admin_note}</div>}
                  </td>
                  <td>{badge(l.status)}</td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      {isAdmin && l.status === 'pending' && (
                        <>
                          <Button variant="subtle" size="sm" icon={<Check size={14} />} title="Approve" style={{ color: 'var(--green)' }} onClick={() => void decide(l, 'approved')} />
                          <Button variant="subtle" size="sm" icon={<X size={14} />} title="Reject" style={{ color: 'var(--red)' }} onClick={() => void decide(l, 'rejected')} />
                        </>
                      )}
                      {isAdmin && <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void del(l)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="text-center py-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>No {filter === 'all' ? '' : filter} leave requests.</div>}
      </div>
      {!isAdmin && <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-faint)' }}>Only an admin can approve or reject. Your requests stay pending until reviewed.</div>}
    </div>
  );
}

// ---- Per-employee colour calendar -------------------------------------------
function CalendarTab({ employees, categories }: { employees: Employee[]; categories: LeaveCategory[] }) {
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [month, setMonth] = useState(() => new Date());
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [pick, setPick] = useState<string>('all'); // legend filter: 'worked' | 'absent' | category id | 'all'

  useEffect(() => {
    if (employeeId === '') { setAttendance([]); setLeaves([]); return; }
    void http.get('/api/attendance', { params: { employee_id: employeeId } }).then((r) => setAttendance(r.data.data));
    void http.get('/api/leaves', { params: { employee_id: employeeId, status: 'approved' } }).then((r) => setLeaves(r.data.data));
  }, [employeeId]);

  // Map each date → what happened (approved leave takes precedence, else worked/absent).
  const byDate = useMemo(() => {
    const m = new Map<string, { kind: string; color: string; label: string; detail: string }>();
    for (const a of attendance) {
      const d = String(a.date).slice(0, 10);
      if (a.clock_in) m.set(d, { kind: 'worked', color: 'var(--green)', label: 'Worked', detail: `${String(a.clock_in).slice(0, 5)}–${a.clock_out ? String(a.clock_out).slice(0, 5) : '…'}` });
      else if (a.status === 'absent') m.set(d, { kind: 'absent', color: 'var(--red)', label: 'Absent', detail: '' });
    }
    for (const l of leaves) {
      for (const d of coveredDates(String(l.from_date).slice(0, 10), l.days)) {
        m.set(d, { kind: `cat${l.leave_category_id}`, color: l.category?.color ?? '#999', label: l.category?.name ?? 'Leave', detail: l.description || '' });
      }
    }
    return m;
  }, [attendance, leaves]);

  const rows = useMemo(() => {
    const list: { date: string; label: string; color: string; detail: string; kind: string }[] = [];
    byDate.forEach((v, date) => list.push({ date, ...v }));
    return list
      .filter((r) => pick === 'all' || r.kind === pick)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [byDate, pick]);

  const legend = [
    { kind: 'worked', color: 'var(--green)', label: 'Worked' },
    ...categories.map((c) => ({ kind: `cat${c.id}`, color: c.color, label: c.name })),
    { kind: 'absent', color: 'var(--red)', label: 'Absent' },
  ];

  return (
    <div>
      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <SearchSelect items={employees} value={employeeId} onChange={setEmployeeId} allLabel="Select employee…" placeholder="Search employee…" width={260} subtitle={(e) => `${e.code}${e.role ? ` · ${e.role}` : ''}`} />
      </div>

      {employeeId === '' ? (
        <div className="text-center py-10 text-[13px]" style={{ color: 'var(--text-faint)' }}>Select an employee to see their leave & attendance calendar.</div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
              <div className="text-[13.5px] font-bold">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
              <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
            </div>
            <ColourCalendar month={month} byDate={byDate} />
            <div className="flex gap-2 mt-3 flex-wrap">
              {legend.map((l) => (
                <button key={l.kind} type="button" onClick={() => setPick((p) => p === l.kind ? 'all' : l.kind)}
                  className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-full border"
                  style={{ borderColor: pick === l.kind ? l.color : 'var(--border)', background: pick === l.kind ? 'var(--surface-2)' : undefined }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              {pick === 'all' ? 'All records' : `${legend.find((l) => l.kind === pick)?.label ?? ''} records`} · {rows.length}
            </div>
            <div className="card overflow-hidden">
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Type</th><th>Details</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.date}>
                        <td className="text-[12.5px] whitespace-nowrap">{prettyDate(r.date)}</td>
                        <td><span className="inline-flex items-center gap-1.5 text-[12.5px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />{r.label}</span></td>
                        <td className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{r.detail || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <div className="text-center py-6 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>No records for this filter.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColourCalendar({ month, byDate }: { month: Date; byDate: Map<string, { color: string; label: string }> }) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const startDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA');
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold mb-1" style={{ color: 'var(--text-faint)' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const hit = byDate.get(key(d));
          const isToday = key(d) === today;
          return (
            <div key={i} className="relative grid place-items-center rounded-md text-[12px]"
              style={{ height: 34, background: hit ? hit.color : 'var(--surface-2)', color: hit ? '#fff' : 'var(--text)', border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--border)', fontWeight: hit ? 700 : 400 }}
              title={hit ? `${hit.label}` : ''}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Leave categories (admin) -----------------------------------------------
function CategoriesTab({ categories, onChanged }: { categories: LeaveCategory[]; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [annualDays, setAnnualDays] = useState('14');
  const [color, setColor] = useState('#2563eb');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await http.post('/api/leave-categories', { name: name.trim(), annual_days: Number(annualDays) || 0, color, active: true });
      toast('Category added'); setName(''); setAnnualDays('14'); onChanged();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };
  const save = async (c: LeaveCategory, patch: Partial<LeaveCategory>) => {
    try { await http.put(`/api/leave-categories/${c.id}`, { ...c, ...patch }); onChanged(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };
  const del = async (c: LeaveCategory) => {
    if (!(await confirmDelete({ title: 'Delete category?', html: `Remove <b>${c.name}</b>?` }))) return;
    try { await http.delete(`/api/leave-categories/${c.id}`); toast('Category deleted'); onChanged(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  return (
    <div>
      <div className="flex gap-2 items-end mb-4 flex-wrap">
        <Field label="New category"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual" style={{ width: 180 }} /></Field>
        <Field label="Days / year"><Input className="mono text-right" inputMode="numeric" value={annualDays} onChange={(e) => setAnnualDays(e.target.value.replace(/\D/g, ''))} style={{ width: 100 }} /></Field>
        <Field label="Colour"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 46, height: 40, border: '1px solid var(--border)', borderRadius: 8, background: 'none' }} /></Field>
        <Button variant="primary" icon={<Plus size={15} />} disabled={!name.trim() || busy} onClick={add}>Add</Button>
      </div>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Colour</th><th>Category</th><th className="num">Days / year</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td><input type="color" value={c.color} onChange={(e) => void save(c, { color: e.target.value })} style={{ width: 34, height: 26, border: 'none', background: 'none' }} /></td>
                <td className="font-semibold">{c.name}</td>
                <td className="num">
                  <Input className="mono text-right" inputMode="numeric" defaultValue={String(c.annual_days)} onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; if (v !== c.annual_days) void save(c, { annual_days: v }); }} style={{ width: 80, height: 32, display: 'inline-block' }} />
                </td>
                <td>
                  <button type="button" onClick={() => void save(c, { active: !c.active })} className="chip" style={{ background: c.active ? 'var(--green-soft)' : 'var(--surface-2)', color: c.active ? 'var(--green)' : 'var(--text-muted)' }}>
                    {c.active ? 'Active' : 'Off'}
                  </button>
                </td>
                <td className="num"><Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void del(c)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <div className="text-center py-6 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>No categories yet — add one above.</div>}
      </div>
    </div>
  );
}
