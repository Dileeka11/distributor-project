import { useMemo } from 'react';
import { fmt0, compact } from '@/lib/format';

interface DailyRow { label: string; cash: number; credit: number; }

// Round a value up to a clean axis maximum (1/2/2.5/5 × 10ⁿ).
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

export function SalesBarChart({ data }: { data: DailyRow[] }) {
  if (!data.length) return <div className="text-[13px] py-10 text-center" style={{ color: 'var(--text-faint)' }}>No sales this month.</div>;

  const rawMax = Math.max(...data.map((d) => d.cash + d.credit), 1);
  const step = niceCeil(rawMax / 4);             // round gridline interval
  const tickCount = Math.max(1, Math.ceil(rawMax / step));
  const max = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => step * (tickCount - i)); // max … 0
  const barW = 100 / data.length;
  const H = 180;
  const AX = 44; // width reserved for the y-axis value labels
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <div className="flex" style={{ height: H }}>
        {/* Y axis — numerical values */}
        <div className="relative flex-shrink-0" style={{ width: AX }}>
          {ticks.map((tk, i) => (
            <span key={i} className="absolute right-2 text-[10px] mono -translate-y-1/2" style={{ top: `${(i / tickCount) * 100}%`, color: 'var(--text-faint)' }}>
              {compact(tk)}
            </span>
          ))}
        </div>
        {/* Plot area with gridlines */}
        <div className="relative flex-1 min-w-0">
          {ticks.map((_, i) => (
            <div key={i} className="absolute left-0 right-0" style={{ top: `${(i / tickCount) * 100}%`, borderTop: '1px dashed var(--border)' }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {data.map((d, i) => {
              const total = d.cash + d.credit;
              const h = (total / max) * 100;
              const cashH = (d.cash / max) * 100;
              const x = i * barW + barW * 0.15;
              const w = barW * 0.7;
              return (
                <g key={i}>
                  <title>{`${d.label}\nCash Rs ${fmt0(d.cash)}\nCredit Rs ${fmt0(d.credit)}`}</title>
                  <rect x={x} y={100 - cashH} width={w} height={cashH} fill="var(--blue)" rx="0.6" />
                  <rect x={x} y={100 - h} width={w} height={h - cashH} fill="var(--accent)" rx="0.6" />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {/* X axis — dates */}
      <div className="flex" style={{ marginLeft: AX }}>
        {data.map((d, i) => (
          <div key={i} className="text-[9.5px] mono text-center" style={{ width: `${barW}%`, color: 'var(--text-faint)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {i % labelStep === 0 ? d.label.replace(/^\w+\s/, '') : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  segments, centerLabel, centerValue,
}: { segments: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 38, C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * C;
    const dash = `${len} ${C - len}`;
    const offset = -acc;
    acc += len;
    return { ...s, dash, offset };
  });
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" width={140} height={140}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
        {arcs.map((a, i) => (
          <circle
            key={i} cx="50" cy="50" r={R}
            fill="none" stroke={a.color} strokeWidth="14"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            transform="rotate(-90 50 50)"
          />
        ))}
        <text x="50" y="48" textAnchor="middle" fontSize="9" fill="var(--text-faint)" fontWeight={600}>{centerLabel}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="11" fill="var(--text)" fontWeight={800}>{centerValue}</text>
      </svg>
      <div className="flex-1 flex flex-col gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>Rs {compact(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = useMemo(() => Math.max(...rows.map((r) => r.value), 1), [rows]);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[12.5px] mb-1.5">
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>Rs {compact(r.value)}</span>
          </div>
          <div className="bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
