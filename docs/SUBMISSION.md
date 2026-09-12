# Submission text

## Title

Fish Tank

## Description

Fish Tank is an agent that lives in the glass-walled meeting room instead of
in a chat window. It listens to the meeting, keeps the agenda on pace on the
room display, and writes decisions and action items to the wall as they are
spoken, with the owner and due date it heard. The room corrects it out loud:
"no, that one's Priya's" updates the item in front of everyone before it ever
becomes a record. A door sign on a phone outside the glass flips between in
use, running late, and available. When someone says "that's a wrap," the
door sign goes green and the agent proposes a follow-up built from what the
room already validated. A human taps send.

The environment is the point. The agent hears everyone at once, acts on a
shared surface the whole room can see and touch, and changes the state of the
room itself. None of that can be pasted into a chatbox.

Built during the event: a dependency-free Node server with server-sent
events, two pages (room display and door sign), a fixture replay that feeds
the scripted meeting through the same path as a live mic, and a Claude call
that returns operations against existing ledger ids so corrections update
items instead of duplicating them. Failure states are on screen: not hearing,
thinking, offline keeping last ledger, and a visible send failure. Everything
the agent does can be undone with one tap. Known limitation: no speaker
identification, so owners come from names spoken aloud and unclear items show
"owner?" until someone taps them.

Stack: Node, Claude API (claude-opus-5, structured output, low effort, cached
prefix), Chrome Web Speech API for the live mic.

## Social post

We built Fish Tank: an agent that lives in the meeting room. It hears the
meeting, puts decisions and action items on the wall as they're said, takes
corrections out loud, flips the door sign when you wrap early, and proposes
the follow-up the room already agreed to. Built in one day at [EVENT]
with [PARTNERS]. Repo: https://github.com/matgCodes/fish-tank
