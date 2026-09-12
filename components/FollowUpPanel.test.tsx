import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FollowUpPanel } from "./FollowUpPanel";

describe("FollowUpPanel", () => {
  it("renders nothing before the meeting ends", () => {
    expect(renderToStaticMarkup(<FollowUpPanel followUp={{ status: "none" }} />)).toBe("");
  });

  it("shows the proposed text and a send button", () => {
    const html = renderToStaticMarkup(<FollowUpPanel followUp={{ status: "proposed", text: "*Follow-up: Launch sync*" }} />);
    expect(html).toContain("Proposed follow-up");
    expect(html).toContain("*Follow-up: Launch sync*");
    expect(html).toContain("Send follow-up");
    expect(html).not.toContain('role="alert"');
  });

  it("shows a failed send as an alert with retry", () => {
    const html = renderToStaticMarkup(
      <FollowUpPanel followUp={{ status: "proposed", text: "x", error: "Could not reach Slack: no answer in 5s" }} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Not sent. Could not reach Slack: no answer in 5s");
    expect(html).toContain("Retry send");
  });

  it("shows the sent stamp and no button once sent", () => {
    const html = renderToStaticMarkup(
      <FollowUpPanel followUp={{ status: "sent", text: "x", sentAt: "2026-09-12T22:31:57.837Z" }} />,
    );
    expect(html).toContain("Follow-up sent");
    expect(html).toContain("Posted to Slack at");
    expect(html).not.toContain("<button");
  });
});
