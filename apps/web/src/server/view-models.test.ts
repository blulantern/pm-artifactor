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
    const sam = vm.loads.find((l) => l.personId === "Sam Rivera")!;
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
