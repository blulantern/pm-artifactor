export type ActionType =
  | "sprint_end" | "complex_check_in" | "stakeholder_update_due"
  | "one_on_one_overdue" | "gate_deadline" | "deploy_attention" | "meeting_prep";
export type Urgency = "low" | "med" | "high";

export interface SuggestedAction {
  type: ActionType;
  urgency: Urgency;
  text: string;
  refType: string;
  refId: string;
}

export interface CanonicalSnapshot {
  now: Date;
  cadences: { id: string; name: string; endDate: Date; openStoryCount: number }[];
  complexItems: { id: string; title: string; assignee: string; daysSinceStatusChange: number }[];
  stakeholders: { id: string; name: string; nextDue: Date | null; cares: string }[];
  oneOnOnes: { personId: string; personName: string; lastMet: Date | null; cadenceDays: number }[];
  gates: { projectId: string; name: string; deadline: Date; unacceptedDeliverables: number }[];
  deployments: { id: string; releaseVersion: string; status: string }[];
  meetings: { title: string; start: Date; linkLabel: string | null }[];
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const daysBetween = (a: Date, b: Date): number => (a.getTime() - b.getTime()) / DAY_MS;
