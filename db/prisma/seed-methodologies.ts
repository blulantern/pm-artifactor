import type { PrismaClient } from "@prisma/client";

interface Bundle {
  key: string;
  name: string;
  family: string;
  isIterative: boolean;
  types: { name: string; level: number; unit: string }[];
  phases: { name: string; gate: boolean }[];
  states: { name: string; category: string }[];
  transitions: { from: string; to: string; name: string; approval?: boolean }[];
}

const BUNDLES: Bundle[] = [
  {
    key: "SCRUM", name: "Scrum", family: "agile", isIterative: true,
    types: [
      { name: "Epic", level: 1, unit: "points" },
      { name: "Story", level: 2, unit: "points" },
      { name: "Task", level: 3, unit: "points" },
    ],
    phases: [{ name: "Sprint", gate: false }],
    states: [
      { name: "To Do", category: "todo" },
      { name: "In Progress", category: "in_progress" },
      { name: "Done", category: "done" },
    ],
    transitions: [
      { from: "To Do", to: "In Progress", name: "start" },
      { from: "In Progress", to: "Done", name: "finish" },
    ],
  },
  {
    key: "SAFE", name: "SAFe", family: "agile", isIterative: true,
    types: [
      { name: "Portfolio Epic", level: 1, unit: "points" },
      { name: "Feature", level: 2, unit: "points" },
      { name: "Story", level: 3, unit: "points" },
    ],
    phases: [{ name: "PI Planning", gate: true }, { name: "Execution", gate: false }, { name: "Inspect & Adapt", gate: true }],
    states: [
      { name: "Funnel", category: "todo" },
      { name: "Implementing", category: "in_progress" },
      { name: "Done", category: "done" },
    ],
    transitions: [
      { from: "Funnel", to: "Implementing", name: "pull" },
      { from: "Implementing", to: "Done", name: "complete" },
    ],
  },
  {
    key: "WATERFALL", name: "Waterfall", family: "traditional", isIterative: false,
    types: [
      { name: "Work Package", level: 1, unit: "days" },
      { name: "Activity", level: 2, unit: "days" },
      { name: "Task", level: 3, unit: "days" },
    ],
    phases: [
      { name: "Initiate", gate: true }, { name: "Plan", gate: true },
      { name: "Execute", gate: true }, { name: "Monitor", gate: false }, { name: "Close", gate: true },
    ],
    states: [
      { name: "Not Started", category: "todo" },
      { name: "In Progress", category: "in_progress" },
      { name: "Complete", category: "done" },
    ],
    transitions: [
      { from: "Not Started", to: "In Progress", name: "begin" },
      { from: "In Progress", to: "Complete", name: "complete", approval: true },
    ],
  },
  {
    key: "DMAIC", name: "DMAIC", family: "lean", isIterative: false,
    types: [
      { name: "Improvement Charter", level: 1, unit: "days" },
      { name: "Root Cause", level: 2, unit: "days" },
      { name: "Corrective Action", level: 3, unit: "days" },
    ],
    phases: [
      { name: "Define", gate: true }, { name: "Measure", gate: true }, { name: "Analyze", gate: true },
      { name: "Improve", gate: true }, { name: "Control", gate: true },
    ],
    states: [
      { name: "Open", category: "todo" },
      { name: "Investigating", category: "in_progress" },
      { name: "Controlled", category: "done" },
    ],
    transitions: [
      { from: "Open", to: "Investigating", name: "investigate" },
      { from: "Investigating", to: "Controlled", name: "control", approval: true },
    ],
  },
];

export async function seedMethodologies(prisma: PrismaClient): Promise<void> {
  for (const b of BUNDLES) {
    const existing = await prisma.methodology.findUnique({ where: { key: b.key } });
    if (existing) continue;

    const meth = await prisma.methodology.create({
      data: { key: b.key, name: b.name, family: b.family, isIterative: b.isIterative },
    });
    const lifecycle = await prisma.lifecycle.create({
      data: { methodologyId: meth.id, name: b.name },
    });
    await prisma.lifecyclePhase.createMany({
      data: b.phases.map((p, i) => ({
        lifecycleId: lifecycle.id, name: p.name, sequence: i, gateRequired: p.gate,
      })),
    });
    await prisma.workItemType.createMany({
      data: b.types.map((t) => ({
        methodologyId: meth.id, name: t.name, hierarchyLevel: t.level, defaultEstimateUnit: t.unit,
      })),
    });
    const wf = await prisma.workflowDefinition.create({ data: { methodologyId: meth.id } });
    const stateIds = new Map<string, string>();
    for (let i = 0; i < b.states.length; i++) {
      const s = b.states[i]!;
      const created = await prisma.workflowState.create({
        data: { workflowDefinitionId: wf.id, name: s.name, category: s.category, order: i },
      });
      stateIds.set(s.name, created.id);
    }
    for (const t of b.transitions) {
      await prisma.stateTransition.create({
        data: {
          fromStateId: stateIds.get(t.from)!,
          toStateId: stateIds.get(t.to)!,
          name: t.name,
          requiresApproval: t.approval ?? false,
        },
      });
    }
  }
}
