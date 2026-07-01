import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Pickable {
  id: number;
  name: string;
  code?: string;
  phone?: string | null;
}

/**
 * A searchable dropdown that filters a list by name / code / phone. Emits the
 * picked id (or '' for the "all" option). Used as a filter across master pages.
 */
export function SearchSelect<T extends Pickable>({
  items, value, onChange, allLabel = 'All', placeholder = 'Search name or code…', width, subtitle,
}: {
  items: T[];
  value: number | '';
  onChange: (v: number | '') => void;
  allLabel?: string;
  placeholder?: string;
  width?: number;
  subtitle?: (t: T) => ReactNode;
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

  const selected = items.find((i) => i.id === value);
  const ql = q.trim().toLowerCase();
  const list = ql
    ? items.filter((i) => i.name.toLowerCase().includes(ql) || (i.code ?? '').toLowerCase().includes(ql) || String(i.phone ?? '').toLowerCase().includes(ql))
    : items;
  const pick = (v: number | '') => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={ref} className="relative" style={width ? { width } : undefined}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center justify-between text-left w-full" style={{ height: 40, backgroundImage: 'none', paddingRight: 12 }}>
        <span className="truncate" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>{selected ? selected.name : allLabel}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 z-30 w-full rounded-[9px] border border-border shadow-lg" style={{ background: 'var(--surface)', minWidth: 240 }}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input autoFocus className="input" style={{ height: 34, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
            </div>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }} className="py-1">
            <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2" style={{ fontWeight: value === '' ? 700 : 400, background: value === '' ? 'var(--surface-2)' : undefined }}>{allLabel}</button>
            {list.map((i) => (
              <button key={i.id} type="button" onClick={() => pick(i.id)} className="w-full text-left px-3 py-2 hover:bg-surface-2" style={{ background: i.id === value ? 'var(--surface-2)' : undefined }}>
                <div className="text-[13px] font-medium">{i.name}</div>
                {subtitle && <div className="text-[11.5px] mono" style={{ color: 'var(--text-muted)' }}>{subtitle(i)}</div>}
              </button>
            ))}
            {list.length === 0 && <div className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
