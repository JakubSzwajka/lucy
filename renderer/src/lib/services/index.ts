// ============================================================================
// Service Layer Exports
// ============================================================================

// MCP Service
export { McpService, getMcpService } from "./mcp";
export { McpRepository, getMcpRepository } from "./mcp";
export type { McpTestResult, McpStatusResult, ValidationResult } from "./mcp";

// Item Service
export { ItemService, getItemService } from "./item";
export { ItemRepository, getItemRepository } from "./item";
export {
  ItemTransformer,
  extractContent,
  extractActivitiesFromParts,
  itemsToActivities,
  itemsToChatMessages,
  mergeWithStreaming,
} from "./item";
export type {
  CreateItemData,
  CreateMessageData,
  CreateToolCallData,
  CreateToolResultData,
  CreateReasoningData,
  CreateItemResult,
} from "./item";

// Session Service
export { SessionService, getSessionService } from "./session";
export { SessionRepository, getSessionRepository } from "./session";
export type { CreateSessionOptions, CreateSessionResult, UpdateSessionResult } from "./session";

// Agent Service
export { AgentService, getAgentService } from "./agent";
export { AgentRepository, getAgentRepository } from "./agent";
export type { CreateAgentResult, UpdateAgentResult } from "./agent";

// Chat Service
export { ChatService, getChatService } from "./chat";
export type {
  ChatContext,
  ChatPrepareOptions,
  ModelMessage,
  ChatFinishResult,
} from "./chat";

// Integration Service
export { IntegrationService, getIntegrationService } from "./integration";
export { IntegrationRepository, getIntegrationRepository } from "./integration";
export type {
  IntegrationState,
  IntegrationListItem,
  IntegrationDetail,
  UpdateIntegrationResult,
} from "./integration";

// Config Services
export { SettingsService, getSettingsService } from "./config";
export { SystemPromptService, getSystemPromptService } from "./config";
