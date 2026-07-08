import type { DomainEvent } from "../domain/events/domain-event.js";

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void;
}

export interface OutboxPort {
  enqueue(command: { readonly type: string; readonly payload: unknown }): Promise<void>;
}
