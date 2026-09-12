# Demo script

Status: **frozen** by the "Demo script freeze" ticket (#7).

This is the four-minute meeting the demo runs, line by line, with what the room
display shows after each line. It is also the fixture transcript the extraction
pipeline (#11) is built against. The same script in fixture form is in
[`demo-script.fixture.json`](demo-script.fixture.json); #11 copies it over the
stub `fixtures/demo.json` from the scaffold PR.

Operations follow [`ops-schema-draft.md`](ops-schema-draft.md).

## Invite

This is also the demo invite for invite import (#8).

| Field | Value |
|---|---|
| Title | Launch check-in |
| Starts | 2026-09-12 14:00 (-07:00) |
| Ends | 2026-09-12 14:15 (-07:00) |
| Attendees | Sam `a1`, Dana `a2`, Jordan `a3` |

| Agenda item | Id | Planned minutes |
|---|---|---|
| Launch status | `g1` | 1 |
| Vendor contracts | `g2` | 2 |
| Launch date | `g3` | 1 |

The planned minutes are small on purpose. The pacing nudge fires at 80 percent
of an item's time, so a 1-minute first item nudges at 48 seconds and runs over
at 60 seconds, inside a live read.

The meeting ends about 2:03 PM against a 2:15 PM invite, so the door sign flips
to available visibly early.

## Cast

- **Jordan** runs the meeting. Played by one teammate.
- **Sam** reports status. Played by the other teammate.
- **Dana** is on the invite and not in the room. She is only named.

Dana was picked on the speech-to-text bench. See [Name check](#name-check).

## Before recording

- Invite imported. Display shows the agenda, three attendees, empty ledger, badge "listening".
- Door sign shows "In use until 2:15 PM".

## Script

Times are seconds from the first line. A line is about 7 seconds at a normal pace.

| t | Speaker | Line | Operations | Expected on screen |
|---|---|---|---|---|
| 0 | Jordan | Okay, let's get started. First up is launch status. | `set_meeting_status in_progress`, `set_current_agenda_item g1` | Launch status highlighted, 1:00 counting down |
| 7 | Sam | The build is green and the landing page is up on staging. | `no_op` | No change |
| 15 | Jordan | Nice. The open question is the blue design or the old one. | `no_op` | No change |
| 23 | Sam | The blue design tested better with users last week. | `no_op` | No change |
| 31 | Jordan | Okay, we've decided. We're launching with the blue design. | `add_item decision "Launch with the blue design"` | **L1** decision appears |
| 40 | Sam | Good, that settles a long debate. | `no_op` | No change |
| 48 | Sam | The launch checklist is about half done. | `no_op` | **Pacing nudge** appears at 48 s. Proposed wording: "Launch status: 12 seconds left" |
| 56 | | *[Jordan glances at the display. Hold through 60 s so the overrun shows.]* | | Nudge changes to overrun. Proposed wording: "Launch status is over time" |
| 66 | Jordan | We're running over on this one. Let's move on. | `set_current_agenda_item g2` | Vendor contracts highlighted, 2:00 counting down, nudge clears |
| 73 | Jordan | Next up, vendor contracts. The print vendor still hasn't signed. | `no_op` | No change |
| 81 | Jordan | Sam, can you own the vendor follow-up by Friday? | `add_item action "Vendor follow-up" owner a1 due 2026-09-18` | **L2** action: Sam, due Fri Sep 18 |
| 89 | Sam | Yes, I'll get it done by Friday. | `no_op` | No change. A confirmation must not add a second item |
| 97 | Sam | Jordan, can you send the launch announcement by Wednesday? | `add_item action "Send the launch announcement" owner a3 due 2026-09-16` | **L3** action: Jordan, due Wed Sep 16 |
| 105 | Jordan | Sure, Wednesday works. | `no_op` | No change |
| 113 | Jordan | Someone also needs to update the budget spreadsheet before the review. | `add_item action "Update the budget spreadsheet before the review"` | **L4** action with **"owner?"** |
| 121 | Sam | I can take that. | `no_op` | Still "owner?". Without speaker identification the agent can't know who "I" is |
| 129 | Jordan | No, that one's Dana's. She owns the budget. | `update_item L4 owner a2` | **L4 owner changes to Dana in place.** Hold 5 seconds |
| 139 | Jordan | Last item is the launch date, but we already covered it. | `set_current_agenda_item g3` | Launch date highlighted |
| 147 | Jordan | That's a wrap. Thanks, everyone. | `set_meeting_status wrapping` | **"End meeting?"** prompt |
| 155 | | *[Jordan taps "End meeting?"]* | Human: `set_meeting_status ended` | Meeting ended. Proposed follow-up appears |
| 160 | | *[Cut to the door sign phone.]* | | Door sign flips to **Available** |
| 175 | | *[Sam reads the follow-up and taps Send.]* | Human: send follow-up | Follow-up marked sent |
| 185 | | *[Cut to the Slack channel.]* | | Follow-up message in Slack. Hold to about 3:30 |

## Proposed follow-up text

A proposal for the follow-up ticket (#13), not a decision.

```
Launch check-in, Sat Sep 12

Decisions
- Launch with the blue design

Action items
- Sam: Vendor follow-up, due Fri Sep 18
- Jordan: Send the launch announcement, due Wed Sep 16
- Dana: Update the budget spreadsheet before the review

Attendees: Sam, Dana, Jordan
```

## What the script is built around

- **Every required beat appears once.** Three agenda items with minutes, one
  decision, two action items with owners named aloud, one item with no clear
  owner, one spoken correction, one pacing nudge, an early wrap, and the
  follow-up sent.
- **The correction updates, it does not add.** L4 changes owner in place. That
  is the #11 done-when test.
- **"I can take that" stays "owner?".** It shows the known limitation from the
  README on camera, and the next line fixes it.
- **Status talk is `no_op`.** Five lines exist so the agent visibly ignores
  chatter, and to fill the time before the nudge.
- **Trigger phrases are plain.** "Let's move on" and "That's a wrap" were heard
  correctly in nearly every bench pass.
- **18 spoken lines.** Every line is a Claude call when live.

## Notes for extraction and replay (#11)

- "By Friday" resolves to 2026-09-18 and "by Wednesday" to 2026-09-16 only if
  the meeting date is in the prompt. Put `meeting.startsAt` in the cached prefix.
- Replay can't express the three taps. The applier drops an agent `ended`, and
  send is a human action. The fixture lists them under `taps` with
  `source: "human"`. Replay needs to apply those to reach the door sign flip
  and the follow-up.
- Who sets `followUp.status: proposed` on `ended` is open for #13.
- On the bench, Web Speech once heard "follow-up" as "follower". Extraction
  should tolerate small mishears like that.

## Name check

The correction line was read on the speech-to-text bench with both engines
listening, on 2026-09-12. "Priya" comes from the #6 run.

| Name | Web Speech API | AssemblyAI streaming |
|---|---|---|
| Dana | 2 of 2 correct | 2 of 2 correct |
| Marcus | 1 of 1 correct | 1 of 1 correct |
| Maya | 1 of 2, once heard as "miles" | 2 of 2 correct |
| Elena | 0 of 2, heard as "Alanis" and "Atlantis" | 2 of 2 correct |
| Priya | 0 of 4 | 0 of 4 |

"Sam" and "Jordan" were heard correctly by both engines in the action-item lines.
