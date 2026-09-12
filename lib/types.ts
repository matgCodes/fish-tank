// Mirrors the operations schema decided on the "Operations schema and state
// shape" ticket (docs/ops-schema-draft.md). Change that file first.

export type MeetingStatus = "scheduled" | "in_progress" | "wrapping" | "ended";
export type ListeningStatus = "listening" | "not_hearing" | "paused" | "offline";
export type FollowUpStatus = "none" | "proposed" | "sent";
export type Source = "agent" | "human";
export type LedgerKind = "decision" | "action";

export interface Attendee {
  id: string;
  name: string;
  email?: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  plannedMinutes: number;
  startedAt?: string;
  endedAt?: string;
}

export interface LedgerItem {
  id: string;
  kind: LedgerKind;
  text: string;
  ownerId: string | null;
  due: string | null;
  source: Source;
  updatedAt: string;
}

export interface MeetingState {
  meeting: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: MeetingStatus;
  };
  attendees: Attendee[];
  agenda: AgendaItem[];
  currentAgendaItemId: string | null;
  ledger: LedgerItem[];
  listening: { status: ListeningStatus; lastHeardAt: string | null };
  followUp: { status: FollowUpStatus; text?: string; sentAt?: string; error?: string };
}

export type Operation =
  | { type: "add_item"; kind: LedgerKind; text: string; ownerId?: string | null; due?: string | null }
  | { type: "update_item"; id: string; text?: string; ownerId?: string | null; due?: string | null }
  | { type: "remove_item"; id: string }
  | { type: "set_current_agenda_item"; agendaItemId: string }
  | { type: "set_meeting_status"; status: MeetingStatus }
  | { type: "no_op" };

// Server-internal, not part of MeetingState.
export interface Utterance {
  text: string;
  receivedAt: string;
}
