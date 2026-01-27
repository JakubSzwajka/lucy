import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { allIntegrations } from "@/lib/tools/integrations";

// Parse database record into state
function parseIntegrationRecord(record: typeof integrations.$inferSelect) {
  return {
    id: record.id,
    name: record.name,
    enabled: record.enabled,
    credentials: record.credentials ? JSON.parse(record.credentials) : null,
    config: record.config ? JSON.parse(record.config) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// GET /api/integrations - List all available integrations with their state
export async function GET() {
  // Get all integration states from database
  const dbIntegrations = await db.select().from(integrations);
  const stateMap = new Map(
    dbIntegrations.map((i) => [i.id, parseIntegrationRecord(i)])
  );

  // Merge definitions with database state
  const result = allIntegrations.map((definition) => {
    const state = stateMap.get(definition.id);

    // Get credential field names (without values) for UI
    const credentialFields = Object.keys(
      definition.credentialsSchema.shape
    ).map((key) => {
      const field = definition.credentialsSchema.shape[key];
      return {
        name: key,
        description: field && "description" in field ? (field.description as string | undefined) : undefined,
      };
    });

    // Get config field names for UI
    const configFields = definition.configSchema
      ? Object.keys(definition.configSchema.shape).map((key) => {
          const field = definition.configSchema?.shape[key];
          return {
            name: key,
            description: field && "description" in field ? (field.description as string | undefined) : undefined,
          };
        })
      : [];

    return {
      // Definition info
      id: definition.id,
      name: definition.name,
      description: definition.description,
      iconUrl: definition.iconUrl,
      credentialFields,
      configFields,
      hasTestConnection: !!definition.testConnection,

      // State info
      enabled: state?.enabled ?? false,
      isConfigured: state?.credentials !== null,
      config: state?.config ?? null,
      createdAt: state?.createdAt ?? null,
      updatedAt: state?.updatedAt ?? null,
    };
  });

  return NextResponse.json(result);
}
