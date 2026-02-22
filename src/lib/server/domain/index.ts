// ============================================================================
// Domain Layer Exports — entity CRUD services & repositories
// ============================================================================

// Item Service
export { ItemService, getItemService } from "./item";
export { ItemRepository, getItemRepository } from "./item";
export type {
  CreateItemData,
  CreateMessageData,
  CreateToolCallData,
  CreateToolResultData,
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

// Agent Config Service
export { AgentConfigService, getAgentConfigService } from "./agent-config";
export { AgentConfigRepository, getAgentConfigRepository } from "./agent-config";

// Config Services
export { SettingsService, getSettingsService } from "./config";
export { SystemPromptService, getSystemPromptService } from "./config";

// Repository Types
export type { Repository, PaginatedRepository, QueryOptions, PaginatedResult } from "./repository.types";
