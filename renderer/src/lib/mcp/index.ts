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
