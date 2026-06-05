import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Kind = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export function Badge({ kind = 'gray', dot, children }: { kind?: Kind; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cn('badge', `badge-${kind}`)}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function statusBadge(status: 'paid' | 'partial' | 'unpaid' | string): { kind: Kind; label: string } {
  switch (status) {
    case 'paid':    return { kind: 'green', label: 'Paid' };
    case 'partial': return { kind: 'amber', label: 'Partial' };
    case 'unpaid':  return { kind: 'red',   label: 'Unpaid' };
    default:        return { kind: 'gray',  label: status };
  }
}

export function stockBadge(stock: number): { kind: Kind; label: string } {
  if (stock <= 0) return { kind: 'red', label: 'Out of stock' };
  if (stock < 200) return { kind: 'amber', label: 'Low stock' };
  return { kind: 'green', label: 'In stock' };
}
