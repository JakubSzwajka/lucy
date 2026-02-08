import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================================
// USERS - Multi-user support
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// ============================================================================
// SESSIONS - User-facing conversation container
// ============================================================================

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),

  // User association (required for multi-user)
  userId: text("user_id")
    .notNull()
    .references(() => users.id),

  // Points to the orchestrating agent for this session
  rootAgentId: text("root_agent_id"),

  // Display
  title: text("title").notNull().default("New Chat"),

  // Session lifecycle
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("sessions_user_idx").on(table.userId),
]);

// ============================================================================
// AGENTS - Runtime instances with parent-child hierarchy
// ============================================================================

export const agentStatusEnum = ["pending", "running", "waiting", "completed", "failed", "cancelled"] as const;

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),

  // User association
  userId: text("user_id")
    .notNull()
    .references(() => users.id),

  // Relationships
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),

  // If spawned by a tool call, which one?
  sourceCallId: text("source_call_id"),

  // Task definition
  name: text("name").notNull(), // e.g., "orchestrator", "researcher", "coder"
  task: text("task"), // The goal/instruction for this agent
  systemPrompt: text("system_prompt"), // Agent-specific system prompt
  model: text("model"), // Which model to use
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>(), // Additional config

  // Runtime state
  status: text("status", { enum: agentStatusEnum }).notNull().default("pending"),
  waitingForCallId: text("waiting_for_call_id"), // Blocked on this tool call
  result: text("result"), // Final result/output
  error: text("error"), // Error message if failed
  turnCount: integer("turn_count").notNull().default(0), // Number of turns completed

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
}, (table) => [
  index("agents_session_idx").on(table.sessionId),
  index("agents_parent_idx").on(table.parentId),
  index("agents_user_idx").on(table.userId),
]);

// ============================================================================
// ITEMS - Polymorphic conversation entries per agent
// ============================================================================

export const itemTypeEnum = ["message", "tool_call", "tool_result", "reasoning"] as const;
export const messageRoleEnum = ["user", "assistant", "system"] as const;
export const toolCallStatusEnum = ["pending", "pending_approval", "running", "completed", "failed"] as const;

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),

  // Belongs to an agent's conversation thread
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),

  // Ordering within the agent's thread
  sequence: integer("sequence").notNull(),

  // Discriminator for polymorphism
  type: text("type", { enum: itemTypeEnum }).notNull(),

  // === TYPE: message ===
  role: text("role", { enum: messageRoleEnum }),
  content: text("content"),

  // === TYPE: tool_call ===
  callId: text("call_id"), // Unique ID for linking call → result
  toolName: text("tool_name"),
  toolArgs: text("tool_args", { mode: "json" }).$type<Record<string, unknown>>(),
  toolStatus: text("tool_status", { enum: toolCallStatusEnum }),

  // === TYPE: tool_result ===
  // Uses callId to link back to the tool_call
  toolOutput: text("tool_output"),
  toolError: text("tool_error"),

  // === TYPE: reasoning ===
  reasoningSummary: text("reasoning_summary"),
  reasoningContent: text("reasoning_content"),

  // Metadata
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("items_agent_seq_idx").on(table.agentId, table.sequence),
  index("items_call_id_idx").on(table.callId),
]);

// ============================================================================
// SYSTEM PROMPTS - Reusable system prompts
// ============================================================================

export const systemPrompts = sqliteTable("system_prompts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("system_prompts_user_idx").on(table.userId),
]);

// ============================================================================
// QUICK ACTIONS - Predefined user prompts shown on empty chat
// ============================================================================

export const quickActions = sqliteTable("quick_actions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  content: text("content").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("quick_actions_user_idx").on(table.userId),
]);

// ============================================================================
// PLANS - Execution plans owned by orchestrator agents
// ============================================================================

export const planStatusEnum = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const;

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),

  // User association
  userId: text("user_id")
    .notNull()
    .references(() => users.id),

  // Ownership - one plan per session, owned by orchestrator agent
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),

  // Content
  title: text("title").notNull(),
  description: text("description"),

  // Status
  status: text("status", { enum: planStatusEnum }).notNull().default("pending"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
}, (table) => [
  index("plans_session_idx").on(table.sessionId),
  index("plans_agent_idx").on(table.agentId),
  index("plans_user_idx").on(table.userId),
]);

// ============================================================================
// PLAN STEPS - Individual steps within a plan
// ============================================================================

export const planStepStatusEnum = ['pending', 'in_progress', 'completed', 'failed', 'skipped'] as const;

export const planSteps = sqliteTable("plan_steps", {
  id: text("id").primaryKey(),

  // Belongs to plan
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),

  // Ordering
  sequence: integer("sequence").notNull(),

  // Content
  description: text("description").notNull(),

  // Execution link (for future sub-agent support)
  assignedAgentId: text("assigned_agent_id")
    .references(() => agents.id, { onDelete: "set null" }),

  // Status & result
  status: text("status", { enum: planStepStatusEnum }).notNull().default("pending"),
  result: text("result"),
  error: text("error"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
}, (table) => [
  index("plan_steps_plan_idx").on(table.planId),
  index("plan_steps_agent_idx").on(table.assignedAgentId),
  index("plan_steps_plan_seq_idx").on(table.planId, table.sequence),
]);

// ============================================================================
// SETTINGS - App-wide settings (per user)
// ============================================================================

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  defaultModelId: text("default_model_id"),
  defaultSystemPromptId: text("default_system_prompt_id"),
  enabledModels: text("enabled_models"), // JSON array of model IDs
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("settings_user_idx").on(table.userId),
]);

// ============================================================================
// MCP SERVERS - External tool providers (Model Context Protocol)
// ============================================================================

export const mcpTransportTypeEnum = ["stdio", "sse", "http"] as const;

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),

  // Transport configuration
  transportType: text("transport_type", { enum: mcpTransportTypeEnum }).notNull(),

  // Stdio transport fields
  command: text("command"), // e.g., "npx", "/usr/local/bin/mcp-server"
  args: text("args"), // JSON array of arguments
  env: text("env"), // JSON object of environment variables

  // HTTP/SSE transport fields
  url: text("url"),
  headers: text("headers"), // JSON object of headers

  // Settings
  requireApproval: integer("require_approval", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  iconUrl: text("icon_url"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("mcp_servers_user_idx").on(table.userId),
]);

// ============================================================================
// SESSION MCP SERVERS - Junction table for session-to-MCP mapping
// ============================================================================

export const sessionMcpServers = sqliteTable("session_mcp_servers", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  mcpServerId: text("mcp_server_id")
    .notNull()
    .references(() => mcpServers.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("session_mcp_session_idx").on(table.sessionId),
  index("session_mcp_server_idx").on(table.mcpServerId),
]);

// ============================================================================
// INTEGRATIONS - Third-party service integrations (Todoist, Notion, etc.)
// ============================================================================

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(), // e.g., "todoist", "notion"
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(), // Display name
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  credentials: text("credentials"), // JSON: { "apiKey": "..." }
  config: text("config"), // JSON: integration-specific config
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("integrations_user_idx").on(table.userId),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserRecord = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type AgentRecord = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentStatus = (typeof agentStatusEnum)[number];

export type ItemRecord = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemType = (typeof itemTypeEnum)[number];
export type MessageRole = (typeof messageRoleEnum)[number];
export type ToolCallStatus = (typeof toolCallStatusEnum)[number];

export type SystemPromptRecord = typeof systemPrompts.$inferSelect;
export type NewSystemPrompt = typeof systemPrompts.$inferInsert;

export type QuickActionRecord = typeof quickActions.$inferSelect;
export type NewQuickAction = typeof quickActions.$inferInsert;

export type SettingsRecord = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export type PlanRecord = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanStatus = (typeof planStatusEnum)[number];

export type PlanStepRecord = typeof planSteps.$inferSelect;
export type NewPlanStep = typeof planSteps.$inferInsert;
export type PlanStepStatus = (typeof planStepStatusEnum)[number];

export type McpTransportType = (typeof mcpTransportTypeEnum)[number];
export type McpServerRecord = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
export type SessionMcpServerRecord = typeof sessionMcpServers.$inferSelect;
export type NewSessionMcpServer = typeof sessionMcpServers.$inferInsert;

export type IntegrationRecord = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
