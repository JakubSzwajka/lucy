import { WHATSAPP_PLUGIN_ID, createWhatsAppPlugin } from "agents-plugin-whatsapp";

import type { GatewayPluginRegistry } from "../types/gateway-plugins.js";

export function buildGatewayPluginRegistry(): GatewayPluginRegistry {
  return {
    [WHATSAPP_PLUGIN_ID]: createWhatsAppPlugin(),
  };
}
