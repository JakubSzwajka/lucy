import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import type { LanguageModel } from "ai";

import { MEMORY_PLUGIN_ID, createMemoryPlugin } from "../../agents-memory/src/index.ts";
import {
  AgentRuntime,
  createFileAdapters,
  type ModelConfig,
  type ModelProvider,
} from "../src/index.js";

const BASELINE_DATA_DIR = ".agents-data-smoke-test-baseline";
const OBSERVER_DATA_DIR = ".agents-data-smoke-test-observer";

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter(
      (part): part is { text: string; type: "text" } =>
        typeof part === "object"
        && part !== null
        && "type" in part
        && part.type === "text"
        && "text" in part
        && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function getSystemPromptText(
  prompt: Array<{ content: unknown; role: string }> | undefined,
): string {
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
      doGenerate: async (input: {
        prompt?: Array<{ content: unknown; role: string }>;
      }) => {
        const systemPrompt = getSystemPromptText(input.prompt);

        // Detect extraction call
        if (systemPrompt.includes("memory extraction system")) {
          return mockResponse(
            JSON.stringify([
              {
                category: "personal",
                confidence: 0.95,
                content: "User's name is Kuba",
                gate: "allow",
                type: "fact",
              },
              {
                category: "work",
                confidence: 0.95,
                content: "Works at Acme Corp",
                gate: "allow",
                type: "fact",
              },
            ]),
          );
        }

        // Detect synthesis call
        if (systemPrompt.includes("memory synthesizer")) {
          return mockResponse("Name is Kuba. Works at Acme Corp.");
        }

        // Regular chat — check if memory was injected
        const hasMemory =
          systemPrompt.includes("Kuba") && systemPrompt.includes("Acme");
        return mockResponse(
          hasMemory
            ? "Hello Kuba! I remember you work at Acme Corp."
            : "Hello! I'm a mock assistant.",
        );
      },
      doStream: async () => {
        throw new Error("Not implemented");
      },
      modelId: "mock-model",
      provider: "mock",
      specificationVersion: "v1",
      supportsImageUrls: false,
    } as unknown as LanguageModel;
  }

  buildProviderOptions(
    _config: ModelConfig,
    _thinkingEnabled: boolean,
  ): unknown {
    return undefined;
  }
}

function mockResponse(text: string) {
  return {
    finishReason: "stop" as const,
    rawCall: { rawPrompt: null, rawSettings: {} },
    text,
    usage: { completionTokens: 20, promptTokens: 10 },
    warnings: [],
  };
}

async function cleanDir(dataDir: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await rm(dataDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function withCleanDir<T>(
  dataDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  await cleanDir(dataDir);

  try {
    return await fn();
  } finally {
    await cleanDir(dataDir);
  }
}

async function main() {
  console.log("🧪 agents-runtime smoke test (single-agent + memory observer)");

  try {
    // Scenario 1: Baseline
    console.log("\n1. Baseline runtime without plugins");
    await withCleanDir(BASELINE_DATA_DIR, async () => {
      const runtime = new AgentRuntime({
        deps: {
          ...createFileAdapters(BASELINE_DATA_DIR),
          models: new MockModelProvider(),
        },
      });
      await runtime.init();

      const result = await runtime.sendMessage("Hello");
      if (!result.response.includes("mock assistant")) {
        throw new Error(`Unexpected response: ${result.response}`);
      }

      const history = await runtime.getHistory();
      if (history.length < 2) {
        throw new Error(
          `Expected at least 2 items, got ${history.length}`,
        );
      }

      console.log(`✅ Response: "${result.response}"`);
      console.log(`✅ History: ${history.length} items`);
    });

    // Scenario 2: Memory observer
    console.log("\n2. Runtime with memory observer");
    await withCleanDir(OBSERVER_DATA_DIR, async () => {
      const memoryPlugin = createMemoryPlugin({
        dataDir: OBSERVER_DATA_DIR,
        observer: { modelId: "mock-model" },
      });

      const runtime = new AgentRuntime({
        deps: {
          ...createFileAdapters(OBSERVER_DATA_DIR),
          models: new MockModelProvider(),
        },
        resolvedPlugins: [
          { config: {}, plugin: memoryPlugin },
        ],
      });
      await runtime.init();

      // Send a message with memorable facts
      const result1 = await runtime.sendMessage(
        "My name is Kuba and I work at Acme Corp",
      );
      console.log(`✅ First response: "${result1.response}"`);

      // Wait for fire-and-forget observer pipeline
      await new Promise((r) => setTimeout(r, 2000));

      // Check observations were extracted
      const obsPath = join(OBSERVER_DATA_DIR, "memory", "observations.jsonl");
      if (!existsSync(obsPath)) {
        throw new Error("observations.jsonl was not created");
      }
      const obsContent = await readFile(obsPath, "utf-8");
      const obsLines = obsContent.trim().split("\n").filter(Boolean);
      if (obsLines.length === 0) {
        throw new Error("No observations were extracted");
      }
      console.log(`✅ Observations extracted: ${obsLines.length}`);

      // Check memory.md was synthesized
      const memPath = join(OBSERVER_DATA_DIR, "memory", "memory.md");
      if (!existsSync(memPath)) {
        throw new Error("memory.md was not created");
      }
      const memContent = await readFile(memPath, "utf-8");
      if (!memContent.includes("Kuba")) {
        throw new Error(
          `memory.md doesn't contain expected content: ${memContent}`,
        );
      }
      console.log(`✅ memory.md synthesized: "${memContent.trim()}"`);

      // Send another message — should see memory in context
      const result2 = await runtime.sendMessage("Do you remember me?");
      if (
        !result2.response.includes("Kuba")
        || !result2.response.includes("Acme")
      ) {
        throw new Error(
          `Memory not injected into context: ${result2.response}`,
        );
      }
      console.log(`✅ Memory injected: "${result2.response}"`);
    });

    console.log("\n🎉 Smoke test PASSED\n");
  } catch (error) {
    console.error("\n❌ Smoke test FAILED:", error);
    process.exit(1);
  }
}

main();
