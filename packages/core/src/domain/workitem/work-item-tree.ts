import { WorkItem } from "./work-item.js";
import type { WorkItemId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";

export class WorkItemTree {
  private readonly byId = new Map<string, WorkItem>();
  private readonly childIds = new Map<string, WorkItemId[]>();

  private constructor(items: WorkItem[]) {
    for (const it of items) {
      this.byId.set(it.id, it);
      if (!this.childIds.has(it.id)) this.childIds.set(it.id, []);
    }
    for (const it of items) {
      if (it.parentId) {
        const siblings = this.childIds.get(it.parentId) ?? [];
        siblings.push(it.id);
        this.childIds.set(it.parentId, siblings);
      }
    }
  }

  static fromFlat(items: WorkItem[]): WorkItemTree {
    return new WorkItemTree(items);
  }

  roots(): WorkItem[] {
    return [...this.byId.values()].filter((i) => i.parentId === null);
  }

  childrenOf(id: WorkItemId): WorkItem[] {
    return (this.childIds.get(id) ?? []).map((cid) => this.byId.get(cid)!);
  }

  private descendants(id: WorkItemId): WorkItem[] {
    const out: WorkItem[] = [];
    for (const child of this.childrenOf(id)) {
      out.push(child, ...this.descendants(child.id));
    }
    return out;
  }

  rolledUpEstimate(id: WorkItemId): number {
    const self = this.byId.get(id);
    const kids = this.childrenOf(id);
    if (kids.length === 0) return self?.estimate ?? 0;
    return this.descendants(id)
      .filter((d) => this.childrenOf(d.id).length === 0)
      .reduce((sum, leaf) => sum + (leaf.estimate ?? 0), 0);
  }

  rolledUpStatus(id: WorkItemId): StatusCategory {
    const kids = this.descendants(id);
    if (kids.length === 0) return this.byId.get(id)?.status ?? "todo";
    if (kids.some((k) => k.status === "blocked")) return "blocked";
    if (kids.every((k) => k.status === "done")) return "done";
    if (kids.some((k) => k.status !== "todo")) return "in_progress";
    return "todo";
  }
}
