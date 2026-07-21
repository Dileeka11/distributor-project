import Swal from 'sweetalert2';

const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// Corner toast used for every create / update / delete / error feedback.
const ToastMixin = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export function toast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
  void ToastMixin.fire({ icon: kind === 'ok' ? 'success' : 'error', title: msg });
}

// Centered SweetAlert modal used for blocking errors (e.g. failed sign in).
export function alertError(title: string, text?: string): Promise<void> {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'OK',
    confirmButtonColor: cssVar('--accent', '#C8102E'),
  }).then(() => undefined);
}

// SweetAlert confirmation used for destructive actions (delete).
export function confirmDelete(opts: { title?: string; html?: string; confirmText?: string } = {}): Promise<boolean> {
  return Swal.fire({
    title: opts.title ?? 'Are you sure?',
    html: opts.html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Yes, delete',
    cancelButtonText: 'Cancel',
    confirmButtonColor: cssVar('--accent', '#C8102E'),
    cancelButtonColor: '#9aa1ab',
    reverseButtons: true,
    focusCancel: true,
  }).then((r) => r.isConfirmed);
}
