import { NextResponse } from "next/server";
import { getKnowledgeConfigService } from "@/lib/tools/integrations/knowledge";

// GET /api/knowledge/config - Get knowledge config (tag categories + entity types)
export async function GET() {
  try {
    const configService = getKnowledgeConfigService();
    const config = await configService.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to get knowledge config:", error);
    return NextResponse.json(
      { error: "Failed to get knowledge config" },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge/config - Update entire config
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const configService = getKnowledgeConfigService();

    await configService.saveConfig(body);
    const config = await configService.getConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to update knowledge config:", error);
    return NextResponse.json(
      { error: "Failed to update knowledge config" },
      { status: 500 }
    );
  }
}
