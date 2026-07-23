import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, LogIn, LogOut, Edit2, Trash2, Clock, FileBarChart2, ChevronLeft, ChevronRight, ChevronDown, Search, CalendarDays } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty, Avatar } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Field';
import { useAuth } from '@/store/auth';
import { LeaveCenter } from '@/pages/LeaveCenter';
import type { Attendance, Employee, JobRole } from '@/types';

const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : '—');
// Decimal hours → readable "Xh Ym" (e.g. 0.07 → "4m", 8.5 → "8h 30m").
const fmtHrs = (dec: number) => {
  const total = Math.round(dec * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const STATUS: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { present: 'green', 'half-day': 'amber', leave: 'amber', absent: 'red' };

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [date, setDate] = useState(today);
  const [roleFilter, setRoleFilter] = useState('All');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [editing, setEditing] = useState<{ emp: Employee; rec?: Attendance } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leavePending, setLeavePending] = useState(0);
  // Manual time entry: off = record at the current time; on = use the picked time.
  const [manualTime, setManualTime] = useState(false);
  const [pickedTime, setPickedTime] = useState('');

  const loadEmployees = () => http.get('/api/employees').then((r) => setEmployees((r.data.data as Employee[]).filter((e) => e.active)));
  const loadRecords = () => http.get('/api/attendance', { params: { date } }).then((r) => setRecords(r.data.data));
  const loadPending = () => http.get('/api/leaves', { params: { status: 'pending' } }).then((r) => setLeavePending((r.data.data as unknown[]).length)).catch(() => {});
  useEffect(() => { void loadEmployees(); void http.get('/api/job-roles').then((r) => setRoles(r.data.data)); void loadPending(); }, []);
  useEffect(() => { void loadRecords(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  const isToday = date === today;
  // Number() both sides: older PHP/MySQL stacks serialize ids as strings.
  const recFor = (id: number) => records.find((r) => Number(r.employee_id) === id);

  // Role dropdown narrows the employee list; the employee dropdown then filters to one.
  const roleEmployees = employees.filter((e) => roleFilter === 'All' || e.role === roleFilter);
  const shown = employeeId === '' ? roleEmployees : roleEmployees.filter((e) => Number(e.id) === employeeId);

  const clock = async (emp: Employee) => {
    try {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      // Manual time (HH:MM from the picker) → append :00; else the live time.
      const time = manualTime && pickedTime
        ? `${pickedTime}:00`
        : `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      const { data } = await http.post('/api/attendance/clock', {
        employee_id: emp.id, date: d.toLocaleDateString('en-CA'), time,
      });
      const saved = data.data as Attendance;
      toast(saved.clock_out ? `${emp.name} clocked out` : `${emp.name} clocked in`);
      // Show the saved row immediately from the response, then refresh the list.
      setRecords((rs) => {
        const rest = rs.filter((r) => Number(r.employee_id) !== Number(saved.employee_id));
        return [saved, ...rest];
      });
      void loadRecords();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const del = async (rec: Attendance) => {
    if (!(await confirmDelete({ title: 'Delete attendance?', html: `Remove this record?` }))) return;
    try { await http.delete(`/api/attendance/${rec.id}`); toast('Attendance deleted'); void loadRecords(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const present = shown.filter((e) => { const r = recFor(Number(e.id)); return r && r.status !== 'absent' && r.clock_in; }).length;
  const totalHours = shown.reduce((s, e) => { const r = recFor(Number(e.id)); return s + (r ? Number(r.total_hours) : 0); }, 0);

  return (
    <div className="fade-in">
      <PageHead
        title="Attendance"
        sub="Daily clock-in / clock-out and worked hours per employee."
        actions={
          <>
            <Button variant="subtle" icon={<CalendarDays size={16} />} onClick={() => setLeaveOpen(true)}>
              Leave{leavePending > 0 && <span className="ml-1.5 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--accent)' }}>{leavePending}</span>}
            </Button>
            <Button variant="subtle" icon={<FileBarChart2 size={16} />} onClick={() => setReportOpen(true)}>Attendance report</Button>
          </>
        }
      />

      <div className="flex gap-2.5 mb-3 items-center flex-wrap">
        <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setEmployeeId(''); }} style={{ width: 190, height: 40 }}>
          <option value="All">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </Select>
        <EmployeePicker employees={roleEmployees} value={employeeId} onChange={setEmployeeId} allLabel="All employees" width={260} />
      </div>

      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} style={{ height: 40, width: 180 }} />
        {isToday
          ? <span className="chip" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>Today — clock-in enabled</span>
          : <Button variant="subtle" onClick={() => setDate(today)}>Back to today</Button>}
        {isToday && (
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer px-2.5 rounded-full border border-border" style={{ height: 36, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={manualTime} onChange={(e) => { setManualTime(e.target.checked); if (e.target.checked && !pickedTime) { const d = new Date(); setPickedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); } }} />
            Manual time
            {manualTime && <Input type="time" value={pickedTime} onChange={(e) => setPickedTime(e.target.value)} style={{ height: 28, width: 120 }} />}
          </label>
        )}
        <LiveClock />
        <div className="flex gap-2">
          <span className="chip">{present} / {shown.length} present</span>
          <span className="chip">{fmtHrs(totalHours)} total</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Employee</th><th>Role</th><th>Clock In</th><th>Clock Out</th><th className="num">Hours</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((emp) => {
              const rec = recFor(Number(emp.id));
              const clockedIn = !!rec?.clock_in;
              const clockedOut = !!rec?.clock_out;
              return (
                <tr key={emp.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name} />
                      <div className="font-semibold">{emp.name}</div>
                    </div>
                  </td>
                  <td className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{emp.role || '—'}</td>
                  <td className="mono">{hhmm(rec?.clock_in ?? null)}</td>
                  <td className="mono">{hhmm(rec?.clock_out ?? null)}</td>
                  <td className="num mono font-semibold">{rec ? fmtHrs(Number(rec.total_hours)) : '—'}</td>
                  <td>{rec ? <Badge kind={STATUS[rec.status] ?? 'gray'}>{rec.status}</Badge> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td className="num">
                    <div className="flex gap-1.5 justify-end">
                      {/* Check-in (first tap) is admin-only; check-out any user. */}
                      {isToday && !clockedOut && (clockedIn || isAdmin) && (
                        <Button variant="primary" size="sm" icon={clockedIn ? <LogOut size={14} /> : <LogIn size={14} />}
                          style={clockedIn ? { background: 'var(--amber)', borderColor: 'var(--amber)' } : undefined}
                          onClick={() => void clock(emp)}>
                          {clockedIn ? 'Clock out' : 'Clock in'}
                        </Button>
                      )}
                      {isAdmin && <Button variant="subtle" size="sm" icon={<Edit2 size={14} />} title="Edit / correct" onClick={() => setEditing({ emp, rec })} />}
                      {isAdmin && rec && <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void del(rec)} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <Empty icon={<CalendarCheck size={40} />}
            title={employees.length === 0 ? 'No active employees' : 'No matching employees'}
            sub={employees.length === 0 ? 'Add employees first to record attendance.' : 'Try a different search or role.'} />
        )}
      </div>

      {editing && (
        <AttendanceEditModal
          emp={editing.emp}
          rec={editing.rec}
          date={date}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void loadRecords(); }}
        />
      )}

      {reportOpen && <AttendanceReportModal onClose={() => setReportOpen(false)} />}

      {leaveOpen && (
        <LeaveCenter
          employees={employees}
          onClose={() => setLeaveOpen(false)}
          onChanged={() => { void loadPending(); void loadRecords(); }}
        />
      )}
    </div>
  );
}

// Ticking wall-clock for the attendance screen.
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="ml-auto flex items-center gap-2 px-3.5 rounded-full border border-border" style={{ height: 36, background: 'var(--surface)' }}>
      <Clock size={15} style={{ color: 'var(--accent)' }} />
      <span className="mono font-bold text-[14.5px]" style={{ fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString('en-GB')}</span>
      <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{now.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
    </div>
  );
}

// Attendance report card: date range + role → employee (searchable), a month
// calendar coloured by status, and the matching attendance table.
function AttendanceReportModal({ onClose }: { onClose: () => void }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [role, setRole] = useState('All');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [calMonth, setCalMonth] = useState(() => new Date());

  useEffect(() => {
    void http.get('/api/employees').then((r) => setEmployees(r.data.data));
    void http.get('/api/job-roles').then((r) => setRoles(r.data.data));
  }, []);

  useEffect(() => {
    if (!employeeId) { setRecords([]); return; }
    void http.get('/api/attendance', { params: { employee_id: employeeId } }).then((r) => setRecords(r.data.data));
  }, [employeeId]);

  const roleEmployees = useMemo(
    () => (role === 'All' ? employees : employees.filter((e) => e.role === role)),
    [employees, role],
  );
  useEffect(() => {
    if (employeeId && !roleEmployees.some((e) => Number(e.id) === employeeId)) setEmployeeId('');
  }, [roleEmployees, employeeId]);

  const byDate = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const r of records) m.set(String(r.date).slice(0, 10), r);
    return m;
  }, [records]);

  const tableRows = useMemo(
    () => records
      .filter((r) => { const d = String(r.date).slice(0, 10); return d >= from && d <= to; })
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [records, from, to],
  );

  const totalHours = tableRows.reduce((s, r) => s + Number(r.total_hours), 0);
  const presentDays = tableRows.filter((r) => r.status !== 'absent' && r.clock_in).length;
  const emp = employees.find((e) => Number(e.id) === employeeId);

  return (
    <Modal lg title="Attendance report" onClose={onClose}>
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="All">All roles</option>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Employee">
            <EmployeePicker employees={roleEmployees} value={employeeId} onChange={setEmployeeId} />
          </Field>
          {emp && (
            <div className="rounded-[10px] p-3.5 mt-1 flex gap-6" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div><div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Days present</div><div className="mono text-[17px] font-extrabold">{presentDays}</div></div>
              <div><div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Total hours</div><div className="mono text-[17px] font-extrabold">{fmtHrs(totalHours)}</div></div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <div className="text-[13.5px] font-bold">{calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
            <button type="button" className="grid place-items-center w-7 h-7 rounded-md hover:bg-surface-2" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <MiniCalendar month={calMonth} byDate={byDate} />
          <div className="flex gap-3 mt-3 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {([['present', 'var(--green)'], ['half-day', 'var(--amber)'], ['absent', 'var(--red)']] as const).map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[10px] border border-border overflow-hidden">
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th className="num">Hours</th><th>Status</th></tr></thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{prettyDate(r.date)}</td>
                  <td className="mono">{hhmm(r.clock_in)}</td>
                  <td className="mono">{hhmm(r.clock_out)}</td>
                  <td className="num mono font-semibold">{fmtHrs(Number(r.total_hours))}</td>
                  <td><Badge kind={STATUS[r.status] ?? 'gray'}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!employeeId && <div className="text-center py-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>Select an employee to view attendance.</div>}
        {employeeId && tableRows.length === 0 && <div className="text-center py-8 text-[13px]" style={{ color: 'var(--text-faint)' }}>No attendance in this date range.</div>}
      </div>
    </Modal>
  );
}

// Searchable employee selector (name / code / mobile).
function EmployeePicker({ employees, value, onChange, allLabel, width }: {
  employees: Employee[]; value: number | ''; onChange: (v: number | '') => void; allLabel?: string; width?: number;
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

  const selected = employees.find((e) => Number(e.id) === value);
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? employees.filter((e) => e.name.toLowerCase().includes(ql) || e.code.toLowerCase().includes(ql) || String(e.phone ?? '').toLowerCase().includes(ql))
    : employees;
  const pick = (v: number | '') => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative" style={width ? { width } : undefined}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center justify-between text-left w-full" style={{ height: 40, backgroundImage: 'none', paddingRight: 12 }}>
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>{selected ? selected.name : (allLabel ?? 'Select employee…')}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)' }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input autoFocus className="input" style={{ height: 34, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or mobile…" />
            </div>
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto' }} className="py-1">
            {allLabel && (
              <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2" style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}>{allLabel}</button>
            )}
            {filtered.map((e) => (
              <button key={e.id} type="button" onClick={() => pick(Number(e.id))} className="w-full text-left px-3 py-2 hover:bg-surface-2" style={{ background: Number(e.id) === value ? 'var(--surface-2)' : undefined }}>
                <div className="text-[13px] font-medium">{e.name}</div>
                <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{e.code}{e.role ? ` · ${e.role}` : ''}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Month grid with a coloured dot per day reflecting the employee's attendance.
function MiniCalendar({ month, byDate }: { month: Date; byDate: Map<string, Attendance> }) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const startDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA');
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const color: Record<string, string> = { present: 'var(--green)', absent: 'var(--red)', leave: 'var(--amber)', 'half-day': 'var(--amber)' };
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold mb-1" style={{ color: 'var(--text-faint)' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const rec = byDate.get(key(d));
          const isToday = key(d) === today;
          return (
            <div key={i} className="relative grid place-items-center rounded-md text-[12px]"
              style={{ height: 34, background: 'var(--surface-2)', border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)' }}
              title={rec ? `${rec.status} · ${hhmm(rec.clock_in)}–${hhmm(rec.clock_out)}` : ''}>
              {d}
              {rec && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full" style={{ background: color[rec.status] ?? 'var(--text-faint)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttendanceEditModal({ emp, rec, date, onClose, onSaved }: {
  emp: Employee; rec?: Attendance; date: string; onClose: () => void; onSaved: () => void;
}) {
  const [clockIn, setClockIn] = useState(rec?.clock_in ? String(rec.clock_in).slice(0, 5) : '');
  const [clockOut, setClockOut] = useState(rec?.clock_out ? String(rec.clock_out).slice(0, 5) : '');
  const [status, setStatus] = useState(rec?.status ?? 'present');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await http.post('/api/attendance', {
        employee_id: emp.id, date,
        clock_in: clockIn || null, clock_out: clockOut || null, status,
      });
      toast('Attendance saved');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={`Attendance — ${emp.name}`}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy} onClick={save}>Save</Button></>}
    >
      <div className="rounded-[10px] p-3.5 mb-4 flex items-center gap-2 text-[13px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <Clock size={15} /> {prettyDate(date)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Clock in"><Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} /></Field>
        <Field label="Clock out"><Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} /></Field>
        <Field label="Status" full>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['present', 'half-day', 'leave', 'absent'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
