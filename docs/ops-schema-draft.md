# Operations schema

Decided on the "Operations schema and state shape" ticket (#2). Both halves
of the build code against this file. Guiding rule: simple enough to reach a
working prototype, and every agent action the room might need to reverse has
one tap on the display.

## State

```
MeetingState
  meeting:      { id, title, startsAt, endsAt, status }
                status: scheduled | in_progress | wrapping | ended
  attendees:    [{ id, name, email? }]
  agenda:       [{ id, title, plannedMinutes, startedAt?, endedAt? }]
                startedAt / endedAt stamped by the server, never by Claude
  currentAgendaItemId: string | null
  ledger:       [LedgerItem]
  listening:    { status, lastHeardAt }
                status: listening | not_hearing | paused | offline
  followUp:     { status, text?, sentAt? }
                status: none | proposed | sent

LedgerItem
  id:        string, stable, assigned by the server on add ("L1", "L2", ...)
  kind:      decision | action
  text:      string
  ownerId:   attendee id | null
  due:       ISO date | null
  source:    agent | human
  updatedAt: ISO datetime
```

Server-internal, not in `MeetingState`: finalized utterances as
`{ text, receivedAt }`, with `receivedAt` stamped by the server.

## Operations

Claude returns one array of operations per utterance. Display taps send the
same operations through the same applier.

```
add_item                { kind, text, ownerId?, due? }   server assigns id
update_item             { id, text?, ownerId?, due? }
remove_item             { id }                           hard delete
set_current_agenda_item { agendaItemId }
set_meeting_status      { status }
no_op                   {}                               nothing actionable
```

Display taps

| Tap | Operation |
|---|---|
| Agenda item | `set_current_agenda_item` |
| Edit a ledger item, or assign "owner?" | `update_item` |
| Delete a ledger item | `remove_item` |
| "End meeting?" confirm | `set_meeting_status { status: ended }` |

## Rules

- Claude receives the full current ledger with ids and must reference
  existing ids for update and remove.
- The server applies operations in order. Unknown ids are dropped and logged.
- Last write wins by item id. A human edit sets `source: human` but does not
  lock the item; a later spoken correction can still change it.
- Claude emits `update_item` only when the utterance explicitly corrects that
  item.
- Claude sets `ownerId` only when a name is spoken or clearly resolves to an
  attendee, and `due` only when a date is stated. Otherwise `null`. No guessing.
- On `set_current_agenda_item`, the server stamps `endedAt` on the item being
  left and `startedAt` on the new one.
- Claude may set meeting status to `in_progress` or `wrapping`, never `ended`.
  "That's a wrap" and the last agenda item closing both mean `wrapping`.
  Server drops an agent `ended`.
- `wrapping` shows "End meeting?" on the room display. Only that tap sets
  `ended`. The door sign flips to available on `ended`, not on `wrapping`.

## Rendering

- Action item, `ownerId: null`: "owner?", tap to assign.
- Action item, `due: null`: nothing.
- Decision: no owner or due shown.

## Claude call shape

- System prompt, cached prefix: instructions, this schema, agenda, attendees.
- User turn: current ledger as JSON, finals received in the last 60 seconds,
  the new utterance.
- Window is a tunable constant, `TRANSCRIPT_WINDOW_SECONDS = 60`, measured by
  server `receivedAt`, so it behaves the same whichever speech-to-text path
  (#5) is active. Tune it in fixture replay (#11).
- Structured output: `output_config.format` with a JSON schema of
  `{ ops: Operation[] }`.
- `output_config.effort: "low"`.
- Model `claude-opus-5`. Thinking parameter omitted.

## Decisions

1. Human edits do not lock a field. Last write wins by item id.
2. The agenda advances by operation from Claude and by tapping an agenda
   item. The server stamps agenda times.
3. Transcript window is the last 60 seconds of finals, tunable.
4. No `flag_unclear`. Null means unclear; "owner?" plus tap-to-assign is
   enough for the build.
5. Claude can propose ending (`wrapping`); only the room's tap sets `ended`.
6. `remove_item` is a hard delete. A wrong removal is an accepted risk,
   checked in fixture replay.
