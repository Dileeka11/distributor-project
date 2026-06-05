import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'subtle';
type Size = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'subtle', size = 'md', icon, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'subtle' && 'btn-subtle',
        size === 'sm' && 'btn-sm',
        !children && 'btn-icon',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
