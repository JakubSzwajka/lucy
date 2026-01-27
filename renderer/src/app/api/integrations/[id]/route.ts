import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getIntegrationDefinition } from "@/lib/tools/integrations";
import { getIntegrationProvider } from "@/lib/tools";

// GET /api/integrations/[id] - Get a specific integration's state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const definition = getIntegrationDefinition(id);
  if (!definition) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const [record] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id));

  const state = record
    ? {
        id: record.id,
        name: record.name,
        enabled: record.enabled,
        credentials: record.credentials
          ? JSON.parse(record.credentials)
          : null,
        config: record.config ? JSON.parse(record.config) : null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    : null;

  return NextResponse.json({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    iconUrl: definition.iconUrl,
    enabled: state?.enabled ?? false,
    isConfigured: state?.credentials !== null,
    config: state?.config ?? null,
    // Don't expose credentials in response
  });
}

// PATCH /api/integrations/[id] - Update integration credentials/config/enabled
export async function PATCH(
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

  // Validate credentials if provided
  if (body.credentials !== undefined) {
    const result = definition.credentialsSchema.safeParse(body.credentials);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid credentials", details: result.error.format() },
        { status: 400 }
      );
    }
  }

  // Validate config if provided
  if (body.config !== undefined && definition.configSchema) {
    const result = definition.configSchema.safeParse(body.config);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid config", details: result.error.format() },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  // Check if record exists
  const [existing] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id));

  if (existing) {
    // Update existing record
    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.enabled !== undefined) {
      updates.enabled = body.enabled;
    }
    if (body.credentials !== undefined) {
      updates.credentials = JSON.stringify(body.credentials);
    }
    if (body.config !== undefined) {
      updates.config = JSON.stringify(body.config);
    }

    await db.update(integrations).set(updates).where(eq(integrations.id, id));
  } else {
    // Insert new record
    await db.insert(integrations).values({
      id,
      name: definition.name,
      enabled: body.enabled ?? false,
      credentials: body.credentials ? JSON.stringify(body.credentials) : null,
      config: body.config ? JSON.stringify(body.config) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Refresh integration provider to pick up changes
  const provider = getIntegrationProvider();
  if (provider) {
    await provider.refresh();
  }

  // Return updated state (without credentials)
  const [updated] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id));

  return NextResponse.json({
    id: definition.id,
    name: definition.name,
    enabled: updated.enabled,
    isConfigured: updated.credentials !== null,
    config: updated.config ? JSON.parse(updated.config) : null,
    updatedAt: updated.updatedAt,
  });
}

// DELETE /api/integrations/[id] - Remove credentials (reset to unconfigured)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const definition = getIntegrationDefinition(id);
  if (!definition) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  // Delete the record (or update to reset credentials)
  await db.delete(integrations).where(eq(integrations.id, id));

  // Refresh integration provider
  const provider = getIntegrationProvider();
  if (provider) {
    await provider.refresh();
  }

  return NextResponse.json({ success: true });
}
