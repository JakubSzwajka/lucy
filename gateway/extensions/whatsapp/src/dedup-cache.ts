export class DedupCache {
  private readonly seen = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(messageId: string): boolean {
    this.cleanup();
    if (this.seen.has(messageId)) return true;
    this.seen.set(messageId, Date.now());
    return false;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.seen) {
      if (now - timestamp > this.ttlMs) {
        this.seen.delete(id);
      }
    }
  }
}
