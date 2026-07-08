import { expect, test } from "vitest";
import type { EventBus } from "./event-bus.js";
import type { DomainEvent } from "../domain/events/domain-event.js";

test("EventBus interface can be implemented by a fake", async () => {
  const seen: string[] = [];
  const handlers: Record<string, ((e: DomainEvent) => Promise<void>)[]> = {};
  const bus: EventBus = {
    async publish(events) { for (const e of events) for (const h of handlers[e.type] ?? []) await h(e); },
    subscribe(type, handler) { (handlers[type] ??= []).push(handler); },
  };
  bus.subscribe("X", async (e) => { seen.push(e.aggregateId); });
  await bus.publish([{ type: "X", occurredAt: new Date(), aggregateId: "a1" }]);
  expect(seen).toEqual(["a1"]);
});
