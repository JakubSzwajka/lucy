export { FileAgentStore } from "./file-agent-store.js";
export { FileConfigStore } from "./file-config-store.js";
export { FileIdentityProvider } from "./file-identity-provider.js";
export { FileItemStore } from "./file-item-store.js";
export { resolveDataDir } from "./resolve-data-dir.js";

import { FileAgentStore } from "./file-agent-store.js";
import { FileConfigStore } from "./file-config-store.js";
import { FileIdentityProvider } from "./file-identity-provider.js";
import { FileItemStore } from "./file-item-store.js";
import { resolveDataDir } from "./resolve-data-dir.js";

export function createFileAdapters(dataDir?: string) {
  const resolved = resolveDataDir(dataDir);
  return {
    agents: new FileAgentStore(resolved),
    config: new FileConfigStore(resolved),
    identity: new FileIdentityProvider(resolved),
    items: new FileItemStore(resolved),
  };
}
