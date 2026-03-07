export { FileAgentStore } from "./file-agent-store.js";
export { FileItemStore } from "./file-item-store.js";
export { FileConfigStore } from "./file-config-store.js";
export { FileSessionStore } from "./file-session-store.js";
export { FileIdentityProvider } from "./file-identity-provider.js";

import { FileAgentStore } from "./file-agent-store.js";
import { FileItemStore } from "./file-item-store.js";
import { FileConfigStore } from "./file-config-store.js";
import { FileSessionStore } from "./file-session-store.js";
import { FileIdentityProvider } from "./file-identity-provider.js";

export function createFileAdapters(dataDir = ".agents-data") {
  return {
    agents: new FileAgentStore(dataDir),
    items: new FileItemStore(dataDir),
    config: new FileConfigStore(dataDir),
    sessions: new FileSessionStore(dataDir),
    identity: new FileIdentityProvider(dataDir),
  };
}
