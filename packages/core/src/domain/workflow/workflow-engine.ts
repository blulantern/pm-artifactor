import type { WorkflowDefinition, StateTransitionDef } from "../methodology/config.js";
import type { WorkflowStateId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";
import type { DomainEvent } from "../events/domain-event.js";
import { workItemStatusChanged } from "../events/work-item-events.js";
import type { WorkItem } from "../workitem/work-item.js";

export interface TransitionContext { readonly now: Date; readonly approved?: boolean; }
export interface TransitionResult {
  readonly newStateId: WorkflowStateId;
  readonly newCategory: StatusCategory;
  readonly events: DomainEvent[];
}

export class WorkflowEngine {
  constructor(private readonly wf: WorkflowDefinition) {}

  private find(from: WorkflowStateId, name: string): StateTransitionDef | undefined {
    return this.wf.transitions.find((t) => t.fromStateId === from && t.name === name);
  }

  private categoryOf(id: WorkflowStateId): StatusCategory {
    const s = this.wf.states.find((st) => st.id === id);
    if (!s) throw new Error(`Unknown workflow state: ${id}`);
    return s.category;
  }

  can(from: WorkflowStateId, name: string, ctx: TransitionContext): boolean {
    const t = this.find(from, name);
    if (!t) return false;
    if (t.requiresApproval && !ctx.approved) return false;
    return true;
  }

  apply(
    item: WorkItem,
    from: WorkflowStateId,
    name: string,
    ctx: TransitionContext,
  ): TransitionResult {
    const t = this.find(from, name);
    if (!t) throw new Error(`Illegal transition '${name}' from ${from}`);
    if (t.requiresApproval && !ctx.approved) throw new Error(`Transition '${name}' requires approval`);
    const fromCat = this.categoryOf(from);
    const toCat = this.categoryOf(t.toStateId);
    const events: DomainEvent[] =
      fromCat === toCat ? [] : [workItemStatusChanged(item.id, fromCat, toCat, ctx.now)];
    return { newStateId: t.toStateId, newCategory: toCat, events };
  }
}
