// How many requests are in flight, so the UI can show that it is working.
//
// Driven from the HTTP layer rather than from each page: every screen loads its
// data through `http`, so counting there covers all of them at once and cannot
// drift out of sync with a page that forgets to flip its own flag.

type Listener = (busy: boolean) => void;

let inFlight = 0;
const listeners = new Set<Listener>();

const notify = () => {
  const busy = inFlight > 0;
  listeners.forEach((fn) => fn(busy));
};

export function progressStart(): void {
  inFlight += 1;
  notify();
}

export function progressDone(): void {
  inFlight = Math.max(0, inFlight - 1);
  notify();
}

export function onProgress(fn: Listener): () => void {
  listeners.add(fn);
  fn(inFlight > 0);
  return () => { listeners.delete(fn); };
}
