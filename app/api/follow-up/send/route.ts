import { postFollowUp } from "@/lib/followUp";
import { getState, updateFollowUp } from "@/lib/store";

export const dynamic = "force-dynamic";

let sending = false;

// POST, no body. A human taps send: posts the proposed follow-up to the Slack
// webhook, then marks it sent or records the error for every display to show.
export async function POST() {
  const { followUp } = getState();
  if (followUp.status !== "proposed" || !followUp.text) {
    return Response.json({ error: `nothing to send, follow-up is ${followUp.status}` }, { status: 409 });
  }
  if (sending) return Response.json({ error: "a send is already in progress" }, { status: 409 });

  sending = true;
  try {
    const text = followUp.text;
    const url = process.env.SLACK_WEBHOOK_URL;
    const result = url ? await postFollowUp(url, text) : { ok: false as const, error: "SLACK_WEBHOOK_URL is not set" };
    if (result.ok) {
      updateFollowUp({ status: "sent", text, sentAt: new Date().toISOString(), error: undefined });
    } else {
      console.warn("[follow-up] send failed:", result.error);
      updateFollowUp({ error: result.error });
    }
    return Response.json({ followUp: getState().followUp }, { status: result.ok ? 200 : 502 });
  } finally {
    sending = false;
  }
}
