"use client";

import { useState } from "react";
import type { MeetingState } from "@/lib/types";

// Proposed follow-up with the human send tap. The room display (#9) mounts this.
export function FollowUpPanel({ followUp }: { followUp: MeetingState["followUp"] }) {
  const [sending, setSending] = useState(false);
  const [tapError, setTapError] = useState<string | null>(null);

  if (followUp.status === "none") return null;

  async function send() {
    setSending(true);
    setTapError(null);
    try {
      const response = await fetch("/api/follow-up/send", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        // A failed Slack post arrives through state for every display; show
        // anything else, like a double tap or a bad status, here.
        if (!body?.followUp?.error) setTapError(body?.error ?? `Send failed (${response.status})`);
      }
    } catch {
      setTapError("Could not reach the Fish Tank server");
    } finally {
      setSending(false);
    }
  }

  const error = tapError ?? followUp.error;
  const sent = followUp.status === "sent";

  return (
    <section
      id="follow-up"
      style={{ border: `2px solid ${sent ? "#1a7f37" : "#444"}`, borderRadius: 8, padding: 16, marginBottom: 16, maxWidth: 640 }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{sent ? "Follow-up sent" : "Proposed follow-up"}</h2>
      <pre style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{followUp.text}</pre>

      {error && !sent && (
        <p role="alert" style={{ background: "#ffebe9", color: "#82071e", border: "1px solid #cf222e", borderRadius: 6, padding: 10, margin: "0 0 12px" }}>
          Not sent. {error}
        </p>
      )}

      {sent ? (
        <p style={{ color: "#1a7f37", margin: 0 }}>Posted to Slack at {new Date(followUp.sentAt!).toLocaleTimeString()}</p>
      ) : (
        <button onClick={send} disabled={sending} style={{ fontSize: 18, padding: "12px 24px", borderRadius: 6, cursor: sending ? "wait" : "pointer" }}>
          {sending ? "Sending…" : error ? "Retry send" : "Send follow-up"}
        </button>
      )}
    </section>
  );
}
