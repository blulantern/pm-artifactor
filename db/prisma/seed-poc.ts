import type { PrismaClient } from "@prisma/client";

export async function seedPoc(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.portfolio.findFirst({ where: { name: "Digital Banking Portfolio" } });
  if (existing) return;

  const org = await prisma.organization.create({ data: { name: "Northwind Bank", tier: "enterprise" } });
  const portfolio = await prisma.portfolio.create({
    data: {
      name: "Digital Banking Portfolio", organizationId: org.id, vision: "Modern, trusted banking",
      status: "active", totalInvestment: 12.4, benefitRealized: 4.1,
    },
  });

  await prisma.strategicObjective.createMany({
    data: [
      { organizationId: org.id, title: "Grow deposits", weightPct: 42 },
      { organizationId: org.id, title: "Reduce fraud loss", weightPct: 31 },
      { organizationId: org.id, title: "Improve NPS", weightPct: 18 },
    ],
  });

  const pay = await prisma.program.create({
    data: { organizationId: org.id, portfolioId: portfolio.id, name: "Payments Modernization", status: "on_track", methodology: "SAFe", benefitPct: 68 },
  });
  const cx = await prisma.program.create({
    data: { organizationId: org.id, portfolioId: portfolio.id, name: "Customer Experience", status: "at_risk", methodology: "Hybrid", benefitPct: 41 },
  });
  await prisma.benefit.create({ data: { programId: pay.id, name: "Ledger cost savings", metric: "$", baselineValue: 0, targetValue: 2.5, realizationStatus: "in_progress" } });

  const scrum = (await prisma.methodology.findUnique({ where: { key: "SCRUM" } }))!;
  const waterfall = (await prisma.methodology.findUnique({ where: { key: "WATERFALL" } }))!;

  const checkout = await prisma.project.create({
    data: {
      name: "Mobile Checkout Revamp", organizationId: org.id, portfolioId: portfolio.id, programId: cx.id, methodologyId: scrum.id,
      status: "at_risk", health: 62, nextMilestone: "Sprint 14 ends Mar 18", sourceLabel: "Jira", spi: 0.92, cpi: 1.03,
    },
  });
  const ledger = await prisma.project.create({
    data: {
      name: "Ledger Migration", organizationId: org.id, portfolioId: portfolio.id, programId: pay.id, methodologyId: waterfall.id,
      status: "at_risk", health: 70, nextMilestone: "Gate 2 · Mar 22", sourceLabel: "Azure DevOps", spi: 0.88, cpi: 0.96,
    },
  });
  const fraud = await prisma.project.create({
    data: {
      name: "Fraud Signals v2", organizationId: org.id, portfolioId: portfolio.id, programId: pay.id, methodologyId: scrum.id,
      status: "on_track", health: 86, nextMilestone: "Continuous", sourceLabel: "GitHub", spi: 1.0, cpi: 1.02,
    },
  });

  // Standalone-capability demo data (manual foundation)
  const standaloneProduct = await prisma.product.create({
    data: { organizationId: org.id, name: "Ledger Platform", status: "active", vision: "One source of truth for spend." },
  });
  await prisma.program.create({ data: { organizationId: org.id, name: "Ops Excellence (standalone)", status: "on_track" } });
  await prisma.project.create({
    data: { organizationId: org.id, name: "Ledger API (standalone, delivers product)", methodologyId: scrum.id, productId: standaloneProduct.id, status: "on_track" },
  });

  // Scrum tree for Checkout: epic -> 3 stories, in Sprint 14.
  const storyType = (await prisma.workItemType.findFirst({ where: { methodologyId: scrum.id, name: "Story" } }))!;
  const epicType = (await prisma.workItemType.findFirst({ where: { methodologyId: scrum.id, name: "Epic" } }))!;
  const sprint = await prisma.cadence.create({
    data: {
      projectId: checkout.id, kind: "sprint", name: "Sprint 14",
      startDate: new Date("2026-03-04"), endDate: new Date("2026-03-18"), goal: "Checkout revamp", capacity: 40, committedPoints: 34,
    },
  });
  const epic = await prisma.workItem.create({
    data: { projectId: checkout.id, workItemTypeId: epicType.id, title: "Checkout revamp", status: "in_progress" },
  });
  await prisma.workItem.createMany({
    data: [
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "Payment sheet", status: "done", estimate: 8, estimateUnit: "points", complexityBand: "med" },
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "Apple Pay", status: "in_progress", estimate: 5, estimateUnit: "points", complexityBand: "high" },
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "a11y pass", status: "in_progress", estimate: 3, estimateUnit: "points", complexityBand: "low" },
    ],
  });

  // Team of four.
  const team = await prisma.team.create({ data: { organizationId: org.id, name: "Checkout Squad" } });
  const dana = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Dana Okafor", email: "dana@northwind.example", role: "Sr. Backend Eng", flowNote: "high-complexity backend" } });
  const sam = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Sam Rivera", email: "sam@northwind.example", role: "Frontend Eng", flowNote: "polished small/med UI" } });
  const lin = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Lin Chen", email: "lin@northwind.example", role: "Data Eng", flowNote: "steady, load-bearing work" } });
  const theo = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Theo Adékúnlé", email: "theo@northwind.example", role: "QA / Automation", flowNote: "consistent, thorough" } });

  // Allocations — Sam overallocated across two sources (F1 cross-tool truth).
  await prisma.allocation.createMany({
    data: [
      { personId: dana.id, ownerType: "project", ownerId: checkout.id, pct: 68, sourceLabel: "Jira" },
      { personId: sam.id, ownerType: "project", ownerId: checkout.id, pct: 70, sourceLabel: "Jira" },
      { personId: sam.id, ownerType: "project", ownerId: fraud.id, pct: 52, sourceLabel: "Monday" },
      { personId: lin.id, ownerType: "project", ownerId: ledger.id, pct: 84, sourceLabel: "Azure DevOps" },
      { personId: theo.id, ownerType: "project", ownerId: checkout.id, pct: 55, sourceLabel: "Jira" },
    ],
  });

  // Skills + velocity + a note for Dana (shape the person page).
  await prisma.skillObservation.createMany({
    data: [
      { personId: dana.id, skill: "Distributed systems", proficiency: 5, interest: 5 },
      { personId: dana.id, skill: "Kubernetes", proficiency: 2, interest: 4 },
      { personId: sam.id, skill: "React / UI", proficiency: 5, interest: 5 },
      { personId: sam.id, skill: "Accessibility", proficiency: 3, interest: 5 },
    ],
  });
  await prisma.velocityInsight.createMany({
    data: [
      { personId: dana.id, dimension: "complexity", band: 2, throughput: 1.15, caveat: "Flows on high-complexity backend" },
      { personId: dana.id, dimension: "complexity", band: 0, throughput: 0.7 },
    ],
  });
  await prisma.teammateNote.create({
    data: { personId: dana.id, category: "recognition", content: "Shipped conflict-replay four days ahead of commitment.", howToSupport: "Give her the release-notes engine she's wanted.", evidenceRefs: '[{"type":"pr","id":"812"}]' },
  });
  await prisma.oneOnOne.create({ data: { personId: lin.id, metOn: new Date("2026-02-23"), talkingPoints: "Infra goal", followUps: "Pair on pipeline" } });

  // Stakeholders.
  const priya = await prisma.stakeholder.create({ data: { name: "Priya N.", role: "CFO · Exec Sponsor", influence: 5, interest: 4, stance: "supporter", updateCadence: "Biweekly · due Thu", nextDue: new Date("2026-03-19"), caresAbout: "Ledger benefit, budget" } });
  await prisma.stakeholder.createMany({
    data: [
      { name: "Marcus L.", role: "Head of Risk", influence: 4, interest: 5, stance: "skeptic", updateCadence: "Weekly · due Mon", caresAbout: "Fraud Signals, RAID" },
      { name: "Elena V.", role: "VP Product", influence: 4, interest: 3, stance: "neutral", updateCadence: "Monthly", caresAbout: "Checkout roadmap" },
      { name: "Raj P.", role: "Eng Director", influence: 3, interest: 2, stance: "supporter", updateCadence: "Monthly", caresAbout: "Capacity, hiring" },
    ],
  });
  await prisma.stakeholderInterest.create({ data: { stakeholderId: priya.id, ownerType: "project", ownerId: ledger.id, reason: "Tracks the Ledger benefit" } });

  // Backlog with WSJF/RICE inputs (matches POC).
  const backlog = await prisma.backlog.create({ data: { projectId: checkout.id, kind: "product" } });
  const items = [
    { title: "Enterprise SSO", bv: 8, tc: 5, rr: 8, size: 5, r: 2000, i: 2, c: 80, e: 3 },
    { title: "Audit logging", bv: 5, tc: 2, rr: 8, size: 3, r: 800, i: 1, c: 90, e: 2 },
    { title: "Release-notes engine", bv: 8, tc: 3, rr: 3, size: 8, r: 1200, i: 2, c: 70, e: 5 },
    { title: "Checkout a11y pass", bv: 5, tc: 8, rr: 2, size: 3, r: 5000, i: 1, c: 85, e: 2 },
    { title: "Billing proration", bv: 3, tc: 2, rr: 2, size: 2, r: 400, i: 0.5, c: 60, e: 2 },
  ];
  let rank = 0;
  for (const it of items) {
    const wi = await prisma.workItem.create({
      data: { projectId: checkout.id, workItemTypeId: storyType.id, title: it.title, status: "todo", estimate: it.size, estimateUnit: "points" },
    });
    await prisma.backlogItem.create({
      data: {
        backlogId: backlog.id, workItemId: wi.id, rank: rank++,
        wsjfUserBusinessValue: it.bv, wsjfTimeCriticality: it.tc, wsjfRiskReduction: it.rr,
        riceReach: it.r, riceImpact: it.i, riceConfidence: it.c, riceEffort: it.e,
      },
    });
  }

  // Releases + environments + deployments (DORA: include a rollback).
  const dev = await prisma.environment.create({ data: { name: "dev", promoteOrder: 0 } });
  const staging = await prisma.environment.create({ data: { name: "staging", promoteOrder: 1 } });
  const prod = await prisma.environment.create({ data: { name: "prod", promoteOrder: 2 } });
  const v23 = await prisma.release.create({ data: { projectId: checkout.id, version: "v2.3", name: "Checkout + Fraud", status: "deploying" } });
  const v22 = await prisma.release.create({ data: { projectId: ledger.id, version: "v2.2", name: "Ledger phase 1", status: "released", releasedAt: new Date("2026-03-10") } });
  await prisma.deployment.createMany({
    data: [
      { releaseId: v23.id, environmentId: dev.id, status: "success", leadTimeMinutes: 40 },
      { releaseId: v23.id, environmentId: staging.id, status: "success", leadTimeMinutes: 55 },
      { releaseId: v23.id, environmentId: prod.id, status: "running" },
      { releaseId: v22.id, environmentId: dev.id, status: "success", leadTimeMinutes: 30 },
      { releaseId: v22.id, environmentId: staging.id, status: "success", leadTimeMinutes: 45 },
      { releaseId: v22.id, environmentId: prod.id, status: "success", leadTimeMinutes: 60 },
    ],
  });
  const fraudRelease = await prisma.release.create({ data: { projectId: fraud.id, version: "v1.9", name: "Fraud model", status: "released" } });
  const failedProd = await prisma.deployment.create({ data: { releaseId: fraudRelease.id, environmentId: prod.id, status: "rolled_back", leadTimeMinutes: 52 } });
  await prisma.deployment.create({ data: { releaseId: fraudRelease.id, environmentId: prod.id, status: "success", rollbackOfId: failedProd.id, leadTimeMinutes: 20 } });

  // Emails, calendar, suggested actions.
  await prisma.emailMessage.createMany({
    data: [
      { subject: "Ledger cutover date", fromEmail: "priya@northwind.example", snippet: "Confirm the Ledger cutover date before the board deck.", receivedAt: new Date("2026-03-16T07:10:00Z"), kind: "needs_reply", linkLabel: "Ledger Migration" },
      { subject: "Fraud threshold", fromEmail: "marcus@northwind.example", snippet: "Wants sign-off on the fraud model threshold change.", receivedAt: new Date("2026-03-16T06:40:00Z"), kind: "decision", linkLabel: "Fraud Signals v2" },
      { subject: "Gateway maintenance", fromEmail: "ops@vendor.example", snippet: "Payment gateway maintenance window overlaps release v2.3.", receivedAt: new Date("2026-03-15T22:00:00Z"), kind: "risk", linkLabel: "Release v2.3" },
      { subject: "Q2 roadmap", fromEmail: "elena@northwind.example", snippet: "Shared updated Q2 roadmap for Checkout.", receivedAt: new Date("2026-03-15T18:00:00Z"), kind: "fyi", linkLabel: "Mobile Checkout" },
    ],
  });
  await prisma.calendarEvent.createMany({
    data: [
      { title: "Standup · Checkout", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T09:15:00Z"), linkLabel: "Mobile Checkout Revamp" },
      { title: "1:1 open slot", start: new Date("2026-03-16T11:30:00Z"), end: new Date("2026-03-16T12:00:00Z"), isFreeTime: true },
      { title: "Risk review · Marcus", start: new Date("2026-03-16T14:00:00Z"), end: new Date("2026-03-16T14:30:00Z") },
      { title: "Sprint 14 review prep", start: new Date("2026-03-16T16:00:00Z"), end: new Date("2026-03-16T16:30:00Z") },
    ],
  });
  await prisma.suggestedAction.createMany({
    data: [
      { type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri — 3 stories still In Progress on Checkout", refType: "project", refId: checkout.id },
      { type: "deploy_attention", urgency: "high", text: "Release v2.3 is deploying to prod — watch the gateway maintenance overlap", refType: "release", refId: v23.id },
      { type: "stakeholder_update_due", urgency: "med", text: "Draft Priya's biweekly update (she tracks the Ledger benefit) — due Thu", refType: "stakeholder", refId: priya.id },
      { type: "one_on_one_overdue", urgency: "med", text: "You haven't met Lin in 3 weeks — she has an open infra goal", refType: "person", refId: lin.id },
      { type: "gate_deadline", urgency: "med", text: "Ledger Gate 2 review is Mar 22 — 2 deliverables still unaccepted", refType: "project", refId: ledger.id },
      { type: "complex_check_in", urgency: "low", text: "Auth-rewrite (high-complexity) has been quiet 4 days — check in with Dana", refType: "person", refId: dana.id },
      { type: "meeting_prep", urgency: "med", text: "Standup in 40m; prep note: 2 blockers flagged overnight", refType: "project", refId: checkout.id },
    ],
  });

  // Read-only connections shown on the Connections page.
  const jira = await prisma.externalSystem.create({ data: { vendor: "jira" } });
  await prisma.syncConnection.create({ data: { externalSystemId: jira.id, authRef: "keychain:jira", direction: "inbound", lastPulledAt: new Date() } });
}
