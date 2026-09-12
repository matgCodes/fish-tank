import type { LedgerKind, MeetingState, MeetingStatus, Operation, Source } from "./types";

export interface ApplyContext {
  now: () => string;
  nextLedgerId: () => string;
}

export interface DroppedOp {
  op: unknown;
  reason: string;
}

export interface ApplyResult {
  applied: Operation[];
  dropped: DroppedOp[];
}

const KINDS: LedgerKind[] = ["decision", "action"];
const STATUSES: MeetingStatus[] = ["scheduled", "in_progress", "wrapping", "ended"];

// Applies operations in order, mutating state. Operations that break a schema
// rule are dropped and reported, never thrown, so one bad op cannot sink a batch.
export function applyOps(state: MeetingState, ops: unknown[], source: Source, ctx: ApplyContext): ApplyResult {
  const result: ApplyResult = { applied: [], dropped: [] };
  const drop = (op: unknown, reason: string) => result.dropped.push({ op, reason });

  for (const raw of ops) {
    const op = raw as Operation;
    switch (op?.type) {
      case "add_item": {
        if (!KINDS.includes(op.kind) || typeof op.text !== "string" || !op.text.trim()) {
          drop(op, "add_item needs a kind and text");
          break;
        }
        state.ledger.push({
          id: ctx.nextLedgerId(),
          kind: op.kind,
          text: op.text,
          ownerId: op.ownerId ?? null,
          due: op.due ?? null,
          source,
          updatedAt: ctx.now(),
        });
        result.applied.push(op);
        break;
      }
      case "update_item": {
        const item = state.ledger.find((i) => i.id === op.id);
        if (!item) {
          drop(op, `unknown ledger id ${op.id}`);
          break;
        }
        if (typeof op.text === "string" && op.text.trim()) item.text = op.text;
        if (op.ownerId !== undefined) item.ownerId = op.ownerId;
        if (op.due !== undefined) item.due = op.due;
        item.source = source;
        item.updatedAt = ctx.now();
        result.applied.push(op);
        break;
      }
      case "remove_item": {
        const index = state.ledger.findIndex((i) => i.id === op.id);
        if (index === -1) {
          drop(op, `unknown ledger id ${op.id}`);
          break;
        }
        state.ledger.splice(index, 1);
        result.applied.push(op);
        break;
      }
      case "set_current_agenda_item": {
        const next = state.agenda.find((a) => a.id === op.agendaItemId);
        if (!next) {
          drop(op, `unknown agenda id ${op.agendaItemId}`);
          break;
        }
        if (state.currentAgendaItemId !== next.id) {
          const now = ctx.now();
          const leaving = state.agenda.find((a) => a.id === state.currentAgendaItemId);
          if (leaving) leaving.endedAt = now;
          next.startedAt = now;
          delete next.endedAt;
          state.currentAgendaItemId = next.id;
        }
        result.applied.push(op);
        break;
      }
      case "set_meeting_status": {
        if (!STATUSES.includes(op.status)) {
          drop(op, `unknown status ${op.status}`);
          break;
        }
        if (op.status === "ended" && source === "agent") {
          drop(op, "only the room's tap can end the meeting");
          break;
        }
        state.meeting.status = op.status;
        result.applied.push(op);
        break;
      }
      case "no_op":
        result.applied.push(op);
        break;
      default:
        drop(raw, "unknown operation type");
    }
  }

  return result;
}
