import { applyOps, type ApplyResult } from "./ops";
import type { MeetingState, Source, Utterance } from "./types";

type Listener = (state: MeetingState) => void;

interface Store {
  state: MeetingState;
  nextLedgerNumber: number;
  utterances: Utterance[];
  listeners: Set<Listener>;
  replayRun: number;
}

export function emptyState(): MeetingState {
  return {
    meeting: { id: "", title: "", startsAt: "", endsAt: "", status: "scheduled" },
    attendees: [],
    agenda: [],
    currentAgendaItemId: null,
    ledger: [],
    listening: { status: "offline", lastHeardAt: null },
    followUp: { status: "none" },
  };
}

// Route handlers can load as separate module instances in dev, so the one
// shared store lives on globalThis.
const holder = globalThis as typeof globalThis & { __fishTankStore?: Store };

export function getStore(): Store {
  holder.__fishTankStore ??= {
    state: emptyState(),
    nextLedgerNumber: 1,
    utterances: [],
    listeners: new Set(),
    replayRun: 0,
  };
  return holder.__fishTankStore;
}

export function getState(): MeetingState {
  return getStore().state;
}

export function subscribe(listener: Listener): () => void {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish() {
  const store = getStore();
  for (const listener of store.listeners) listener(store.state);
}

export function apply(ops: unknown[], source: Source): ApplyResult {
  const store = getStore();
  const result = applyOps(store.state, ops, source, {
    now: () => new Date().toISOString(),
    nextLedgerId: () => `L${store.nextLedgerNumber++}`,
  });
  for (const { op, reason } of result.dropped) console.warn("[ops] dropped:", reason, JSON.stringify(op));
  publish();
  return result;
}

export function resetState(seed: MeetingState = emptyState()) {
  const store = getStore();
  store.state = structuredClone(seed);
  const numbers = store.state.ledger.map((i) => Number(i.id.replace(/^L/, ""))).filter(Number.isFinite);
  store.nextLedgerNumber = Math.max(0, ...numbers) + 1;
  store.utterances = [];
  publish();
}

export function recordUtterance(text: string): Utterance {
  const utterance = { text, receivedAt: new Date().toISOString() };
  getStore().utterances.push(utterance);
  return utterance;
}
