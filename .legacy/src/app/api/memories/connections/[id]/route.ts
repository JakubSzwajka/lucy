import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth/middleware";
import { getMemoryStore } from "@/lib/server/memory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/memories/connections/[id] - Delete a connection
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const store = getMemoryStore();
  await store.deleteConnection(userId, id);

  return new NextResponse(null, { status: 204 });
}
