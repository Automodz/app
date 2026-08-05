/**
 * SIGN-IN STAGE TRACE — temporary diagnostic instrumentation.
 *
 * NOT PART OF THE PRODUCT. This exists to answer one question: at which stage
 * does signing in stop? Remove it once that is known.
 *
 * WHY IT IS NOT JUST `console.log`. The failure reproduces on iPhone Safari,
 * where there is no console without tethering the phone to a Mac and opening
 * Web Inspector. An instrument that cannot be read in the environment it is
 * measuring is not an instrument. So each stage goes three places:
 *
 *   console        for desktop
 *   localStorage   survives the popup, the redirect, and the page being
 *                  replaced — which matters, because the flow currently dies
 *                  on another origin and takes the tab's memory with it
 *   a subscriber   so the login screen can show the trail on the device
 *
 * Stages are numbered exactly as specified so a screenshot maps to the list
 * without interpretation.
 */

export interface TraceEntry {
  /** 1–9, matching the stage list. */
  stage: number;
  label: string;
  /** ms since the attempt began. */
  at: number;
  /** Anything worth carrying — a status code, an error code, a uid. */
  detail?: string;
}

const KEY = 'automodz-auth-trace';

let started = 0;
let entries: TraceEntry[] = [];
const listeners = new Set<(e: TraceEntry[]) => void>();

/** Begin a fresh attempt. Clears the previous trail. */
export function traceStart(): void {
  started = Date.now();
  entries = [];
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  listeners.forEach(fn => fn(entries));
}

export function trace(stage: number, label: string, detail?: string): void {
  const entry: TraceEntry = {
    stage,
    label,
    at: started ? Date.now() - started : 0,
    ...(detail ? { detail } : {}),
  };
  entries = [...entries, entry];

  /* eslint-disable-next-line no-console */
  console.log(`[auth ${stage}] ${label}${detail ? ` — ${detail}` : ''} (+${entry.at}ms)`);

  /* Written on every stage rather than at the end, because the stage we most
     need to see is the one after which nothing else runs. */
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* private mode */ }

  listeners.forEach(fn => fn(entries));
}

/** The trail from this attempt, or the one that died on a previous page. */
export function traceRead(): TraceEntry[] {
  if (entries.length) return entries;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as TraceEntry[] : [];
  } catch {
    return [];
  }
}

export function traceSubscribe(fn: (e: TraceEntry[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** One line per stage, for copying out of a screenshot or a share sheet. */
export function traceText(): string {
  return traceRead()
    .map(e => `${e.stage}. ${e.label}${e.detail ? ` — ${e.detail}` : ''} (+${e.at}ms)`)
    .join('\n');
}
