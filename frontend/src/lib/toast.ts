// Minimal toast — replaces console-only feedback for mutations
export function toast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:20px',
    'padding:11px 16px', 'border-radius:9px',
    'font-size:13px', 'font-weight:600', 'z-index:9999',
    `background:${kind === 'ok' ? 'var(--green-soft)' : 'var(--red-soft)'}`,
    `color:${kind === 'ok' ? 'var(--green)' : 'var(--red)'}`,
    `border:1px solid ${kind === 'ok' ? 'var(--green)' : 'var(--red)'}`,
    'box-shadow:0 4px 14px rgba(15,18,25,.08)',
    'animation:fade .2s ease',
  ].join(';');
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; }, 2300);
  setTimeout(() => el.remove(), 2700);
}
