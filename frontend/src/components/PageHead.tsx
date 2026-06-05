import type { ReactNode } from 'react';

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight m-0">{title}</h1>
        {sub && <p className="m-0 text-[13px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {actions}
    </div>
  );
}
