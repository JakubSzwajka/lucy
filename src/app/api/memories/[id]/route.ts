import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getMemoryService } from "@/lib/server/memory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/memories/[id] - Get a memory with its evidence
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const memoryService = getMemoryService();

  const result = await memoryService.getById(userId, id);

  if (!result) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

// PATCH /api/memories/[id] - Update a memory
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const updates = await request.json();
  const memoryService = getMemoryService();

  try {
    const memory = await memoryService.update(userId, id, updates);
    return NextResponse.json(memory);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update memory";
    if (message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/memories/[id] - Delete a memory
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const memoryService = getMemoryService();

  await memoryService.delete(userId, id);
  return new NextResponse(null, { status: 204 });
}
