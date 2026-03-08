import type { LucyConfig } from "agents-runtime";

let gatewayConfig: LucyConfig["agents-gateway-http"] | null = null;

export function setGatewayConfig(config: LucyConfig["agents-gateway-http"]): void {
  gatewayConfig = config;
}

export function getGatewayConfig(): LucyConfig["agents-gateway-http"] | null {
  return gatewayConfig;
}
