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

## Run it

```sh
npm install
npm run dev        # binds 0.0.0.0:3000 so a phone on the same Wi-Fi can load it
npm test           # operations applier
```

Open `http://<laptop LAN IP>:3000` on every display. On macOS, allow
incoming connections for node if the firewall asks.

| Path | What it does |
|---|---|
| `lib/types.ts` | `MeetingState` and `Operation`, mirroring `docs/ops-schema-draft.md` |
| `lib/ops.ts` | The operations applier. Pure; drops invalid ops with a reason |
| `lib/store.ts` | The one in-memory store on `globalThis`, with subscribe and publish |
| `lib/replay.ts` | Fixture replay entry point. Pass `onUtterance` to plug in extraction |
| `fixtures/demo.json` | Stub meeting and script with scripted ops per utterance |
| `POST /api/ops` | `{ source: "agent" \| "human", ops: Operation[] }` |
| `GET /api/events` | Server-sent events: full state on connect and on every change |
| `POST /api/replay` | `{ fixture?: "demo", speed?: number }` resets state and replays |

```sh
curl -X POST localhost:3000/api/ops -H 'content-type: application/json' \
  -d '{"source":"human","ops":[{"type":"add_item","kind":"action","text":"Test"}]}'
curl -X POST localhost:3000/api/replay -H 'content-type: application/json' -d '{"speed":10}'
```

State is in memory: restarting the dev server clears it.

## Known limitation

Without speaker identification the agent cannot tell who said "I'll take
that." Owners are inferred from names spoken aloud and from the invite's
attendee list. Items with no clear owner show "owner?" and are assigned by
tapping them on the room display.
