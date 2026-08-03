// Detects that the browser was closed between visits, so the app can insist on
// a fresh sign-in.
//
// The server already issues the session as a browser-session cookie (no Expires),
// which is meant to disappear when the browser closes. Chrome and Edge undo that:
// with "Continue where you left off" enabled they restore session cookies — and
// sessionStorage with them — so nothing the browser hands us can tell a reopened
// window apart from a reloaded one.
//
// What a close does leave behind is a gap in time. The app writes a timestamp
// while it is open; if the last one is older than the grace period, the app was
// not running, and we treat that as a new visit.

const LAST_SEEN_KEY = 'kk.session.lastSeen';

// Written this often while the app is open.
const BEAT_MS = 15_000;
// Comfortably longer than a beat, so a slow tab never logs itself out.
const GRACE_MS = 60_000;

const now = () => Date.now();

function readLastSeen(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markSeen(): void {
  try { localStorage.setItem(LAST_SEEN_KEY, String(now())); } catch { /* private mode */ }
}

export function clearSeen(): void {
  try { localStorage.removeItem(LAST_SEEN_KEY); } catch { /* private mode */ }
}

/**
 * True when the app has not been running recently — a first visit, or the
 * browser having been closed and reopened. A plain reload keeps the timestamp
 * fresh, so refreshing mid-work does not sign anyone out.
 */
export function isNewBrowserVisit(): boolean {
  const last = readLastSeen();
  return last === null || now() - last > GRACE_MS;
}

/**
 * True when the app was opened straight at /login. Arriving there is a request
 * to sign in, so any session still alive is ended rather than walked past.
 */
export function isLoginRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/login';
}

/** Keep the timestamp warm while the app is open. Returns a cleanup function. */
export function startPresenceHeartbeat(): () => void {
  markSeen();
  const timer = window.setInterval(markSeen, BEAT_MS);
  // A tab coming back to the foreground should refresh immediately rather than
  // wait out the interval.
  const onVisible = () => { if (document.visibilityState === 'visible') markSeen(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', markSeen);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pagehide', markSeen);
  };
}
