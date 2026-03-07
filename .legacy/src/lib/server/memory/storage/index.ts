import { PostgresMemoryStore } from "./postgres-memory-store";
import type { MemoryStore } from "./memory-store.interface";

let instance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!instance) {
    instance = new PostgresMemoryStore();
  }
  return instance;
}

export type { MemoryStore } from "./memory-store.interface";
