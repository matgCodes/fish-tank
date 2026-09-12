import type { MeetingState } from "./types";

// Slack treats &, <, and > as control characters in mrkdwn.
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Renders the follow-up as Slack mrkdwn from the ledger the room validated.
export function renderFollowUp(state: MeetingState): string {
  const ownerName = (id: string | null) => state.attendees.find((a) => a.id === id)?.name ?? "owner?";
  const decisions = state.ledger.filter((i) => i.kind === "decision");
  const actions = state.ledger.filter((i) => i.kind === "action");
  const none = ["• None recorded"];

  return [
    `*Follow-up: ${escape(state.meeting.title || "Meeting")}*`,
    "",
    "*Decisions*",
    ...(decisions.length ? decisions.map((d) => `• ${escape(d.text)}`) : none),
    "",
    "*Action items*",
    ...(actions.length
      ? actions.map((a) => `• ${escape(a.text)} — ${escape(ownerName(a.ownerId))}${a.due ? `, due ${a.due}` : ""}`)
      : none),
    "",
    "*Attendees*",
    state.attendees.length ? state.attendees.map((a) => escape(a.name)).join(", ") : "None listed",
  ].join("\n");
}

// Proposes the follow-up once the room ends the meeting, and keeps the text in
// step with ledger corrections until it is sent. A send error stays visible.
export function syncFollowUp(state: MeetingState) {
  if (state.meeting.status !== "ended" || state.followUp.status === "sent") return;
  state.followUp = { ...state.followUp, status: "proposed", text: renderFollowUp(state) };
}

export type PostResult = { ok: true } | { ok: false; error: string };

// Posts to a Slack incoming webhook. Never throws; the timeout turns a dead
// network into a visible failure instead of a hung send.
export async function postFollowUp(
  url: string,
  text: string,
  { fetchImpl = fetch, timeoutMs = 5000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<PostResult> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return { ok: true };
    const body = (await response.text().catch(() => "")).slice(0, 200);
    return { ok: false, error: `Slack answered ${response.status}${body ? `: ${body}` : ""}` };
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { message?: string } };
    const reason =
      err?.name === "TimeoutError" ? `no answer in ${timeoutMs / 1000}s` : (err?.cause?.message ?? err?.message ?? String(error));
    return { ok: false, error: `Could not reach Slack: ${reason}` };
  }
}
