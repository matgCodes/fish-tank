# Speech-to-text bench

A throwaway harness for [#6](https://github.com/matgCodes/fish-tank/issues/6).
It runs the two engines picked in [#5](https://github.com/matgCodes/fish-tank/issues/5)
against the same scripted lines on a real mic and produces the comment body for #6.
It has no dependencies and stays out of the app scaffold owned by #3.
The two adapters in `index.html` are shaped so #12 can lift them.

## Before the room

1. Get an AssemblyAI API key. The research note lists $50 of free credit with no card.
2. Copy `bench/stt/.env.example` to `bench/stt/.env` and paste the key. The file is gitignored.
3. Use Chrome on the demo laptop, with the mic you will use on camera.
4. Join the venue Wi-Fi, not a hotspot. The point is to see whether that network works.

## Run

```sh
node bench/stt/server.mjs
```

Open http://localhost:8787 and allow the microphone. Without a key, Web Speech
still works and the AssemblyAI card shows "no API key on the server".

## Protocol

The ticket asks for 20 minutes per engine with the same lines.

- **Separate runs, as the ticket says.** Tick only Web Speech, press Start, and
  loop the script for 20 minutes. Press Stop. Tick only AssemblyAI and repeat.
  Results from both sessions stay on the page.
- **Together, if room time is short.** Tick both. Both engines hear the same
  speech for 20 minutes. The comparison is fairer and takes half the time.

For every line:

1. Read the big line aloud at a normal meeting pace.
2. Press **Space** the moment you finish it. The next line appears.
3. If you mark the wrong line, press Undo.

The last line has a 30 second silence countdown before it. Stay quiet until it
ends, then read it. That tests restart after silence. The usual failure is the
first words after the silence going missing.

Watch the badges while you read. "Not hearing" means no final text for 8 seconds.
The event log shows every Web Speech restart and every AssemblyAI reconnect.

## After

1. Press **Copy results as Markdown**.
2. Paste it as a comment on #6. Fill in room, mic, network, pick, and reason.
3. Close #6 and add the pick to "Decisions so far" on the map, #1.

Results live in this browser's local storage until you press Reset twice.

## Reading the numbers

- **Lag** runs from your Space press to the last final text for that line. It
  includes your reaction time, which is the same for both engines, so compare
  the two medians. A negative lag means the engine finalized before you pressed.
- **Dropped words** are scripted words missing from the heard text. Number
  words like "ten" versus "10" count as drops, so check the per-line table.
- A final that arrives after you marked a line is matched to that line or to
  the next one by word overlap.

## Not verified

Nobody has run this with a real mic or a live AssemblyAI socket yet. The scoring
logic has unit tests:

```sh
node --test bench/stt/analysis.test.mjs
```
