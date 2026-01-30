import { NextResponse } from "next/server";
import { getItemService } from "@/lib/services";
import type { CreateItemData } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/items - Get all items for an agent
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const itemService = getItemService();

  const agentItems = itemService.getByAgentId(id);
  return NextResponse.json(agentItems);
}

// POST /api/agents/[id]/items - Add an item to an agent's thread
export async function POST(req: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const body = await req.json();
  const itemService = getItemService();

  const { type } = body;

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  // Build item data based on type
  let itemData: CreateItemData;

  switch (type) {
    case "message":
      itemData = {
        type: "message",
        role: body.role,
        content: body.content,
      };
      break;

    case "tool_call":
      itemData = {
        type: "tool_call",
        callId: body.callId,
        toolName: body.toolName,
        toolArgs: body.toolArgs || null,
        toolStatus: body.toolStatus || "pending",
      };
      break;

    case "tool_result":
      itemData = {
        type: "tool_result",
        callId: body.callId,
        toolOutput: body.toolOutput || null,
        toolError: body.toolError || null,
      };
      break;

    case "reasoning":
      itemData = {
        type: "reasoning",
        reasoningContent: body.reasoningContent,
        reasoningSummary: body.reasoningSummary || null,
      };
      break;

    default:
      return NextResponse.json(
        { error: `Unknown item type: ${type}` },
        { status: 400 }
      );
  }

  const result = itemService.create(agentId, itemData);

  if (result.notFound) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.item, { status: 201 });
}
