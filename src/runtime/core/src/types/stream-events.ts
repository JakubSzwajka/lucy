// ---------------------------------------------------------------------------
// Normalized stream events emitted by AgentRuntime
// ---------------------------------------------------------------------------

/** Agent has started processing a prompt. */
export interface AgentStartEvent {
  type: "agent_start";
}

/** Agent has finished processing. */
export interface AgentEndEvent {
  type: "agent_end";
}

/** Streaming text delta from assistant. */
export interface TextDeltaEvent {
  type: "text_delta";
  delta: string;
}

/** Thinking/reasoning delta from assistant. */
export interface ThinkingDeltaEvent {
  type: "thinking_delta";
  delta: string;
}

/** A tool has started execution. */
export interface ToolStartEvent {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/** A tool has finished execution. */
export interface ToolEndEvent {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  output: string;
}

export type StreamEvent =
  | AgentStartEvent
  | AgentEndEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolEndEvent;
