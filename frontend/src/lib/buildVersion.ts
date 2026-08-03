// Reloads the app when the server has a newer build than the one running.
//
// index.html is served no-cache, so normally a deploy is picked up on the next
// load. But a browser that cached index.html *before* that header existed will
// keep replaying the old copy — and with it the old bundles, which are still on
// the server — without ever asking again. Nothing in the page can clear that
// entry, so the fix is to re-request the document under a URL the cache has
// never seen.

const ENTRY_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;
const RELOADED_FOR = 'kk.build.reloadedFor';

/** The entry bundle this page is actually running. Null under the dev server. */
function runningEntry(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[src*="assets/index-"]');
  return el ? (el.src.match(ENTRY_RE)?.[0] ?? null) : null;
}

/** The entry bundle the server is handing out right now. */
async function publishedEntry(): Promise<string | null> {
  const res = await fetch(`/index.html?_cb=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.text()).match(ENTRY_RE)?.[0] ?? null;
}

/**
 * Checks once, and reloads through a fresh URL if the build has moved on.
 *
 * The reload is recorded against the version it was for, so a page that somehow
 * keeps coming back stale asks for it once and then gives up rather than
 * looping.
 */
export async function reloadIfBuildChanged(): Promise<void> {
  try {
    const running = runningEntry();
    if (!running) return; // dev server — no hashed entry to compare

    const published = await publishedEntry();
    if (!published || published === running) return;

    if (sessionStorage.getItem(RELOADED_FOR) === published) return;
    sessionStorage.setItem(RELOADED_FOR, published);

    // A query the cache has not seen forces the document to come from the
    // server, which is the only way past an already-cached index.html.
    const url = new URL(window.location.href);
    url.searchParams.set('_v', published.replace(/\D/g, '').slice(-8) || '1');
    window.location.replace(url.toString());
  } catch {
    // Offline, or the check itself failed — never block the app for this.
  }
}
