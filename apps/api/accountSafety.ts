import type {
  AccountRestriction,
  AccountSafetyEvent,
  AccountStatusHistory,
  LocalDbData,
  PolicyDecisionRecord,
  RestrictionLevel,
} from "./apiTypes";
import { createId, nowIso } from "./ids";

const levelRank: Record<RestrictionLevel, number> = {
  none: 0,
  watched: 1,
  restricted: 2,
  generation_hold: 3,
  banned: 4,
};

export function currentRestriction(data: LocalDbData, userId: string): AccountRestriction {
  const latest = [...data.accountRestrictions]
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest ?? {
    id: "restriction_none",
    userId,
    level: "none",
    reason: "",
    sharingDisabled: false,
    generationDisabled: false,
    createdAt: nowIso(),
  };
}

export function assertCanGenerate(data: LocalDbData, userId: string): void {
  const restriction = currentRestriction(data, userId);
  if (restriction.level === "banned" || restriction.generationDisabled) {
    throw new Error("This account is on generation hold pending review.");
  }
}

export function assertCanShare(data: LocalDbData, userId: string): void {
  const restriction = currentRestriction(data, userId);
  if (restriction.level === "banned" || restriction.sharingDisabled) {
    throw new Error("Sharing is disabled for this account pending review.");
  }
}

export function applySafetyEventForDecision(data: LocalDbData, decision: PolicyDecisionRecord): AccountSafetyEvent[] {
  if (!decision.userId || decision.severity < 4 || decision.action === "allow" || decision.action === "review_only") {
    return [];
  }
  const events = decision.categories.map((category) => {
    const event: AccountSafetyEvent = {
      id: createId("safety"),
      userId: decision.userId!,
      policyDecisionId: decision.id,
      category,
      severity: decision.severity,
      gate: decision.gate,
      status: "open",
      createdAt: nowIso(),
    };
    data.accountSafetyEvents.push(event);
    return event;
  });
  updateRestrictionFromEvents(data, decision.userId, `Policy decision ${decision.id}`);
  return events;
}

export function updateRestrictionFromEvents(data: LocalDbData, userId: string, reason: string): AccountRestriction {
  const severeOpenEvents = data.accountSafetyEvents.filter((event) => event.userId === userId && event.status === "open" && event.severity >= 4);
  const desired: RestrictionLevel =
    severeOpenEvents.length >= 3 ? "generation_hold" :
    severeOpenEvents.length >= 2 ? "restricted" :
    severeOpenEvents.length >= 1 ? "watched" :
    "none";
  const current = currentRestriction(data, userId);
  if (levelRank[desired] <= levelRank[current.level]) return current;
  const next: AccountRestriction = {
    id: createId("restriction"),
    userId,
    level: desired,
    reason,
    sharingDisabled: desired !== "none",
    generationDisabled: desired === "generation_hold",
    contextTokenCap: desired === "restricted" ? 6000 : undefined,
    createdAt: nowIso(),
  };
  const history: AccountStatusHistory = {
    id: createId("status"),
    userId,
    fromLevel: current.level,
    toLevel: next.level,
    reason,
    createdAt: nowIso(),
  };
  data.accountRestrictions.push(next);
  data.accountStatusHistory.push(history);
  return next;
}

export function reconcileRestrictionFromOpenEvents(data: LocalDbData, userId: string, reason: string): AccountRestriction {
  const severeOpenEvents = data.accountSafetyEvents.filter((event) => event.userId === userId && event.status === "open" && event.severity >= 4);
  const desired: RestrictionLevel =
    severeOpenEvents.length >= 3 ? "generation_hold" :
    severeOpenEvents.length >= 2 ? "restricted" :
    severeOpenEvents.length >= 1 ? "watched" :
    "none";
  const current = currentRestriction(data, userId);
  if (desired === current.level) return current;
  const next: AccountRestriction = {
    id: createId("restriction"),
    userId,
    level: desired,
    reason,
    sharingDisabled: desired !== "none",
    generationDisabled: desired === "generation_hold",
    contextTokenCap: desired === "restricted" ? 6000 : undefined,
    createdAt: nowIso(),
  };
  data.accountRestrictions.push(next);
  data.accountStatusHistory.push({
    id: createId("status"),
    userId,
    fromLevel: current.level,
    toLevel: next.level,
    reason,
    createdAt: nowIso(),
  });
  return next;
}
