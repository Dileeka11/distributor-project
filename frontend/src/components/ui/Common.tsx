import type { ReactNode } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { initials } from '@/lib/format';

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[200px] max-w-[360px]">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
      <input
        className="input"
        style={{ height: 40, paddingLeft: 38 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, accent,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; accent?: boolean }) {
  return (
    <div className="inline-flex gap-[3px] p-[3px] rounded-[7px] border border-border bg-surface-2">
      {options.map((o) => {
        const on = o.value === value;
        const cls = on
          ? accent ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'
          : 'btn btn-sm btn-subtle';
        return (
          <button key={o.value} type="button" className={cls} style={{ background: on && !accent ? 'var(--surface)' : undefined }} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name, kind }: { name: string; kind?: 'accent' | 'blue' | 'plain' }) {
  const bg = kind === 'blue' ? 'var(--blue-soft)' : kind === 'plain' ? 'var(--surface-2)' : 'var(--accent-soft)';
  const fg = kind === 'blue' ? 'var(--blue)' : kind === 'plain' ? 'var(--text-muted)' : 'var(--accent)';
  return (
    <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px] font-bold text-[13px] flex-shrink-0" style={{ background: bg, color: fg }}>
      {initials(name)}
    </div>
  );
}

export function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="relative h-6 w-[42px] rounded-full transition flex-shrink-0"
      style={{ background: on ? 'var(--accent)' : 'var(--border-strong)' }}
    >
      <span
        className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition"
        style={{ transform: on ? 'translateX(18px)' : 'none' }}
      />
    </button>
  );
}

export function Stat({
  label, value, cur, icon, tint, foot,
}: { label: string; value: ReactNode; cur?: string; icon: ReactNode; tint?: 'accent' | 'blue' | 'amber' | 'green' | 'red'; foot?: ReactNode }) {
  const tintBg: Record<string, string> = {
    accent: 'var(--accent-soft)',
    blue: 'var(--blue-soft)',
    amber: 'var(--amber-soft)',
    green: 'var(--green-soft)',
    red: 'var(--red-soft)',
  };
  const tintFg: Record<string, string> = {
    accent: 'var(--accent)',
    blue: 'var(--blue)',
    amber: 'var(--amber)',
    green: 'var(--green)',
    red: 'var(--red)',
  };
  return (
    <div className="card p-5 flex flex-col gap-2.5 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="grid place-items-center w-[34px] h-[34px] rounded-[9px]" style={{ background: tint ? tintBg[tint] : 'var(--surface-2)', color: tint ? tintFg[tint] : 'var(--text-muted)' }}>
          {icon}
        </div>
      </div>
      <div className="text-[27px] font-extrabold tracking-tight leading-none">
        {cur && <span className="text-[14px] font-semibold mr-1" style={{ color: 'var(--text-faint)' }}>{cur}</span>}
        {value}
      </div>
      {foot && <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{foot}</div>}
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="text-center py-[54px] px-5" style={{ color: 'var(--text-faint)' }}>
      <div className="mx-auto mb-3 opacity-50">{icon}</div>
      <div className="text-[15px] font-semibold mb-1">{title}</div>
      {sub && <div className="text-[13px]">{sub}</div>}
    </div>
  );
}

export function Pagination({
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface select-none flex-wrap gap-3">
      <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        Showing <span className="font-semibold">{totalItems === 0 ? 0 : start}</span> to{' '}
        <span className="font-semibold">{end}</span> of{' '}
        <span className="font-semibold">{totalItems}</span> items
      </div>
      
      <div className="flex items-center gap-4.5 flex-wrap">
        {/* Rows per page selector */}
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <span>Rows per page:</span>
          <select
            className="input py-1 px-2"
            style={{ width: 75, height: 32, padding: '0 8px' }}
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1); // reset to page 1
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Page controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-sm btn-subtle p-1"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-1">
            <span className="text-[13px] px-2" style={{ color: 'var(--text-muted)' }}>
              Page <span className="font-semibold">{currentPage}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-subtle p-1"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
