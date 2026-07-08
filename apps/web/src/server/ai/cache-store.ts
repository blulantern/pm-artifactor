export interface CachedEntry {
  keyHash: string;
  taskType: string;
  output: unknown;
  groundedOn: string[];
  tokensUsed: number;
  hitCount: number;
  stale: boolean;
}

export interface AICacheStore {
  get(keyHash: string): Promise<CachedEntry | null>;
  put(entry: CachedEntry): Promise<void>;
  bumpHit(keyHash: string, tokensSaved: number): Promise<void>;
  markStaleByEntity(entityId: string): Promise<number>;
}

export class InMemoryAICacheStore implements AICacheStore {
  private readonly byKey = new Map<string, CachedEntry>();
  async get(keyHash: string): Promise<CachedEntry | null> {
    return this.byKey.get(keyHash) ?? null;
  }
  async put(entry: CachedEntry): Promise<void> {
    this.byKey.set(entry.keyHash, { ...entry });
  }
  async bumpHit(keyHash: string, _tokensSaved: number): Promise<void> {
    const e = this.byKey.get(keyHash);
    if (e) e.hitCount += 1;
  }
  async markStaleByEntity(entityId: string): Promise<number> {
    let n = 0;
    for (const e of this.byKey.values()) {
      if (!e.stale && e.groundedOn.includes(entityId)) { e.stale = true; n++; }
    }
    return n;
  }
}
