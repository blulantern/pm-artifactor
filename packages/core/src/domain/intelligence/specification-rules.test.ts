import { expect, test } from "vitest";
import { runSpecificationRules } from "./specification-rules.js";

const now = new Date("2026-03-16T08:00:00Z");
function snap(overrides: any = {}) {
  return {
    now,
    cadences: [], complexItems: [], stakeholders: [], oneOnOnes: [],
    gates: [], deployments: [], meetings: [], ...overrides,
  };
}

test("sprint-end fires when a cadence ends within N days with open stories", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "Sprint 14", endDate: new Date("2026-03-18T00:00:00Z"), openStoryCount: 3 }],
  }));
  const a = actions.find((x) => x.type === "sprint_end");
  expect(a).toBeTruthy();
  expect(a!.text).toContain("Sprint 14");
  expect(a!.urgency).toBe("high");
});

test("sprint-end does NOT fire when no stories are open", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "Sprint 14", endDate: new Date("2026-03-18T00:00:00Z"), openStoryCount: 0 }],
  }));
  expect(actions.find((x) => x.type === "sprint_end")).toBeUndefined();
});

test("deploy-attention fires on a rolled_back deployment", () => {
  const actions = runSpecificationRules(snap({
    deployments: [{ id: "d1", releaseVersion: "v2.3", status: "rolled_back" }],
  }));
  expect(actions.find((x) => x.type === "deploy_attention")).toBeTruthy();
});

test("1:1 overdue fires when last meeting exceeds cadence", () => {
  const actions = runSpecificationRules(snap({
    oneOnOnes: [{ personId: "lin", personName: "Lin", lastMet: new Date("2026-02-20T00:00:00Z"), cadenceDays: 14 }],
  }));
  expect(actions.find((x) => x.type === "one_on_one_overdue")).toBeTruthy();
});

test("all seven rule types can fire together", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "S14", endDate: new Date("2026-03-17T00:00:00Z"), openStoryCount: 2 }],
    complexItems: [{ id: "auth", title: "Auth rewrite", assignee: "Dana", daysSinceStatusChange: 4 }],
    stakeholders: [{ id: "priya", name: "Priya", nextDue: new Date("2026-03-17T00:00:00Z"), cares: "Ledger" }],
    oneOnOnes: [{ personId: "lin", personName: "Lin", lastMet: new Date("2026-02-01T00:00:00Z"), cadenceDays: 14 }],
    gates: [{ projectId: "ledger", name: "Gate 2", deadline: new Date("2026-03-22T00:00:00Z"), unacceptedDeliverables: 2 }],
    deployments: [{ id: "d1", releaseVersion: "v2.3", status: "rolled_back" }],
    meetings: [{ title: "Standup", start: new Date("2026-03-16T08:40:00Z"), linkLabel: "Checkout" }],
  }));
  const types = new Set(actions.map((a) => a.type));
  expect(types.size).toBe(7);
});
