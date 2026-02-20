import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getMemoryService } from "@/lib/memory";
import type { MemoryFilters } from "@/lib/memory";

// GET /api/memories - List memories with filters, or search
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const type = searchParams.get("type");
  const scope = searchParams.get("scope");
  const status = searchParams.get("status");
  const minConfidence = searchParams.get("minConfidence");
  const tags = searchParams.get("tags");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  const memoryService = getMemoryService();

  if (search) {
    const opts: { limit?: number; offset?: number } = {};
    if (limit) opts.limit = parseInt(limit, 10);
    if (offset) opts.offset = parseInt(offset, 10);
    const results = await memoryService.search(userId, search, opts);
    return NextResponse.json(results);
  }

  const filters: MemoryFilters = {};
  if (type) filters.type = type as MemoryFilters["type"];
  if (scope) filters.scope = scope as MemoryFilters["scope"];
  if (status) filters.status = status as MemoryFilters["status"];
  if (minConfidence) filters.minConfidence = parseFloat(minConfidence);
  if (tags) filters.tags = tags.split(",");
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const results = await memoryService.list(userId, filters);
  return NextResponse.json(results);
}

// POST /api/memories - Create a new memory
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const body = await request.json();

  if (!body.type || !body.content || body.confidenceScore == null || !body.confidenceLevel) {
    return NextResponse.json(
      { error: "Missing required fields: type, content, confidenceScore, confidenceLevel" },
      { status: 400 }
    );
  }

  const memoryService = getMemoryService();

  try {
    const result = await memoryService.create(userId, {
      type: body.type,
      content: body.content,
      confidenceScore: body.confidenceScore,
      confidenceLevel: body.confidenceLevel,
      tags: body.tags,
      scope: body.scope,
    }, body.evidence);

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create memory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
