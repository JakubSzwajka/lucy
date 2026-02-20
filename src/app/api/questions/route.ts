import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getQuestionService } from "@/lib/memory";
import type { QuestionFilters } from "@/lib/memory";

// GET /api/questions - List questions with filters
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;
  const { userId } = authResult.user;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const scope = searchParams.get("scope");
  const timing = searchParams.get("timing");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  const filters: QuestionFilters = {};
  if (status) filters.status = status as QuestionFilters["status"];
  if (scope) filters.scope = scope;
  if (timing) filters.timing = timing as QuestionFilters["timing"];
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const questionService = getQuestionService();
  const results = await questionService.list(userId, filters);
  return NextResponse.json(results);
}
