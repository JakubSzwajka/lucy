import { NextResponse } from "next/server";
import { getQuickActionService } from "@/lib/services";

function parseEnabledParam(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

// GET /api/quick-actions - List quick actions (optionally filtered by enabled)
export async function GET(req: Request) {
  const service = getQuickActionService();
  const { searchParams } = new URL(req.url);
  const enabled = parseEnabledParam(searchParams.get("enabled"));
  const actions = service.getAll(enabled);
  return NextResponse.json(actions);
}

// POST /api/quick-actions - Create a new quick action
export async function POST(req: Request) {
  const { name, content, icon, sortOrder, enabled } = await req.json();
  const service = getQuickActionService();

  const result = service.create({ name, content, icon, sortOrder, enabled });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.action, { status: 201 });
}
