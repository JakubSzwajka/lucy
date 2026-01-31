import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

// ============================================================================
// Integration Definition
// ============================================================================

export interface IntegrationDefinition<
  TCredentials extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TConfig extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  // Identity
  id: string;
  name: string;
  description: string;
  iconUrl?: string;

  // Credential schema - defines what the integration needs
  credentialsSchema: TCredentials;

  // Optional config schema - additional settings
  configSchema?: TConfig;

  // Tool factory - creates tools when integration is enabled
  createTools: (
    credentials: z.infer<TCredentials>,
    config: z.infer<TConfig>
  ) => AnyToolDefinition[];

  // Optional: Test connection with credentials
  testConnection?: (credentials: z.infer<TCredentials>) => Promise<{
    success: boolean;
    error?: string;
    info?: string;
  }>;
}

// ============================================================================
// Integration State (from database)
// ============================================================================

export interface IntegrationState {
  id: string;
  name: string;
  enabled: boolean;
  credentials: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Integration with State (merged definition + db state)
// ============================================================================

export interface IntegrationWithState {
  definition: IntegrationDefinition;
  state: IntegrationState | null;
  isConfigured: boolean;
  isEnabled: boolean;
}

// ============================================================================
// Helper to define integrations with type inference
// ============================================================================

export function defineIntegration<
  TCredentials extends z.ZodObject<z.ZodRawShape>,
  TConfig extends z.ZodObject<z.ZodRawShape> = z.ZodObject<Record<string, never>>,
>(
  definition: IntegrationDefinition<TCredentials, TConfig>
): IntegrationDefinition<TCredentials, TConfig> {
  return definition;
}
