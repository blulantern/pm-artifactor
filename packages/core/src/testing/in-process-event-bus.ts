import type { EventBus } from "../ports/event-bus.js";
import type { DomainEvent } from "../domain/events/domain-event.js";

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, ((e: DomainEvent) => Promise<void>)[]>();
  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      for (const h of this.handlers.get(e.type) ?? []) await h(e);
    }
  }
}
