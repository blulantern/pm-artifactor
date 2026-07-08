import {
  type CanonicalSnapshot, type SuggestedAction, daysBetween,
} from "./suggested-action.js";

export interface RuleOptions {
  sprintEndWithinDays?: number;
  complexQuietDays?: number;
  stakeholderDueWithinDays?: number;
}

export function runSpecificationRules(snap: CanonicalSnapshot, opts: RuleOptions = {}): SuggestedAction[] {
  const sprintWindow = opts.sprintEndWithinDays ?? 3;
  const complexQuiet = opts.complexQuietDays ?? 3;
  const stakeholderWindow = opts.stakeholderDueWithinDays ?? 2;
  return [
    ...sprintEnd(snap, sprintWindow),
    ...complexCheckIn(snap, complexQuiet),
    ...stakeholderDue(snap, stakeholderWindow),
    ...oneOnOneOverdue(snap),
    ...gateDeadline(snap),
    ...deployAttention(snap),
    ...meetingPrep(snap),
  ];
}

export function sprintEnd(snap: CanonicalSnapshot, withinDays: number): SuggestedAction[] {
  return snap.cadences
    .filter((c) => {
      const d = daysBetween(c.endDate, snap.now);
      return d >= 0 && d <= withinDays && c.openStoryCount > 0;
    })
    .map((c) => ({
      type: "sprint_end" as const, urgency: "high" as const,
      text: `${c.name} ends soon — ${c.openStoryCount} stories still open`,
      refType: "cadence", refId: c.id,
    }));
}

export function complexCheckIn(snap: CanonicalSnapshot, quietDays: number): SuggestedAction[] {
  return snap.complexItems
    .filter((i) => i.daysSinceStatusChange >= quietDays)
    .map((i) => ({
      type: "complex_check_in" as const, urgency: "low" as const,
      text: `Check in on ${i.title} — high-complexity, quiet ${i.daysSinceStatusChange} days (${i.assignee})`,
      refType: "work_item", refId: i.id,
    }));
}

export function stakeholderDue(snap: CanonicalSnapshot, withinDays: number): SuggestedAction[] {
  return snap.stakeholders
    .filter((s) => s.nextDue != null && daysBetween(s.nextDue, snap.now) >= 0 && daysBetween(s.nextDue, snap.now) <= withinDays)
    .map((s) => ({
      type: "stakeholder_update_due" as const, urgency: "med" as const,
      text: `Draft ${s.name}'s update (tracks ${s.cares})`,
      refType: "stakeholder", refId: s.id,
    }));
}

export function oneOnOneOverdue(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.oneOnOnes
    .filter((o) => o.lastMet == null || daysBetween(snap.now, o.lastMet) > o.cadenceDays)
    .map((o) => ({
      type: "one_on_one_overdue" as const, urgency: "med" as const,
      text: `You haven't met ${o.personName} recently — schedule a 1:1`,
      refType: "person", refId: o.personId,
    }));
}

export function gateDeadline(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.gates
    .filter((g) => daysBetween(g.deadline, snap.now) >= 0)
    .map((g) => ({
      type: "gate_deadline" as const, urgency: "med" as const,
      text: `${g.name} review approaches — ${g.unacceptedDeliverables} deliverables unaccepted`,
      refType: "project", refId: g.projectId,
    }));
}

export function deployAttention(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.deployments
    .filter((d) => d.status === "failed" || d.status === "rolled_back")
    .map((d) => ({
      type: "deploy_attention" as const, urgency: "high" as const,
      text: `${d.releaseVersion} ${d.status} — MTTR clock running`,
      refType: "deployment", refId: d.id,
    }));
}

export function meetingPrep(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.meetings
    .filter((m) => m.linkLabel != null && daysBetween(m.start, snap.now) >= 0)
    .map((m) => ({
      type: "meeting_prep" as const, urgency: "med" as const,
      text: `${m.title} soon — prep note for ${m.linkLabel}`,
      refType: "meeting", refId: m.title,
    }));
}
