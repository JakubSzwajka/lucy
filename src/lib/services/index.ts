// ============================================================================
// Service Layer Exports
// ============================================================================

// MCP Service (re-export from lib/mcp)
export {
  McpService,
  getMcpService,
  McpRepository,
  getMcpRepository,
} from "@/lib/integrations/mcp";
export type { McpTestResult, McpStatusResult, ValidationResult } from "@/lib/integrations/mcp";

// Item Service
export { ItemService, getItemService } from "./item";
export { ItemRepository, getItemRepository } from "./item";
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
export { ChatService, getChatService, cancelAgent } from "./chat";
export type {
  ChatContext,
  ChatPrepareOptions,
  ExecuteTurnOptions,
  ModelMessage,
  ChatFinishResult,
} from "./chat";

// Config Services
export { SettingsService, getSettingsService } from "./config";
export { SystemPromptService, getSystemPromptService } from "./config";

// Plan Service
export { PlanService, getPlanService } from "./plan";
export { PlanRepository, getPlanRepository } from "./plan";
export type {
  CreatePlanInput,
  UpdatePlanInput,
  CreatePlanResult,
  UpdatePlanResult,
  PlanWithSteps,
} from "./plan";

// Filesystem Service
export { FilesystemService, createFilesystemService } from "./filesystem";
export type { FileInfo, FilesystemServiceConfig } from "./filesystem";

// Conversation Search
export {
  ConversationSearchRepository,
  getConversationSearchRepository,
} from "./conversation-search";
export type {
  ConversationSearchResult,
  ConversationSearchOptions,
  ContextItem,
} from "./conversation-search";

// Agent Config Service
export { AgentConfigService, getAgentConfigService } from "./agent-config";
export { AgentConfigRepository, getAgentConfigRepository } from "./agent-config";

// Trigger Service
export { TriggerService, getTriggerService } from "./trigger";
export { TriggerRepository, getTriggerRepository } from "./trigger";
export { TriggerScheduler, getTriggerScheduler } from "./trigger";

// Memory Service
export { MemoryService, getMemoryService } from "@/lib/memory";
export type {
  Memory,
  MemoryEvidence,
  MemoryStats,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryFilters,
} from "@/lib/memory";