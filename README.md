# Fish Tank

An agent that lives in the glass-walled meeting room. It hears the meeting,
keeps the agenda on pace on the room display, writes decisions and action
items to the screen as they are spoken so the room can correct them live,
flips the door sign for the people outside, and proposes the follow-up the
room already validated. A human taps send.

Built in one day at the hackathon on 2026-09-12. Everything in this repo was
built during the event. Planning notes from before build day are in
`docs/CONCEPT_PLAN.md`; the decided operations schema is
`docs/ops-schema-draft.md`.

## Why the room matters

The agent is not a chat window. It is a participant with hands. The room
display is a shared surface: when the agent hears "Sam, can you own the
contract by Friday" the action item appears on the wall with Sam's name, and
when someone says "no, that one's Priya's" the same item updates in front of
everyone. Corrections happen in the room before the record exists. The door
sign faces outward through the glass, so people outside see "in use",
"running late", or "available" without opening a calendar.

## Run it

Requires Node 20 or newer. No build step, no framework.

```
cd standalone
cp .env.example .env      # add ANTHROPIC_API_KEY
node server.js
```

The `standalone/` folder is the complete demo loop in one dependency-free
Node file. The Next.js app at the repo root is the same design being built
out with typed state, tests, and components; it shares the operations schema
and the fixture format.

- Room display: http://localhost:3000/ on the laptop or TV in the room.
- Door sign: the LAN address printed at startup, path `/door`, on a phone
  outside the glass.
- Optional: set `SLACK_WEBHOOK_URL` in `.env` to post the follow-up to Slack.
  Without it the follow-up is rendered on screen and logged.

## Two ways to feed it

- **Replay** (the recorded demo): "Start replay" plays the scripted meeting in
  `fixture/script.json` at real speed, line by line, through the same path a
  live mic uses.
- **Live mic:** "Mic on" uses Chrome's Web Speech API with auto-restart after
  silence. Same server path, same ledger.

Both send final utterances to the server, which sends each one, with the
agenda, attendees, and the current ledger, to Claude. Claude returns
operations against existing ledger ids, never a fresh list, so a correction
updates the item on screen instead of adding a second one.

## What the room controls

- Pause listening. A banner shows whenever the room is being heard.
- Tap any ledger item to edit its text, change or set its owner, or delete it.
- Tap an agenda item to move to it. Pacing nudges appear on screen only; the
  agent never speaks.
- End the meeting. The door sign flips, and the follow-up is proposed, not
  sent, until a human taps send.

## Failure states

- Agent call fails: "offline, keeping last ledger" badge, one retry, ledger
  untouched.
- No final speech for 45 seconds while listening: "not hearing" badge.
- Follow-up post fails: visible error on screen, item stays proposed.
- Unknown ledger ids from the model are dropped and logged.

## Known limitation

Without speaker identification the agent cannot tell who said "I'll take
that." Owners come from names spoken aloud and from the attendee list. Items
with no clear owner show "owner?" and are assigned by tapping them on the room
display. Attendees and agenda come from `fixture/script.json`; invite import
was cut for time.

## Stack

Node, one file server with server-sent events, two static pages, the Claude
API (`claude-opus-5`, structured output, low effort, cached system prefix)
called over raw HTTP because the venue network would not finish an npm
install in time.
