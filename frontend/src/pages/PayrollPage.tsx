import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Printer, Trash2, Wallet, ChevronDown, Search } from 'lucide-react';
import { http, apiErrorMessage } from '@/lib/http';
import { fmt, fmt0, prettyDate } from '@/lib/format';
import { toast, confirmDelete } from '@/lib/toast';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Common';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, MoneyInput } from '@/components/ui/Field';
import { useSettings } from '@/store/settings';
import type { Employee, Payroll } from '@/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: number) => MONTHS[m - 1] ?? String(m);

export default function PayrollPage() {
  const { settings } = useSettings();
  const now = new Date();
  const [rows, setRows] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [year, setYear] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState<number | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [open, setOpen] = useState(false);

  const load = () => http.get('/api/payrolls', { params: { year } }).then((r) => setRows(r.data.data));
  const loadEmployees = () => http.get('/api/employees').then((r) => setEmployees((r.data.data as Employee[]).filter((e) => e.active)));
  useEffect(() => { void loadEmployees(); }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year]);

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i), [now]);

  // Employees & roles that actually have payslips this year — drive the filters.
  const payrollEmployees = useMemo(() => {
    const map = new Map<number, Employee>();
    rows.forEach((p) => { if (p.employee) map.set(Number(p.employee.id), p.employee); });
    return [...map.values()];
  }, [rows]);
  const roleOptions = useMemo(
    () => Array.from(new Set(payrollEmployees.map((e) => e.role).filter(Boolean))) as string[],
    [payrollEmployees],
  );

  const filtered = rows.filter((p) =>
    (monthFilter === 'All' || Number(p.month) === monthFilter)
    && (roleFilter === 'All' || p.employee?.role === roleFilter)
    && (employeeId === '' || Number(p.employee_id) === employeeId),
  );
  const totalNet = filtered.reduce((s, p) => s + Number(p.net_pay), 0);

  const del = async (p: Payroll) => {
    if (!(await confirmDelete({ title: 'Delete payslip?', html: `Remove <b>${p.code}</b> for ${p.employee?.name}?` }))) return;
    try { await http.delete(`/api/payrolls/${p.id}`); toast('Payslip deleted'); void load(); }
    catch (e) { toast(apiErrorMessage(e), 'err'); }
  };

  const printSlip = (p: Payroll) => {
    const w = window.open('', '_blank', 'width=720,height=800');
    if (!w) return;
    const row = (k: string, v: string, bold = false) => `<tr><td>${k}</td><td class="r"${bold ? ' style="font-weight:700"' : ''}>${v}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${p.code}</title>
      <style>
        *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
        body{margin:36px;color:#1c1f26} h1{font-size:19px;margin:0} .sub{color:#666;font-size:12px}
        .box{border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;margin-top:18px}
        .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
        td{padding:7px 4px;border-bottom:1px solid #eef0f2} .r{text-align:right}
        .net{margin-top:14px;display:flex;justify-content:space-between;font-size:16px;font-weight:800}
        .net .v{color:#0a7d34}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>${settings.company || 'Distributor'}</h1><div class="sub">Payslip</div></div>
        <div class="sub" style="text-align:right"><b>${p.code}</b><br>${monthName(p.month)} ${p.year}</div>
      </div>
      <div class="box">
        <div class="row"><span>Employee</span><b>${p.employee?.name ?? '—'}</b></div>
        <div class="row"><span>Role</span><span>${p.employee?.role ?? '—'}</span></div>
        <div class="row"><span>Days worked</span><span>${p.days_worked}</span></div>
        <div class="row"><span>Hours worked</span><span>${Number(p.total_hours).toFixed(2)}</span></div>
        <div class="row"><span>Overtime hours</span><span>${Number(p.ot_hours ?? 0).toFixed(2)}</span></div>
        <table>
          ${row('Basic salary', 'Rs ' + fmt(Number(p.basic_salary)))}
          ${row('Hours pay', 'Rs ' + fmt(Number(p.hours_pay)))}
          ${row('Overtime pay', 'Rs ' + fmt(Number(p.ot_pay ?? 0)))}
          ${row('Bonus', 'Rs ' + fmt(Number(p.bonus)))}
          ${row('Gross pay', 'Rs ' + fmt(Number(p.gross_pay)), true)}
          ${row('Deductions', '- Rs ' + fmt(Number(p.deductions)))}
        </table>
        <div class="net"><span>Net pay</span><span class="v">Rs ${fmt(Number(p.net_pay))}</span></div>
      </div>
      <div class="sub" style="margin-top:20px">Generated ${p.generated_at ? prettyDate(p.generated_at) : ''}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fade-in">
      <PageHead
        title="Payroll"
        sub={`${filtered.length} payslips · Rs ${fmt0(totalNet)} total net pay.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>Generate payslip</Button>}
      />

      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 120, height: 40 }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={monthFilter === 'All' ? 'All' : String(monthFilter)} onChange={(e) => setMonthFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))} style={{ width: 160, height: 40 }}>
          <option value="All">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: 170, height: 40 }}>
          <option value="All">All roles</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <EmployeePicker employees={payrollEmployees} value={employeeId} onChange={setEmployeeId} />
      </div>

      <div className="card overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 1180, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th>Payslip</th><th>Employee</th><th>Period</th><th className="num">Days</th><th className="num">Hours</th>
              <th className="num">OT hrs</th><th className="num">Basic</th><th className="num">Hours pay</th>
              <th className="num">OT pay</th><th className="num">Bonus</th>
              <th className="num">Deductions</th><th className="num">Net pay</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="mono font-semibold">{p.code}</td>
                <td className="font-semibold">{p.employee?.name ?? '—'}</td>
                <td className="text-[13px]">{monthName(p.month)} {p.year}</td>
                <td className="num mono">{p.days_worked}</td>
                <td className="num mono">{Number(p.total_hours).toFixed(2)}</td>
                <td className="num mono" style={{ color: Number(p.ot_hours) > 0 ? 'var(--amber)' : undefined }}>{Number(p.ot_hours ?? 0).toFixed(2)}</td>
                <td className="num money">{fmt(Number(p.basic_salary))}</td>
                <td className="num money">{fmt(Number(p.hours_pay))}</td>
                <td className="num money" style={{ color: Number(p.ot_pay) > 0 ? 'var(--amber)' : undefined }}>{fmt(Number(p.ot_pay ?? 0))}</td>
                <td className="num money">{fmt(Number(p.bonus))}</td>
                <td className="num money" style={{ color: 'var(--red)' }}>{fmt(Number(p.deductions))}</td>
                <td className="num money font-bold" style={{ color: 'var(--green)' }}>{fmt(Number(p.net_pay))}</td>
                <td className="num">
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="subtle" size="sm" icon={<Printer size={14} />} title="Print payslip" onClick={() => printSlip(p)} />
                    <Button variant="subtle" size="sm" icon={<Trash2 size={14} />} onClick={() => void del(p)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && (
          <Empty icon={<Wallet size={40} />}
            title={rows.length === 0 ? 'No payslips yet' : 'No matching payslips'}
            sub={rows.length === 0 ? 'Generate a monthly payslip from attendance hours and salary.' : 'Try a different month, role or employee.'} />
        )}
      </div>

      {open && (
        <GenerateModal
          employees={employees}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

// Searchable employee filter — pick by name or code, or "All employees".
function EmployeePicker({ employees, value, onChange }: {
  employees: Employee[]; value: number | ''; onChange: (v: number | '') => void;
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
  const list = ql ? employees.filter((e) => e.name.toLowerCase().includes(ql) || e.code.toLowerCase().includes(ql)) : employees;
  const pick = (v: number | '') => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative" style={{ width: 240 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center justify-between text-left w-full" style={{ height: 40, backgroundImage: 'none', paddingRight: 12 }}>
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>{selected ? selected.name : 'All employees'}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)' }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input autoFocus className="input" style={{ height: 34, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code…" />
            </div>
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto' }} className="py-1">
            <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2" style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}>All employees</button>
            {list.map((e) => (
              <button key={e.id} type="button" onClick={() => pick(Number(e.id))} className="w-full text-left px-3 py-2 hover:bg-surface-2" style={{ background: Number(e.id) === value ? 'var(--surface-2)' : undefined }}>
                <div className="text-[13px] font-medium">{e.name}</div>
                <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{e.code}{e.role ? ` · ${e.role}` : ''}</div>
              </button>
            ))}
            {list.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function GenerateModal({ employees, onClose, onSaved }: {
  employees: Employee[]; onClose: () => void; onSaved: () => void;
}) {
  const now = new Date();
  const [employeeId, setEmployeeId] = useState<number | ''>(employees[0]?.id ?? '');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [deductions, setDeductions] = useState('');
  const [bonus, setBonus] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!employeeId) return;
    setBusy(true);
    try {
      await http.post('/api/payrolls/generate', {
        employee_id: employeeId, month, year,
        deductions: Number(deductions) || 0, bonus: Number(bonus) || 0,
      });
      toast('Payslip generated');
      onSaved();
    } catch (e) { toast(apiErrorMessage(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title="Generate payslip"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!employeeId || busy} onClick={save}>Generate</Button></>}
    >
      <div className="text-[12.5px] mb-4" style={{ color: 'var(--text-muted)' }}>
        Pulls the employee's attendance hours for the month: regular hours × hourly rate, overtime (beyond the daily limit) × OT rate, plus basic salary and bonus, minus deductions.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee" req full>
          <Select value={String(employeeId)} onChange={(e) => setEmployeeId(Number(e.target.value))}>
            {employees.length === 0 && <option value="">No active employees</option>}
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? ` · ${e.role}` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Month">
          <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Year">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
        <Field label="Bonus (LKR)"><MoneyInput value={bonus} onChange={setBonus} placeholder="0" /></Field>
        <Field label="Deductions (LKR)" hint="Tax, advances, etc."><MoneyInput value={deductions} onChange={setDeductions} placeholder="0" /></Field>
      </div>
    </Modal>
  );
}
