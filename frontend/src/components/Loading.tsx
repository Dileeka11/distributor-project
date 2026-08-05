import { useEffect, useState } from 'react';
import { onProgress } from '@/lib/progress';

/**
 * The bar across the top of the app while requests are running.
 *
 * It is deliberately slow to appear and slow to leave: showing it for a request
 * that finishes in 80ms reads as a flicker, and snapping it away mid-sweep
 * looks broken. So it waits a moment before appearing, and once shown it always
 * runs to the end.
 */
export function TopProgress() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    const stop = onProgress((busy) => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      if (busy) {
        showTimer = window.setTimeout(() => setVisible(true), 140);
      } else {
        hideTimer = window.setTimeout(() => setVisible(false), 220);
      }
    });

    return () => {
      stop();
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 100,
        pointerEvents: 'none', overflow: 'hidden',
        opacity: visible ? 1 : 0, transition: 'opacity .2s ease',
      }}
    >
      <div
        style={{
          height: '100%', width: '40%',
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          animation: 'kkSweep 1.1s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/** Spinner + label, for a page whose code or data has not arrived yet. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-20" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '2.5px solid var(--border-strong)', borderTopColor: 'var(--accent)',
            animation: 'kkSpin .7s linear infinite',
          }}
        />
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
    </div>
  );
}
