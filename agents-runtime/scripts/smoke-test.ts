import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModel } from "ai";
import { AgentRuntime, createFileAdapters } from "../src/index.js";
import type { ModelProvider, ModelConfig, Agent, AgentConfigWithTools, SystemPrompt } from "../src/index.js";

const DATA_DIR = ".agents-data-smoke-test";

// Mock ModelProvider that returns a fake model
class MockModelProvider implements ModelProvider {
  async getModelConfig(modelId: string): Promise<ModelConfig | undefined> {
    return {
      id: modelId,
      name: "Mock Model",
      provider: "mock",
      modelId: modelId,
      supportsReasoning: false,
      supportsImages: false,
      maxContextTokens: 4096,
    };
  }

  getLanguageModel(_config: ModelConfig): LanguageModel {
    // Return a minimal mock that generateText can work with
    // This is a simplified mock - in reality you'd use a proper mock framework
    return {
      specificationVersion: "v1",
      provider: "mock",
      modelId: "mock-model",
      defaultObjectGenerationMode: undefined,
      supportsImageUrls: false,
      doGenerate: async () => ({
        text: "Hello! I'm a mock response from the agents-runtime smoke test.",
        usage: { promptTokens: 10, completionTokens: 20 },
        finishReason: "stop" as const,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "text-delta", textDelta: "Hello from stream!" });
            controller.enqueue({ type: "finish", finishReason: "stop", usage: { promptTokens: 10, completionTokens: 20 } });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    } as unknown as LanguageModel;
  }

  buildProviderOptions(_config: ModelConfig, _thinkingEnabled: boolean): unknown {
    return undefined;
  }
}

async function seedData() {
  // Seed agent config
  const configDir = join(DATA_DIR, "config", "agents");
  await mkdir(configDir, { recursive: true });
  const agentConfig: AgentConfigWithTools = {
    id: "config-1",
    userId: "user-1",
    name: "Test Agent",
    description: "A test agent for smoke testing",
    systemPromptId: "prompt-1",
    defaultModelId: "mock-model",
    maxTurns: 25,
    icon: null,
    color: null,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    tools: [],
  };
  await writeFile(join(configDir, "config-1.json"), JSON.stringify(agentConfig, null, 2));

  // Seed system prompt
  const promptDir = join(DATA_DIR, "config", "prompts");
  await mkdir(promptDir, { recursive: true });
  const prompt: SystemPrompt = {
    id: "prompt-1",
    name: "Test Prompt",
    content: "You are a helpful test assistant.",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await writeFile(join(promptDir, "prompt-1.json"), JSON.stringify(prompt, null, 2));

  // Seed agent
  const agentDir = join(DATA_DIR, "agents");
  await mkdir(agentDir, { recursive: true });
  const agent: Agent = {
    id: "agent-1",
    sessionId: "session-1",
    agentConfigId: "config-1",
    name: "Test Agent Instance",
    status: "pending",
    turnCount: 0,
    createdAt: new Date(),
  };
  await writeFile(join(agentDir, "agent-1.json"), JSON.stringify(agent, null, 2));

  // Seed session
  const sessionDir = join(DATA_DIR, "sessions", "session-1");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(sessionDir, "session.json"), JSON.stringify({ id: "session-1", updatedAt: new Date().toISOString() }, null, 2));
}

async function seedUserMessage() {
  // Write initial user message to items JSONL
  const itemsDir = join(DATA_DIR, "items");
  await mkdir(itemsDir, { recursive: true });
  const userMessage = {
    id: "item-1",
    agentId: "agent-1",
    sequence: 1,
    type: "message",
    role: "user",
    content: "Hello, can you introduce yourself?",
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(itemsDir, "agent-1.jsonl"), JSON.stringify(userMessage) + "\n");
}

async function main() {
  console.log("🧪 agents-runtime smoke test\n");

  // Clean up any previous test data
  try { await rm(DATA_DIR, { recursive: true }); } catch {}

  // Seed data
  console.log("📁 Seeding test data...");
  await seedData();
  await seedUserMessage();

  // Create runtime with file adapters + mock model
  const fileAdapters = createFileAdapters(DATA_DIR);
  const runtime = new AgentRuntime({
    ...fileAdapters,
    models: new MockModelProvider(),
  });

  console.log("🚀 Running agent in non-streaming mode...\n");

  try {
    const result = await runtime.run("agent-1", "user-1", [
      { role: "user", content: "Hello, can you introduce yourself?" },
    ], {
      sessionId: "session-1",
      streaming: false,
      maxTurns: 3,
    });

    if (!result.streaming) {
      console.log(`✅ Agent response: "${result.result}"`);
      console.log(`   Reached max turns: ${result.reachedMaxTurns}`);
    }

    // Verify items were written
    const itemsPath = join(DATA_DIR, "items", "agent-1.jsonl");
    const itemsContent = await readFile(itemsPath, "utf-8");
    const lines = itemsContent.trim().split("\n");
    console.log(`\n📝 Items in JSONL: ${lines.length}`);
    for (const line of lines) {
      const item = JSON.parse(line);
      console.log(`   [${item.sequence}] ${item.type}: ${item.role ?? ""} ${(item.content ?? "").slice(0, 60)}`);
    }

    // Verify agent was updated
    const agentPath = join(DATA_DIR, "agents", "agent-1.json");
    const agentData = JSON.parse(await readFile(agentPath, "utf-8"));
    console.log(`\n🤖 Agent status: ${agentData.status}`);
    console.log(`   Turn count: ${agentData.turnCount}`);

    console.log("\n🎉 Smoke test PASSED — runtime works standalone!\n");
  } catch (error) {
    console.error("\n❌ Smoke test FAILED:", error);
    process.exit(1);
  } finally {
    // Clean up
    try { await rm(DATA_DIR, { recursive: true }); } catch {}
  }
}

main();
