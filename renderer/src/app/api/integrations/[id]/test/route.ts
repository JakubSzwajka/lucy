import { NextResponse } from "next/server";
import { getIntegrationDefinition } from "@/lib/tools/integrations";

// POST /api/integrations/[id]/test - Test connection with provided credentials
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const definition = getIntegrationDefinition(id);
  if (!definition) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (!definition.testConnection) {
    return NextResponse.json(
      { error: "This integration does not support connection testing" },
      { status: 400 }
    );
  }

  // Validate credentials
  const result = definition.credentialsSchema.safeParse(body.credentials);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid credentials", details: result.error.format() },
      { status: 400 }
    );
  }

  // Test the connection
  try {
    const testResult = await definition.testConnection(result.data);
    return NextResponse.json(testResult);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    });
  }
}
