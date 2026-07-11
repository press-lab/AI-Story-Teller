import type { LocalDbData } from "./apiTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

export function pruneExpiredAndRetainedData(data: LocalDbData, now = new Date()): void {
  const nowMs = now.getTime();
  const olderThan = (value: string | undefined, days: number) => !value || Date.parse(value) < nowMs - days * DAY_MS;
  data.sessions = data.sessions.filter((entry) => !olderThan(entry.expiresAt, 7) && (!entry.revokedAt || !olderThan(entry.revokedAt, 7)));
  data.verificationTokens = data.verificationTokens.filter((entry) => !olderThan(entry.expiresAt, 7) && (!entry.usedAt || !olderThan(entry.usedAt, 7)));
  data.oauthStates = data.oauthStates.filter((entry) => !olderThan(entry.expiresAt, 1) && (!entry.usedAt || !olderThan(entry.usedAt, 1)));
  data.oauthExchangeCodes = data.oauthExchangeCodes.filter((entry) => !olderThan(entry.expiresAt, 1) && (!entry.consumedAt || !olderThan(entry.consumedAt, 1)));
  data.performanceTraces = data.performanceTraces.filter((entry) => !olderThan(entry.createdAt, 30)).slice(-2_000);
  data.contextBuildEvents = data.contextBuildEvents.filter((entry) => !olderThan(entry.createdAt, 30));
  data.policyDecisions = data.policyDecisions.filter((entry) => !olderThan(entry.createdAt, 365));
  data.accountSafetyEvents = data.accountSafetyEvents.filter((entry) => !olderThan(entry.createdAt, 365));
  data.usageLogs = data.usageLogs.filter((entry) => !olderThan(entry.createdAt, 365));
  data.adminActions = data.adminActions.filter((entry) => !olderThan(entry.createdAt, 730));
}

export function deleteUserData(data: LocalDbData, userId: string): void {
  const userEmail = data.users.find((entry) => entry.id === userId)?.email;
  const adventureIds = new Set(data.adventures.filter((entry) => entry.ownerUserId === userId).map((entry) => entry.id));
  const scenarioIds = new Set(data.scenarioDrafts.filter((entry) => entry.ownerUserId === userId).map((entry) => entry.id));
  const revisionIds = new Set(data.scenarioRevisions.filter((entry) => scenarioIds.has(entry.scenarioId)).map((entry) => entry.id));
  data.users = data.users.filter((entry) => entry.id !== userId);
  data.profiles = data.profiles.filter((entry) => entry.userId !== userId);
  data.authIdentities = data.authIdentities.filter((entry) => entry.userId !== userId);
  data.passwordCredentials = data.passwordCredentials.filter((entry) => entry.userId !== userId);
  data.signupIntents = data.signupIntents.filter((entry) => !userEmail || entry.email !== userEmail);
  data.sessions = data.sessions.filter((entry) => entry.userId !== userId);
  data.verificationTokens = data.verificationTokens.filter((entry) => entry.userId !== userId);
  data.oauthExchangeCodes = data.oauthExchangeCodes.filter((entry) => entry.userId !== userId);
  data.adventures = data.adventures.filter((entry) => entry.ownerUserId !== userId);
  data.adventureSnapshots = data.adventureSnapshots.filter((entry) => !adventureIds.has(entry.adventureId));
  data.contextBuildEvents = data.contextBuildEvents.filter((entry) => entry.userId !== userId && !adventureIds.has(entry.adventureId));
  data.policyDecisions = data.policyDecisions.filter((entry) => entry.userId !== userId);
  data.accountSafetyEvents = data.accountSafetyEvents.filter((entry) => entry.userId !== userId);
  data.accountRestrictions = data.accountRestrictions.filter((entry) => entry.userId !== userId);
  data.accountStatusHistory = data.accountStatusHistory.filter((entry) => entry.userId !== userId);
  data.scenarioDrafts = data.scenarioDrafts.filter((entry) => entry.ownerUserId !== userId);
  data.scenarioRevisions = data.scenarioRevisions.filter((entry) => !scenarioIds.has(entry.scenarioId));
  data.scenarioLikes = data.scenarioLikes.filter((entry) => entry.userId !== userId && !scenarioIds.has(entry.scenarioId));
  data.userFollows = data.userFollows.filter((entry) => entry.followerUserId !== userId && entry.followedUserId !== userId);
  data.friendships = data.friendships.filter((entry) => entry.requesterUserId !== userId && entry.addresseeUserId !== userId);
  data.shareLinks = data.shareLinks.filter((entry) => entry.ownerUserId !== userId && !revisionIds.has(entry.targetId));
  data.usageLogs = data.usageLogs.filter((entry) => entry.userId !== userId);
  data.performanceTraces = data.performanceTraces.filter((entry) => entry.userId !== userId);
}
