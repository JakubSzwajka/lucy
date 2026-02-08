import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getToolRegistry, initializeToolRegistry } from "@/lib/tools";

/**
 * GET /api/tools
 * List all registered tools from all providers.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error;

  // Ensure registry is initialized
  await initializeToolRegistry();

  const registry = getToolRegistry();
  const allTools = await registry.getAllTools();

  // Return simplified tool info for the UI
  const tools = allTools.map(({ key, definition }) => ({
    key,
    name: definition.name,
    description: definition.description,
    source: definition.source,
  }));

  return NextResponse.json({ tools });
}
