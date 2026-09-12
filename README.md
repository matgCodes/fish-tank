# Fish Tank

An agent that lives in the glass-walled meeting room. It hears the meeting,
keeps the agenda on pace on the room display, writes decisions and action
items to the screen as they are spoken so the room can correct them live,
flips the door sign for people outside, and sends the follow-up the room
already validated.

Hackathon build, 2026-09-12. Everything in this repo was built during the
event. Planning notes from before build day are in `docs/CONCEPT_PLAN.md`.

## Where the work is tracked

The build is charted as a wayfinder map on this repo's GitHub Issues. Open
the issue labelled `wayfinder:map` for the destination, decisions so far, and
the open tickets. See `docs/agents/issue-tracker.md`.

## Known limitation

Without speaker identification the agent cannot tell who said "I'll take
that." Owners are inferred from names spoken aloud and from the invite's
attendee list. Items with no clear owner show "owner?" and are assigned by
tapping them on the room display.
