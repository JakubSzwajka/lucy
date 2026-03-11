import type {
  AgentRuntimeOptions,
  HistoryEntry,
  ModelConfig,
  RuntimeConfig,
} from "../types.js";

import { SocketClient, type RpcEvent, type RpcResponse } from "./socket-client.js";

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private config: RuntimeConfig;
  private client: SocketClient;
  private sessionId: string | null = null;

  constructor(options: AgentRuntimeOptions) {
    this.config = options.config;
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

  async sendMessage(
    message: string,
    options?: { modelId?: string; thinkingEnabled?: boolean },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    await this.ensureConnected();

    if (options?.modelId || options?.thinkingEnabled) {
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

    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;

      let textContent = "";
      const toolCalls: Array<{ name: string; id: string }> = [];

      if (typeof m.content === "string") {
        textContent = m.content;
      } else if (Array.isArray(m.content)) {
        for (const block of m.content as Array<Record<string, unknown>>) {
          if (block.type === "text") {
            textContent += block.text as string;
          } else if (block.type === "toolCall") {
            toolCalls.push({ name: block.name as string, id: block.id as string });
          }
        }
      }

      // When hiding tool calls, skip assistant messages that only contain tool calls
      if (hideToolCalls && m.role === "assistant" && !textContent && toolCalls.length > 0) {
        continue;
      }

      // When showing tool calls, append tool call summaries to the text
      if (!hideToolCalls && toolCalls.length > 0) {
        const summary = toolCalls.map((tc) => `[tool: ${tc.name}]`).join(" ");
        textContent = textContent ? `${textContent}\n\n${summary}` : summary;
      }

      items.push({
        id: `msg-${sequence}`,
        type: "message" as const,
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: textContent,
        sequence,
        agentId: this.sessionId ?? "unknown",
        createdAt: new Date(
          typeof m.timestamp === "number" ? m.timestamp : Date.now(),
        ),
      });
      sequence++;
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

  async abort(): Promise<void> {
    await this.ensureConnected();
    await this.client.request({ type: "abort" });
  }
}
