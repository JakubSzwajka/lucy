import { db, quickActions, QuickActionRecord } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
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
  getAll(enabled?: boolean): QuickAction[] {
    const baseQuery = db
      .select()
      .from(quickActions);

    const records = enabled === undefined
      ? baseQuery
        .orderBy(asc(quickActions.sortOrder), asc(quickActions.name))
        .all()
      : baseQuery
        .where(eq(quickActions.enabled, enabled))
        .orderBy(asc(quickActions.sortOrder), asc(quickActions.name))
        .all();

    return records.map(parseQuickActionRecord);
  }

  getById(id: string): QuickAction | null {
    const [record] = db
      .select()
      .from(quickActions)
      .where(eq(quickActions.id, id))
      .all();

    return record ? parseQuickActionRecord(record) : null;
  }

  create(data: QuickActionCreate): { action?: QuickAction; error?: string } {
    const trimmedName = data.name?.trim();
    const trimmedContent = data.content?.trim();

    if (!trimmedName || !trimmedContent) {
      return { error: "Name and content are required" };
    }

    if (trimmedName.length > MAX_QUICK_ACTION_NAME_LENGTH) {
      return { error: `Name must be ${MAX_QUICK_ACTION_NAME_LENGTH} characters or less` };
    }

    const id = uuidv4();

    db.insert(quickActions).values({
      id,
      name: trimmedName,
      content: trimmedContent,
      icon: data.icon || null,
      sortOrder: data.sortOrder ?? 0,
      enabled: data.enabled ?? true,
    }).run();

    return { action: this.getById(id)! };
  }

  update(id: string, data: QuickActionUpdate): { action?: QuickAction; error?: string; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { notFound: true };
    }

    const nextName = data.name !== undefined ? data.name.trim() : undefined;
    const nextContent = data.content !== undefined ? data.content.trim() : undefined;

    if (nextName !== undefined) {
      const trimmedName = nextName;
      if (!trimmedName) {
        return { error: "Name is required" };
      }
      if (trimmedName.length > MAX_QUICK_ACTION_NAME_LENGTH) {
        return { error: `Name must be ${MAX_QUICK_ACTION_NAME_LENGTH} characters or less` };
      }
    }

    if (nextContent !== undefined) {
      const trimmedContent = nextContent;
      if (!trimmedContent) {
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

    db.update(quickActions)
      .set(updateData)
      .where(eq(quickActions.id, id))
      .run();

    return { action: this.getById(id)! };
  }

  delete(id: string): { success: boolean; notFound?: boolean } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, notFound: true };
    }

    db.delete(quickActions).where(eq(quickActions.id, id)).run();
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
