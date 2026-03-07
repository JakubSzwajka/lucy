import type {
  RuntimePlugin,
  RuntimePluginPrepareContextInput,
  RuntimePluginPrepareContextResult,
  RuntimePluginRunCompleteInput,
  RuntimePluginSystemPromptSection,
} from "agents-runtime";

export interface MemoryContextRecord {
  content: string;
  title?: string;
}

export interface MemoryPluginContext {
  latestRun?: MemoryPluginObservedRun;
  memory?: MemoryContextRecord | null;
}

export interface MemoryPluginObservedRun {
  agentId: string;
  output?: string;
  sessionId: string;
  status: "cancelled" | "completed" | "failed";
  userId: string;
}

export interface MemoryPluginConfig {
  getContext?: (
    input: MemoryPluginPrepareContextInput,
  ) => MemoryContextRecord | null | undefined | Promise<MemoryContextRecord | null | undefined>;
  initialMemory?: MemoryContextRecord | null;
  onRunObserved?: (
    input: MemoryPluginRunCompleteInput,
    context: MemoryPluginContext,
  ) => void | Promise<void>;
}

export interface MemoryPluginOptions {
  id?: string;
}

export type MemoryPlugin = RuntimePlugin<MemoryPluginConfig>;

export type MemoryPluginPrepareContextInput = RuntimePluginPrepareContextInput<MemoryPluginConfig>;
export type MemoryPluginPrepareContextResult = RuntimePluginPrepareContextResult;
export type MemoryPluginRunCompleteInput = RuntimePluginRunCompleteInput<MemoryPluginConfig>;
export type MemoryPluginSystemPromptSectionShape = RuntimePluginSystemPromptSection;
