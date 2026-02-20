import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getMemoryStore } from "@/lib/memory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/memories/[id]/connections - Create a connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const { toMemoryId, relationshipType, strength } = await request.json();

  if (!toMemoryId || !relationshipType) {
    return NextResponse.json(
      { error: "toMemoryId and relationshipType are required" },
      { status: 400 }
    );
  }

  const store = getMemoryStore();
  const connections = await store.addConnections(userId, [
    { fromMemoryId: id, toMemoryId, relationshipType, strength },
  ]);

  return NextResponse.json(connections[0], { status: 201 });
}

// GET /api/memories/[id]/connections - List connections for a memory
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const store = getMemoryStore();
  const connections = await store.getConnections(userId, id);

  return NextResponse.json(connections);
}
