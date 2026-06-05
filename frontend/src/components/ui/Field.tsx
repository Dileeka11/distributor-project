import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label, hint, req, full, children,
}: { label: string; hint?: ReactNode; req?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'col-span-2')}>
      <label className="field-label">
        {label}
        {req && <span className="ml-0.5" style={{ color: 'var(--accent)' }}>*</span>}
      </label>
      {children}
      {hint && <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>{hint}</div>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('select', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('textarea', props.className)} />;
}

export function MoneyInput({
  value, onChange, placeholder, ...rest
}: { value: string | number; onChange: (v: string) => void; placeholder?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={String(value ?? '')}
      placeholder={placeholder ?? '0.00'}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      className="mono"
      {...rest}
    />
  );
}
