# Operations schema, draft

Artifact for the "Operations schema and state shape" ticket. React to it
there. This is a draft, not a decision.

## State

```
MeetingState
  meeting:      { id, title, startsAt, endsAt, status }
                status: scheduled | in_progress | wrapping | ended
  attendees:    [{ id, name, email? }]
  agenda:       [{ id, title, plannedMinutes, startedAt?, endedAt? }]
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
  ownerId:   attendee id | null      (null renders as "owner?")
  due:       ISO date | null
  source:    agent | human
  updatedAt: ISO datetime
```

## Operations

Claude returns one array of operations per utterance.

```
add_item                { kind, text, ownerId?, due? }   server assigns id
update_item             { id, text?, ownerId?, due? }
remove_item             { id }
set_current_agenda_item { agendaItemId }
set_meeting_status      { status }
no_op                   {}                               nothing actionable
```

Rules

- Claude receives the full current ledger with ids and must reference
  existing ids for update and remove.
- The server applies operations in order. Unknown ids are dropped and logged.
- A human edit on the display sets `source: human`.
- Claude maps spoken names to attendee ids. Unresolved owner means
  `ownerId: null`.

## Claude call shape

- System prompt, cached prefix: instructions, this schema, agenda, attendees.
- User turn: current ledger as JSON, the last 8 utterances, the new
  utterance.
- Structured output: `output_config.format` with a JSON schema of
  `{ ops: Operation[] }`.
- `output_config.effort: "low"`.
- Model `claude-opus-5`. Thinking parameter omitted.

## Open questions for the ticket

1. Does a human edit lock that field against later agent updates, or can a
   spoken correction still move it?
2. Does "let's move on" advance the agenda by operation, or only by a button
   on the display?
3. Is a rolling window of 8 utterances right?
4. Do we want a `flag_unclear { id }` operation that marks an item with "?"
   instead of guessing an owner or due date?
