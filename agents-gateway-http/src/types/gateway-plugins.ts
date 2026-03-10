export interface GatewayPluginInitInput<
  TConfig = unknown,
  TApp = unknown,
  TRuntime = unknown,
> {
  app: TApp;
  pluginConfig: TConfig;
  runtime: TRuntime;
}

export interface GatewayPlugin<TConfig = unknown> {
  id: string;
  /**
   * Invoked once when the gateway is bootstrapped. Use this to register
   * routes on the app instance and capture the runtime reference. Called
   * sequentially in resolved plugin order; failures are fatal.
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

export interface ResolvedGatewayPlugin<TConfig = GatewayPluginConfig> {
  config: TConfig;
  plugin: GatewayPlugin<TConfig>;
}

export interface GatewayPluginManifest<TConfig = unknown> {
  id: string;
  type: "gateway";
  create: (config: TConfig) => GatewayPlugin<TConfig>;
}
