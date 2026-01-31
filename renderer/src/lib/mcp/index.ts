export {
  createMcpClient,
  closeMcpClient,
  executeToolCall,
  convertToAiSdkTools,
  getClientStatuses,
  type McpClientWrapper,
  type SimpleTool,
} from "./client";

export {
  McpClientPool,
  getGlobalPool,
  ensureServersConnected,
  disconnectAll,
  getPoolForSession, // Legacy, will be removed
  type McpServerStatus,
} from "./pool";

export { McpRepository, getMcpRepository } from "./repository";
export { McpService, getMcpService } from "./service";
export type { McpTestResult, McpStatusResult, ValidationResult } from "./service";
