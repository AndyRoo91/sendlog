/* Offline tick queue.
 *
 * Crags routinely have no signal, so a tick commit that fails on the network
 * must NOT be lost. When `commit()` can't reach the server, the payload is
 * parked here (localStorage) and replayed when connectivity returns —
 * triggered by the `online` event, an explicit `flush()`, or app load.
 *
 * On a successful replay we emit a `sendlog:tick-synced` CustomEvent so any
 * live view (the Tick Sheet) can swap its optimistic placeholder for the real
 * server entry. Listeners get the originating `clientId` to match on.
 *
 * Error policy: a network/offline failure stops the flush and keeps the item
 * for next time. A server *rejection* (HTTP 4xx/5xx — a poison payload) drops
 * the item so it can't wedge the queue forever. */
import { api } from "../api/client";
import type { BoulderEntry, LeadRouteEntry } from "../api/client";

const KEY = "sendlog.syncQueue.v1";
export const TICK_SYNCED_EVENT = "sendlog:tick-synced";

export type TickKind = "lead" | "boulder";

export interface QueuedTick {
  clientId: string;           // also the temp entry id (stringified negative number)
  sessionId: number;
  kind: TickKind;
  payload: Record<string, unknown>;
  queuedAt: number;
}

export interface TickSyncedDetail {
  clientId: string;
  sessionId: number;
  kind: TickKind;
  entry: LeadRouteEntry | BoulderEntry;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let flushing = false;

function read(): QueuedTick[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedTick[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedTick[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / unavailable — nothing we can usefully do */
  }
  listeners.forEach((l) => l());
}

/** Number of ticks waiting to sync. */
export function queueSize(): number {
  return read().length;
}

/** Subscribe to queue-size changes. Returns an unsubscribe fn. */
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Park a tick for later replay. */
export function enqueue(item: QueuedTick): void {
  write([...read(), item]);
}

/** Drop a queued tick by clientId (e.g. the user deleted its placeholder). */
export function dequeue(clientId: string): void {
  write(read().filter((q) => q.clientId !== clientId));
}

/** fetch() rejects with a TypeError on a true network failure; our req()
 *  helper throws Error("<status>: …") for HTTP responses. Only the former
 *  should be retried. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

function emitSynced(detail: TickSyncedDetail): void {
  window.dispatchEvent(new CustomEvent<TickSyncedDetail>(TICK_SYNCED_EVENT, { detail }));
}

/** Replay queued ticks oldest-first. Safe to call repeatedly; concurrent calls
 *  are coalesced. Stops at the first network failure and leaves the rest. */
export async function flush(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    while (true) {
      const items = read();
      if (items.length === 0) break;
      const item = items[0];
      try {
        const entry =
          item.kind === "lead"
            ? await api.addLead(item.sessionId, item.payload as Parameters<typeof api.addLead>[1])
            : await api.addBoulder(item.sessionId, item.payload as Parameters<typeof api.addBoulder>[1]);
        dequeue(item.clientId);
        emitSynced({ clientId: item.clientId, sessionId: item.sessionId, kind: item.kind, entry });
      } catch (err) {
        if (isNetworkError(err)) break;        // still offline → retry later
        dequeue(item.clientId);                // poison payload → drop it
      }
    }
  } finally {
    flushing = false;
  }
}

// Register replay triggers once, on import.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flush(); });
  // Best-effort replay on app load (covers a reload while items are pending).
  void flush();
}
