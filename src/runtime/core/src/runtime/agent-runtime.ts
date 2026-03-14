import type {
  HistoryEntry,
  ModelConfig,
  SessionInfo,
  StreamEvent,
} from "../types.js";

import { syncPrompt } from "./prompt-sync.js";
import type { PromptContext } from "./prompt-context.js";
import { SocketClient, type RpcEvent, type RpcResponse } from "./socket-client.js";

type StreamCallback = (event: StreamEvent) => void;

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private client: SocketClient;
  private sessionId: string | null = null;

  constructor() {
    this.client = new SocketClient();
  }

  async init(): Promise<void> {
    await this.client.connect();

    // Verify bridge is alive and cache session id
    const resp = await this.client.request({ type: "get_state" });
    if (!resp.success) {
      throw new Error(`[runtime] pi-bridge get_state failed: ${resp.error ?? "unknown error"}`);
    }

    const data = resp.data as Record<string, unknown> | undefined;
    this.sessionId = (data?.sessionId as string) ?? "unknown";
    console.log(`[runtime] connected to pi-bridge, session ${this.sessionId}`);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isConnected) {
      console.log("[runtime] reconnecting to pi-bridge...");
      await this.client.connect();
      // Re-cache session info after reconnect
      const resp = await this.client.request({ type: "get_state" });
      if (resp.success) {
        const data = resp.data as Record<string, unknown> | undefined;
        this.sessionId = (data?.sessionId as string) ?? this.sessionId;
      }
    }
  }

  async destroy(): Promise<void> {
    this.client.disconnect();
    this.sessionId = null;
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
   * Translate a raw pi-bridge RPC event into normalized StreamEvents.
   */
  private handleBridgeEvent(event: RpcEvent): void {
    switch (event.type) {
      case "agent_start":
        this.emitStream({ type: "agent_start" });
        break;

      case "agent_end":
        this.emitStream({ type: "agent_end" });
        break;

      case "message_update": {
        const ame = event.assistantMessageEvent as Record<string, unknown> | undefined;
        if (!ame) break;
        if (ame.type === "text_delta") {
          this.emitStream({ type: "text_delta", delta: ame.delta as string });
        } else if (ame.type === "thinking_delta") {
          this.emitStream({ type: "thinking_delta", delta: ame.delta as string });
        }
        break;
      }

      case "tool_execution_start": {
        const args = (event.args as Record<string, unknown>) ?? {};
        this.emitStream({
          type: "tool_start",
          toolCallId: event.toolCallId as string,
          toolName: event.toolName as string,
          args,
        });
        break;
      }

      case "tool_execution_end": {
        const result = event.result as Record<string, unknown> | undefined;
        const content = (result?.content as Array<Record<string, unknown>>) ?? [];
        const outputText = content
          .filter((c) => c.type === "text")
          .map((c) => c.text as string)
          .join("\n");
        this.emitStream({
          type: "tool_end",
          toolCallId: event.toolCallId as string,
          toolName: event.toolName as string,
          isError: (event.isError as boolean) ?? false,
          output: outputText,
        });
        break;
      }
    }
  }

  /**
   * Send a message and return immediately after the prompt is accepted.
   * Events are emitted via subscribe(). Returns a promise that resolves
   * when the agent finishes (agent_end).
   */
  async sendMessageStreaming(message: string, ctx?: PromptContext): Promise<void> {
    await this.ensureConnected();
    if (ctx) await syncPrompt(ctx);

    return new Promise<void>((resolve, reject) => {
      const unsubscribe = this.client.subscribe((event: RpcEvent) => {
        this.handleBridgeEvent(event);

        if (event.type === "agent_end") {
          unsubscribe();
          resolve();
        }
      });

      this.client.request({ type: "prompt", message }).then((ack: RpcResponse) => {
        if (!ack.success) {
          unsubscribe();
          reject(new Error(`[runtime] prompt rejected: ${ack.error ?? "unknown error"}`));
        }
      }).catch((err) => {
        unsubscribe();
        reject(err);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Legacy non-streaming sendMessage (kept for Telegram etc.)
  // ---------------------------------------------------------------------------

  async sendMessage(
    message: string,
    options: { modelId?: string; thinkingEnabled?: boolean; context: PromptContext },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    await this.ensureConnected();
    await syncPrompt(options.context);

    if (options.modelId || options.thinkingEnabled) {
      console.warn("[runtime] per-request modelId/thinkingEnabled not yet supported over RPC, using session defaults");
    }

    let responseText = "";
    let reachedMaxTurns = false;

    return new Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }>(
      (resolve, reject) => {
        // Subscribe to streaming events before sending the command
        const unsubscribe = this.client.subscribe((event: RpcEvent) => {
          if (
            event.type === "message_update" &&
            event.assistantMessageEvent &&
            typeof event.assistantMessageEvent === "object" &&
            (event.assistantMessageEvent as Record<string, unknown>).type === "text_delta"
          ) {
            responseText += (event.assistantMessageEvent as Record<string, unknown>).delta as string;
          }

          if (event.type === "agent_end") {
            const msgs = event.messages as Array<Record<string, unknown>> | undefined;
            if (msgs && msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              if (last.role === "assistant" && last.stopReason === "length") {
                reachedMaxTurns = true;
              }
            }
            unsubscribe();
            resolve({
              response: responseText,
              agentId: this.sessionId ?? "unknown",
              reachedMaxTurns,
            });
          }
        });

        // Send the prompt command — the response is just an ack
        this.client.request({ type: "prompt", message }).then((ack: RpcResponse) => {
          if (!ack.success) {
            unsubscribe();
            reject(new Error(`[runtime] prompt rejected: ${ack.error ?? "unknown error"}`));
          }
          // Ack received — streaming events will follow
        }).catch((err) => {
          unsubscribe();
          reject(err);
        });
      },
    );
  }

  async getHistory({
    hideToolCalls = false,
  }: {
    hideToolCalls?: boolean;
  }): Promise<{ items: HistoryEntry[]; compactionSummary: string | null }> {
    await this.ensureConnected();

    const resp = await this.client.request({ type: "get_messages" });
    if (!resp.success) {
      throw new Error(`[runtime] get_messages failed: ${resp.error ?? "unknown error"}`);
    }

    const data = resp.data as { messages: Array<Record<string, unknown>> } | undefined;
    const messages = data?.messages ?? [];
    const items: HistoryEntry[] = [];
    let sequence = 0;
    const agentId = this.sessionId ?? "unknown";

    // Build a map of toolCallId → toolResult for pairing
    const toolResultsByCallId = new Map<string, Record<string, unknown>>();
    for (const m of messages) {
      if (m.role === "toolResult") {
        toolResultsByCallId.set(m.toolCallId as string, m);
      }
    }

    for (const m of messages) {
      const timestamp = new Date(
        typeof m.timestamp === "number" ? m.timestamp : Date.now(),
      );

      // --- User messages ---
      if (m.role === "user") {
        let textContent = "";
        if (typeof m.content === "string") {
          textContent = m.content;
        } else if (Array.isArray(m.content)) {
          for (const block of m.content as Array<Record<string, unknown>>) {
            if (block.type === "text") {
              textContent += block.text as string;
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
        let textContent = "";
        const contentBlocks = Array.isArray(m.content) ? m.content as Array<Record<string, unknown>> : [];

        if (typeof m.content === "string") {
          textContent = m.content;
        }

        for (const block of contentBlocks) {
          // Text blocks
          if (block.type === "text") {
            textContent += block.text as string;
          }

          // Thinking / reasoning blocks
          if (block.type === "thinking" && !hideToolCalls) {
            const thinking = (block.thinking as string) ?? "";
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

          // Tool call blocks
          if (block.type === "toolCall" && !hideToolCalls) {
            const callId = block.id as string;
            const toolName = block.name as string;

            // Parse arguments — can be string or object
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

            // Determine status from paired tool result
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

            // Emit paired tool result
            if (result) {
              let toolOutput: string | undefined;
              let toolError: string | undefined;

              const resultContent = Array.isArray(result.content)
                ? (result.content as Array<Record<string, unknown>>)
                : [];
              const outputText = resultContent
                .filter((c) => c.type === "text")
                .map((c) => c.text as string)
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

        // Emit text content as a message (if any)
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
    await this.ensureConnected();

    const resp = await this.client.request({ type: "get_available_models" });
    if (!resp.success) {
      throw new Error(`[runtime] get_available_models failed: ${resp.error ?? "unknown error"}`);
    }

    const data = resp.data as { models: Array<Record<string, unknown>> } | undefined;
    const models = data?.models ?? [];

    return models.map((m) => ({
      id: m.id as string,
      name: (m.name as string) ?? (m.id as string),
      provider: m.provider as string,
      modelId: m.modelId as string,
      supportsReasoning: m.supportsReasoning as boolean | undefined,
      supportsImages: m.supportsImages as boolean | undefined,
      maxContextTokens: (m.maxContextTokens as number) ?? 0,
    }));
  }

  async getSessionInfo(): Promise<SessionInfo> {
    await this.ensureConnected();

    const [stateResp, statsResp] = await Promise.all([
      this.client.request({ type: "get_state" }),
      this.client.request({ type: "get_session_stats" }),
    ]);

    if (!stateResp.success) {
      throw new Error(`[runtime] get_state failed: ${stateResp.error ?? "unknown error"}`);
    }
    if (!statsResp.success) {
      throw new Error(`[runtime] session stats failed: ${statsResp.error ?? "unknown error"}`);
    }

    const state = stateResp.data as Record<string, unknown>;
    const stats = statsResp.data as Record<string, unknown>;
    const model = state.model as Record<string, unknown> | undefined;
    const tokens = stats.tokens as Record<string, number> | undefined;

    const contextWindow = (model?.contextWindow as number) ?? 0;
    const reserveTokens = 16_384; // Pi default
    const threshold = contextWindow > 0 ? contextWindow - reserveTokens : 0;
    const totalTokens = tokens?.total ?? 0;

    return {
      sessionId: (state.sessionId as string) ?? this.sessionId ?? "unknown",
      sessionName: state.sessionName as string | undefined,
      model: {
        id: (model?.id as string) ?? "unknown",
        provider: (model?.provider as string) ?? "unknown",
        contextWindow,
      },
      tokens: {
        input: tokens?.input ?? 0,
        output: tokens?.output ?? 0,
        cacheRead: tokens?.cacheRead ?? 0,
        cacheWrite: tokens?.cacheWrite ?? 0,
        total: totalTokens,
      },
      cost: (stats.cost as number) ?? 0,
      messages: {
        user: (stats.userMessages as number) ?? 0,
        assistant: (stats.assistantMessages as number) ?? 0,
        toolCalls: (stats.toolCalls as number) ?? 0,
        total: (stats.totalMessages as number) ?? 0,
      },
      compaction: {
        enabled: (state.autoCompactionEnabled as boolean) ?? true,
        isCompacting: (state.isCompacting as boolean) ?? false,
        threshold,
        usage: threshold > 0 ? totalTokens / threshold : 0,
      },
    };
  }

  async abort(): Promise<void> {
    await this.ensureConnected();
    await this.client.request({ type: "abort" });
  }
}
