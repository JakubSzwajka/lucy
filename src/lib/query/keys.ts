export const queryKeys = {
  sessions: {
    all: ["sessions"] as const,
  },
  settings: ["settings"] as const,
  systemPrompts: {
    all: ["systemPrompts"] as const,
  },
  mcpServers: {
    all: ["mcpServers"] as const,
    status: ["mcpServers", "status"] as const,
  },
  plans: {
    bySession: (id: string) => ["plans", id] as const,
  },
  memories: {
    all: ["memories"] as const,
    list: (filters?: Record<string, unknown>) => ["memories", "list", filters] as const,
    detail: (id: string) => ["memories", id] as const,
  },
  questions: {
    all: ["questions"] as const,
    list: (filters?: Record<string, unknown>) => ["questions", "list", filters] as const,
  },
  identity: {
    active: ["identity"] as const,
    history: ["identity", "history"] as const,
  },
  agentConfigs: {
    all: ["agentConfigs"] as const,
    detail: (id: string) => ["agentConfigs", id] as const,
  },
  triggers: {
    all: ["triggers"] as const,
    detail: (id: string) => ["triggers", id] as const,
    runs: (id: string) => ["triggers", id, "runs"] as const,
  },
  models: ["models"] as const,
  memorySettings: ["memorySettings"] as const,
};
