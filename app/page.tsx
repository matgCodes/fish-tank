"use client";

import { useEffect, useState } from "react";
import type { MeetingState } from "@/lib/types";

export default function StatePage() {
  const [state, setState] = useState<MeetingState | null>(null);
  const [connected, setConnected] = useState(false);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.onmessage = (event) => {
      setState(JSON.parse(event.data));
      setReceivedAt(new Date().toISOString());
    };
    return () => events.close();
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
      <p>
        {connected ? "connected" : "connecting…"}
        {receivedAt && ` · last update received ${receivedAt}`}
      </p>
      <pre id="state">{state ? JSON.stringify(state, null, 2) : "waiting for state"}</pre>
    </main>
  );
}
