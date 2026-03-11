import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type ExtensionFactory,
} from "@mariozechner/pi-coding-agent";

import type {
  AgentRuntimeOptions,
  HistoryEntry,
  ModelConfig,
  RuntimeConfig,
} from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveDataDir(): string {
  if (process.env.AGENTS_DATA_DIR) return process.env.AGENTS_DATA_DIR;
  return join(homedir(), ".agents-data");
}

const PROMPT_FILE_PATH = resolve("./prompt.md");

function readPromptFile(): string {
  try {
    return readFileSync(PROMPT_FILE_PATH, "utf-8");
  } catch {
    throw new Error(`[runtime] prompt.md not found at ${PROMPT_FILE_PATH} — mount or create it before starting`);
  }
}

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private config: RuntimeConfig;
  private modelRegistry: ModelRegistry | null = null;
  private session: AgentSession | null = null;

  constructor(options: AgentRuntimeOptions) {
    this.config = options.config;
  }

  async init(): Promise<void> {
    // Auth — OpenRouter only. Set OPENROUTER_API_KEY in env.
    const authStorage = AuthStorage.create();
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      console.warn("[runtime] OPENROUTER_API_KEY not set — no models will be available");
    } else {
      authStorage.setRuntimeApiKey("openrouter", openrouterKey);
    }

    const modelRegistry = new ModelRegistry(authStorage);
    this.modelRegistry = modelRegistry;

    // Resolve model — must be set in config
    const [provider, ...rest] = this.config.model.split("/");
    const modelId = rest.join("/");
    const model = modelRegistry.find(provider, modelId);
    if (!model) {
      throw new Error(`[runtime] model "${this.config.model}" not found in Pi registry`);
    }

    // Settings (compaction)
    const compaction = this.config.compaction;
    const settingsManager = SettingsManager.inMemory({
      compaction: compaction
        ? {
            enabled: compaction.enabled ?? true,
            reserveTokens: compaction.reserveTokens,
            keepRecentTokens: compaction.keepRecentTokens,
          }
        : undefined,
    });

    // System prompt: validate prompt.md exists at init
    readPromptFile();

    // Resolve extensions
    const extensionFactories: ExtensionFactory[] = [];
    const additionalExtensionPaths: string[] = [];

    if (this.config.extensions) {
      for (const ext of this.config.extensions) {
        if (ext.startsWith(".") || ext.startsWith("/")) {
          additionalExtensionPaths.push(resolve(ext));
        } else {
          try {
            const mod = await import(ext);
            const factory: ExtensionFactory =
              mod.default ?? mod.extension ?? mod;
            extensionFactories.push(factory);
          } catch (err) {
            console.warn(`[runtime] failed to load extension "${ext}":`, err);
          }
        }
      }
    }

    // Resource loader — re-reads prompt.md on every call
    const loader = new DefaultResourceLoader({
      settingsManager,
      extensionFactories,
      additionalExtensionPaths,
      systemPromptOverride: () => readPromptFile(),
    });
    await loader.reload();

    // Session manager — persistent by default, in-memory only if explicitly disabled
    const sessionConfig = this.config.session;
    const dataDir = resolveDataDir();
    const sessionDir = resolve(dataDir, "sessions");

    let sessionManager: SessionManager;
    if (sessionConfig?.persist === false) {
      sessionManager = SessionManager.inMemory();
      console.log("[runtime] using in-memory session");
    } else if (sessionConfig?.resume !== false) {
      sessionManager = SessionManager.continueRecent(process.cwd(), sessionDir);
      console.log(`[runtime] resuming session ${sessionManager.getSessionId()} from ${sessionDir}`);
    } else {
      sessionManager = SessionManager.create(process.cwd(), sessionDir);
      console.log(`[runtime] new session ${sessionManager.getSessionId()} in ${sessionDir}`);
    }

    // Create session
    const { session } = await createAgentSession({
      model,
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      sessionManager,
      settingsManager,
      // tools: [],
    });

    this.session = session;
    console.log("[runtime] initialized with Pi SDK session", session.sessionId);
  }

  async destroy(): Promise<void> {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
  }

  async sendMessage(
    message: string,
    options?: { modelId?: string; thinkingEnabled?: boolean },
  ): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }> {
    if (!this.session) throw new Error("Runtime not initialized");
    if (options?.modelId || options?.thinkingEnabled) {
      console.warn("[runtime] per-request modelId/thinkingEnabled not yet supported with Pi SDK, using session defaults");
    }
    const session = this.session;

    let responseText = "";
    let reachedMaxTurns = false;
    let done = false;

    const result = new Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }>(
      (resolve, reject) => {
        const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
          if (
            event.type === "message_update" &&
            event.assistantMessageEvent.type === "text_delta"
          ) {
            responseText += event.assistantMessageEvent.delta;
          }

          if (event.type === "agent_end") {
            done = true;
            const msgs = event.messages;
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              if (last.role === "assistant" && "stopReason" in last && last.stopReason === "length") {
                reachedMaxTurns = true;
              }
            }
            unsubscribe();
            resolve({
              response: responseText,
              agentId: session.sessionId,
              reachedMaxTurns,
            });
          }
        });

        session.prompt(message).catch((err) => {
          unsubscribe();
          if (!done) reject(err);
        });
      },
    );

    return result;
  }

  async getHistory(): Promise<{ items: HistoryEntry[]; compactionSummary: string | null }> {
    if (!this.session) throw new Error("Runtime not initialized");

    const messages = this.session.messages;
    const items: HistoryEntry[] = messages
      .filter((m): m is typeof m & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant",
      )
      .map((m, i) => {
        let content = "";
        if (typeof m.content === "string") {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          content = m.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => c.text)
            .join("");
        }

        return {
          id: `msg-${i}`,
          type: "message" as const,
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content,
          sequence: i,
          agentId: this.session!.sessionId,
          createdAt: new Date(
            "timestamp" in m && typeof m.timestamp === "number" ? m.timestamp : Date.now(),
          ),
        };
      });

    return { items, compactionSummary: null };
  }

  async getModels(): Promise<ModelConfig[]> {
    if (!this.modelRegistry) throw new Error("Runtime not initialized");

    const available = await this.modelRegistry.getAvailable();
    return available.map((m) => ({
      id: `${m.provider}/${m.id}`,
      name: m.name,
      provider: m.provider,
      modelId: m.id,
      supportsReasoning: m.reasoning ?? false,
      supportsImages: Array.isArray(m.input) && m.input.includes("image"),
      maxContextTokens: m.contextWindow ?? 0,
    }));
  }

  async abort(): Promise<void> {
    if (this.session) {
      await this.session.abort();
    }
  }
}
