import { NextResponse } from "next/server";
import { getIntegrationService } from "@/lib/services";

// GET /api/integrations - List all available integrations with their state
export async function GET() {
  const integrationService = getIntegrationService();
  const integrations = integrationService.getAll();
  return NextResponse.json(integrations);
}
