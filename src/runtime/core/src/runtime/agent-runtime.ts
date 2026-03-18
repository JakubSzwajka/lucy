import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type SessionStats,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { AssistantMessage, AssistantMessageEvent, Api, Model, ToolResultMessage } from "@mariozechner/pi-ai";

import type {
  HistoryEntry,
  ModelConfig,
  SessionInfo,
  StreamEvent,
} from "../types.js";

type StreamCallback = (event: StreamEvent) => void;

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private session: AgentSession | null = null;
  private sessionManager: SessionManager | null = null;
  private model: Model<Api> | null = null;
  private resourceLoader: DefaultResourceLoader | null = null;
  private settingsManager: SettingsManager | null = null;
  private agentDir: string | undefined;

  async init(): Promise<void> {
    const modelStr = process.env.PI_MODEL;
    if (!modelStr) {
      throw new Error("[runtime] PI_MODEL is required but not set");
    }

    const slashIdx = modelStr.indexOf("/");
    if (slashIdx === -1) {
      throw new Error(`[runtime] PI_MODEL must be in "provider/modelId" format, got: ${modelStr}`);
    }
    const provider = modelStr.slice(0, slashIdx);
    const modelId = modelStr.slice(slashIdx + 1);

    // getModel is typed for KnownProvider; cast needed for dynamic provider strings
    this.model = (getModel as (p: string, m: string) => Model<Api>)(provider, modelId);

    this.agentDir = process.env.PI_CODING_AGENT_DIR ?? undefined;
    const promptPath = resolve(process.env.PI_PROMPT ?? "PROMPT.md");

    this.settingsManager = SettingsManager.create(process.cwd(), this.agentDir);
    const compactionThreshold = parseInt(process.env.PI_COMPACTION_THRESHOLD ?? "50000", 10);
    const contextWindow = this.model.contextWindow ?? 200_000;
    this.settingsManager.applyOverrides({
      compaction: {
        enabled: true,
        reserveTokens: Math.max(contextWindow - compactionThreshold, 16_384),
      },
    });

    this.resourceLoader = new DefaultResourceLoader({
      cwd: process.cwd(),
      agentDir: this.agentDir,
      settingsManager: this.settingsManager,
      appendSystemPrompt: existsSync(promptPath)
        ? readFileSync(promptPath, "utf-8")
        : undefined,
    });
    await this.resourceLoader.reload();

    this.sessionManager = SessionManager.continueRecent(process.cwd());

    const { session } = await createAgentSession({
      model: this.model,
      resourceLoader: this.resourceLoader,
      sessionManager: this.sessionManager,
      settingsManager: this.settingsManager,
      agentDir: this.agentDir,
    });

    this.session = session;
    console.log(`[runtime] session ${session.sessionId} created`);
  }

  async newSession(): Promise<SessionInfo> {
    if (!this.sessionManager || !this.model || !this.resourceLoader) {
      throw new Error("[runtime] not initialized");
    }

    await this.abort();
    this.session?.dispose();
    this.sessionManager.newSession();

    const { session } = await createAgentSession({
      model: this.model,
      resourceLoader: this.resourceLoader,
      sessionManager: this.sessionManager,
      settingsManager: this.settingsManager ?? undefined,
      agentDir: this.agentDir,
    });

    this.session = session;
    console.log(`[runtime] new session ${session.sessionId} created`);
    return this.getSessionInfo();
  }

  async destroy(): Promise<void> {
    this.session?.dispose();
    this.session = null;
  }

  // ---------------------------------------------------------------------------
  // Event streaming
  // ---------------------------------------------------------------------------

  private streamSubscribers = new Set<StreamCallback>();

  /**
   * Subscribe to normalized stream events. Returns an unsubscribe function.
   * Events are emitted during sendMessage / sendMessageStreaming.
   */
  subscribe(callback: StreamCallback): () => void {
    this.streamSubscribers.add(callback);
    return () => { this.streamSubscribers.delete(callback); };
  }

  private emitStream(event: StreamEvent): void {
    for (const cb of this.streamSubscribers) {
      try {
        cb(event);
      } catch (err) {
        console.error("[runtime] stream subscriber error:", err);
      }
    }
  }

  /**
   * Translate a Pi SDK session event into normalized StreamEvents.
   */
  private handleSessionEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case "agent_start":
        this.emitStream({ type: "agent_start" });
        break;

      case "agent_end":
        this.emitStream({ type: "agent_end" });
        break;

      case "message_update": {
        const ame: AssistantMessageEvent = event.assistantMessageEvent;
        if (ame.type === "text_delta") {
          this.emitStream({ type: "text_delta", delta: ame.delta });
        } else if (ame.type === "thinking_delta") {
          this.emitStream({ type: "thinking_delta", delta: ame.delta });
        }
        break;
      }

      case "tool_execution_start": {
        const args = (event.args as Record<string, unknown>) ?? {};
        this.emitStream({
          type: "tool_start",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args,
        });
        break;
      }

      case "tool_execution_end": {
        const result = event.result as { content?: Array<{ type: string; text?: string }> } | undefined;
        const content = result?.content ?? [];
        const outputText = content
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("\n");
        this.emitStream({
          type: "tool_end",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          isError: event.isError,
          output: outputText,
        });
        break;
      }
    }
  }

  /**
   * Send a message and stream events via subscribe(). Returns a promise
   * that resolves when the agent finishes (agent_end).
   */
  async sendMessageStreaming(message: string): Promise<void> {
    if (!this.session) throw new Error("[runtime] not initialized");

    const unsubscribe = this.session.subscribe((event: AgentSessionEvent) => {
      this.handleSessionEvent(event);
    });

    try {
      await this.session.prompt(message);
    } finally {
      unsubscribe();
    }
  }

  // ---------------------------------------------------------------------------
  // Non-streaming sendMessage (kept for Telegram etc.)
  // ---------------------------------------------------------------------------

  async sendMessage(
    message: string,
    options?: { modelId?: string; thinkingEnabled?: boolean },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    if (!this.session) throw new Error("[runtime] not initialized");

    if (options?.modelId || options?.thinkingEnabled) {
      console.warn("[runtime] per-request modelId/thinkingEnabled not yet supported, using session defaults");
    }

    let responseText = "";
    let reachedMaxTurns = false;

    const unsubscribe = this.session.subscribe((event: AgentSessionEvent) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        responseText += event.assistantMessageEvent.delta;
      }

      if (event.type === "agent_end") {
        const msgs = event.messages;
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last.role === "assistant" && (last as AssistantMessage).stopReason === "length") {
            reachedMaxTurns = true;
          }
        }
      }
    });

    try {
      await this.session.prompt(message);
    } finally {
      unsubscribe();
    }

    return {
      response: responseText,
      agentId: this.session.sessionId,
      reachedMaxTurns,
    };
  }

  async getHistory({
    hideToolCalls = false,
  }: {
    hideToolCalls?: boolean;
  }): Promise<{ items: HistoryEntry[]; compactionSummary: string | null }> {
    if (!this.session) throw new Error("[runtime] not initialized");

    const messages = this.session.messages;
    const items: HistoryEntry[] = [];
    let sequence = 0;
    const agentId = this.session.sessionId;

    // Build a map of toolCallId -> toolResult for pairing
    const toolResultsByCallId = new Map<string, ToolResultMessage>();
    for (const m of messages) {
      if (m.role === "toolResult") {
        toolResultsByCallId.set((m as ToolResultMessage).toolCallId, m as ToolResultMessage);
      }
    }

    for (const m of messages) {
      const timestamp = new Date(
        "timestamp" in m && typeof m.timestamp === "number" ? m.timestamp : Date.now(),
      );

      // --- User messages ---
      if (m.role === "user") {
        let textContent = "";
        if (typeof m.content === "string") {
          textContent = m.content;
        } else if (Array.isArray(m.content)) {
          for (const block of m.content) {
            if ("type" in block && block.type === "text" && "text" in block) {
              textContent += (block as { text: string }).text;
            }
          }
        }
        if (textContent) {
          items.push({
            id: `msg-${sequence}`,
            type: "message",
            role: "user",
            content: textContent,
            sequence: sequence++,
            agentId,
            createdAt: timestamp,
          });
        }
        continue;
      }

      // --- Assistant messages ---
      if (m.role === "assistant") {
        const am = m as AssistantMessage;
        let textContent = "";
        const contentBlocks = Array.isArray(am.content) ? am.content : [];

        for (const block of contentBlocks) {
          if (block.type === "text") {
            textContent += block.text;
          }

          if (block.type === "thinking" && !hideToolCalls) {
            const thinking = block.thinking ?? "";
            if (thinking) {
              items.push({
                id: `reasoning-${sequence}`,
                type: "reasoning",
                reasoningContent: thinking,
                sequence: sequence++,
                agentId,
                createdAt: timestamp,
              });
            }
          }

          if (block.type === "toolCall" && !hideToolCalls) {
            const callId = block.id;
            const toolName = block.name;

            let toolArgs: Record<string, unknown> | undefined;
            if (typeof block.arguments === "string") {
              try {
                toolArgs = JSON.parse(block.arguments);
              } catch {
                toolArgs = { raw: block.arguments };
              }
            } else if (block.arguments && typeof block.arguments === "object") {
              toolArgs = block.arguments as Record<string, unknown>;
            }

            const result = toolResultsByCallId.get(callId);
            let toolStatus: "completed" | "failed" | "running" = "running";
            if (result) {
              toolStatus = result.isError ? "failed" : "completed";
            }

            items.push({
              id: `toolcall-${sequence}`,
              type: "tool_call",
              callId,
              toolName,
              toolArgs,
              toolStatus,
              sequence: sequence++,
              agentId,
              createdAt: timestamp,
            });

            if (result) {
              let toolOutput: string | undefined;
              let toolError: string | undefined;

              const resultContent = result.content ?? [];
              const outputText = resultContent
                .filter((c) => c.type === "text")
                .map((c) => c.type === "text" ? c.text : "")
                .join("\n");

              if (result.isError) {
                toolError = outputText || "Unknown error";
              } else {
                toolOutput = outputText || undefined;
              }

              items.push({
                id: `toolresult-${sequence}`,
                type: "tool_result",
                callId,
                toolOutput,
                toolError,
                sequence: sequence++,
                agentId,
                createdAt: timestamp,
              });
            }
          }
        }

        if (textContent) {
          items.push({
            id: `msg-${sequence}`,
            type: "message",
            role: "assistant",
            content: textContent,
            sequence: sequence++,
            agentId,
            createdAt: timestamp,
          });
        }

        continue;
      }

      // Skip toolResult messages — already handled inline with tool calls above
    }

    return { items, compactionSummary: null };
  }

  async getModels(): Promise<ModelConfig[]> {
    if (!this.session) throw new Error("[runtime] not initialized");

    const models = this.session.modelRegistry.getAvailable();

    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      modelId: m.id,
      supportsReasoning: m.reasoning || undefined,
      supportsImages: m.input.includes("image") || undefined,
      maxContextTokens: m.contextWindow,
    }));
  }

  async getSessionInfo(): Promise<SessionInfo> {
    if (!this.session) throw new Error("[runtime] not initialized");

    const stats: SessionStats = this.session.getSessionStats();
    const model = this.session.model;
    const contextWindow = model?.contextWindow ?? 0;
    const reserveTokens = this.settingsManager?.getCompactionReserveTokens() ?? 16_384;
    const threshold = contextWindow > 0 ? contextWindow - reserveTokens : 0;
    const ctxUsage = this.session.getContextUsage();

    return {
      sessionId: this.session.sessionId,
      sessionName: this.session.sessionName,
      model: {
        id: model?.id ?? "unknown",
        provider: model?.provider ?? "unknown",
        contextWindow,
      },
      tokens: {
        input: stats.tokens.input,
        output: stats.tokens.output,
        cacheRead: stats.tokens.cacheRead,
        cacheWrite: stats.tokens.cacheWrite,
        total: stats.tokens.total,
      },
      cost: stats.cost,
      messages: {
        user: stats.userMessages,
        assistant: stats.assistantMessages,
        toolCalls: stats.toolCalls,
        total: stats.totalMessages,
      },
      context: {
        tokens: ctxUsage?.tokens ?? null,
        contextWindow: ctxUsage?.contextWindow ?? contextWindow,
        percent: ctxUsage?.percent ?? null,
      },
      compaction: {
        enabled: this.session.autoCompactionEnabled,
        isCompacting: this.session.isCompacting,
        threshold,
      },
    };
  }

  async abort(): Promise<void> {
    if (!this.session) return;
    await this.session.abort();
  }
}
