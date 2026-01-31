import { NextResponse } from "next/server";
import { getToolRegistry, initializeToolRegistry } from "@/lib/tools";

/**
 * GET /api/tools
 * List all registered tools from all providers.
 */
export async function GET() {
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
