import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.FISH_TANK_MODEL || "claude-opus-5";
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture/script.json"), "utf8"));

// ---------- state (docs/ops-schema-draft.md) ----------
let state, utterances, seq, replayTimer;
function reset() {
  const now = new Date();
  state = {
    meeting: { id: "m1", title: fixture.meeting.title, startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + fixture.meeting.plannedMinutes * 60000).toISOString(), status: "scheduled" },
    attendees: fixture.attendees,
    agenda: fixture.agenda.map(a => ({ ...a })),
    currentAgendaItemId: null,
    ledger: [],
    listening: { status: "paused", lastHeardAt: null },
    agent: { status: "idle", lastError: null },
    followUp: { status: "none" },
    log: [],
  };
  utterances = []; seq = 0;
  if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
  state.replay = { running: false, index: 0 };
  broadcast();
}
function log(msg) { state.log.unshift(`${new Date().toLocaleTimeString()} ${msg}`); state.log = state.log.slice(0, 40); }

function applyOp(op, source) {
  const now = new Date().toISOString();
  switch (op.type) {
    case "add_item": {
      const item = { id: `L${++seq}`, kind: op.kind, text: op.text, ownerId: op.ownerId ?? null, due: op.due ?? null, source, updatedAt: now };
      if (item.ownerId && !state.attendees.find(a => a.id === item.ownerId)) item.ownerId = null;
      state.ledger.push(item); log(`${source}: added ${item.kind} ${item.id} "${item.text}"`); break;
    }
    case "update_item": {
      const it = state.ledger.find(i => i.id === op.id);
      if (!it) { log(`dropped update for unknown ${op.id}`); return; }
      for (const k of ["text", "ownerId", "due"]) if (op[k] !== undefined) it[k] = op[k];
      if (it.ownerId && !state.attendees.find(a => a.id === it.ownerId)) it.ownerId = null;
      it.source = source; it.updatedAt = now; log(`${source}: updated ${it.id}`); break;
    }
    case "remove_item": {
      const n = state.ledger.length; state.ledger = state.ledger.filter(i => i.id !== op.id);
      log(n === state.ledger.length ? `dropped remove for unknown ${op.id}` : `${source}: removed ${op.id}`); break;
    }
    case "set_current_agenda_item": {
      const next = state.agenda.find(a => a.id === op.agendaItemId);
      if (!next) { log(`dropped unknown agenda item ${op.agendaItemId}`); return; }
      const cur = state.agenda.find(a => a.id === state.currentAgendaItemId);
      if (cur && cur.id !== next.id && !cur.endedAt) cur.endedAt = now;
      if (!next.startedAt) next.startedAt = now;
      state.currentAgendaItemId = next.id;
      if (state.meeting.status === "scheduled") state.meeting.status = "in_progress";
      log(`${source}: agenda -> ${next.title}`); break;
    }
    case "set_meeting_status": {
      if (!["scheduled", "in_progress", "wrapping", "ended"].includes(op.status)) return;
      state.meeting.status = op.status;
      if (op.status === "ended") {
        const cur = state.agenda.find(a => a.id === state.currentAgendaItemId);
        if (cur && !cur.endedAt) cur.endedAt = now;
        state.meeting.endsAt = now;
        state.followUp = { status: "proposed", text: buildFollowUp() };
        state.listening.status = "paused";
        if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; state.replay.running = false; }
      }
      log(`${source}: meeting ${op.status}`); break;
    }
    case "no_op": break;
    default: log(`dropped unknown op ${op.type}`);
  }
}
function name(id) { return state.attendees.find(a => a.id === id)?.name || "owner?"; }
function buildFollowUp() {
  const d = state.ledger.filter(i => i.kind === "decision"), a = state.ledger.filter(i => i.kind === "action");
  return [`Follow-up: ${state.meeting.title}`, ``,
    `Decisions`, ...(d.length ? d.map(i => `- ${i.text}`) : ["- none recorded"]), ``,
    `Action items`, ...(a.length ? a.map(i => `- ${i.text} (${name(i.ownerId)}${i.due ? ", due " + i.due : ""})`) : ["- none recorded"]), ``,
    `Attendees: ${state.attendees.map(x => x.name).join(", ")}`].join("\n");
}

// ---------- Claude ----------
const OPS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["ops"],
  properties: { ops: { type: "array", items: { type: "object", additionalProperties: false, required: ["type"],
    properties: {
      type: { type: "string", enum: ["add_item", "update_item", "remove_item", "set_current_agenda_item", "set_meeting_status", "no_op"] },
      kind: { type: "string", enum: ["decision", "action"] },
      id: { type: "string" }, text: { type: "string" },
      ownerId: { type: ["string", "null"] }, due: { type: ["string", "null"] },
      agendaItemId: { type: "string" },
      status: { type: "string", enum: ["scheduled", "in_progress", "wrapping", "ended"] },
    } } } },
};
function systemPrompt() {
  return `You are Fish Tank, an agent that lives in a meeting room. You hear one utterance at a time and keep a shared ledger the room can see and correct.
Return only operations against the current ledger. Rules:
- add_item only for an explicit decision ("let's go with X", "decision made") or an explicit commitment or assignment of work.
- update_item only when the utterance explicitly corrects an existing item (owner, due, wording). Reference its id.
- set ownerId only when a name is spoken or clearly resolves to an attendee; set due only when a date or day is stated. Otherwise null. Never guess.
- set_current_agenda_item when the room moves to an agenda item ("let's move on to rollout", "start with the vendor").
- set_meeting_status ended on "that's a wrap" or an explicit close. Never otherwise.
- Small talk, agreement, or discussion with no decision or commitment: return {"ops":[{"type":"no_op"}]}.
- due is an ISO date if a date is given, otherwise the day word as spoken ("Friday").
Attendees: ${JSON.stringify(state.attendees)}
Agenda: ${JSON.stringify(state.agenda.map(a => ({ id: a.id, title: a.title })))}
Today is ${new Date().toDateString()}.`;
}
async function extract(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing (put it in .env)");
  const recent = utterances.slice(-8).map(u => u.text);
  const user = `Current ledger (ids are stable): ${JSON.stringify(state.ledger.map(i => ({ id: i.id, kind: i.kind, text: i.text, ownerId: i.ownerId, due: i.due })))}
Current agenda item: ${state.currentAgendaItemId ?? "none yet"}
Recent utterances: ${JSON.stringify(recent)}
New utterance: ${JSON.stringify(text)}
Return {"ops":[...]}.`;
  const body = { model: MODEL, max_tokens: 2000,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: { type: "json_schema", schema: OPS_SCHEMA } } };
  let res = await call(body);
  if (res.status === 400) { // structured-output shape rejected: fall back to plain JSON in text
    delete body.output_config.format; body.messages[0].content += " Respond with JSON only.";
    res = await call(body);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const msg = await res.json();
  if (msg.stop_reason === "refusal") return [];
  const txt = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return [];
  const parsed = JSON.parse(m[0]);
  return Array.isArray(parsed.ops) ? parsed.ops : [];
}
async function call(body) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 25000);
  try {
    return await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body) });
  } finally { clearTimeout(t); }
}

// ---------- utterance queue ----------
const queue = []; let busy = false;
function hear(text) {
  if (!text?.trim() || state.meeting.status === "ended") return;
  utterances.push({ text, receivedAt: new Date().toISOString() });
  state.listening.lastHeardAt = new Date().toISOString();
  if (state.listening.status !== "paused") state.listening.status = "listening";
  queue.push(text); broadcast(); pump();
}
async function pump() {
  if (busy || !queue.length) return; busy = true;
  const text = queue.shift();
  state.agent.status = "thinking"; broadcast();
  let attempt = 0, ops = null;
  while (attempt < 2 && ops === null) {
    try { ops = await extract(text); state.agent.lastError = null; }
    catch (e) { attempt++; state.agent.lastError = String(e.message || e); log(`agent error: ${state.agent.lastError}`); state.agent.status = "offline"; broadcast(); if (attempt < 2) await new Promise(r => setTimeout(r, 1500)); }
  }
  if (ops) { for (const op of ops) applyOp(op, "agent"); state.agent.status = "idle"; }
  broadcast(); busy = false; pump();
}

// ---------- replay ----------
function replayStart() {
  if (state.replay.running) return;
  state.replay.running = true; state.listening.status = "listening"; log("replay started"); broadcast();
  const step = () => {
    const line = fixture.lines[state.replay.index];
    if (!line || !state.replay.running) { state.replay.running = false; broadcast(); return; }
    replayTimer = setTimeout(() => { state.replay.index++; hear(`${line.speaker}: ${line.text}`); step(); }, line.delay * 1000);
  };
  step();
}
function replayStop() { state.replay.running = false; if (replayTimer) clearTimeout(replayTimer); replayTimer = null; log("replay stopped"); broadcast(); }

// ---------- SSE + HTTP ----------
const clients = new Set();
function broadcast() { const data = `data: ${JSON.stringify(state)}\n\n`; for (const c of clients) c.write(data); }
setInterval(() => { // heartbeat and not-hearing detection
  if (state.listening.status === "listening" && state.listening.lastHeardAt && Date.now() - Date.parse(state.listening.lastHeardAt) > 45000) { state.listening.status = "not_hearing"; }
  for (const c of clients) c.write(": ping\n\n");
}, 10000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify(state)}\n\n`); clients.add(res); req.on("close", () => clients.delete(res)); return;
    }
    if (req.method === "GET" && url.pathname === "/state") return send(200, state);
    if (req.method === "POST") {
      const body = await readJson(req);
      if (url.pathname === "/utterance") { hear(body.text); return send(200, { ok: true }); }
      if (url.pathname === "/op") { applyOp(body.op, "human"); broadcast(); return send(200, { ok: true }); }
      if (url.pathname === "/listening") { state.listening.status = body.status; broadcast(); return send(200, { ok: true }); }
      if (url.pathname === "/replay/start") { replayStart(); return send(200, { ok: true }); }
      if (url.pathname === "/replay/stop") { replayStop(); return send(200, { ok: true }); }
      if (url.pathname === "/reset") { reset(); return send(200, { ok: true }); }
      if (url.pathname === "/followup/send") {
        if (state.followUp.status !== "proposed") return send(400, { error: "nothing proposed" });
        const hook = process.env.SLACK_WEBHOOK_URL;
        if (hook) {
          try { const r = await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: state.followUp.text }) });
            if (!r.ok) throw new Error(`Slack ${r.status}`); }
          catch (e) { state.followUp.error = String(e.message || e); log(`follow-up failed: ${state.followUp.error}`); broadcast(); return send(502, { error: state.followUp.error }); }
        } else { log("follow-up sent (no SLACK_WEBHOOK_URL set, logged only)"); console.log("\n--- FOLLOW-UP ---\n" + state.followUp.text + "\n"); }
        state.followUp.status = "sent"; state.followUp.sentAt = new Date().toISOString(); delete state.followUp.error; broadcast(); return send(200, { ok: true });
      }
      return send(404, { error: "no route" });
    }
    const file = url.pathname === "/" ? "room.html" : url.pathname === "/door" ? "door.html" : null;
    if (!file) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(fs.readFileSync(path.join(__dirname, "public", file)));
  } catch (e) { send(500, { error: String(e.message || e) }); }
});
function readJson(req) { return new Promise((ok, bad) => { let s = ""; req.on("data", c => s += c); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } }); }); }
function loadEnv() { try { for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {} }

reset();
server.listen(PORT, "0.0.0.0", () => {
  const nets = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === "IPv4" && !n.internal).map(n => n.address);
  console.log(`Fish Tank\n  room display: http://localhost:${PORT}/\n  door sign:    http://${nets[0] || "localhost"}:${PORT}/door\n  model: ${MODEL}  key: ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`);
});
