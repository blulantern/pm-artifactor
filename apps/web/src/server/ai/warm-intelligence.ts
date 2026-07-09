import type { PrismaClient } from "@prisma/client";
import {
  WsjfStrategy,
  RiceStrategy,
  computeLoads,
  computeDora,
  computeHealth,
  computeSprint,
  type FeatureRecord,
  type HealthDriverInput,
  type ScorableItem,
  type DriverName,
  type Trend,
} from "@pma/core";
import type { AIPort } from "@pma/core";
import Anthropic from "@anthropic-ai/sdk";
import { TemplateAIPort } from "./template-ai-port.js";
import { ClaudeAIPort } from "./claude-ai-port.js";
import { ClaudeCodeAIPort } from "./claude-code-ai-port.js";
import { PrismaAICacheStore, logAiTask } from "./prisma-ai-store.js";
import { ResolutionLadder } from "./resolution-ladder.js";
import { persistFeatures } from "./feature-persistence.js";

/** Manager display name for the daily brief — no per-user account model exists yet (matches view-models.ts). */
const MANAGER_NAME = "Alex";

/**
 * Selects the AIPort delegate behind the resolution ladder. The provider is
 * interchangeable behind the shared AIPort contract:
 *
 *   PMA_AI_PROVIDER=template     — deterministic template only (no model calls)
 *   PMA_AI_PROVIDER=anthropic    — live Claude over the metered Messages API (needs ANTHROPIC_API_KEY)
 *   PMA_AI_PROVIDER=claude-code  — your logged-in Claude Code CLI (subscription; local/testing only)
 *   (unset)                      — auto: anthropic when ANTHROPIC_API_KEY is set, else template
 *
 * Every provider falls back per-task to the deterministic template on any failure, so
 * the app stays correct and always grounded regardless of the choice. A new provider
 * (e.g. OpenAI) is a new GroundedLLMPort subclass added to this switch — nothing else changes.
 */
export function delegateFor(env: Record<string, string | undefined> = process.env): AIPort {
  const template = new TemplateAIPort();
  const provider = env.PMA_AI_PROVIDER?.toLowerCase();

  switch (provider) {
    case "template":
      return template;
    case "claude-code":
      return new ClaudeCodeAIPort(template);
    case "anthropic":
      return anthropicOrTemplate(template, env);
    case undefined:
    case "":
      // Back-compat default: a key means the metered API, otherwise the template.
      return env.ANTHROPIC_API_KEY ? anthropicOrTemplate(template, env) : template;
    default:
      return template;
  }
}

/** Constructs the metered-API adapter when a key is present, else the deterministic template. */
function anthropicOrTemplate(template: AIPort, env: Record<string, string | undefined>): AIPort {
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new ClaudeAIPort(new Anthropic({ apiKey }), template) : template;
}

/** Wires the Prisma-backed cache store behind the resolution ladder for app use. */
export function aiPort(prisma: PrismaClient): ResolutionLadder {
  return new ResolutionLadder(delegateFor(), new PrismaAICacheStore(prisma));
}

export interface WarmIntelligenceResult {
  features: number;
  aiTasks: number;
}

/**
 * Runs the deterministic analyzers over the seeded data, persisting every emitted
 * FeatureRecord, then exercises each generative AI task twice through the resolution
 * ladder (first call = llm miss, second identical call = exact_cache hit), logging
 * every resolution as an AiTask row. This produces the real feature + AiTask corpus
 * the Intelligence page reads.
 */
export async function warmIntelligence(prisma: PrismaClient): Promise<WarmIntelligenceResult> {
  const now = new Date();
  const allFeatures: FeatureRecord[] = [];

  // ---- 1. Deterministic analyzers over seeded data --------------------------------

  // Prioritization: WSJF + RICE over the backlog.
  const backlogRows = await prisma.backlogItem.findMany({ include: { workItem: true } });
  const scorable: ScorableItem[] = backlogRows.map((b) => ({
    id: b.workItemId,
    title: b.workItem.title,
    estimate: b.workItem.estimate,
    wsjf: {
      userBusinessValue: b.wsjfUserBusinessValue ?? 0,
      timeCriticality: b.wsjfTimeCriticality ?? 0,
      riskReduction: b.wsjfRiskReduction ?? 0,
    },
    rice: {
      reach: b.riceReach ?? 0,
      impact: b.riceImpact ?? 0,
      confidence: b.riceConfidence ?? 0,
      effort: b.riceEffort ?? 1,
    },
  }));
  if (scorable.length > 0) {
    allFeatures.push(...new WsjfStrategy().rank(scorable, now).features);
    allFeatures.push(...new RiceStrategy().rank(scorable, now).features);
  }

  // Capacity: loads over allocations.
  const allocations = await prisma.allocation.findMany({ include: { person: true } });
  if (allocations.length > 0) {
    allFeatures.push(
      ...computeLoads(
        allocations.map((a) => ({ personId: a.person.id, pct: a.pct, source: a.sourceLabel ?? "?" })),
        now,
      ).features,
    );
  }

  // DORA over deployments.
  const deployments = await prisma.deployment.findMany({ include: { environment: true } });
  if (deployments.length > 0) {
    allFeatures.push(
      ...computeDora(
        deployments.map((d) => ({
          environment: d.environment.name,
          status: d.status,
          leadTimeMinutes: d.leadTimeMinutes,
          isRollback: d.rollbackOfId != null,
        })),
        now,
      ).features,
    );
  }

  // Health per project — synthesized driver severities from materialized project fields,
  // same heuristic as view-models.ts buildProjectView (no separate health-driver table exists).
  const projects = await prisma.project.findMany({
    include: { program: true, workItems: true, raidItems: true },
  });
  let sampleHealth: {
    id: string;
    name: string;
    composite: number;
    drivers: { name: DriverName; severity: number; trend: Trend }[];
  } | null = null;
  for (const project of projects) {
    const drivers = synthesizeDrivers(project);
    const healthResult = computeHealth(project.id, drivers, now);
    allFeatures.push(...healthResult.features);
    if (!sampleHealth) {
      sampleHealth = {
        id: project.id,
        name: project.name,
        composite: healthResult.result.composite,
        drivers: healthResult.result.drivers,
      };
    }
  }

  // Sprint over the active cadence's work items (same "covers now, else most recently
  // ended" fallback as view-models.ts buildProjectView).
  const cadences = await prisma.cadence.findMany({ include: { workItems: true } });
  const activeCadence =
    cadences.find((c) => c.startDate <= now && now <= c.endDate) ??
    [...cadences].sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] ??
    null;
  if (activeCadence) {
    allFeatures.push(
      ...computeSprint(
        activeCadence.workItems.map((w) => ({ status: w.status, estimate: w.estimate })),
        activeCadence.id,
        now,
      ).features,
    );
  }

  const featureCount = await persistFeatures(prisma, allFeatures);

  // ---- 2. Generative tasks through the resolution ladder (miss, then hit) ---------

  const ladder = aiPort(prisma);
  let aiTasks = 0;

  const runTwice = async (task: string, input: unknown) => {
    for (let i = 0; i < 2; i++) {
      const outcome = await ladder.resolve(task, input);
      await logAiTask(prisma, task, outcome);
      aiTasks++;
    }
  };

  // daily-brief.compose — from the seeded SuggestedAction rows.
  const suggestedActionRows = await prisma.suggestedAction.findMany({ orderBy: { createdAt: "asc" } });
  const dailyBriefInput = {
    date: now.toISOString().slice(0, 10),
    manager_name: MANAGER_NAME,
    suggested_actions: suggestedActionRows.map((a) => ({
      id: a.id,
      type: a.type,
      urgency: a.urgency,
      text: a.text,
      refs: a.refId ? [a.refId] : [],
    })),
  };
  await runTwice("daily-brief.compose", dailyBriefInput);

  // health.explain — for one project (reuse the first project's computed health).
  if (sampleHealth) {
    const healthInput = {
      entity: { id: sampleHealth.id, type: "project" as const, name: sampleHealth.name },
      composite: sampleHealth.composite,
      drivers: sampleHealth.drivers.map((d) => ({ name: d.name, value: d.severity, trend: d.trend })),
    };
    await runTwice("health.explain", healthInput);
  }

  // stakeholder.update — one stakeholder + its interest items.
  const stakeholder = await prisma.stakeholder.findFirst({
    where: { interests: { some: {} } },
    include: { interests: true },
  });
  if (stakeholder) {
    const items = await Promise.all(
      stakeholder.interests.map(async (interest) => {
        const owner = await resolveOwner(prisma, interest.ownerType, interest.ownerId);
        return {
          id: interest.id,
          name: owner.name,
          status: owner.status,
          reason_invested: interest.reason ?? null,
        };
      }),
    );
    const stakeholderInput = {
      stakeholder: { id: stakeholder.id, name: stakeholder.name, interest_level: interestLevelFor(stakeholder.interest) },
      items,
    };
    await runTwice("stakeholder.update", stakeholderInput);
  }

  // email.digest — seeded emails mapped to the EmailMessageEnvelope shape.
  const emails = await prisma.emailMessage.findMany({ orderBy: { receivedAt: "desc" } });
  if (emails.length > 0) {
    const pulledAt = now.toISOString();
    const emailInput = {
      messages: emails.map((e) => ({
        provenance: {
          source: "gmail" as const,
          external_id: e.id,
          pulled_at: pulledAt,
          mode: "read_only" as const,
        },
        thread_id: e.threadId ?? undefined,
        subject: e.subject,
        from_email: e.fromEmail,
        received_at: e.receivedAt.toISOString(),
        snippet: e.snippet,
      })),
    };
    await runTwice("email.digest", emailInput);
  }

  return { features: featureCount, aiTasks };
}

// ============================== helpers ==============================

interface ProjectForHealth {
  id: string;
  spi: number | null;
  cpi: number | null;
  raidItems: { status: string; category: string; probability: number | null; impact: number | null }[];
  workItems: { status: string }[];
  program: { benefitPct: number | null } | null;
}

/** Synthesizes plausible driver severities/trends from the materialized Project row —
 * mirrors the heuristic in view-models.ts buildProjectView (there is no separate
 * "health driver" table). */
function synthesizeDrivers(project: ProjectForHealth): HealthDriverInput[] {
  const scheduleSeverity = project.spi != null ? clamp((1 - project.spi) * 100) : 0;
  const costSeverity = project.cpi != null ? clamp((1 - project.cpi) * 100) : 0;
  const openRaid = project.raidItems.filter((r) => r.status === "open");
  const raidSeverity =
    openRaid.length === 0
      ? 0
      : clamp((openRaid.reduce((s, r) => s + (r.probability ?? 3) * (r.impact ?? 3), 0) / openRaid.length / 25) * 100);
  const blockedItems = project.workItems.filter((w) => w.status === "blocked").length;
  const dependencySeverity = project.workItems.length === 0 ? 0 : clamp((blockedItems / project.workItems.length) * 100);
  const benefitSeverity = clamp(100 - (project.program?.benefitPct ?? 50));
  const scopeSeverity = clamp(openRaid.filter((r) => r.category === "issue").length * 15);

  return [
    { name: "schedule_variance", severity: scheduleSeverity, trend: trendFor(project.spi, 1) },
    { name: "cost_variance", severity: costSeverity, trend: trendFor(project.cpi, 1) },
    { name: "scope_creep", severity: scopeSeverity, trend: "flat" },
    { name: "raid_exposure", severity: raidSeverity, trend: openRaid.length > 2 ? "worsening" : "flat" },
    { name: "dependency_risk", severity: dependencySeverity, trend: blockedItems > 0 ? "worsening" : "flat" },
    { name: "benefit_confidence", severity: benefitSeverity, trend: "flat" },
    { name: "team_health", severity: 25, trend: "flat" },
  ];
}

async function resolveOwner(
  prisma: PrismaClient,
  ownerType: string,
  ownerId: string,
): Promise<{ name: string; status: string }> {
  if (ownerType === "project") {
    const project = await prisma.project.findUnique({ where: { id: ownerId } });
    if (project) return { name: project.name, status: project.status };
  } else if (ownerType === "program") {
    const program = await prisma.program.findUnique({ where: { id: ownerId } });
    if (program) return { name: program.name, status: program.status };
  } else if (ownerType === "benefit") {
    const benefit = await prisma.benefit.findUnique({ where: { id: ownerId } });
    if (benefit) return { name: benefit.name, status: benefit.realizationStatus };
  } else if (ownerType === "strategic_objective") {
    const objective = await prisma.strategicObjective.findUnique({ where: { id: ownerId } });
    if (objective) return { name: objective.title, status: "active" };
  } else if (ownerType === "work_item") {
    const workItem = await prisma.workItem.findUnique({ where: { id: ownerId } });
    if (workItem) return { name: workItem.title, status: workItem.status };
  }
  return { name: ownerId, status: "unknown" };
}

function interestLevelFor(interest: number): "manage_closely" | "keep_satisfied" | "keep_informed" | "monitor" {
  if (interest >= 4) return "manage_closely";
  if (interest >= 3) return "keep_satisfied";
  if (interest >= 2) return "keep_informed";
  return "monitor";
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function trendFor(value: number | null, target: number): Trend {
  if (value == null) return "flat";
  if (Math.abs(value - target) < 0.02) return "flat";
  return value < target ? "worsening" : "improving";
}
