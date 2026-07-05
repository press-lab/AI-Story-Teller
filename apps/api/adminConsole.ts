import type {
  AccountRestriction,
  AccountSafetyEvent,
  AccountStatus,
  LocalDbData,
  RestrictionLevel,
} from "./apiTypes";
import type { ApiConfig } from "./config";
import { currentRestriction, reconcileRestrictionFromOpenEvents } from "./accountSafety";
import { summarizeAdventure } from "./adventureStore";
import { getPlatformSettings } from "./platformSettings";
import { createId, nowIso } from "./ids";

export interface AdminConsoleData {
  totals: {
    users: number;
    activeUsers: number;
    adventures: number;
    scenarioDrafts: number;
    publishedScenarioRevisions: number;
    openSafetyEvents: number;
    policyDecisions: number;
    usageLogs: number;
  };
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    profileDisplayName: string;
    role: "user" | "admin";
    status: AccountStatus;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    adventureCount: number;
    scenarioCount: number;
    publishedScenarioCount: number;
    safetyEventCount: number;
    openSafetyEventCount: number;
    currentRestriction: AccountRestriction;
  }>;
  invites: Array<{
    id: string;
    tokenHashPrefix: string;
    createdAt: string;
    expiresAt?: string;
    maxUses: number;
    useCount: number;
    createdByUserId?: string;
    note?: string;
    disabledAt?: string;
  }>;
  adventures: Array<ReturnType<typeof summarizeAdventure> & { ownerUserId: string }>;
  scenarios: Array<{
    id: string;
    ownerUserId: string;
    title: string;
    description: string;
    revisionCount: number;
    publishedRevisionCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  scenarioRevisions: Array<{
    id: string;
    scenarioId: string;
    ownerUserId: string;
    version: number;
    title: string;
    status: string;
    createdAt: string;
    publishedAt?: string;
  }>;
  safetyEvents: AccountSafetyEvent[];
  restrictions: AccountRestriction[];
  policyDecisions: LocalDbData["policyDecisions"];
  usageLogs: LocalDbData["usageLogs"];
  contextBuilds: Array<{
    id: string;
    userId: string;
    adventureId: string;
    gate: string;
    createdAt: string;
    messageCount: number;
    sectionCount: number;
    totalEstimatedTokens: number;
    excludedItemCount: number;
    decisionCount: number;
  }>;
  adminActions: LocalDbData["adminActions"];
  platformSettings: ReturnType<typeof getPlatformSettings>;
}

export function buildAdminConsole(data: LocalDbData, config: ApiConfig): AdminConsoleData {
  return {
    totals: {
      users: data.users.length,
      activeUsers: data.users.filter((user) => user.status === "active").length,
      adventures: data.adventures.length,
      scenarioDrafts: data.scenarioDrafts.length,
      publishedScenarioRevisions: data.scenarioRevisions.filter((revision) => revision.status === "published").length,
      openSafetyEvents: data.accountSafetyEvents.filter((event) => event.status === "open").length,
      policyDecisions: data.policyDecisions.length,
      usageLogs: data.usageLogs.length,
    },
    users: data.users
      .map((user) => {
        const profile = data.profiles.find((entry) => entry.userId === user.id);
        const userScenarios = data.scenarioDrafts.filter((scenario) => scenario.ownerUserId === user.id);
        const userScenarioIds = new Set(userScenarios.map((scenario) => scenario.id));
        const safetyEvents = data.accountSafetyEvents.filter((event) => event.userId === user.id);
        const role: "user" | "admin" = user.role === "admin" || config.adminEmails.includes(user.email.toLowerCase()) ? "admin" : "user";
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          profileDisplayName: profile?.displayName ?? user.displayName,
          role,
          status: user.status,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          adventureCount: data.adventures.filter((adventure) => adventure.ownerUserId === user.id).length,
          scenarioCount: userScenarios.length,
          publishedScenarioCount: data.scenarioRevisions.filter((revision) => userScenarioIds.has(revision.scenarioId) && revision.status === "published").length,
          safetyEventCount: safetyEvents.length,
          openSafetyEventCount: safetyEvents.filter((event) => event.status === "open").length,
          currentRestriction: currentRestriction(data, user.id),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    invites: data.inviteLinks
      .map((invite) => ({
        id: invite.id,
        tokenHashPrefix: invite.tokenHash.slice(0, 10),
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
        createdByUserId: invite.createdByUserId,
        note: invite.note,
        disabledAt: invite.disabledAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    adventures: data.adventures
      .map((record) => ({ ...summarizeAdventure(record.adventure), ownerUserId: record.ownerUserId }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    scenarios: data.scenarioDrafts
      .map((scenario) => {
        const revisions = data.scenarioRevisions.filter((revision) => revision.scenarioId === scenario.id);
        return {
          id: scenario.id,
          ownerUserId: scenario.ownerUserId,
          title: scenario.title,
          description: scenario.description,
          revisionCount: revisions.length,
          publishedRevisionCount: revisions.filter((revision) => revision.status === "published").length,
          createdAt: scenario.createdAt,
          updatedAt: scenario.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    scenarioRevisions: data.scenarioRevisions
      .map((revision) => ({
        id: revision.id,
        scenarioId: revision.scenarioId,
        ownerUserId: revision.ownerUserId,
        version: revision.version,
        title: revision.title,
        status: revision.status,
        createdAt: revision.createdAt,
        publishedAt: revision.publishedAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    safetyEvents: [...data.accountSafetyEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    restrictions: [...data.accountRestrictions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    policyDecisions: [...data.policyDecisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    usageLogs: [...data.usageLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    contextBuilds: data.contextBuildEvents
      .map((event) => ({
        id: event.id,
        userId: event.userId,
        adventureId: event.adventureId,
        gate: event.gate,
        createdAt: event.createdAt,
        messageCount: event.context.messages.length,
        sectionCount: event.context.sections.filter((section) => section.items.length > 0).length,
        totalEstimatedTokens: event.context.totalEstimatedTokens,
        excludedItemCount: event.context.excludedItems.length,
        decisionCount: event.context.decisions.length,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    adminActions: [...data.adminActions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    platformSettings: getPlatformSettings(data, config),
  };
}

export function updateUserStatus(
  data: LocalDbData,
  adminUserId: string | undefined,
  userId: string,
  status: AccountStatus,
): void {
  if (!["pending_verification", "active", "disabled"].includes(status)) throw new Error("Invalid account status.");
  const user = data.users.find((entry) => entry.id === userId);
  if (!user) throw new Error("User not found.");
  user.status = status;
  user.updatedAt = nowIso();
  if (status === "disabled") {
    for (const session of data.sessions.filter((entry) => entry.userId === userId && !entry.revokedAt)) {
      session.revokedAt = nowIso();
    }
  }
  data.adminActions.push({
    id: createId("admin_action"),
    adminUserId,
    action: "update_user_status",
    targetType: "user",
    targetId: userId,
    reason: `Set user status to ${status}.`,
    createdAt: nowIso(),
  });
}

export function disableInviteLink(
  data: LocalDbData,
  adminUserId: string | undefined,
  inviteId: string,
): void {
  const invite = data.inviteLinks.find((entry) => entry.id === inviteId);
  if (!invite) throw new Error("Invite not found.");
  if (!invite.disabledAt) invite.disabledAt = nowIso();
  data.adminActions.push({
    id: createId("admin_action"),
    adminUserId,
    action: "disable_invite",
    targetType: "invite",
    targetId: inviteId,
    reason: "Invite disabled from Admin Console.",
    createdAt: nowIso(),
  });
}

export function createManualRestriction(
  data: LocalDbData,
  adminUserId: string | undefined,
  userId: string,
  input: {
    level: RestrictionLevel;
    reason: string;
    sharingDisabled?: boolean;
    generationDisabled?: boolean;
    contextTokenCap?: number;
  },
): AccountRestriction {
  if (!data.users.some((user) => user.id === userId)) throw new Error("User not found.");
  const current = currentRestriction(data, userId);
  const level = input.level;
  if (!["none", "watched", "restricted", "generation_hold", "banned"].includes(level)) throw new Error("Invalid restriction level.");
  const restriction: AccountRestriction = {
    id: createId("restriction"),
    userId,
    level,
    reason: input.reason.trim() || "Manual admin restriction.",
    sharingDisabled: input.sharingDisabled ?? (level !== "none"),
    generationDisabled: input.generationDisabled ?? (level === "generation_hold" || level === "banned"),
    contextTokenCap: input.contextTokenCap,
    createdAt: nowIso(),
  };
  data.accountRestrictions.push(restriction);
  data.accountStatusHistory.push({
    id: createId("status"),
    userId,
    fromLevel: current.level,
    toLevel: level,
    reason: restriction.reason,
    createdAt: nowIso(),
  });
  data.adminActions.push({
    id: createId("admin_action"),
    adminUserId,
    action: "create_manual_restriction",
    targetType: "user",
    targetId: userId,
    reason: restriction.reason,
    createdAt: nowIso(),
  });
  return restriction;
}

export function updateSafetyEventStatus(
  data: LocalDbData,
  adminUserId: string | undefined,
  eventId: string,
  status: AccountSafetyEvent["status"],
): AccountSafetyEvent {
  if (!["open", "reviewed", "dismissed"].includes(status)) throw new Error("Invalid safety event status.");
  const event = data.accountSafetyEvents.find((entry) => entry.id === eventId);
  if (!event) throw new Error("Safety event not found.");
  event.status = status;
  reconcileRestrictionFromOpenEvents(data, event.userId, `Safety event ${eventId} set to ${status}.`);
  data.adminActions.push({
    id: createId("admin_action"),
    adminUserId,
    action: "update_safety_event_status",
    targetType: "accountSafetyEvent",
    targetId: eventId,
    reason: `Set safety event status to ${status}.`,
    createdAt: nowIso(),
  });
  return event;
}
