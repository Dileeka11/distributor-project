import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Modal({
  title, onClose, footer, children, lg, xl,
}: { title: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; lg?: boolean; xl?: boolean }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

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
