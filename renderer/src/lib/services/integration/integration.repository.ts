import { db, integrations, IntegrationRecord } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { Integration, IntegrationUpdate } from "@/types";

// ============================================================================
// Integration Repository Types
// ============================================================================

export interface IntegrationState {
  id: string;
  name: string;
  enabled: boolean;
  credentials: Record<string, string> | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Integration Repository
// ============================================================================

/**
 * Transform database record to state object
 */
function parseIntegrationRecord(record: IntegrationRecord): IntegrationState {
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

/**
 * Repository for integration data access
 */
export class IntegrationRepository {
  /**
   * Find an integration by ID
   */
  findById(id: string): IntegrationState | null {
    const [record] = db.select().from(integrations).where(eq(integrations.id, id)).all();
    return record ? parseIntegrationRecord(record) : null;
  }

  /**
   * Find all integrations
   */
  findAll(): IntegrationState[] {
    const records = db.select().from(integrations).all();
    return records.map(parseIntegrationRecord);
  }

  /**
   * Find all as a map (id -> state)
   */
  findAllAsMap(): Map<string, IntegrationState> {
    const records = this.findAll();
    return new Map(records.map((r) => [r.id, r]));
  }

  /**
   * Upsert an integration (create or update)
   */
  upsert(
    id: string,
    name: string,
    data: {
      enabled?: boolean;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    }
  ): IntegrationState {
    const now = new Date();
    const existing = this.findById(id);

    if (existing) {
      // Update existing record
      const updates: Record<string, unknown> = { updatedAt: now };

      if (data.enabled !== undefined) {
        updates.enabled = data.enabled;
      }
      if (data.credentials !== undefined) {
        updates.credentials = JSON.stringify(data.credentials);
      }
      if (data.config !== undefined) {
        updates.config = JSON.stringify(data.config);
      }

      db.update(integrations).set(updates).where(eq(integrations.id, id)).run();
    } else {
      // Insert new record
      db.insert(integrations).values({
        id,
        name,
        enabled: data.enabled ?? false,
        credentials: data.credentials ? JSON.stringify(data.credentials) : null,
        config: data.config ? JSON.stringify(data.config) : null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    return this.findById(id)!;
  }

  /**
   * Delete an integration
   */
  delete(id: string): boolean {
    const result = db.delete(integrations).where(eq(integrations.id, id)).run();
    return result.changes > 0;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: IntegrationRepository | null = null;

export function getIntegrationRepository(): IntegrationRepository {
  if (!instance) {
    instance = new IntegrationRepository();
  }
  return instance;
}
