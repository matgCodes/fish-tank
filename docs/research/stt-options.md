# Speech-to-text options for a one-day build

Resolves [#5](https://github.com/matgCodes/fish-tank/issues/5). Scope: a scripted
four-minute meeting, spoken live in a room, laptop mic, browser display, final
utterances posted to a server that calls Claude. Facts below are from primary docs
only; numbered refs resolve in [Sources](#sources). Anything not in a doc is marked
**unconfirmed** rather than guessed.

## Comparison

| Fact | Web Speech API (Chrome) | Deepgram streaming | AssemblyAI streaming |
| --- | --- | --- | --- |
| **Auth shape; browser-direct or relay** | No key, no account, no relay. Browser API. But on Chrome "your audio is sent to a web service for recognition processing, so it won't work offline" [1]. Page must be served from a web server (HTTPS/localhost) [3]. | `Authorization: Token <key>`; keys must not go "in publicly accessible areas such as GitHub or client-side code" [4]. Temp tokens from `/auth/grant`, default TTL 30 s, max 3600 s, sent as `Authorization: Bearer` [5]. Browser WebSockets can't set headers, so the documented client-side path is `Sec-WebSocket-Protocol: token, YOUR_DEEPGRAM_API_KEY` — the raw key [6]. A `bearer` subprotocol for temp tokens does **not** appear on that page: **browser-direct with a temp token is unconfirmed**; use the JS SDK or a relay to keep the key off the client. | API key in the `Authorization` header, no `Bearer` prefix; "Don't ship your API key to client-side code" [12]. Browser path is fully documented: `POST https://streaming.assemblyai.com/v3/token` from your server, `expires_in_seconds` 1–600, **single use, one session**, passed as a `token` query parameter on the WebSocket URL [13]. |
| **Free tier / trial limits** | Free, no account, no published quota. Whether Chrome rate-limits the service is **unconfirmed**. | "$200 free credit", "No credit card required"; Nova-3 streaming $0.0048/min promo, $0.0077/min regular [11]. | "$50 in free credits, no credit card required"; streaming $0.45/hr (u3-rt-pro), billed on **session duration**, not audio [15]. |
| **Behavior on silence; restart** | `no-speech` error = "No speech was detected" [2]. `end` fires "when the speech recognition service has disconnected" [1]. `continuous` "defaults to single (`false`)" — one result then stop [1]. Chrome's exact silence timeout is **not documented on MDN (unconfirmed)**; the working pattern is restart from `onend`. | Connection closes after a 10-second window with no audio and no KeepAlive, with a `NET-0001` error; send `{"type": "KeepAlive"}` every 3–5 s [7]. Streaming continuous mic frames counts as audio, so this only bites if you pause the recorder. | No silence disconnect documented. Sessions "auto-close after 3 hours and are billed for the full duration" [12]. A reconnect needs a freshly minted token (single use) [13]. |
| **Interim vs final; how final is signalled** | `interimResults` returns results where `SpeechRecognitionResult.isFinal` is `false`; final is `isFinal === true` [1]. | Interim results "are sent every 1 second" [8]. `is_final` = "whether the transcription is final"; `speech_final` = set `true` when endpointing sees speech→silence [8][10]. Better for a noisy room: `UtteranceEnd` (`{"type":"UtteranceEnd", ...}`), driven by word-timing gaps via `utterance_end_ms` (min 1000 ms, requires `interim_results=true`) [8]. | "Expect several partial updates before each `end_of_turn: true`"; formatted turns carry `turn_is_formatted: true` [12]. |
| **Speaker labels on streaming; latency cost** | None documented on the interface [1]. | Supported on streaming: `diarize_model=v1` or `latest`; each word carries a `speaker` field, but `speaker_confidence` is omitted on streaming, and `diarize_model=v2` is not supported on streaming [9][10]. Latency cost **not documented (unconfirmed)**. | Supported: add `speaker_labels: true`; works on "all streaming models" [14]. Latency cost and any add-on price **not documented on the pages read (unconfirmed)**. |
| **Chrome-only / network constraints** | Chrome 139 unprefixed, `webkit` prefix from 33; Edge mirrors Chrome; Safari 14.1 prefixed; Firefox 142 only behind the `media.webspeech.recognition.enable` pref [3]. Needs the network — `network` error = "Network communication required for completing the recognition failed" [2]. What host/protocol Chrome uses is **not documented (unconfirmed)**, so it cannot be pre-allowlisted. | Outbound `wss://` to a third-party host. A venue proxy that blocks WebSocket upgrades kills it, and there is no HTTP fallback for live streaming. | Same: outbound `wss://` to `streaming.assemblyai.com` [13]. Same blocking risk. |

Speaker labels are listed because the ticket asked. The map already puts speaker
identification out of scope, so this row should not drive the pick.

## Gotchas for a one-day build

- Feature-detect `window.SpeechRecognition || window.webkitSpeechRecognition`.
  Unprefixed only exists from Chrome 139 [3].
- Web Speech needs the page served over HTTPS or localhost, not `file://` [3].
- Set `continuous = true` and `interimResults = true`, then restart from `onend` —
  the default is one result and stop [1]. Guard the restart loop so a permanent
  `not-allowed` (mic denied) doesn't spin forever [2].
- Handle `network` and `not-allowed` separately from `no-speech`. `no-speech` is
  routine in a meeting; the other two mean the demo is broken [2].
- Deepgram: the 10 s no-audio close (`NET-0001`) is real. Either keep mic frames
  flowing or send KeepAlive every 3–5 s [7].
- Deepgram temp tokens default to a 30 s TTL. Mint with a longer `ttl_seconds`
  or you will lose a connect race [5]. Whether an already-open stream survives
  token expiry is **unconfirmed**.
- Deepgram endpointing uses a VAD, and "background noise can cause the VAD to
  trigger and prevent the detection of silent audio" — a real room is noisy, so
  prefer `utterance_end_ms` with `interim_results=true` [8].
- AssemblyAI tokens are single-use, so every reconnect must mint a new one from
  your server [13]. Build that into the reconnect path, not just the first connect.
- AssemblyAI sends `end_of_turn` and, separately, a formatted turn flagged
  `turn_is_formatted` [12]. Pick one flag to gate the POST to Claude or you risk
  sending the same utterance twice (double-send is inferred from the two flags,
  not stated in the doc).
- AssemblyAI bills session wall-clock, so close the socket when the demo ends [12].
- Neither provider's `wss://` can be tested from your desk. Test on the venue Wi-Fi.

## Recommendation

Use the **Web Speech API as the primary path**, with **AssemblyAI browser-direct as
the switchable fallback**, and build both behind one `onFinal(text)` adapter with a
manual toggle in the UI. Web Speech wins here for one reason that matters on camera:
no signup, no key, no token endpoint, no WebSocket of your own — roughly fifty lines
and nothing to expire mid-demo, and on a scripted four-minute read its known
failure mode (the service disconnects and `end` fires [1]) is survivable by calling
`start()` again from `onend`. Its real cost is quality and the undocumented silence
behavior, and quality is explicitly the thing we care least about. AssemblyAI is the
better second because its browser path is the only one of the two providers that is
fully documented end to end — server mints a single-use token, browser opens the
socket with `?token=` [13] — and its `end_of_turn: true` is a cleaner "this utterance
is done" signal than anything Web Speech gives us [12]. Deepgram is the better API on
paper (UtteranceEnd is noise-robust [8], $200 of credit [11]), but its documented
browser-direct path puts the raw API key in a `Sec-WebSocket-Protocol` header [6],
and temp-token-over-WebSocket is unconfirmed from the docs read — that is an
afternoon of unknowns we do not need today.

**Fallback if third-party WebSockets are blocked at the venue.** Be precise about
what fails: a blocked WebSocket upgrade to `api.deepgram.com` or
`streaming.assemblyai.com` is a network-path problem, and a relay on our own laptop
does **not** fix it — the relay sits on the same blocked network. So the relay is a
key-hygiene tool, not a network fallback. What does help is that Web Speech uses a
different network path than our `wss://` (Chrome talks to its own web service [1]),
so the two paths fail independently. That is the fallback: ship both adapters, put a
visible toggle on the display, and flip it if one dies. If **both** fail — which
means general outbound blocking, the same class of problem as the blocked SSH port
22 — the answer is a phone hotspot for the demo laptop, decided before the room is
booked, not during. Test both paths on the venue Wi-Fi as the first thing on
arrival; that check is worth more than any amount of further reading.

## Sources

1. https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
2. https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error
3. https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json
4. https://developers.deepgram.com/docs/authenticating
5. https://developers.deepgram.com/guides/fundamentals/token-based-authentication
6. https://developers.deepgram.com/docs/using-the-sec-websocket-protocol
7. https://developers.deepgram.com/docs/keep-alive
8. https://developers.deepgram.com/docs/understanding-end-of-speech-detection
9. https://developers.deepgram.com/docs/diarization
10. https://developers.deepgram.com/reference/speech-to-text/listen-streaming
11. https://deepgram.com/pricing
12. https://www.assemblyai.com/docs/speech-to-text/universal-streaming
13. https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token
14. https://www.assemblyai.com/docs/faq/can-i-use-speaker-diarization-with-live-audio-transcription
15. https://www.assemblyai.com/pricing

Checked 2026-09-12.
