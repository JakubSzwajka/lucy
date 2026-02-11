import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getMemoryStore } from "@/lib/memory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/memories/[id]/graph - Get memory graph
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const { id } = await params;
  const depthParam = request.nextUrl.searchParams.get("depth");
  const depth = depthParam ? parseInt(depthParam, 10) : 2;

  const store = getMemoryStore();
  const graph = await store.getGraph(userId, id, depth);

  return NextResponse.json(graph);
}
