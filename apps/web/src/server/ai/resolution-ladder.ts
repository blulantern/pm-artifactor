import type { AIPort, AIResult } from "@pma/core";
import type { AICacheStore } from "./cache-store.js";
import { cacheKey } from "./cache-key.js";
import { estimateTokens } from "./template-ai-port.js";

export interface ResolutionOutcome {
  output: unknown;
  groundedOn: string[];
  confidence: number;
  tier: "exact_cache" | "llm";
  tokensUsed: number;
  tokensSaved: number;
}

/** Caching Proxy over the real AIPort: exact-cache tier, else the delegate ("llm"). */
export class ResolutionLadder implements AIPort {
  constructor(private readonly delegate: AIPort, private readonly store: AICacheStore) {}

  async run(task: string, input: unknown): Promise<AIResult> {
    const r = await this.resolve(task, input);
    return { output: r.output, groundedOn: r.groundedOn, confidence: r.confidence };
  }

  async resolve(task: string, input: unknown): Promise<ResolutionOutcome> {
    const key = cacheKey(task, input);
    const cached = await this.store.get(key);
    if (cached && !cached.stale) {
      await this.store.bumpHit(key, cached.tokensUsed);
      return {
        output: cached.output, groundedOn: cached.groundedOn, confidence: 1,
        tier: "exact_cache", tokensUsed: 0, tokensSaved: cached.tokensUsed,
      };
    }
    const res = await this.delegate.run(task, input);
    if (!res.groundedOn || res.groundedOn.length === 0) {
      throw new Error(`AI output for '${task}' has empty grounded_on — discarded as a hallucination`);
    }
    const tokensUsed = estimateTokens(res.output);
    await this.store.put({
      keyHash: key, taskType: task, output: res.output, groundedOn: res.groundedOn,
      tokensUsed, hitCount: 0, stale: false,
    });
    return {
      output: res.output, groundedOn: res.groundedOn, confidence: res.confidence,
      tier: "llm", tokensUsed, tokensSaved: 0,
    };
  }
}
