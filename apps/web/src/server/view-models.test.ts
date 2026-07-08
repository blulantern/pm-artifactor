import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { buildPortfolioView, buildPrioritizeView, buildDoraView, buildIntelView } from "./view-models.js";

test("portfolio view surfaces Sam's cross-tool overallocation", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const vm = await buildPortfolioView(prisma);
    const sam = vm.loads.find((l) => l.name === "Sam Rivera")!;
    expect(sam.totalPct).toBe(122);
    expect(sam.overallocated).toBe(true);
    expect(vm.programs).toHaveLength(2);
  } finally { await cleanup(); }
}, 30000);

test("prioritize view ranks the backlog by the chosen model", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const wsjf = await buildPrioritizeView(prisma, "WSJF");
    expect(wsjf.rows[0]!.value).toBeGreaterThanOrEqual(wsjf.rows[1]!.value);
    const rice = await buildPrioritizeView(prisma, "RICE");
    expect(rice.rows[0]!.title).toBe("Checkout a11y pass"); // 2125, highest
  } finally { await cleanup(); }
}, 30000);

test("dora view computes CFR from rolled-back prod deploys", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const vm = await buildDoraView(prisma);
    expect(vm.prodDeploys).toBeGreaterThanOrEqual(3);
    expect(vm.changeFailureRate).toBeGreaterThan(0);
  } finally { await cleanup(); }
}, 30000);

test("intel view goes live after warming (real tier distribution + tokens saved)", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const { warmIntelligence } = await import("./ai/warm-intelligence.js");
    await warmIntelligence(prisma);
    const vm = await buildIntelView(prisma);
    expect(vm.hasLiveData).toBe(true);
    expect(vm.tokensSaved).toBeGreaterThan(0);
    const det = vm.tiers.find((t) => t.name === "deterministic")!;
    expect(det.count).toBeGreaterThan(0);
    expect(vm.tiers.reduce((s, t) => s + t.pct, 0)).toBeGreaterThan(99); // ~100%
  } finally { await cleanup(); }
}, 60000);

test("team view keys capacity by person id — two same-named people do not merge", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "Org" } });
    // Two distinct people who happen to share a display name.
    const a = await prisma.person.create({ data: { organizationId: org.id, name: "Alex Kim", email: "a@x.com" } });
    const b = await prisma.person.create({ data: { organizationId: org.id, name: "Alex Kim", email: "b@x.com" } });
    await prisma.allocation.create({ data: { personId: a.id, ownerType: "project", ownerId: "p", pct: 40, sourceLabel: "Jira" } });
    await prisma.allocation.create({ data: { personId: b.id, ownerType: "project", ownerId: "p", pct: 90, sourceLabel: "Jira" } });
    const { buildTeamView } = await import("./view-models.js");
    const vm = await buildTeamView(prisma);
    const rows = vm.filter((r) => r.name === "Alex Kim");
    expect(rows).toHaveLength(2);
    // If keyed by name, both would show the merged 130%. Keyed by id, each is distinct.
    expect(rows.map((r) => r.totalPct).sort((x, y) => x - y)).toEqual([40, 90]);
  } finally { await cleanup(); }
}, 30000);
