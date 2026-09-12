import { describe, expect, it } from "vitest";
import demo from "../fixtures/demo.json";
import { applyOps, type ApplyContext } from "./ops";
import type { MeetingState } from "./types";

function setup() {
  const state = structuredClone(demo.meeting) as MeetingState;
  let n = 1;
  let tick = 0;
  const ctx: ApplyContext = {
    now: () => `2026-09-12T21:00:0${tick++}.000Z`,
    nextLedgerId: () => `L${n++}`,
  };
  return { state, ctx };
}

describe("applyOps", () => {
  it("assigns ids on add and updates in place by id", () => {
    const { state, ctx } = setup();
    applyOps(state, [{ type: "add_item", kind: "action", text: "Update the budget sheet" }], "agent", ctx);
    expect(state.ledger).toMatchObject([{ id: "L1", ownerId: null, due: null, source: "agent" }]);

    applyOps(state, [{ type: "update_item", id: "L1", ownerId: "a2" }], "human", ctx);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({ id: "L1", ownerId: "a2", source: "human" });
  });

  it("drops unknown ids and keeps applying the rest of the batch", () => {
    const { state, ctx } = setup();
    const result = applyOps(
      state,
      [
        { type: "update_item", id: "L9", text: "nope" },
        { type: "remove_item", id: "L9" },
        { type: "bogus" },
        { type: "add_item", kind: "decision", text: "Ship blue" },
      ],
      "agent",
      ctx,
    );
    expect(result.dropped).toHaveLength(3);
    expect(state.ledger.map((i) => i.text)).toEqual(["Ship blue"]);
  });

  it("hard deletes on remove_item", () => {
    const { state, ctx } = setup();
    applyOps(state, [{ type: "add_item", kind: "decision", text: "x" }, { type: "remove_item", id: "L1" }], "human", ctx);
    expect(state.ledger).toEqual([]);
  });

  it("stamps agenda times when the current item changes", () => {
    const { state, ctx } = setup();
    applyOps(state, [{ type: "set_current_agenda_item", agendaItemId: "g1" }], "agent", ctx);
    applyOps(state, [{ type: "set_current_agenda_item", agendaItemId: "g2" }], "human", ctx);
    const [g1, g2] = state.agenda;
    expect(state.currentAgendaItemId).toBe("g2");
    expect(g1.startedAt).toBeDefined();
    expect(g1.endedAt).toBe(g2.startedAt);
  });

  it("lets only a human end the meeting", () => {
    const { state, ctx } = setup();
    const agent = applyOps(state, [{ type: "set_meeting_status", status: "ended" }], "agent", ctx);
    expect(agent.dropped).toHaveLength(1);
    expect(state.meeting.status).toBe("scheduled");

    applyOps(state, [{ type: "set_meeting_status", status: "wrapping" }], "agent", ctx);
    applyOps(state, [{ type: "set_meeting_status", status: "ended" }], "human", ctx);
    expect(state.meeting.status).toBe("ended");
  });

  it("replays the demo script's scripted ops to the expected ledger", () => {
    const { state, ctx } = setup();
    for (const entry of demo.script) applyOps(state, entry.ops, "agent", ctx);
    expect(state.meeting.status).toBe("wrapping");
    expect(state.currentAgendaItemId).toBe("g2");
    expect(state.ledger.map((i) => [i.id, i.ownerId])).toEqual([
      ["L1", null],
      ["L2", "a1"],
      ["L3", "a2"],
    ]);
  });
});
