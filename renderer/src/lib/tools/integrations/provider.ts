import { db } from "@/lib/db";
import { integrations as integrationsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ToolProvider, ToolDefinition } from "../types";
import type { IntegrationDefinition } from "./types";

export class IntegrationToolProvider implements ToolProvider {
  readonly name = "integration";
  private tools: ToolDefinition[] = [];
  private integrationDefinitions: IntegrationDefinition[] = [];

  constructor(definitions: IntegrationDefinition[] = []) {
    this.integrationDefinitions = definitions;
  }

  async getTools(): Promise<ToolDefinition[]> {
    return this.tools;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async initialize(): Promise<void> {
    await this.refresh();
  }

  async dispose(): Promise<void> {
    this.tools = [];
  }

  /**
   * Register an integration definition.
   * This should be called at startup before initialize().
   */
  registerIntegration(definition: IntegrationDefinition): void {
    const existing = this.integrationDefinitions.find(d => d.id === definition.id);
    if (!existing) {
      this.integrationDefinitions.push(definition);
    }
  }

  /**
   * Get all registered integration definitions.
   */
  getIntegrationDefinitions(): IntegrationDefinition[] {
    return [...this.integrationDefinitions];
  }

  /**
   * Get a specific integration definition by ID.
   */
  getIntegrationDefinition(id: string): IntegrationDefinition | undefined {
    return this.integrationDefinitions.find(d => d.id === id);
  }

  /**
   * Refresh tools from database.
   * Called when integrations are enabled/disabled or credentials change.
   */
  async refresh(): Promise<void> {
    this.tools = [];

    // Fetch enabled integrations from database
    const enabledIntegrations = await db
      .select()
      .from(integrationsTable)
      .where(eq(integrationsTable.enabled, true));

    for (const dbIntegration of enabledIntegrations) {
      const definition = this.integrationDefinitions.find(
        d => d.id === dbIntegration.id
      );
      if (!definition) {
        console.warn(
          `Integration ${dbIntegration.id} is enabled but no definition found`
        );
        continue;
      }

      try {
        // Parse credentials and config
        const credentials = dbIntegration.credentials
          ? JSON.parse(dbIntegration.credentials)
          : {};
        const config = dbIntegration.config
          ? JSON.parse(dbIntegration.config)
          : {};

        // Validate credentials against schema
        const validatedCredentials = definition.credentialsSchema.safeParse(credentials);
        if (!validatedCredentials.success) {
          console.error(
            `Invalid credentials for integration ${dbIntegration.id}:`,
            validatedCredentials.error.message
          );
          continue;
        }

        // Validate config if schema exists
        let validatedConfig = {};
        if (definition.configSchema) {
          const configResult = definition.configSchema.safeParse(config);
          if (!configResult.success) {
            console.warn(
              `Invalid config for integration ${dbIntegration.id}:`,
              configResult.error.message
            );
            // Continue with empty config instead of failing
          } else {
            validatedConfig = configResult.data;
          }
        }

        // Create tools for this integration
        const integrationTools = definition.createTools(
          validatedCredentials.data,
          validatedConfig
        );
        this.tools.push(...integrationTools);

        console.log(
          `Loaded ${integrationTools.length} tools from integration: ${definition.name}`
        );
      } catch (error) {
        console.error(
          `Failed to initialize integration ${dbIntegration.id}:`,
          error
        );
      }
    }
  }
}
