import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex, real } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// AGENT CONFIGS - Reusable agent configuration templates
// ============================================================================

export const agentConfigToolTypeEnum = ["mcp", "builtin", "delegate"] as const;

export const agentConfigs = pgTable("agent_configs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  systemPromptId: text("system_prompt_id")
    .references(() => systemPrompts.id, { onDelete: "set null" }),
  defaultModelId: text("default_model_id"),
  maxTurns: integer("max_turns").notNull().default(25),
  icon: text("icon"),
  color: text("color"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("agent_configs_user_idx").on(table.userId),
]);

export const agentConfigTools = pgTable("agent_config_tools", {
  id: text("id").primaryKey(),
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id, { onDelete: "cascade" }),
  toolType: text("tool_type", { enum: agentConfigToolTypeEnum }).notNull(),
  toolRef: text("tool_ref").notNull(),
  toolName: text("tool_name"),
  toolDescription: text("tool_description"),
}, (table) => [
  index("agent_config_tools_config_idx").on(table.agentConfigId),
  uniqueIndex("agent_config_tools_unique_idx").on(table.agentConfigId, table.toolType, table.toolRef),
]);

// ============================================================================
// USERS - Multi-user support
// ============================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ============================================================================
// SESSIONS - User-facing conversation container
// ============================================================================

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),

  // User association (required for multi-user)
  userId: text("user_id")
    .notNull()
    .references(() => users.id),

  // Points to the orchestrating agent for this session
  rootAgentId: text("root_agent_id"),

  // Optional agent config template used for this session
  agentConfigId: text("agent_config_id")
    .references(() => agentConfigs.id, { onDelete: "set null" }),

  // Display
  title: text("title").notNull().default("New Chat"),

  // Session lifecycle
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),

  // Pinned sessions appear at top of sidebar
  isPinned: boolean("is_pinned").notNull().default(false),

  // Recursive session hierarchy
  parentSessionId: text("parent_session_id"),
  sourceCallId: text("source_call_id"),

  // Auto-reflection progress tracking
  reflectionTokenCount: integer("reflection_token_count").notNull().default(0),
  lastReflectionItemCount: integer("last_reflection_item_count").notNull().default(0),

  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_parent_idx").on(table.parentSessionId),
]);

// ============================================================================
// AGENTS - Runtime instances with parent-child hierarchy
// ============================================================================

export const agentStatusEnum = ["pending", "running", "waiting", "completed", "failed", "cancelled"] as const;

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),

  // User association
  userId: text("user_id")
    .notNull()
    .references(() => users.id),

  // Relationships
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),

  // Optional agent config template used for this agent
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id, { onDelete: "cascade" }),

  // Task definition
  name: text("name").notNull(), // e.g., "orchestrator", "researcher", "coder"
  task: text("task"), // The goal/instruction for this agent
  systemPrompt: text("system_prompt"), // Agent-specific system prompt
  model: text("model"), // Which model to use
  config: jsonb("config").$type<Record<string, unknown>>(), // Additional config

  // Runtime state
  status: text("status", { enum: agentStatusEnum }).notNull().default("pending"),
  waitingForCallId: text("waiting_for_call_id"), // Blocked on this tool call
  result: text("result"), // Final result/output
  error: text("error"), // Error message if failed
  turnCount: integer("turn_count").notNull().default(0), // Number of turns completed

  // Timestamps
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("agents_session_idx").on(table.sessionId),
  index("agents_user_idx").on(table.userId),
]);

// ============================================================================
// ITEMS - Polymorphic conversation entries per agent
// ============================================================================

export const itemTypeEnum = ["message", "tool_call", "tool_result", "reasoning"] as const;
export const messageRoleEnum = ["user", "assistant", "system"] as const;
export const toolCallStatusEnum = ["pending", "pending_approval", "running", "completed", "failed"] as const;

export const items = pgTable("items", {
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
  contentParts: text("content_parts"), // JSON string of multimodal parts array, null for text-only

  // === TYPE: tool_call ===
  callId: text("call_id"), // Unique ID for linking call → result
  toolName: text("tool_name"),
  toolArgs: jsonb("tool_args").$type<Record<string, unknown>>(),
  toolStatus: text("tool_status", { enum: toolCallStatusEnum }),

  // === TYPE: tool_result ===
  // Uses callId to link back to the tool_call
  toolOutput: text("tool_output"),
  toolError: text("tool_error"),

  // === TYPE: reasoning ===
  reasoningSummary: text("reasoning_summary"),
  reasoningContent: text("reasoning_content"),

  // Metadata
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("items_agent_seq_idx").on(table.agentId, table.sequence),
  index("items_call_id_idx").on(table.callId),
]);

// ============================================================================
// SYSTEM PROMPTS - Reusable system prompts
// ============================================================================

export const systemPrompts = pgTable("system_prompts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("system_prompts_user_idx").on(table.userId),
]);

// ============================================================================
// PLANS - Execution plans owned by orchestrator agents
// ============================================================================

export const planStatusEnum = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const;

export const plans = pgTable("plans", {
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
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("plans_session_idx").on(table.sessionId),
  index("plans_agent_idx").on(table.agentId),
  index("plans_user_idx").on(table.userId),
]);

// ============================================================================
// PLAN STEPS - Individual steps within a plan
// ============================================================================

export const planStepStatusEnum = ['pending', 'in_progress', 'completed', 'failed', 'skipped'] as const;

export const planSteps = pgTable("plan_steps", {
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
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("plan_steps_plan_idx").on(table.planId),
  index("plan_steps_agent_idx").on(table.assignedAgentId),
  index("plan_steps_plan_seq_idx").on(table.planId, table.sequence),
]);

// ============================================================================
// SETTINGS - App-wide settings (per user)
// ============================================================================

export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  enabledModels: text("enabled_models"), // JSON array of model IDs
  contextWindowSize: integer("context_window_size"), // sliding window: max user messages sent to LLM
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("settings_user_idx").on(table.userId),
]);

// ============================================================================
// MCP SERVERS - External tool providers (Model Context Protocol)
// ============================================================================

export const mcpTransportTypeEnum = ["stdio", "sse", "http"] as const;

export const mcpServers = pgTable("mcp_servers", {
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
  requireApproval: boolean("require_approval").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  iconUrl: text("icon_url"),

  // Timestamps
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("mcp_servers_user_idx").on(table.userId),
]);

// ============================================================================
// MEMORIES - Structured memory storage for continuity system
// ============================================================================

export const memoryTypeEnum = ["fact", "preference", "relationship", "principle", "commitment", "moment", "skill"] as const;
export const confidenceLevelEnum = ["explicit", "implied", "inferred", "speculative"] as const;
export const memoryStatusEnum = ["active", "archived", "pending_review"] as const;
export const evidenceSourceTypeEnum = ["session", "item", "manual"] as const;

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type", { enum: memoryTypeEnum }).notNull(),
  content: text("content").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  confidenceLevel: text("confidence_level", { enum: confidenceLevelEnum }).notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  scope: text("scope"),
  status: text("status", { enum: memoryStatusEnum }).notNull().default("active"),
  supersededBy: text("superseded_by"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
  lastAccessedAt: timestamp("last_accessed_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("memories_user_idx").on(table.userId),
  index("memories_user_type_idx").on(table.userId, table.type),
  index("memories_user_scope_idx").on(table.userId, table.scope),
  index("memories_user_status_idx").on(table.userId, table.status),
  index("memories_superseded_idx").on(table.supersededBy),
]);

export const memoryEvidence = pgTable("memory_evidence", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id")
    .notNull()
    .references(() => memories.id, { onDelete: "cascade" }),
  sourceType: text("source_type", { enum: evidenceSourceTypeEnum }).notNull(),
  sourceId: text("source_id"),
  excerpt: text("excerpt").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("memory_evidence_memory_idx").on(table.memoryId),
  index("memory_evidence_source_idx").on(table.sourceId),
]);

// ============================================================================
// MEMORY CONNECTIONS - Graph edges between memories
// ============================================================================

export const connectionRelationshipTypeEnum = ["relates_to", "contradicts", "refines", "supports", "context_for"] as const;

export const memoryConnections = pgTable("memory_connections", {
  id: text("id").primaryKey(),
  fromMemoryId: text("from_memory_id")
    .notNull()
    .references(() => memories.id, { onDelete: "cascade" }),
  toMemoryId: text("to_memory_id")
    .notNull()
    .references(() => memories.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type", { enum: connectionRelationshipTypeEnum }).notNull(),
  strength: real("strength").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("memory_connections_from_idx").on(table.fromMemoryId),
  index("memory_connections_to_idx").on(table.toMemoryId),
  uniqueIndex("memory_connections_unique_idx").on(table.fromMemoryId, table.toMemoryId, table.relationshipType),
]);

// ============================================================================
// REFLECTIONS - Extraction pipeline audit log
// ============================================================================

export const reflections = pgTable("reflections", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  memoriesExtracted: integer("memories_extracted").notNull(),
  questionsGenerated: integer("questions_generated").notNull(),
  modelUsed: text("model_used").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("reflections_user_idx").on(table.userId),
  index("reflections_session_idx").on(table.sessionId),
]);

// ============================================================================
// QUESTIONS - Curiosity-driven questions generated from conversations
// ============================================================================

export const curiosityTypeEnum = ["gap", "implication", "clarification", "exploration", "connection"] as const;
export const questionTimingEnum = ["next_session", "when_relevant", "low_priority"] as const;
export const questionStatusEnum = ["pending", "resolved"] as const;

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  context: text("context").notNull(),
  curiosityType: text("curiosity_type", { enum: curiosityTypeEnum }).notNull(),
  curiosityScore: real("curiosity_score").notNull(),
  timing: text("timing", { enum: questionTimingEnum }).notNull(),
  scope: text("scope"),
  status: text("status", { enum: questionStatusEnum }).notNull().default("pending"),
  answer: text("answer"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("questions_user_status_idx").on(table.userId, table.status),
  index("questions_user_scope_idx").on(table.userId, table.scope),
  index("questions_user_timing_idx").on(table.userId, table.timing),
]);

// ============================================================================
// QUESTION MEMORY LINKS - Links between questions and memories
// ============================================================================

export const questionLinkTypeEnum = ["triggered_by", "answered_by"] as const;

export const questionMemoryLinks = pgTable("question_memory_links", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  memoryId: text("memory_id")
    .notNull()
    .references(() => memories.id, { onDelete: "cascade" }),
  linkType: text("link_type", { enum: questionLinkTypeEnum }).notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("question_memory_links_question_idx").on(table.questionId),
  index("question_memory_links_memory_idx").on(table.memoryId),
]);

// ============================================================================
// IDENTITY DOCUMENTS - Synthesized user identity snapshots
// ============================================================================

export const identityDocuments = pgTable("identity_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  version: integer("version").notNull(),
  content: jsonb("content").$type<{
    values: unknown[];
    capabilities: unknown[];
    growthNarrative: string;
    keyRelationships: unknown[];
  }>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  generatedAt: timestamp("generated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("identity_documents_user_active_idx").on(table.userId, table.isActive),
]);

// ============================================================================
// MEMORY SETTINGS - Per-user configuration for memory system
// ============================================================================

export const memorySettings = pgTable("memory_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  autoExtract: boolean("auto_extract").notNull().default(false),
  reflectionAgentConfigId: text("reflection_agent_config_id").references(() => agentConfigs.id, { onDelete: "set null" }),
  reflectionTokenThreshold: integer("reflection_token_threshold").notNull().default(5000),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("memory_settings_user_idx").on(table.userId),
]);

// ============================================================================
// TRIGGERS - Scheduled and event-driven agent execution
// ============================================================================

export const triggerTypeEnum = ["cron", "webhook"] as const;

export const triggers = pgTable("triggers", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type", { enum: triggerTypeEnum }).notNull(),
  cronExpression: text("cron_expression"),
  timezone: text("timezone").default("UTC"),
  inputTemplate: text("input_template").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  maxTurns: integer("max_turns").notNull().default(25),
  maxRunsPerHour: integer("max_runs_per_hour").notNull().default(10),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastRunSessionId: text("last_run_session_id")
    .references(() => sessions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("triggers_user_idx").on(table.userId),
  index("triggers_user_type_idx").on(table.userId, table.triggerType),
]);

export const triggerRunStatusEnum = ["pending", "running", "completed", "failed", "skipped"] as const;

export const triggerRuns = pgTable("trigger_runs", {
  id: text("id").primaryKey(),
  triggerId: text("trigger_id")
    .notNull()
    .references(() => triggers.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .references(() => sessions.id, { onDelete: "set null" }),
  status: text("status", { enum: triggerRunStatusEnum }).notNull().default("pending"),
  skipReason: text("skip_reason"),
  result: text("result"),
  error: text("error"),
  eventPayload: jsonb("event_payload").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at")
    .$defaultFn(() => new Date()),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("trigger_runs_trigger_idx").on(table.triggerId),
  index("trigger_runs_trigger_status_idx").on(table.triggerId, table.status),
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

export type MemoryRecord = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type MemoryEvidenceRecord = typeof memoryEvidence.$inferSelect;
export type NewMemoryEvidence = typeof memoryEvidence.$inferInsert;

export type MemoryConnectionRecord = typeof memoryConnections.$inferSelect;
export type NewMemoryConnection = typeof memoryConnections.$inferInsert;
export type ConnectionRelationshipType = (typeof connectionRelationshipTypeEnum)[number];

export type ReflectionRecord = typeof reflections.$inferSelect;
export type NewReflection = typeof reflections.$inferInsert;

export type QuestionRecord = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type CuriosityType = (typeof curiosityTypeEnum)[number];
export type QuestionTiming = (typeof questionTimingEnum)[number];
export type QuestionStatus = (typeof questionStatusEnum)[number];

export type QuestionMemoryLinkRecord = typeof questionMemoryLinks.$inferSelect;
export type NewQuestionMemoryLink = typeof questionMemoryLinks.$inferInsert;
export type QuestionLinkType = (typeof questionLinkTypeEnum)[number];

export type IdentityDocumentRecord = typeof identityDocuments.$inferSelect;
export type NewIdentityDocument = typeof identityDocuments.$inferInsert;

export type MemorySettingsRecord = typeof memorySettings.$inferSelect;
export type NewMemorySettings = typeof memorySettings.$inferInsert;

export type AgentConfigRecord = typeof agentConfigs.$inferSelect;
export type NewAgentConfig = typeof agentConfigs.$inferInsert;

export type AgentConfigToolRecord = typeof agentConfigTools.$inferSelect;

export type TriggerRecord = typeof triggers.$inferSelect;
export type NewTrigger = typeof triggers.$inferInsert;
export type TriggerRunRecord = typeof triggerRuns.$inferSelect;
export type NewTriggerRun = typeof triggerRuns.$inferInsert;
export type NewAgentConfigTool = typeof agentConfigTools.$inferInsert;
export type AgentConfigToolType = (typeof agentConfigToolTypeEnum)[number];
