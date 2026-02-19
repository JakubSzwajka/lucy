import { NextRequest, NextResponse } from "next/server";
import { getTriggerService, getTriggerRepository } from "@/lib/services";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/triggers/webhook/:id — External webhook entry point
export async function POST(request: NextRequest, context: RouteContext) {
  // Auth: check LUCY_API_KEY
  const apiKey = process.env.LUCY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: triggerId } = await context.params;

  // Load trigger without userId filter (webhooks are system-level)
  const trigger = await getTriggerRepository().findByIdInternal(triggerId);

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (!trigger.enabled) {
    return NextResponse.json({ error: "Trigger is disabled" }, { status: 409 });
  }

  // Parse webhook payload
  const eventPayload = await request.json().catch(() => ({}));

  try {
    const result = await getTriggerService().execute(triggerId, eventPayload);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: "Execution failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
