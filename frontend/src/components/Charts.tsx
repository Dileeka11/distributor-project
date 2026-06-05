import { useMemo } from 'react';
import { fmt0, compact } from '@/lib/format';

interface DailyRow { label: string; cash: number; credit: number; }

export function SalesBarChart({ data }: { data: DailyRow[] }) {
  const max = Math.max(...data.map((d) => d.cash + d.credit), 1);
  const W = 100; // pct
  const barW = 100 / data.length;
  return (
    <svg viewBox={`0 0 ${W} 50`} preserveAspectRatio="none" className="w-full h-[180px]">
      {data.map((d, i) => {
        const total = d.cash + d.credit;
        const h = (total / max) * 46;
        const cashH = (d.cash / max) * 46;
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = 48 - h;
        return (
          <g key={i}>
            <title>{`${d.label}\nCash Rs ${fmt0(d.cash)}\nCredit Rs ${fmt0(d.credit)}`}</title>
            <rect x={x} y={48 - cashH} width={w} height={cashH} fill="var(--blue)" rx="0.6" />
            <rect x={x} y={y} width={w} height={h - cashH} fill="var(--accent)" rx="0.6" />
          </g>
        );
      })}
    </svg>
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
