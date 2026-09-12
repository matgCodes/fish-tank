# Fish Tank

Hackathon concept plan. Drafted 2026-09-12, revised same day after brainstorm.
Pre-build-day planning only. No code until build day.

## One line

An agent that lives in the glass-walled meeting room. It hears the meeting,
keeps the agenda on pace on the room display, writes decisions and action
items to the screen as they are spoken so the room can correct them live,
flips the door sign for people outside, and sends the follow-up the room
already validated.

## Assumptions

- Team of 2.
- One build day, date and hours not yet announced.
- No hardware. The "physical" surface is a door sign on a phone.
- Stack: Next.js, TypeScript, Anthropic SDK. Python not needed.
- No work email or City data anywhere in the demo. Outlook and Gmail stay out.
- Sponsors, credits, and the starter repo are unknown. Re-check this plan the
  day they publish, especially the speech-to-text choice.

## Eligibility

The project and its core functionality must be built during the event.
Before build day: accounts, keys, design on paper, dry-runs of risky pieces,
demo script. No repo, no code. First commit happens on build day. Be ready to
name what was built when.

## Why this clears the rubric

- The agent is in the room, not in a chat window. The context is ambient,
  multi-person, and real time. Nobody types the meeting into it.
- The room display is a shared surface. Corrections happen out loud, in the
  room, before the record exists. A chatbox cannot do that.
- The door sign faces outward through the glass. People outside see the state.
  That is the environment acting, without hardware.
- One loop, kept narrow, so it can be reliable on camera.

## What is cut and why

- AC and lighting control: IoT plumbing, no hardware, convinces nobody.
- Display connectivity: IT plumbing.
- Spoken output from the agent: intrusive, and a failure surface you cannot
  control on video. Everything the agent says goes on the screen.
- Speaker identification by voice or face: unreliable in a day and a privacy
  problem on camera. Attendees come from the invite. See the owner gap below.

## The loop

1. Import the calendar invite (.ics file or pasted invite). Parse attendees
   and the agenda with planned minutes per item from the description.
2. Room display shows the agenda with a per-item timer and a listening
   indicator.
3. Mic on the room laptop feeds speech-to-text. Finalized utterances go to the
   server.
4. Each utterance, with the agenda, attendees, and the current ledger, goes to
   Claude. Claude returns operations, not a fresh list: add item, update item,
   remove item, set current agenda item, set meeting state.
5. Operations apply to server state. Both displays update.
6. Pacing nudges render on the room display at 80 percent of an item's time
   and on overrun. On screen only.
7. Someone corrects out loud ("no, that's Sam's"). The next utterance produces
   an update operation. The screen changes. This is the hero shot.
8. Meeting ends, by "that's a wrap" or by the last item closing. Door sign
   flips to available. Room display shows a proposed follow-up. A human taps
   send.

## Surfaces

Two Next.js routes, one server.

**Room display** (laptop or TV in the room)
- Agenda with current item highlighted and time remaining.
- Ledger: decisions and action items with owner and due date.
- Badges: listening, not hearing, thinking, offline (keeping last ledger).
- Banner: "This room is listening" while active. Answers the consent question
  a judge will ask.
- Controls: pause listening, tap any ledger item to edit or delete, tap to
  assign an owner when it shows "owner?", tap to send the follow-up.

**Door sign** (phone in a browser, outside the glass)
- In use until 2:30. Running late. Available. Next: 3:00 Vendor review.
- Read only. Updates from the same state.

## Architecture

- Next.js app. API routes call Claude through `@anthropic-ai/sdk`.
- State lives in memory on the server. Displays subscribe by server-sent
  events. Demo runs on a local dev server with the phone on the same Wi-Fi.
- A Vercel deploy is optional and would need a real store. Do not spend build
  day on it. The video and the repo are what judges score.
- Stable item IDs. The ledger is passed into every Claude call and Claude
  returns diffs against it. Fresh lists each call make the correction moment
  flicker or drop items.

**Claude call, per the claude-api skill (verify against the TypeScript README
on build day before writing any SDK code)**
- Model `claude-opus-5`. Adaptive thinking is on by default, so omit the
  thinking parameter.
- `output_config.effort: "low"` for latency.
- Structured output through `output_config.format` for the operations
  schema. No prefill, it returns a 400 on this model.
- Prompt caching: instructions, agenda, attendees, and the operations schema
  are the stable prefix with a cache breakpoint. The current ledger and the
  rolling transcript window come after it.
- If measured latency on build day is too slow for the correction moment,
  `claude-sonnet-5` is available. That is your call, not a default.

**Speech-to-text: the decision that makes or breaks the day**
- Candidate 1: Chrome Web Speech API. No keys. Stops after silence, needs
  auto-restart. Quality is adequate for a scripted meeting.
- Candidate 2: a streaming provider over websockets (for example Deepgram or
  AssemblyAI). Keys, better quality, optional speaker labels.
- Do not pick from memory. Before build day, spend 20 minutes on each with a
  real mic in a real room and pick by result. If the sponsor list includes
  speech-to-text credits, that likely decides it.

**Build against a fixture first, plug the mic in last**
- Person 1 develops the extraction pipeline against a transcript text file
  replayed at real speed. Testable all morning without a mic.
- The same replay is the on-camera fallback if live speech-to-text misbehaves.
  Say so on camera. This keeps the concept alive instead of switching concepts
  midday.

## Owner attribution gap

Without speaker identification the agent cannot know who said "I'll take
that." Two honest fixes:
- The demo script speaks names aloud. "Sam, can you own the vendor follow-up?"
- Items with no clear owner show "owner?" and are tap-to-assign. The
  correction loop handles the rest.

Put the limitation in the README rather than let a judge find it.

## Failure states to build, not just handle

- Speech-to-text drops: "not hearing" badge, auto-restart, ledger unchanged.
- Claude call fails: "offline, keeping last ledger" badge, retry with backoff.
- Invite fails to parse: manual agenda entry screen.
- Duplicate or contradictory operations: last write wins by item ID, and
  every item is editable on screen.

## Follow-up channel

Slack incoming webhook to a throwaway workspace. Five minutes to provision,
visible in a second window on camera. A transactional email provider's test
domain is the alternative. Either is an output channel, not the environment.

## Team split

**First 30 minutes together**
- Operations schema and state shape on the whiteboard, then in one file.
- Repo init, Next.js scaffold, one shared state module.
- Freeze the demo script.

**Person 1: pipeline**
- Mic capture and speech-to-text with auto-restart.
- Utterance queue to the server.
- Claude extraction with ledger diff operations and caching.
- Meeting state machine: scheduled, in progress, wrapping, ended.
- Fixture replay mode.

**Person 2: surfaces and submission**
- Invite import and parse.
- Room display: agenda timer, ledger, badges, banner, controls.
- Door sign page.
- Follow-up render and send.
- README, video shot list, social post draft.

**Integration point:** the state schema. Once it is written, the two halves
do not need each other until the first end-to-end run.

## Build day timeline (relative to start)

| Hours | Work |
|---|---|
| 0:00 to 0:30 | Together: schema, scaffold, script freeze |
| 0:30 to 3:30 | Split build. Person 1 on fixture replay, no mic yet |
| 3:30 to 4:00 | First end-to-end run with the fixture |
| 4:00 to 4:30 | Plug in live speech-to-text |
| 4:30 to 6:30 | Harden. Rehearse the script until it runs clean three times |
| 6:30 to 8:00 | Freeze. Video, README, social post, submission form |

Adjust to the real hours when announced. Keep the final 90 minutes for
submission assets no matter what. A feature that lands inside that window is a
feature that breaks on camera.

## Pre-build-day prep (all eligible)

- [ ] Anthropic API key and `ant auth status` confirmed on both machines.
- [ ] Slack throwaway workspace with an incoming webhook, tested with curl.
- [ ] Speech-to-text bake-off, 20 minutes each, real mic, real room. Record
      the pick and why.
- [ ] Confirm the phone can reach a dev server on the laptop over Wi-Fi.
      macOS firewall may block it.
- [ ] Demo .ics invite with three agenda items, planned minutes, and three
      attendees.
- [ ] Scripted four-minute meeting dialogue, written out, with the beats below.
- [ ] Operations schema and state shape on paper.
- [ ] Video shot list. Phone in frame or picture-in-picture.
- [ ] Read the starter repo and sponsor list the day they drop. Re-check the
      speech-to-text pick and the follow-up channel against them.

## Demo script beats (four minutes)

1. Import the invite. Agenda and attendees appear. Door sign says in use.
2. Item 1 runs. One decision is spoken and lands on the ledger.
3. Pacing nudge appears on screen as item 1 runs long. Someone says "let's
   move on." Current item advances.
4. Item 2. "Sam, can you own the vendor follow-up by Friday?" Action item
   lands with owner and due date.
5. Second action item lands with no clear owner. Shows "owner?".
6. Correction: "no, that one's Priya's." Screen updates. Hold on this.
7. "That's a wrap." Meeting ends early. Door sign flips to available.
8. Proposed follow-up appears. Someone taps send. It shows up in Slack.

Rehearse until it runs clean three times in a row. Record one take.

## Rubric self-check

| Criterion | Target | What earns it |
|---|---|---|
| Functionality | 4 | One loop, fixture fallback, three clean rehearsals |
| Innovation | 4 to 5 | In-room correction and the outward door sign |
| Technical | 4 | Diff-based ledger, state machine, two synced surfaces, failure badges |
| Usefulness | 4 to 5 | Agenda and attendee context, visible controls, human sends |

## Considered and dropped

Browser pre-submit checker, Slack decision ledger, live-game second screen.
All weaker on the environment test than a room-resident agent, and none had
a hero moment as clean as the in-room correction.

## Open items

- Build day date and hours.
- Speech-to-text pick, after the bake-off.
- Sponsor list and starter repo.
