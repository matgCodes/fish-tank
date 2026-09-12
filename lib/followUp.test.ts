import { describe, expect, it } from "vitest";
import demo from "../fixtures/demo.json";
import { postFollowUp, renderFollowUp } from "./followUp";
import { applyOps, type ApplyContext } from "./ops";
import type { MeetingState } from "./types";

function endedDemo() {
  const state = structuredClone(demo.meeting) as MeetingState;
  let n = 1;
  const ctx: ApplyContext = { now: () => "2026-09-12T21:00:00.000Z", nextLedgerId: () => `L${n++}` };
  for (const entry of demo.script) applyOps(state, entry.ops, "agent", ctx);
  return { state, ctx };
}

describe("renderFollowUp", () => {
  it("lists decisions, action items with owners and due dates, and attendees", () => {
    const { state } = endedDemo();
    expect(renderFollowUp(state)).toBe(
      [
        "*Follow-up: Launch sync*",
        "",
        "*Decisions*",
        "• Ship the launch on the blue design",
        "",
        "*Action items*",
        "• Vendor follow-up — Sam, due 2026-09-18",
        "• Update the budget sheet — Priya",
        "",
        "*Attendees*",
        "Sam, Priya, Jordan",
      ].join("\n"),
    );
  });

  it("shows owner? for an unassigned action and escapes Slack control characters", () => {
    const { state, ctx } = endedDemo();
    applyOps(state, [{ type: "add_item", kind: "action", text: "Q3 <draft> & review" }], "agent", ctx);
    expect(renderFollowUp(state)).toContain("• Q3 &lt;draft&gt; &amp; review — owner?");
  });
});

describe("follow-up proposal", () => {
  it("is proposed when the room ends the meeting, not on wrapping", () => {
    const { state, ctx } = endedDemo();
    expect(state.meeting.status).toBe("wrapping");
    expect(state.followUp.status).toBe("none");

    applyOps(state, [{ type: "set_meeting_status", status: "ended" }], "human", ctx);
    expect(state.followUp).toMatchObject({ status: "proposed", text: renderFollowUp(state) });
  });

  it("tracks ledger corrections while proposed and freezes once sent", () => {
    const { state, ctx } = endedDemo();
    applyOps(state, [{ type: "set_meeting_status", status: "ended" }], "human", ctx);
    applyOps(state, [{ type: "update_item", id: "L3", ownerId: "a3" }], "human", ctx);
    expect(state.followUp.text).toContain("• Update the budget sheet — Jordan");

    state.followUp = { status: "sent", text: state.followUp.text, sentAt: "2026-09-12T21:05:00.000Z" };
    applyOps(state, [{ type: "update_item", id: "L3", ownerId: "a1" }], "human", ctx);
    expect(state.followUp.text).toContain("— Jordan");
  });
});

describe("postFollowUp", () => {
  const respond = (status: number, body: string) => (async () => new Response(body, { status })) as typeof fetch;

  it("posts { text } as JSON and succeeds on 200", async () => {
    let sent: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = init;
      return new Response("ok");
    }) as typeof fetch;
    expect(await postFollowUp("https://hooks.example/x", "hello", { fetchImpl })).toEqual({ ok: true });
    expect(JSON.parse(String(sent?.body))).toEqual({ text: "hello" });
  });

  it("reports Slack's status and body on a non-2xx answer", async () => {
    expect(await postFollowUp("u", "t", { fetchImpl: respond(404, "no_service") })).toEqual({
      ok: false,
      error: "Slack answered 404: no_service",
    });
  });

  it("reports a network failure instead of throwing", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND hooks.slack.com") });
    }) as typeof fetch;
    expect(await postFollowUp("u", "t", { fetchImpl })).toEqual({
      ok: false,
      error: "Could not reach Slack: getaddrinfo ENOTFOUND hooks.slack.com",
    });
  });

  it("gives up after the timeout", async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as typeof fetch;
    expect(await postFollowUp("u", "t", { fetchImpl, timeoutMs: 20 })).toEqual({
      ok: false,
      error: "Could not reach Slack: no answer in 0.02s",
    });
  });
});
