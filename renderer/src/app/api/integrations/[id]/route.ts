import { NextResponse } from "next/server";
import { getIntegrationService } from "@/lib/services";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/integrations/[id] - Get a specific integration's state
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const integrationService = getIntegrationService();

  const integration = integrationService.getById(id);

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json(integration);
}

// PATCH /api/integrations/[id] - Update integration credentials/config/enabled
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();
  const integrationService = getIntegrationService();

  const result = await integrationService.update(id, body);

  if (result.notFound) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error, details: result.validationError },
      { status: 400 }
    );
  }

  return NextResponse.json(result.integration);
}

// DELETE /api/integrations/[id] - Remove credentials (reset to unconfigured)
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const integrationService = getIntegrationService();

  const result = await integrationService.delete(id);

  if (result.notFound) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
