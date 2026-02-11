import { db, systemPrompts } from "@/lib/db";
import { asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { getSettingsService } from "./settings.service";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

// ============================================================================
// System Prompt Service
// ============================================================================

const PROMPT_FILE_SUFFIX = ".prompt.md";

// Seed prompts to create on first access if storage is empty
const SEED_PROMPTS = [
  {
    name: "Helpful Assistant",
    content:
      "You are a helpful, harmless, and honest AI assistant. You provide clear, accurate, and thoughtful responses to help users with their questions and tasks.",
  },
  {
    name: "Code Expert",
    content:
      "You are an expert programmer and software engineer. Help users write clean, efficient code, debug issues, explain concepts, and follow best practices. Always consider security, performance, and maintainability.",
  },
  {
    name: "Writing Assistant",
    content:
      "You are a skilled writer and editor. Help users improve their writing by offering suggestions for clarity, grammar, style, and structure. Adapt your tone and advice based on the context and audience of the writing.",
  },
];

interface PromptFileRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  content: string;
}

function getSystemPromptsBasePath(): string {
  if (process.env.LUCY_USER_DATA_PATH) {
    return path.join(process.env.LUCY_USER_DATA_PATH, "prompts", "system");
  }

  return path.join(process.cwd(), "prompts", "system");
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "prompt";
}

function toPrompt(record: PromptFileRecord): SystemPrompt {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function serializePrompt(record: PromptFileRecord): string {
  const normalizedContent = record.content.replace(/\r\n/g, "\n");

  return [
    "---",
    `id: ${record.id}`,
    `name: ${JSON.stringify(record.name)}`,
    `createdAt: ${record.createdAt.toISOString()}`,
    `updatedAt: ${record.updatedAt.toISOString()}`,
    "---",
    normalizedContent,
  ].join("\n");
}

function parsePromptContent(raw: string): PromptFileRecord | null {
  const normalized = raw.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const closingMarkerIndex = normalized.indexOf("\n---\n", 4);
  if (closingMarkerIndex === -1) {
    return null;
  }

  const header = normalized.slice(4, closingMarkerIndex);
  const content = normalized.slice(closingMarkerIndex + 5);

  const fields: Record<string, string> = {};
  for (const line of header.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }

  if (!fields.id || !fields.name) {
    return null;
  }

  let parsedName = fields.name;
  try {
    parsedName = JSON.parse(fields.name);
  } catch {
    // Keep raw header value if not valid JSON.
  }

  const now = new Date();

  return {
    id: fields.id,
    name: parsedName,
    content,
    createdAt: toDate(fields.createdAt, now),
    updatedAt: toDate(fields.updatedAt, now),
  };
}

/**
 * Service for system prompt business logic
 */
export class SystemPromptService {
  private promptsBasePath: string;

  constructor() {
    this.promptsBasePath = getSystemPromptsBasePath();
    ensureDirectory(this.promptsBasePath);
  }

  private listPromptFiles(): string[] {
    if (!fs.existsSync(this.promptsBasePath)) {
      return [];
    }

    return fs.readdirSync(this.promptsBasePath)
      .filter((fileName) => fileName.endsWith(PROMPT_FILE_SUFFIX));
  }

  private getPromptFilePath(fileName: string): string {
    return path.join(this.promptsBasePath, fileName);
  }

  private writePromptFile(record: PromptFileRecord, fileName?: string): string {
    const resolvedFileName = fileName || `${slugify(record.name)}-${record.id.slice(0, 8)}${PROMPT_FILE_SUFFIX}`;
    const filePath = this.getPromptFilePath(resolvedFileName);

    fs.writeFileSync(filePath, serializePrompt(record), "utf-8");

    return resolvedFileName;
  }

  private loadAllPromptEntries(): Array<{ prompt: SystemPrompt; fileName: string }> {
    const entries: Array<{ prompt: SystemPrompt; fileName: string }> = [];

    for (const fileName of this.listPromptFiles()) {
      try {
        const raw = fs.readFileSync(this.getPromptFilePath(fileName), "utf-8");
        const parsed = parsePromptContent(raw);

        if (!parsed) {
          continue;
        }

        entries.push({
          prompt: toPrompt(parsed),
          fileName,
        });
      } catch {
        // Ignore malformed files and continue reading others.
      }
    }

    entries.sort((a, b) => a.prompt.name.localeCompare(b.prompt.name));
    return entries;
  }

  private findPromptEntryById(id: string): { prompt: SystemPrompt; fileName: string } | null {
    return this.loadAllPromptEntries().find((entry) => entry.prompt.id === id) || null;
  }

  private migrateFromDatabaseIfNeeded(): boolean {
    try {
      const existingDbPrompts = db
        .select()
        .from(systemPrompts)
        .orderBy(asc(systemPrompts.name))
        .all();

      if (existingDbPrompts.length === 0) {
        return false;
      }

      for (const prompt of existingDbPrompts) {
        const now = new Date();
        this.writePromptFile({
          id: prompt.id,
          name: prompt.name,
          content: prompt.content,
          createdAt: toDate(prompt.createdAt, now),
          updatedAt: toDate(prompt.updatedAt, now),
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure prompt files exist (migrate DB data or create seeds)
   */
  ensureSeedPrompts(): void {
    if (this.listPromptFiles().length > 0) {
      return;
    }

    if (this.migrateFromDatabaseIfNeeded()) {
      return;
    }

    for (const seed of SEED_PROMPTS) {
      const now = new Date();
      this.writePromptFile({
        id: uuidv4(),
        name: seed.name,
        content: seed.content,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Get all system prompts
   */
  getAll(): SystemPrompt[] {
    this.ensureSeedPrompts();
    return this.loadAllPromptEntries().map((entry) => entry.prompt);
  }

  /**
   * Get a system prompt by ID
   */
  getById(id: string): SystemPrompt | null {
    this.ensureSeedPrompts();
    return this.findPromptEntryById(id)?.prompt || null;
  }

  /**
   * Create a new system prompt
   */
  create(data: SystemPromptCreate): { prompt?: SystemPrompt; error?: string } {
    if (!data.name || !data.content) {
      return { error: "Name and content are required" };
    }

    this.ensureSeedPrompts();

    const now = new Date();
    const record: PromptFileRecord = {
      id: uuidv4(),
      name: data.name,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };

    this.writePromptFile(record);

    return { prompt: toPrompt(record) };
  }

  /**
   * Update a system prompt
   */
  update(id: string, data: SystemPromptUpdate): { prompt?: SystemPrompt; notFound?: boolean } {
    this.ensureSeedPrompts();

    const existing = this.findPromptEntryById(id);
    if (!existing) {
      return { notFound: true };
    }

    const now = new Date();
    const updated: PromptFileRecord = {
      id,
      name: data.name !== undefined ? data.name : existing.prompt.name,
      content: data.content !== undefined ? data.content : existing.prompt.content,
      createdAt: existing.prompt.createdAt,
      updatedAt: now,
    };

    this.writePromptFile(updated, existing.fileName);

    return { prompt: toPrompt(updated) };
  }

  /**
   * Delete a system prompt
   */
  delete(id: string): { success: boolean; notFound?: boolean } {
    this.ensureSeedPrompts();

    const existing = this.findPromptEntryById(id);
    if (!existing) {
      return { success: false, notFound: true };
    }

    // If this prompt is the default, clear the default setting
    const settingsService = getSettingsService();
    settingsService.clearDefaultSystemPrompt(id);

    fs.unlinkSync(this.getPromptFilePath(existing.fileName));

    return { success: true };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SystemPromptService | null = null;

export function getSystemPromptService(): SystemPromptService {
  if (!instance) {
    instance = new SystemPromptService();
  }
  return instance;
}
