import { apply, getState } from "@/lib/store";

export const dynamic = "force-dynamic";

// POST { source: "agent" | "human", ops: Operation[] }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || (body.source !== "agent" && body.source !== "human") || !Array.isArray(body.ops)) {
    return Response.json({ error: 'expected { source: "agent" | "human", ops: Operation[] }' }, { status: 400 });
  }
  const result = apply(body.ops, body.source);
  return Response.json({ ...result, state: getState() });
}
