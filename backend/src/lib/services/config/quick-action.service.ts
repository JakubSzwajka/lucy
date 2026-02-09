import { db } from "@/lib/db";
import { quickActions } from "@/lib/db/schema";
import type { QuickActionRecord } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

const MAX_QUICK_ACTION_NAME_LENGTH = 100;

function parseQuickActionRecord(record: QuickActionRecord): QuickAction {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    icon: record.icon,
    sortOrder: record.sortOrder,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class QuickActionService {
  async getAll(userId: string, enabled?: boolean): Promise<QuickAction[]> {
    if (enabled === undefined) {
      const records = await db
        .select()
        .from(quickActions)
        .where(eq(quickActions.userId, userId))
        .orderBy(asc(quickActions.sortOrder), asc(quickActions.name));
      return records.map(parseQuickActionRecord);
    }

    const records = await db
      .select()
      .from(quickActions)
      .where(and(eq(quickActions.userId, userId), eq(quickActions.enabled, enabled)))
      .orderBy(asc(quickActions.sortOrder), asc(quickActions.name));
    return records.map(parseQuickActionRecord);
  }

  async getById(id: string, userId: string): Promise<QuickAction | null> {
    const [record] = await db
      .select()
      .from(quickActions)
      .where(and(eq(quickActions.id, id), eq(quickActions.userId, userId)));

    return record ? parseQuickActionRecord(record) : null;
  }

  async create(data: QuickActionCreate, userId: string): Promise<{ action?: QuickAction; error?: string }> {
    const trimmedName = data.name?.trim();
    const trimmedContent = data.content?.trim();

    if (!trimmedName || !trimmedContent) {
      return { error: "Name and content are required" };
    }

    if (trimmedName.length > MAX_QUICK_ACTION_NAME_LENGTH) {
      return { error: `Name must be ${MAX_QUICK_ACTION_NAME_LENGTH} characters or less` };
    }

    const id = uuidv4();

    await db.insert(quickActions).values({
      id,
      userId,
      name: trimmedName,
      content: trimmedContent,
      icon: data.icon || null,
      sortOrder: data.sortOrder ?? 0,
      enabled: data.enabled ?? true,
    });

    return { action: (await this.getById(id, userId))! };
  }

  async update(id: string, data: QuickActionUpdate, userId: string): Promise<{ action?: QuickAction; error?: string; notFound?: boolean }> {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return { notFound: true };
    }

    const nextName = data.name !== undefined ? data.name.trim() : undefined;
    const nextContent = data.content !== undefined ? data.content.trim() : undefined;

    if (nextName !== undefined) {
      if (!nextName) {
        return { error: "Name is required" };
      }
      if (nextName.length > MAX_QUICK_ACTION_NAME_LENGTH) {
        return { error: `Name must be ${MAX_QUICK_ACTION_NAME_LENGTH} characters or less` };
      }
    }

    if (nextContent !== undefined) {
      if (!nextContent) {
        return { error: "Content is required" };
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (nextName !== undefined) updateData.name = nextName;
    if (nextContent !== undefined) updateData.content = nextContent;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    await db.update(quickActions)
      .set(updateData)
      .where(and(eq(quickActions.id, id), eq(quickActions.userId, userId)));

    return { action: (await this.getById(id, userId))! };
  }

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return { success: false, notFound: true };
    }

    await db.delete(quickActions).where(and(eq(quickActions.id, id), eq(quickActions.userId, userId)));
    return { success: true };
  }
}

let instance: QuickActionService | null = null;

export function getQuickActionService(): QuickActionService {
  if (!instance) {
    instance = new QuickActionService();
  }
  return instance;
}
