export interface CompactionConfig {
  enabled?: boolean;
  keepRecentTokens?: number;
  reserveTokens?: number;
}

export interface SessionConfig {
  /** Set false to use in-memory sessions (no persistence). Default: true */
  persist?: boolean;
  /** Set false to always create a new session. Default: true (resumes most recent) */
  resume?: boolean;
}

export interface RuntimeConfig {
  model: string;
  compaction?: CompactionConfig;
  extensions?: string[];
  session?: SessionConfig;
}
