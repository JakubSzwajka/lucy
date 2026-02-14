import { db } from "@/lib/db";
import { agentConfigs, agentConfigTools } from "@/lib/db/schema";
import type { AgentConfigRecord, AgentConfigToolRecord } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  AgentConfigWithTools,
  AgentConfigTool,
  AgentConfigCreate,
  AgentConfigUpdate,
  AgentConfig,
} from "@/types";

// ============================================================================
// Helpers
// ============================================================================

function parseConfigRecord(record: AgentConfigRecord): AgentConfig {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    systemPromptId: record.systemPromptId,
    systemPromptOverride: record.systemPromptOverride,
    defaultModelId: record.defaultModelId,
    maxTurns: record.maxTurns,
    icon: record.icon,
    color: record.color,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseToolRecord(record: AgentConfigToolRecord): AgentConfigTool {
  return {
    id: record.id,
    agentConfigId: record.agentConfigId,
    toolType: record.toolType,
    toolRef: record.toolRef,
    toolName: record.toolName,
    toolDescription: record.toolDescription,
  };
}

// ============================================================================
// Agent Config Repository
// ============================================================================

export class AgentConfigRepository {
  /**
   * Find a config by ID with its tools (scoped to user)
   */
  async findById(id: string, userId: string): Promise<AgentConfigWithTools | null> {
    const [record] = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.id, id), eq(agentConfigs.userId, userId)));

    if (!record) return null;

    const toolRecords = await db
      .select()
      .from(agentConfigTools)
      .where(eq(agentConfigTools.agentConfigId, id));

    return {
      ...parseConfigRecord(record),
      tools: toolRecords.map(parseToolRecord),
    };
  }

  /**
   * Find all configs for a user, ordered by updatedAt descending
   */
  async findAll(userId: string): Promise<AgentConfigWithTools[]> {
    const records = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.userId, userId))
      .orderBy(desc(agentConfigs.updatedAt));

    if (records.length === 0) return [];

    // Batch-load all tools for this user's configs
    const configIds = records.map((r) => r.id);
    const allTools = await Promise.all(
      configIds.map((cid) =>
        db.select().from(agentConfigTools).where(eq(agentConfigTools.agentConfigId, cid))
      )
    );

    const toolsByConfigId = new Map<string, AgentConfigToolRecord[]>();
    for (let i = 0; i < configIds.length; i++) {
      toolsByConfigId.set(configIds[i], allTools[i]);
    }

    return records.map((record) => ({
      ...parseConfigRecord(record),
      tools: (toolsByConfigId.get(record.id) || []).map(parseToolRecord),
    }));
  }

  async findByIds(ids: string[], userId: string): Promise<AgentConfigWithTools[]> {
    const records = await db
      .select()
      .from(agentConfigs)
      .where(and(inArray(agentConfigs.id, ids), eq(agentConfigs.userId, userId)));

    if (records.length === 0) return [];

    const configIds = records.map((r) => r.id);
    const allTools = await Promise.all(
      configIds.map((cid) =>
        db.select().from(agentConfigTools).where(eq(agentConfigTools.agentConfigId, cid))
      )
    );

    const toolsByConfigId = new Map<string, AgentConfigToolRecord[]>();
    for (let i = 0; i < configIds.length; i++) {
      toolsByConfigId.set(configIds[i], allTools[i]);
    }

    return records.map((record) => ({
      ...parseConfigRecord(record),
      tools: (toolsByConfigId.get(record.id) || []).map(parseToolRecord),
    }));
  }

  /**
   * Find the default config for a user
   */
  async findDefault(userId: string): Promise<AgentConfigWithTools | null> {
    const [record] = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.userId, userId), eq(agentConfigs.isDefault, true)));

    if (!record) return null;

    const toolRecords = await db
      .select()
      .from(agentConfigTools)
      .where(eq(agentConfigTools.agentConfigId, record.id));

    return {
      ...parseConfigRecord(record),
      tools: toolRecords.map(parseToolRecord),
    };
  }

  /**
   * Create a new config with tools
   */
  async create(data: AgentConfigCreate, userId: string): Promise<AgentConfigWithTools> {
    const configId = uuidv4();

    await db.insert(agentConfigs).values({
      id: configId,
      userId,
      name: data.name,
      description: data.description ?? null,
      systemPromptId: data.systemPromptId ?? null,
      systemPromptOverride: data.systemPromptOverride ?? null,
      defaultModelId: data.defaultModelId ?? null,
      maxTurns: data.maxTurns ?? 25,
      icon: data.icon ?? null,
      color: data.color ?? null,
      isDefault: data.isDefault ?? false,
    });

    if (data.tools && data.tools.length > 0) {
      await db.insert(agentConfigTools).values(
        data.tools.map((t) => ({
          id: uuidv4(),
          agentConfigId: configId,
          toolType: t.type,
          toolRef: t.ref,
          toolName: t.toolName ?? null,
          toolDescription: t.toolDescription ?? null,
        }))
      );
    }

    return (await this.findById(configId, userId))!;
  }

  /**
   * Update a config (and replace tools if provided)
   */
  async update(id: string, data: AgentConfigUpdate, userId: string): Promise<AgentConfigWithTools | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.systemPromptId !== undefined) updateData.systemPromptId = data.systemPromptId;
    if (data.systemPromptOverride !== undefined) updateData.systemPromptOverride = data.systemPromptOverride;
    if (data.defaultModelId !== undefined) updateData.defaultModelId = data.defaultModelId;
    if (data.maxTurns !== undefined) updateData.maxTurns = data.maxTurns;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    await db
      .update(agentConfigs)
      .set(updateData)
      .where(and(eq(agentConfigs.id, id), eq(agentConfigs.userId, userId)));

    // Replace tools if provided
    if (data.tools !== undefined) {
      await db.delete(agentConfigTools).where(eq(agentConfigTools.agentConfigId, id));

      if (data.tools.length > 0) {
        await db.insert(agentConfigTools).values(
          data.tools.map((t) => ({
            id: uuidv4(),
            agentConfigId: id,
            toolType: t.type,
            toolRef: t.ref,
            toolName: t.toolName ?? null,
            toolDescription: t.toolDescription ?? null,
          }))
        );
      }
    }

    return this.findById(id, userId);
  }

  /**
   * Delete a config
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) return false;

    await db.delete(agentConfigs).where(and(eq(agentConfigs.id, id), eq(agentConfigs.userId, userId)));
    return true;
  }

  /**
   * Set a config as default, unsetting any previous default
   */
  async setDefault(id: string, userId: string): Promise<void> {
    // Unset current default
    await db
      .update(agentConfigs)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(agentConfigs.userId, userId), eq(agentConfigs.isDefault, true)));

    // Set new default
    await db
      .update(agentConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(agentConfigs.id, id), eq(agentConfigs.userId, userId)));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AgentConfigRepository | null = null;

export function getAgentConfigRepository(): AgentConfigRepository {
  if (!instance) {
    instance = new AgentConfigRepository();
  }
  return instance;
}
