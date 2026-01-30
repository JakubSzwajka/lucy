import { IntegrationRepository, getIntegrationRepository, IntegrationState } from "./integration.repository";
import { allIntegrations, getIntegrationDefinition } from "@/lib/tools/integrations";
import { getIntegrationProvider } from "@/lib/tools";
import type { Integration, IntegrationUpdate } from "@/types";

// ============================================================================
// Integration Service Types
// ============================================================================

export interface IntegrationListItem {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  credentialFields: Array<{ name: string; description?: string }>;
  configFields: Array<{ name: string; description?: string }>;
  hasTestConnection: boolean;
  enabled: boolean;
  isConfigured: boolean;
  config: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IntegrationDetail {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  enabled: boolean;
  isConfigured: boolean;
  config: Record<string, unknown> | null;
}

export interface UpdateIntegrationResult {
  integration?: IntegrationDetail;
  error?: string;
  notFound?: boolean;
  validationError?: unknown;
}

// ============================================================================
// Integration Service
// ============================================================================

/**
 * Service for integration business logic
 */
export class IntegrationService {
  private repository: IntegrationRepository;

  constructor(repository?: IntegrationRepository) {
    this.repository = repository || getIntegrationRepository();
  }

  // -------------------------------------------------------------------------
  // Query Operations
  // -------------------------------------------------------------------------

  /**
   * Get all integrations with their state merged with definitions
   */
  getAll(): IntegrationListItem[] {
    const stateMap = this.repository.findAllAsMap();

    return allIntegrations.map((definition) => {
      const state = stateMap.get(definition.id);

      // Get credential field names (without values) for UI
      const credentialFields = Object.keys(definition.credentialsSchema.shape).map((key) => {
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
        id: definition.id,
        name: definition.name,
        description: definition.description,
        iconUrl: definition.iconUrl,
        credentialFields,
        configFields,
        hasTestConnection: !!definition.testConnection,
        enabled: state?.enabled ?? false,
        isConfigured: state?.credentials !== null,
        config: state?.config ?? null,
        createdAt: state?.createdAt ?? null,
        updatedAt: state?.updatedAt ?? null,
      };
    });
  }

  /**
   * Get a single integration by ID
   */
  getById(id: string): IntegrationDetail | null {
    const definition = getIntegrationDefinition(id);
    if (!definition) {
      return null;
    }

    const state = this.repository.findById(id);

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      iconUrl: definition.iconUrl,
      enabled: state?.enabled ?? false,
      isConfigured: state?.credentials !== null,
      config: state?.config ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Update Operations
  // -------------------------------------------------------------------------

  /**
   * Update an integration (credentials, config, enabled)
   */
  async update(id: string, data: IntegrationUpdate): Promise<UpdateIntegrationResult> {
    const definition = getIntegrationDefinition(id);
    if (!definition) {
      return { notFound: true };
    }

    // Validate credentials if provided
    if (data.credentials !== undefined) {
      const result = definition.credentialsSchema.safeParse(data.credentials);
      if (!result.success) {
        return { error: "Invalid credentials", validationError: result.error.format() };
      }
    }

    // Validate config if provided
    if (data.config !== undefined && definition.configSchema) {
      const result = definition.configSchema.safeParse(data.config);
      if (!result.success) {
        return { error: "Invalid config", validationError: result.error.format() };
      }
    }

    // Upsert the integration
    const state = this.repository.upsert(id, definition.name, {
      enabled: data.enabled,
      credentials: data.credentials,
      config: data.config,
    });

    // Refresh integration provider to pick up changes
    await this.refreshProvider();

    return {
      integration: {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        iconUrl: definition.iconUrl,
        enabled: state.enabled,
        isConfigured: state.credentials !== null,
        config: state.config,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Delete Operations
  // -------------------------------------------------------------------------

  /**
   * Delete an integration (reset to unconfigured)
   */
  async delete(id: string): Promise<{ success: boolean; notFound?: boolean }> {
    const definition = getIntegrationDefinition(id);
    if (!definition) {
      return { success: false, notFound: true };
    }

    this.repository.delete(id);

    // Refresh integration provider
    await this.refreshProvider();

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Provider Management
  // -------------------------------------------------------------------------

  /**
   * Refresh the integration provider to pick up changes
   */
  private async refreshProvider(): Promise<void> {
    const provider = getIntegrationProvider();
    if (provider) {
      await provider.refresh();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: IntegrationService | null = null;

export function getIntegrationService(): IntegrationService {
  if (!instance) {
    instance = new IntegrationService();
  }
  return instance;
}
