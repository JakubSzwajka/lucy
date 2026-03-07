import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModel } from "ai";
import { MEMORY_PLUGIN_ID, createMemoryPlugin } from "../../agents-memory/src/index.ts";
import {
  bootstrapAgentRuntime,
  createConfiguredRuntime,
  createFileAdapters,
  type Agent,
  type AgentConfigWithTools,
  type ModelConfig,
  type ModelProvider,
  type SystemPrompt,
} from "../src/index.js";

const BASELINE_DATA_DIR = ".agents-data-smoke-test-baseline";
const MEMORY_CONTENT = "Remember: greet the user with 'Hello from memory.'";
const MEMORY_PLUGIN_DATA_DIR = ".agents-data-smoke-test-memory-plugin";
const RUNTIME_FIXTURES = [
  {
    agentId: "agent-1",
    sessionId: "session-1",
    userMessage: "Hello, can you introduce yourself?",
  },
  {
    agentId: "agent-2",
    sessionId: "session-2",
    userMessage: "Can you greet me again?",
  },
] as const;

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part): part is { text: string; type: "text" } => {
      return typeof part === "object"
        && part !== null
        && "type" in part
        && part.type === "text"
        && "text" in part
        && typeof part.text === "string";
    })
    .map((part) => part.text)
    .join("\n");
}

function getSystemPromptText(prompt: Array<{ content: unknown; role: string }> | undefined): string {
  if (!prompt) {
    return "";
  }

  return prompt
    .filter((message) => message.role === "system")
    .map((message) => extractTextContent(message.content))
    .join("\n");
}

class MockModelProvider implements ModelProvider {
  async getModelConfig(modelId: string): Promise<ModelConfig | undefined> {
    return {
      id: modelId,
      maxContextTokens: 4096,
      modelId,
      name: "Mock Model",
      provider: "mock",
      supportsImages: false,
      supportsReasoning: false,
    };
  }

  getLanguageModel(_config: ModelConfig): LanguageModel {
    return {
      defaultObjectGenerationMode: undefined,
      doGenerate: async (input: { prompt?: Array<{ content: unknown; role: string }> }) => {
        const systemPrompt = getSystemPromptText(input.prompt);
        const memoryWasApplied = systemPrompt.includes(MEMORY_CONTENT);

        return {
          finishReason: "stop" as const,
          rawCall: { rawPrompt: null, rawSettings: {} },
          text: memoryWasApplied
            ? "Hello from memory. I'm a configured runtime response."
            : "Hello! I'm a mock response without configured plugins.",
          usage: { completionTokens: 20, promptTokens: 10 },
          warnings: [],
        };
      },
      doStream: async (input: { prompt?: Array<{ content: unknown; role: string }> }) => {
        const systemPrompt = getSystemPromptText(input.prompt);
        const memoryWasApplied = systemPrompt.includes(MEMORY_CONTENT);
        const text = memoryWasApplied
          ? "Hello from memory. Streaming from a configured runtime."
          : "Hello from stream!";

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ textDelta: text, type: "text-delta" });
              controller.enqueue({
                finishReason: "stop",
                type: "finish",
                usage: { completionTokens: 20, promptTokens: 10 },
              });
              controller.close();
            },
          }),
          warnings: [],
        };
      },
      modelId: "mock-model",
      provider: "mock",
      specificationVersion: "v1",
      supportsImageUrls: false,
    } as unknown as LanguageModel;
  }

  buildProviderOptions(_config: ModelConfig, _thinkingEnabled: boolean): unknown {
    return undefined;
  }
}

async function seedData(dataDir: string) {
  const agentConfigId = "config-1";

  const configDir = join(dataDir, "config", "agents");
  await mkdir(configDir, { recursive: true });
  const agentConfig: AgentConfigWithTools = {
    color: null,
    createdAt: new Date(),
    defaultModelId: "mock-model",
    description: "A test agent for smoke testing",
    icon: null,
    id: agentConfigId,
    isDefault: true,
    maxTurns: 25,
    name: "Test Agent",
    systemPromptId: "prompt-1",
    tools: [],
    updatedAt: new Date(),
    userId: "user-1",
  };
  await writeFile(join(configDir, `${agentConfigId}.json`), JSON.stringify(agentConfig, null, 2));

  const promptDir = join(dataDir, "config", "prompts");
  await mkdir(promptDir, { recursive: true });
  const prompt: SystemPrompt = {
    content: "You are a helpful test assistant.",
    createdAt: new Date(),
    id: "prompt-1",
    name: "Test Prompt",
    updatedAt: new Date(),
  };
  await writeFile(join(promptDir, "prompt-1.json"), JSON.stringify(prompt, null, 2));

  const agentDir = join(dataDir, "agents");
  await mkdir(agentDir, { recursive: true });

  const sessionRootDir = join(dataDir, "sessions");
  await mkdir(sessionRootDir, { recursive: true });

  for (const fixture of RUNTIME_FIXTURES) {
    const agent: Agent = {
      agentConfigId,
      createdAt: new Date(),
      id: fixture.agentId,
      name: `Test Agent Instance ${fixture.agentId}`,
      sessionId: fixture.sessionId,
      status: "pending",
      turnCount: 0,
    };
    await writeFile(join(agentDir, `${fixture.agentId}.json`), JSON.stringify(agent, null, 2));

    const sessionDir = join(sessionRootDir, fixture.sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify({ agentId: fixture.agentId, id: fixture.sessionId, updatedAt: new Date().toISOString() }, null, 2),
    );
  }
}

async function seedUserMessages(dataDir: string) {
  const itemsDir = join(dataDir, "items");
  await mkdir(itemsDir, { recursive: true });

  for (const [index, fixture] of RUNTIME_FIXTURES.entries()) {
    const userMessage = {
      agentId: fixture.agentId,
      content: fixture.userMessage,
      createdAt: new Date().toISOString(),
      id: `item-${index + 1}`,
      role: "user",
      sequence: 1,
      type: "message",
    };
    await writeFile(join(itemsDir, `${fixture.agentId}.jsonl`), JSON.stringify(userMessage) + "\n");
  }
}

function createBaselineRuntime(dataDir: string) {
  const fileAdapters = createFileAdapters(dataDir);

  return bootstrapAgentRuntime({
    deps: {
      ...fileAdapters,
      models: new MockModelProvider(),
    },
  });
}

function createSmokeTestRuntime(dataDir: string, observedRuns: string[]) {
  const fileAdapters = createFileAdapters(dataDir);

  return createConfiguredRuntime({
    config: {
      plugins: {
        configById: {
          [MEMORY_PLUGIN_ID]: {
            initialMemory: {
              content: MEMORY_CONTENT,
              title: "Smoke Test Memory",
            },
            onRunObserved(input) {
              observedRuns.push(`${input.sessionId}:${input.run.status}`);
              throw new Error("Expected smoke-test callback failure");
            },
          },
        },
        enabled: [MEMORY_PLUGIN_ID],
      },
    },
    deps: {
      ...fileAdapters,
      models: new MockModelProvider(),
    },
    pluginRegistry: {
      [MEMORY_PLUGIN_ID]: createMemoryPlugin(),
    },
  });
}

async function readItemLines(dataDir: string, agentId: string): Promise<string[]> {
  const itemsPath = join(dataDir, "items", `${agentId}.jsonl`);
  const itemsContent = await readFile(itemsPath, "utf-8");
  return itemsContent.trim().split("\n");
}

async function withSeededData<T>(dataDir: string, run: () => Promise<T>): Promise<T> {
  try {
    await rm(dataDir, { force: true, recursive: true });
  } catch {}

  try {
    await seedData(dataDir);
    await seedUserMessages(dataDir);
    return await run();
  } finally {
    await rm(dataDir, { force: true, recursive: true });
  }
}

async function runScenario(
  dataDir: string,
  scenarioName: string,
  runtimeFactory: () => ReturnType<typeof bootstrapAgentRuntime>,
  assertResult: (result: string, fixture: (typeof RUNTIME_FIXTURES)[number]) => void,
) {
  console.log(`\n${scenarioName}`);

  await withSeededData(dataDir, async () => {
    const runtime = runtimeFactory();

    for (const fixture of RUNTIME_FIXTURES) {
      const result = await runtime.run(
        fixture.agentId,
        "user-1",
        [{ content: fixture.userMessage, role: "user" }],
        {
          maxTurns: 3,
          sessionId: fixture.sessionId,
          streaming: false,
        },
      );

      if (result.streaming) {
        throw new Error(`${scenarioName}: expected a non-streaming response`);
      }

      assertResult(result.result, fixture);

      const lines = await readItemLines(dataDir, fixture.agentId);
      if (lines.length < 2) {
        throw new Error(`${scenarioName}: expected persisted items for ${fixture.agentId}, received ${lines.length}`);
      }

      const agentPath = join(dataDir, "agents", `${fixture.agentId}.json`);
      const agentData = JSON.parse(await readFile(agentPath, "utf-8"));
      if (agentData.status !== "completed") {
        throw new Error(`${scenarioName}: expected ${fixture.agentId} status completed, received ${agentData.status}`);
      }

      console.log(`✅ ${fixture.agentId} response: "${result.result}"`);
    }
  });
}

async function main() {
  console.log("🧪 agents-runtime plugin smoke test");

  try {
    await runScenario(
      BASELINE_DATA_DIR,
      "1. Baseline runtime without plugins",
      () => createBaselineRuntime(BASELINE_DATA_DIR),
      (result, fixture) => {
        if (result.includes("Hello from memory.")) {
          throw new Error(`Baseline runtime unexpectedly applied memory for ${fixture.agentId}: ${result}`);
        }

        if (!result.includes("without configured plugins")) {
          throw new Error(`Baseline runtime returned an unexpected response for ${fixture.agentId}: ${result}`);
        }
      },
    );

    const observedRuns: string[] = [];

    await runScenario(
      MEMORY_PLUGIN_DATA_DIR,
      "2. Configured runtime with memory plugin",
      () => createSmokeTestRuntime(MEMORY_PLUGIN_DATA_DIR, observedRuns),
      (result, fixture) => {
        if (!result.includes("Hello from memory.")) {
          throw new Error(`Memory plugin was not applied for ${fixture.agentId}: ${result}`);
        }
      },
    );

    if (observedRuns.length !== RUNTIME_FIXTURES.length) {
      throw new Error(`Expected ${RUNTIME_FIXTURES.length} observed runs, received ${observedRuns.length}`);
    }

    console.log(`🧠 Observed runs despite callback failures: ${observedRuns.join(", ")}`);
    console.log("\n🎉 Smoke test PASSED — baseline and configured plugin paths both work.\n");
  } catch (error) {
    console.error("\n❌ Smoke test FAILED:", error);
    process.exit(1);
  }
}

main();
