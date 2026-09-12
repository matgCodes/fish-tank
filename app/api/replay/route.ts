import demo from "@/fixtures/demo.json";
import { replayFixture, type Fixture } from "@/lib/replay";

export const dynamic = "force-dynamic";

const fixtures: Record<string, Fixture> = { demo: demo as unknown as Fixture };

// POST { fixture?: "demo", speed?: number }. Resets state to the fixture's
// meeting and starts the replay in the background.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.fixture === "string" ? body.fixture : "demo";
  const speed = typeof body?.speed === "number" && body.speed > 0 ? body.speed : 1;
  const fixture = fixtures[name];
  if (!fixture) return Response.json({ error: `unknown fixture ${name}` }, { status: 404 });

  replayFixture(fixture, { speed }).catch((error) => console.error("[replay] failed:", error));
  const durationMs = Math.max(0, ...fixture.script.map((e) => e.atMs)) / speed;
  return Response.json({ fixture: name, speed, entries: fixture.script.length, durationMs }, { status: 202 });
}
