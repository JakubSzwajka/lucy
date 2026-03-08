import type { AgentRuntime } from "agents-runtime";
import type { Hono } from "hono";

export interface GatewayPluginInitInput<TConfig = unknown> {
  app: Hono;
  pluginConfig: TConfig;
  runtime: AgentRuntime;
}

export interface GatewayPlugin<TConfig = unknown> {
  id: string;
  /**
   * Invoked once when the gateway is bootstrapped. Use this to register
   * routes on the Hono app and capture the runtime reference for calling
   * sendMessage. Called sequentially in resolved plugin
   * order; failures are fatal.
   */
  onInit?: (
    input: GatewayPluginInitInput<TConfig>,
  ) => Promise<void> | void;
  /**
   * Invoked when the gateway is shutting down. Use this to clean up
   * resources created in onInit (clear timers, close connections, etc.).
   */
  onDestroy?: () => Promise<void> | void;
}

export type GatewayPluginConfig = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry is type-erased; concrete types are restored at resolution time
export type GatewayPluginRegistry = Record<string, GatewayPlugin<any>>;

export interface ResolvedGatewayPlugin<TConfig = GatewayPluginConfig> {
  config: TConfig;
  plugin: GatewayPlugin<TConfig>;
}

export interface GatewayPluginsConfig {
  configById?: Record<string, GatewayPluginConfig | undefined>;
  enabled: string[];
}
