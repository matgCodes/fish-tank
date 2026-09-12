import { apply, getStore, recordUtterance, resetState } from "./store";
import type { MeetingState, Operation } from "./types";

export interface FixtureEntry {
  atMs: number;
  speaker?: string;
  text: string;
  // Scripted ops for building surfaces before extraction exists.
  // The extraction pipeline replaces these with Claude's ops.
  ops?: Operation[];
}

export interface Fixture {
  name: string;
  meeting: MeetingState;
  script: FixtureEntry[];
}

export type UtteranceHandler = (entry: FixtureEntry) => void | Promise<void>;

// Default handler: record the utterance, then apply the entry's scripted ops.
export const scriptedHandler: UtteranceHandler = (entry) => {
  recordUtterance(entry.text);
  if (entry.ops?.length) apply(entry.ops, "agent");
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resets state to the fixture's meeting, then feeds each utterance at its
// offset. Starting a new replay stops any replay still running.
export async function replayFixture(
  fixture: Fixture,
  { onUtterance = scriptedHandler, speed = 1 }: { onUtterance?: UtteranceHandler; speed?: number } = {},
) {
  const store = getStore();
  const run = ++store.replayRun;
  resetState(fixture.meeting);
  const startedAt = Date.now();

  for (const entry of fixture.script) {
    const wait = entry.atMs / speed - (Date.now() - startedAt);
    if (wait > 0) await sleep(wait);
    if (store.replayRun !== run) return;
    await onUtterance(entry);
  }
}
