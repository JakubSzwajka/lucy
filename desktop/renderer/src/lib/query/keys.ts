export const queryKeys = {
  sessions: {
    all: ["sessions"] as const,
  },
  settings: ["settings"] as const,
  systemPrompts: {
    all: ["systemPrompts"] as const,
  },
  quickActions: {
    all: ["quickActions"] as const,
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
  memorySettings: ["memorySettings"] as const,
};
