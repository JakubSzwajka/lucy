export { FileAgentStore } from "./file-agent-store.js";
export { FileConfigStore } from "./file-config-store.js";
export { FileIdentityProvider } from "./file-identity-provider.js";
export { FileItemStore } from "./file-item-store.js";
export { FileSessionStore } from "./file-session-store.js";
export { resolveDataDir } from "./resolve-data-dir.js";

import { FileAgentStore } from "./file-agent-store.js";
import { FileConfigStore } from "./file-config-store.js";
import { FileIdentityProvider } from "./file-identity-provider.js";
import { FileItemStore } from "./file-item-store.js";
import { FileSessionStore } from "./file-session-store.js";
import { resolveDataDir } from "./resolve-data-dir.js";

export function createFileAdapters(dataDir?: string) {
  const resolved = resolveDataDir(dataDir);
  return {
    agents: new FileAgentStore(resolved),
    items: new FileItemStore(resolved),
    config: new FileConfigStore(resolved),
    sessions: new FileSessionStore(resolved),
    identity: new FileIdentityProvider(resolved),
  };
}
