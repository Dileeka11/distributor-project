import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

// Open modals, innermost last. Escape closes only the top one, so a form opened
// from inside another (e.g. adding a supplier from a GRN) keeps its parent open.
const openModals: symbol[] = [];

export function Modal({
  title, onClose, footer, children, lg, xl,
}: { title: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; lg?: boolean; xl?: boolean }) {
  // onClose is often a fresh arrow each render; read it through a ref so the
  // modal registers once, on mount, and keeps its place in the stack.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const me = Symbol('modal');
    openModals.push(me);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === me) closeRef.current();
    };
    document.addEventListener('keydown', handler);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      openModals.splice(openModals.indexOf(me), 1);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-[2px]"
      style={{ background: 'rgba(18,20,26,0.45)', animation: 'fade .16s ease' }}
      onClick={onClose}
    >
      <div
        className={cn(
          'card flex flex-col w-full',
          xl ? 'max-w-[1080px]' : lg ? 'max-w-[880px]' : 'max-w-[620px]',
        )}
        style={{ boxShadow: 'var(--shadow-lg, 0 24px 60px rgba(0,0,0,0.18))', maxHeight: 'calc(100vh - 48px)', animation: 'pop .18s cubic-bezier(.2,.9,.3,1)', borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="text-[17px] font-bold tracking-tight">{title}</div>
          <button
            className="w-8 h-8 rounded-md grid place-items-center hover:bg-surface-2"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-surface-2 rounded-b-[16px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Confirm({
  title, message, danger, confirmLabel = 'Confirm', onConfirm, onClose,
}: { title: string; message: ReactNode; danger?: boolean; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            style={danger ? { background: 'var(--red)' } : undefined}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{message}</div>
    </Modal>
  );
}
