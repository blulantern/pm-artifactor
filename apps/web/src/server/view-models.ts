import type { PrismaClient } from "@prisma/client";
import {
  computeLoads,
  computeDora,
  computeHealth,
  computeSprint,
  runSpecificationRules,
  buildDailyBrief,
  WsjfStrategy,
  RiceStrategy,
  type PriorityScore,
  type PersonLoad,
  type HealthDriverInput,
  type CanonicalSnapshot,
  type SuggestedAction,
} from "@pma/core";
import { db } from "./db.js";

const NOW = () => new Date();

/** Manager display name for the daily brief — no per-user account model exists yet. */
const MANAGER_NAME = "Alex";
/** Default cadence assumed for 1:1s absent an explicit per-person cadence field. */
const DEFAULT_ONE_ON_ONE_CADENCE_DAYS = 14;

// ============================== Portfolio ==============================

export async function buildPortfolioView(prisma: PrismaClient) {
  const portfolio = await prisma.portfolio.findFirst({ include: { programs: true } });
  const allocations = await prisma.allocation.findMany({ include: { person: true } });
  const loads = computeLoads(
    allocations.map((a) => ({ personId: a.person.name, pct: a.pct, source: a.sourceLabel ?? "?" })),
    NOW(),
  ).result;
  const objectives = await prisma.strategicObjective.findMany();
  return {
    name: portfolio?.name ?? "Portfolio",
    health: portfolio
      ? Math.round(
          (portfolio.programs.reduce((s, p) => s + (p.benefitPct ?? 0), 0) / Math.max(portfolio.programs.length, 1)),
        )
      : 0,
    invest: portfolio?.totalInvestment ?? 0,
    benefitRealized: portfolio?.benefitRealized ?? 0,
    programs:
      portfolio?.programs.map((p) => ({
        id: p.id,
        name: p.name,
        health: p.benefitPct ?? 0,
        status: p.status,
        benefitPct: p.benefitPct ?? 0,
      })) ?? [],
    loads,
    objectives: objectives.map((o) => ({ title: o.title, weightPct: o.weightPct ?? 0 })),
  };
}
export const getPortfolioView = () => buildPortfolioView(db());

// ============================== Projects ==============================

export async function buildProjectsView(prisma: PrismaClient) {
  const projects = await prisma.project.findMany({ include: { methodology: true }, orderBy: { name: "asc" } });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    methodology: p.methodology.name,
    health: p.health,
    status: p.status,
    next: p.nextMilestone ?? "",
    source: p.sourceLabel ?? "",
    spi: p.spi ?? null,
    cpi: p.cpi ?? null,
  }));
}
export const getProjectsView = () => buildProjectsView(db());

export async function buildProjectView(prisma: PrismaClient, id: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      methodology: true,
      program: true,
      workItems: true,
      cadences: { include: { workItems: true } },
      baselines: true,
      raidItems: true,
      phases: { include: { gate: true }, orderBy: { sequence: "asc" } },
    },
  });
  const now = NOW();

  // Synthesize plausible driver severities/trends from the fields available on the
  // materialized Project row and its related RAID/phase data — there is no separate
  // "health driver" table, so this heuristic maps existing signals onto the analyzer's input shape.
  const scheduleSeverity = project.spi != null ? clamp((1 - project.spi) * 100) : 0;
  const costSeverity = project.cpi != null ? clamp((1 - project.cpi) * 100) : 0;
  const openRaid = project.raidItems.filter((r) => r.status === "open");
  const raidSeverity = openRaid.length === 0
    ? 0
    : clamp((openRaid.reduce((s, r) => s + (r.probability ?? 3) * (r.impact ?? 3), 0) / openRaid.length / 25) * 100);
  const blockedItems = project.workItems.filter((w) => w.status === "blocked").length;
  const dependencySeverity = project.workItems.length === 0
    ? 0
    : clamp((blockedItems / project.workItems.length) * 100);
  const benefitSeverity = clamp(100 - (project.program?.benefitPct ?? 50));
  const scopeSeverity = clamp(openRaid.filter((r) => r.category === "scope" || r.category === "issue").length * 15);

  const drivers: HealthDriverInput[] = [
    { name: "schedule_variance", severity: scheduleSeverity, trend: trendFor(project.spi, 1) },
    { name: "cost_variance", severity: costSeverity, trend: trendFor(project.cpi, 1) },
    { name: "scope_creep", severity: scopeSeverity, trend: "flat" },
    { name: "raid_exposure", severity: raidSeverity, trend: openRaid.length > 2 ? "worsening" : "flat" },
    { name: "dependency_risk", severity: dependencySeverity, trend: blockedItems > 0 ? "worsening" : "flat" },
    { name: "benefit_confidence", severity: benefitSeverity, trend: "flat" },
    { name: "team_health", severity: 25, trend: "flat" },
  ];
  const health = computeHealth(project.id, drivers, now).result;

  // Active cadence: the one covering "now", falling back to the most recently ended one.
  const activeCadence =
    project.cadences.find((c) => c.startDate <= now && now <= c.endDate) ??
    [...project.cadences].sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] ??
    null;
  const sprint = activeCadence
    ? computeSprint(
        activeCadence.workItems.map((w) => ({ status: w.status, estimate: w.estimate })),
        activeCadence.id,
        now,
      ).result
    : null;

  return {
    id: project.id,
    name: project.name,
    methodology: project.methodology.name,
    program: project.program?.name ?? null,
    status: project.status,
    health: health.composite,
    drivers: health.drivers,
    primaryDriver: health.primaryDriver,
    next: project.nextMilestone ?? "",
    source: project.sourceLabel ?? "",
    spi: project.spi ?? null,
    cpi: project.cpi ?? null,
    sprint: sprint ? { cadenceId: activeCadence!.id, cadenceName: activeCadence!.name, ...sprint } : null,
    baselines: project.baselines.map((b) => ({
      id: b.id,
      type: b.type,
      capturedOn: b.capturedOn,
      snapshot: safeJsonParse(b.snapshot),
    })),
    raidItems: project.raidItems.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
    })),
    phases: project.phases.map((p) => ({
      id: p.id,
      name: p.name,
      sequence: p.sequence,
      status: p.status,
      gate: p.gate ? { id: p.gate.id, name: p.gate.name, decision: p.gate.decision, decisionDate: p.gate.decisionDate } : null,
    })),
  };
}
export const getProjectView = (id: string) => buildProjectView(db(), id);

// ============================== Programs ==============================

export async function buildProgramsView(prisma: PrismaClient) {
  const programs = await prisma.program.findMany({
    include: { projects: true, benefits: true, portfolio: true },
    orderBy: { name: "asc" },
  });
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    portfolio: p.portfolio.name,
    status: p.status,
    methodology: p.methodology ?? "",
    health: p.benefitPct ?? 0,
    benefitPct: p.benefitPct ?? 0,
    targetEnd: p.targetEnd,
    projectCount: p.projects.length,
    benefits: p.benefits.map((b) => ({
      id: b.id,
      name: b.name,
      metric: b.metric ?? "",
      baselineValue: b.baselineValue ?? null,
      targetValue: b.targetValue ?? null,
      realizationStatus: b.realizationStatus,
    })),
  }));
}
export const getProgramsView = () => buildProgramsView(db());

// ============================== Prioritize ==============================

export async function buildPrioritizeView(prisma: PrismaClient, model: "WSJF" | "RICE") {
  const backlog = await prisma.backlogItem.findMany({ include: { workItem: true }, orderBy: { rank: "asc" } });
  const items = backlog.map((b) => ({
    id: b.workItemId,
    title: b.workItem.title,
    estimate: b.workItem.estimate,
    wsjf: { userBusinessValue: b.wsjfUserBusinessValue ?? 0, timeCriticality: b.wsjfTimeCriticality ?? 0, riskReduction: b.wsjfRiskReduction ?? 0 },
    rice: { reach: b.riceReach ?? 0, impact: b.riceImpact ?? 0, confidence: b.riceConfidence ?? 0, effort: b.riceEffort ?? 1 },
  }));
  const scores: PriorityScore[] = (model === "WSJF" ? new WsjfStrategy() : new RiceStrategy()).rank(items, NOW()).result;
  const titleById = new Map(items.map((i) => [i.id, i.title]));
  return { model, rows: scores.map((s) => ({ id: s.id, title: titleById.get(s.id) ?? s.id, value: s.value, components: s.components })) };
}
export const getPrioritizeView = (model: "WSJF" | "RICE") => buildPrioritizeView(db(), model);

// ============================== Today ==============================

export async function buildTodayView(prisma: PrismaClient) {
  const now = NOW();

  const [cadenceRows, workItemsHigh, stakeholderRows, people, gateRows, deployments, meetingsRows, seededRows] =
    await Promise.all([
      prisma.cadence.findMany({ include: { workItems: true } }),
      prisma.workItem.findMany({ where: { complexityBand: "high" }, include: { assignee: true } }),
      prisma.stakeholder.findMany(),
      prisma.person.findMany({ include: { oneOnOnes: true } }),
      prisma.gate.findMany({ include: { phase: { include: { project: true } } } }),
      prisma.deployment.findMany({ include: { release: true } }),
      prisma.calendarEvent.findMany({ orderBy: { start: "asc" } }),
      prisma.suggestedAction.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  const snapshot: CanonicalSnapshot = {
    now,
    cadences: cadenceRows.map((c) => ({
      id: c.id,
      name: c.name,
      endDate: c.endDate,
      openStoryCount: c.workItems.filter((w) => w.status !== "done").length,
    })),
    complexItems: workItemsHigh.map((w) => ({
      id: w.id,
      title: w.title,
      assignee: w.assignee?.name ?? "Unassigned",
      daysSinceStatusChange: Math.max(0, Math.round((now.getTime() - (w.lastStatusChangeAt ?? w.createdAt).getTime()) / 86_400_000)),
    })),
    stakeholders: stakeholderRows.map((s) => ({ id: s.id, name: s.name, nextDue: s.nextDue, cares: s.caresAbout ?? "" })),
    oneOnOnes: people.map((p) => ({
      personId: p.id,
      personName: p.name,
      lastMet: p.oneOnOnes.reduce<Date | null>((latest, o) => (latest == null || o.metOn > latest ? o.metOn : latest), null),
      cadenceDays: DEFAULT_ONE_ON_ONE_CADENCE_DAYS,
    })),
    // Deliverable-acceptance tracking isn't modeled yet — synthesized as 0 (no data to report).
    gates: gateRows.map((g) => ({
      projectId: g.phase.project.id,
      name: g.name,
      deadline: g.decisionDate ?? now,
      unacceptedDeliverables: 0,
    })),
    deployments: deployments.map((d) => ({ id: d.id, releaseVersion: d.release.version, status: d.status })),
    meetings: meetingsRows.map((m) => ({ title: m.title, start: m.start, linkLabel: m.linkLabel ?? null })),
  };

  const derivedActions = runSpecificationRules(snapshot);
  const seededActions: SuggestedAction[] = seededRows.map((r) => ({
    type: r.type as SuggestedAction["type"],
    urgency: r.urgency as SuggestedAction["urgency"],
    text: r.text,
    refType: r.refType ?? "unknown",
    refId: r.refId ?? "",
  }));
  // Prefer the seeded suggested_action rows (matches the POC's 7 curated actions) and fall
  // back to the rule-derived ones when no rows exist (e.g. against a freshly-seeded org).
  const actions = seededActions.length > 0 ? seededActions : derivedActions;
  const brief = buildDailyBrief(actions, now, MANAGER_NAME).result;

  return {
    managerName: MANAGER_NAME,
    brief,
    actions: brief.rankedActions,
    meetings: meetingsRows.map((m) => ({ id: m.id, title: m.title, start: m.start, end: m.end, isFreeTime: m.isFreeTime, linkLabel: m.linkLabel ?? null })),
  };
}
export const getTodayView = () => buildTodayView(db());

// ============================== Releases / DORA ==============================

export async function buildReleasesView(prisma: PrismaClient) {
  const releases = await prisma.release.findMany({
    include: { project: true, deployments: { include: { environment: true }, orderBy: { startedAt: "asc" } } },
    orderBy: { targetDate: "asc" },
  });
  return releases.map((r) => ({
    id: r.id,
    version: r.version,
    name: r.name ?? r.version,
    project: r.project.name,
    status: r.status,
    targetDate: r.targetDate,
    releasedAt: r.releasedAt,
    environments: r.deployments.map((d) => ({ environment: d.environment.name, status: d.status, leadTimeMinutes: d.leadTimeMinutes })),
  }));
}
export const getReleasesView = () => buildReleasesView(db());

export async function buildDoraView(prisma: PrismaClient) {
  const deps = await prisma.deployment.findMany({ include: { environment: true } });
  return computeDora(
    deps.map((d) => ({ environment: d.environment.name, status: d.status, leadTimeMinutes: d.leadTimeMinutes, isRollback: d.rollbackOfId != null })),
    NOW(),
  ).result;
}
export const getDoraView = () => buildDoraView(db());

// ============================== Team / People ==============================

export async function buildTeamView(prisma: PrismaClient) {
  const people = await prisma.person.findMany({
    where: { active: true },
    include: { allocations: true, skillObservations: true, oneOnOnes: true, team: true },
    orderBy: { name: "asc" },
  });
  const allAllocations = people.flatMap((p) => p.allocations.map((a) => ({ personId: p.name, pct: a.pct, source: a.sourceLabel ?? "?" })));
  const loadByName = new Map<string, PersonLoad>(computeLoads(allAllocations, NOW()).result.map((l) => [l.personId, l]));

  return people.map((p) => {
    const load = loadByName.get(p.name);
    const lastOneOnOne = p.oneOnOnes.reduce<Date | null>((latest, o) => (latest == null || o.metOn > latest ? o.metOn : latest), null);
    return {
      id: p.id,
      name: p.name,
      role: p.role ?? "",
      team: p.team?.name ?? null,
      flowNote: p.flowNote ?? "",
      totalPct: load?.totalPct ?? 0,
      overallocated: load?.overallocated ?? false,
      bySource: load?.bySource ?? [],
      skills: p.skillObservations.map((s) => ({ skill: s.skill, proficiency: s.proficiency, interest: s.interest })),
      lastOneOnOne,
    };
  });
}
export const getTeamView = () => buildTeamView(db());

export async function buildPersonView(prisma: PrismaClient, id: string) {
  const person = await prisma.person.findUniqueOrThrow({
    where: { id },
    include: {
      team: true,
      allocations: true,
      skillObservations: true,
      velocityInsights: true,
      teammateNotes: true,
      oneOnOnes: { orderBy: { metOn: "desc" } },
    },
  });
  const load = computeLoads(
    person.allocations.map((a) => ({ personId: person.name, pct: a.pct, source: a.sourceLabel ?? "?" })),
    NOW(),
  ).result[0];

  return {
    id: person.id,
    name: person.name,
    role: person.role ?? "",
    email: person.email,
    team: person.team?.name ?? null,
    flowNote: person.flowNote ?? "",
    totalPct: load?.totalPct ?? 0,
    overallocated: load?.overallocated ?? false,
    bySource: load?.bySource ?? [],
    skills: person.skillObservations.map((s) => ({ skill: s.skill, proficiency: s.proficiency, interest: s.interest })),
    velocityInsights: person.velocityInsights.map((v) => ({ dimension: v.dimension, band: v.band, throughput: v.throughput, caveat: v.caveat ?? null })),
    notes: person.teammateNotes.map((n) => ({
      id: n.id,
      category: n.category,
      content: n.content,
      howToSupport: n.howToSupport ?? null,
      sensitive: n.sensitive,
      updatedAt: n.updatedAt,
    })),
    oneOnOnes: person.oneOnOnes.map((o) => ({ id: o.id, metOn: o.metOn, talkingPoints: o.talkingPoints ?? null, followUps: o.followUps ?? null })),
  };
}
export const getPersonView = (id: string) => buildPersonView(db(), id);

// ============================== Stakeholders ==============================

export async function buildStakeholdersView(prisma: PrismaClient) {
  const stakeholders = await prisma.stakeholder.findMany({
    include: { interests: true, communications: { orderBy: { occurredOn: "desc" } } },
    orderBy: { influence: "desc" },
  });
  return stakeholders.map((s) => ({
    id: s.id,
    name: s.name,
    org: s.org ?? null,
    role: s.role ?? "",
    influence: s.influence,
    interest: s.interest,
    stance: s.stance,
    preferredChannel: s.preferredChannel ?? null,
    updateCadence: s.updateCadence ?? null,
    nextDue: s.nextDue,
    caresAbout: s.caresAbout ?? "",
    interests: s.interests.map((i) => ({ ownerType: i.ownerType, ownerId: i.ownerId, reason: i.reason ?? null })),
    lastCommunication: s.communications[0] ? { occurredOn: s.communications[0].occurredOn, summary: s.communications[0].summary ?? null } : null,
  }));
}
export const getStakeholdersView = () => buildStakeholdersView(db());

// ============================== Inbox ==============================

export async function buildInboxView(prisma: PrismaClient) {
  const emails = await prisma.emailMessage.findMany({ orderBy: { receivedAt: "desc" } });
  return {
    unreadCount: emails.filter((e) => e.isUnread).length,
    emails: emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.fromEmail,
      snippet: e.snippet,
      receivedAt: e.receivedAt,
      isUnread: e.isUnread,
      kind: e.kind ?? null,
      linkLabel: e.linkLabel ?? null,
    })),
  };
}
export const getInboxView = () => buildInboxView(db());

// ============================== Intelligence (AI cost/cache layer) ==============================

export async function buildIntelView(prisma: PrismaClient) {
  const [aiTaskCount, featureRecordCount, cacheEntries] = await Promise.all([
    prisma.aiTask.count(),
    prisma.featureRecord.count(),
    prisma.aiResultCache.findMany(),
  ]);
  const tokensUsed = cacheEntries.reduce((s, c) => s + c.tokensUsed, 0);
  const tokensSaved = cacheEntries.reduce((s, c) => s + c.tokensSaved, 0);
  const tierCounts = new Map<string, number>();
  for (const c of cacheEntries) tierCounts.set(c.resolutionTier, (tierCounts.get(c.resolutionTier) ?? 0) + 1);

  return {
    // No AiTask rows are seeded this phase — the Intelligence page should render a
    // "projected / no live AI calls yet" state rather than fabricated metrics.
    hasLiveData: aiTaskCount > 0,
    aiTaskCount,
    featureRecordCount,
    cacheEntryCount: cacheEntries.length,
    tokensUsed,
    tokensSaved,
    resolutionTiers: [...tierCounts.entries()].map(([tier, count]) => ({ tier, count })),
  };
}
export const getIntelView = () => buildIntelView(db());

// ============================== Connections ==============================

export async function buildConnectionsView(prisma: PrismaClient) {
  const systems = await prisma.externalSystem.findMany({ include: { connections: true } });
  return systems.map((s) => ({
    id: s.id,
    vendor: s.vendor,
    baseUrl: s.baseUrl ?? null,
    connections: s.connections.map((c) => ({
      id: c.id,
      direction: c.direction,
      lastPulledAt: c.lastPulledAt,
      authRef: c.authRef,
    })),
  }));
}
export const getConnectionsView = () => buildConnectionsView(db());

// ============================== Vault ==============================

export async function buildVaultView(prisma: PrismaClient) {
  // The vault represents the local encrypted export file, not a Prisma-modeled entity —
  // there is no Vault table. We surface a row count across the canonical model as a stand-in
  // for "how much is in the vault" so the page reflects real data volume rather than fiction.
  const [projects, workItems, people, stakeholders] = await Promise.all([
    prisma.project.count(),
    prisma.workItem.count(),
    prisma.person.count(),
    prisma.stakeholder.count(),
  ]);
  const recordCount = projects + workItems + people + stakeholders;
  return {
    path: "~/PM-Vault/workspace.vault",
    encrypted: true,
    recordCount,
    lastEnriched: null as Date | null,
  };
}
export const getVaultView = () => buildVaultView(db());

// ============================== helpers ==============================

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function trendFor(value: number | null, target: number): "improving" | "flat" | "worsening" {
  if (value == null) return "flat";
  if (Math.abs(value - target) < 0.02) return "flat";
  return value < target ? "worsening" : "improving";
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
