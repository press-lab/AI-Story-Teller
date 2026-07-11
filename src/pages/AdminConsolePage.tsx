import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActionFeedback } from "../components/ActionFeedback";
import type { BackendAdminConsoleData, BackendPlatformSettings, BackendSessionState } from "../runtime/backendApi";
import { CheckboxField, Field, NumberInput } from "./shared";

type RestrictionLevel = "none" | "watched" | "restricted" | "generation_hold" | "banned";
type AdminConsoleView = "overview" | "safetyArchive" | "operations";
type OperationsRecordType = "all" | "policy" | "usage" | "context" | "latency" | "audit";
type OperationsFocus = "all" | "attention";
type AdminUserSummary = BackendAdminConsoleData["users"][number];
type AdminUsageStats = AdminUserSummary["usageStats"];
type AdminTotals = BackendAdminConsoleData["totals"];
type UserLookup = Map<string, AdminUserSummary>;

interface AdminConsolePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  data?: BackendAdminConsoleData;
  status?: string;
  onRefresh?: () => Promise<void> | void;
  onSetUserStatus: (userId: string, status: "pending_verification" | "active" | "disabled") => Promise<void>;
  onSetUserRole: (userId: string, role: "user" | "admin") => Promise<void>;
  onCreateRestriction: (
    userId: string,
    input: {
      level: RestrictionLevel;
      reason: string;
      sharingDisabled?: boolean;
      generationDisabled?: boolean;
      contextTokenCap?: number;
    },
  ) => Promise<void>;
  onUpdateSafetyEvent: (eventId: string, status: "open" | "reviewed" | "dismissed") => Promise<void>;
  onCreateInvite: (input: { note?: string; maxUses?: number; expiresInDays?: number }) => Promise<{ token: string; inviteUrl: string }>;
  onDisableInvite: (inviteId: string) => Promise<void>;
  onSavePlatformSettings: (settings: Partial<BackendPlatformSettings>) => Promise<BackendPlatformSettings>;
}

function formatDate(iso?: string): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString();
}

function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function formatDuration(ms?: number): string {
  if (!Number.isFinite(ms)) return "n/a";
  if ((ms ?? 0) >= 1000) return `${((ms ?? 0) / 1000).toFixed(1)}s`;
  return `${Math.round(ms ?? 0)}ms`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString()}k`;
  return value.toLocaleString();
}

function lowerSearch(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function matchesSearch(search: string, parts: unknown[]): boolean {
  if (!search) return true;
  return parts.some((part) => lowerSearch(part).includes(search));
}

function matchesUserFilter(recordUserId: string | undefined, selectedUserId: string): boolean {
  return !selectedUserId || recordUserId === selectedUserId;
}

function numericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberOrZero(value: unknown): number {
  return numericValue(value) ?? 0;
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(value * ordered.length) - 1);
  return ordered[Math.min(index, ordered.length - 1)] ?? 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function usageTokens(usage: unknown): number | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as { promptTokens?: unknown; completionTokens?: unknown; totalTokens?: unknown };
  const total = numericValue(record.totalTokens);
  if (total !== undefined) return total;
  const prompt = numericValue(record.promptTokens) ?? 0;
  const completion = numericValue(record.completionTokens) ?? 0;
  return prompt + completion || undefined;
}

function policyCategories(decision: BackendAdminConsoleData["policyDecisions"][number]): string[] {
  return stringArray((decision as { categories?: unknown }).categories);
}

function policyMatchedRuleIds(decision: BackendAdminConsoleData["policyDecisions"][number]): string[] {
  return stringArray((decision as { matchedRuleIds?: unknown }).matchedRuleIds);
}

function policySeverity(decision: BackendAdminConsoleData["policyDecisions"][number]): number {
  return numberOrZero((decision as { severity?: unknown }).severity);
}

function userUsageStats(user: AdminUserSummary): AdminUsageStats {
  const stats = (user as { usageStats?: Partial<AdminUsageStats> }).usageStats ?? {};
  return {
    usageLogCount: numberOrZero(stats.usageLogCount),
    promptTokens: numberOrZero(stats.promptTokens),
    completionTokens: numberOrZero(stats.completionTokens),
    totalTokens: numberOrZero(stats.totalTokens),
    cacheReadTokens: numberOrZero(stats.cacheReadTokens),
    cacheCreationTokens: numberOrZero(stats.cacheCreationTokens),
    totalDurationMs: numberOrZero(stats.totalDurationMs),
    lastUsedAt: typeof stats.lastUsedAt === "string" ? stats.lastUsedAt : undefined,
  };
}

function userRestrictionLevel(user: AdminUserSummary): string {
  return (user as { currentRestriction?: { level?: string } }).currentRestriction?.level ?? "none";
}

function adminTotals(data?: BackendAdminConsoleData): AdminTotals {
  const totals = (data as { totals?: Partial<AdminTotals> } | undefined)?.totals ?? {};
  return {
    users: numberOrZero(totals.users),
    activeUsers: numberOrZero(totals.activeUsers),
    adventures: numberOrZero(totals.adventures),
    scenarioDrafts: numberOrZero(totals.scenarioDrafts),
    publishedScenarioRevisions: numberOrZero(totals.publishedScenarioRevisions),
    openSafetyEvents: numberOrZero(totals.openSafetyEvents),
    policyDecisions: numberOrZero(totals.policyDecisions),
    usageLogs: numberOrZero(totals.usageLogs),
    performanceTraces: numberOrZero(totals.performanceTraces),
  };
}

function policyNeedsAttention(decision: BackendAdminConsoleData["policyDecisions"][number]): boolean {
  return decision.action !== "allow" || decision.manualReviewRequired === true || policySeverity(decision) >= 4;
}

function usageNeedsAttention(usage: BackendAdminConsoleData["usageLogs"][number]): boolean {
  return numberOrZero(usage.durationMs) >= 1000 || (usageTokens(usage.usage) ?? 0) >= 4000;
}

function contextNeedsAttention(build: BackendAdminConsoleData["contextBuilds"][number]): boolean {
  return numberOrZero(build.excludedItemCount) > 0 || numberOrZero(build.totalEstimatedTokens) >= 4000;
}

function traceNeedsAttention(trace: BackendAdminConsoleData["performanceTraces"][number]): boolean {
  const statusCode = numericValue(trace.statusCode);
  return trace.status === "error" || statusCode !== undefined && statusCode >= 400 || numberOrZero(trace.durationMs) >= 1000 || numberOrZero(trace.retryCount) > 0;
}

function traceCause(trace: BackendAdminConsoleData["performanceTraces"][number]): string {
  const hintedCause = trace.metadata && typeof trace.metadata.causeHint === "string"
    ? trace.metadata.causeHint
    : undefined;
  const labels: Record<string, string> = {
    offline: "offline device",
    network_quality: "network quality",
    server_or_network: "server or network",
    client_render_or_assets: "browser rendering or assets",
    mixed_page_load: "mixed page load",
    client_render: "browser rendering",
    render_or_asset_loading: "rendering or asset loading",
    main_thread_work: "browser main-thread work",
  };
  if (hintedCause) return labels[hintedCause] ?? hintedCause.replaceAll("_", " ");
  if (trace.source === "ai" || trace.phase.includes("provider")) return "model provider";
  if (trace.source === "database") return "database";
  if (trace.source === "policy") return "policy processing";
  if (trace.source === "sync") return "cloud synchronization";
  if (trace.source === "server") return "application server";
  if (trace.phase === "interaction_latency" || trace.phase === "long_task_window") return "browser main-thread work";
  if (trace.phase === "largest_contentful_paint" || trace.phase === "page_load") return "browser rendering or assets";
  return "unclassified";
}

function auditNeedsAttention(action: BackendAdminConsoleData["adminActions"][number]): boolean {
  return /restriction|safety|status|disable|ban|hold/i.test(`${action.action} ${action.targetType}`);
}

function userDisplayName(user?: AdminUserSummary): string {
  return user?.profileDisplayName?.trim() || user?.displayName?.trim() || user?.email || "";
}

function formatUserReference(userId: string | undefined, usersById: UserLookup): string {
  if (!userId) return "System";
  const user = usersById.get(userId);
  return user ? userDisplayName(user) : `Unknown user ${shortId(userId)}`;
}

function formatAdminTarget(targetType: string, targetId: string, usersById: UserLookup): string {
  return targetType === "user" ? formatUserReference(targetId, usersById) : `${targetType} ${shortId(targetId)}`;
}

export function AdminConsolePage({
  backendMode,
  backendSession,
  data,
  status,
  onRefresh,
  onSetUserStatus,
  onSetUserRole,
  onCreateRestriction,
  onUpdateSafetyEvent,
  onCreateInvite,
  onDisableInvite,
  onSavePlatformSettings,
}: AdminConsolePageProps) {
  const { confirmAction, notify } = useActionFeedback();
  const totals = adminTotals(data);
  const [targetUserId, setTargetUserId] = useState("");
  const [restrictionLevel, setRestrictionLevel] = useState<RestrictionLevel>("watched");
  const [restrictionReason, setRestrictionReason] = useState("Manual admin review.");
  const [sharingDisabled, setSharingDisabled] = useState(true);
  const [generationDisabled, setGenerationDisabled] = useState(false);
  const [contextTokenCap, setContextTokenCap] = useState(0);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(14);
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [adminActionStatus, setAdminActionStatus] = useState("");
  const [safetyEventActionId, setSafetyEventActionId] = useState("");
  const [inviteActionId, setInviteActionId] = useState("");
  const [platformDraft, setPlatformDraft] = useState<BackendPlatformSettings | undefined>();
  const [activeView, setActiveView] = useState<AdminConsoleView>("overview");
  const [operationsSearch, setOperationsSearch] = useState("");
  const [operationsUserId, setOperationsUserId] = useState("");
  const [operationsRecordType, setOperationsRecordType] = useState<OperationsRecordType>("all");
  const [operationsFocus, setOperationsFocus] = useState<OperationsFocus>("all");

  useEffect(() => {
    if (!targetUserId && data?.users[0]) setTargetUserId(data.users[0].id);
  }, [data?.users, targetUserId]);

  useEffect(() => {
    if (data?.platformSettings) setPlatformDraft(data.platformSettings);
  }, [data?.platformSettings]);

  const targetUser = useMemo(
    () => data?.users.find((user) => user.id === targetUserId),
    [data?.users, targetUserId],
  );
  const usersById = useMemo(() => {
    const next = new Map((data?.users ?? []).map((user) => [user.id, user]));
    if (backendSession?.user && !next.has(backendSession.user.id)) {
      next.set(backendSession.user.id, {
        id: backendSession.user.id,
        email: backendSession.user.email,
        displayName: backendSession.user.displayName,
        profileDisplayName: backendSession.profile.displayName,
        role: backendSession.user.role === "admin" ? "admin" : "user",
        status: backendSession.user.status,
        emailVerified: backendSession.user.emailVerified,
        createdAt: backendSession.user.createdAt,
        updatedAt: backendSession.user.updatedAt,
        adventureCount: 0,
        scenarioCount: 0,
        publishedScenarioCount: 0,
        safetyEventCount: 0,
        openSafetyEventCount: 0,
        usageStats: {
          usageLogCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalDurationMs: 0,
        },
        currentRestriction: {
          id: `session-${backendSession.user.id}`,
          userId: backendSession.user.id,
          level: "none",
          reason: "Current admin session.",
          sharingDisabled: false,
          generationDisabled: false,
          createdAt: backendSession.user.createdAt,
        },
      });
    }
    return next;
  }, [backendSession, data?.users]);
  const openSafetyEvents = useMemo(
    () => (data?.safetyEvents ?? []).filter((event) => event.status === "open"),
    [data?.safetyEvents],
  );
  const resolvedSafetyEvents = useMemo(
    () => (data?.safetyEvents ?? []).filter((event) => event.status !== "open"),
    [data?.safetyEvents],
  );
  const normalizedOperationsSearch = operationsSearch.trim().toLowerCase();
  const filteredPolicyDecisions = useMemo(
    () => (data?.policyDecisions ?? []).filter((decision) => (
      matchesUserFilter(decision.userId, operationsUserId) &&
      (operationsFocus === "all" || policyNeedsAttention(decision)) &&
      matchesSearch(normalizedOperationsSearch, [
        decision.id,
        decision.action,
        decision.gate,
        policySeverity(decision),
        policyCategories(decision).join(" "),
        decision.rationale,
        policyMatchedRuleIds(decision).join(" "),
        decision.userId ? formatUserReference(decision.userId, usersById) : "system",
      ])
    )),
    [data?.policyDecisions, normalizedOperationsSearch, operationsFocus, operationsUserId, usersById],
  );
  const filteredUsageLogs = useMemo(
    () => (data?.usageLogs ?? []).filter((usage) => (
      matchesUserFilter(usage.userId, operationsUserId) &&
      (operationsFocus === "all" || usageNeedsAttention(usage)) &&
      matchesSearch(normalizedOperationsSearch, [
        usage.id,
        usage.traceId,
        usage.providerName,
        usage.model,
        usage.adventureId,
        formatUserReference(usage.userId, usersById),
        numberOrZero(usage.durationMs),
        usageTokens(usage.usage),
      ])
    )),
    [data?.usageLogs, normalizedOperationsSearch, operationsFocus, operationsUserId, usersById],
  );
  const filteredContextBuilds = useMemo(
    () => (data?.contextBuilds ?? []).filter((build) => (
      matchesUserFilter(build.userId, operationsUserId) &&
      (operationsFocus === "all" || contextNeedsAttention(build)) &&
      matchesSearch(normalizedOperationsSearch, [
        build.id,
        build.gate,
        build.adventureId,
        formatUserReference(build.userId, usersById),
        numberOrZero(build.totalEstimatedTokens),
        numberOrZero(build.messageCount),
        numberOrZero(build.sectionCount),
        numberOrZero(build.excludedItemCount),
      ])
    )),
    [data?.contextBuilds, normalizedOperationsSearch, operationsFocus, operationsUserId, usersById],
  );
  const filteredPerformanceTraces = useMemo(
    () => (data?.performanceTraces ?? []).filter((trace) => (
      matchesUserFilter(trace.userId, operationsUserId) &&
      (operationsFocus === "all" || traceNeedsAttention(trace)) &&
      matchesSearch(normalizedOperationsSearch, [
        trace.id,
        trace.traceId,
        trace.source,
        trace.phase,
        trace.status,
        numericValue(trace.statusCode),
        trace.route,
        trace.method,
        trace.providerName,
        trace.model,
        trace.errorCategory,
        trace.errorMessage,
        traceCause(trace),
        trace.userId ? formatUserReference(trace.userId, usersById) : "system",
      ])
    )),
    [data?.performanceTraces, normalizedOperationsSearch, operationsFocus, operationsUserId, usersById],
  );
  const filteredAdminActions = useMemo(
    () => (data?.adminActions ?? []).filter((action) => {
      const targetUserId = action.targetType === "user" ? action.targetId : undefined;
      const matchesSelectedUser = !operationsUserId || action.adminUserId === operationsUserId || targetUserId === operationsUserId;
      return (
        matchesSelectedUser &&
        (operationsFocus === "all" || auditNeedsAttention(action)) &&
        matchesSearch(normalizedOperationsSearch, [
          action.id,
          action.action,
          action.targetType,
          action.reason,
          formatAdminTarget(action.targetType, action.targetId, usersById),
          formatUserReference(action.adminUserId, usersById),
        ])
      );
    }),
    [data?.adminActions, normalizedOperationsSearch, operationsFocus, operationsUserId, usersById],
  );
  const policyStats = useMemo(() => ({
    blocked: filteredPolicyDecisions.filter((decision) => decision.action === "block").length,
    manualReview: filteredPolicyDecisions.filter((decision) => decision.manualReviewRequired === true).length,
    highSeverity: filteredPolicyDecisions.filter((decision) => policySeverity(decision) >= 4).length,
  }), [filteredPolicyDecisions]);
  const usageStats = useMemo(() => ({
    calls: filteredUsageLogs.length,
    tokens: filteredUsageLogs.reduce((sum, usage) => sum + (usageTokens(usage.usage) ?? 0), 0),
    durationMs: filteredUsageLogs.reduce((sum, usage) => sum + numberOrZero(usage.durationMs), 0),
    slowCalls: filteredUsageLogs.filter(usageNeedsAttention).length,
  }), [filteredUsageLogs]);
  const contextStats = useMemo(() => ({
    builds: filteredContextBuilds.length,
    averageTokens: filteredContextBuilds.length
      ? Math.round(filteredContextBuilds.reduce((sum, build) => sum + numberOrZero(build.totalEstimatedTokens), 0) / filteredContextBuilds.length)
      : 0,
    excludedBuilds: filteredContextBuilds.filter((build) => numberOrZero(build.excludedItemCount) > 0).length,
  }), [filteredContextBuilds]);
  const traceStats = useMemo(() => {
    const durations = filteredPerformanceTraces.map((trace) => numberOrZero(trace.durationMs));
    const attention = filteredPerformanceTraces.filter(traceNeedsAttention);
    const causeCounts = new Map<string, number>();
    for (const trace of attention) {
      const cause = traceCause(trace);
      causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
    }
    const likelyBottleneck = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none in loaded traces";
    return {
      traces: filteredPerformanceTraces.length,
      errors: filteredPerformanceTraces.filter((trace) => trace.status === "error" || numberOrZero(trace.statusCode) >= 400).length,
      slow: filteredPerformanceTraces.filter((trace) => numberOrZero(trace.durationMs) >= 1000).length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      worstMs: durations.reduce((max, duration) => Math.max(max, duration), 0),
      likelyBottleneck,
    };
  }, [filteredPerformanceTraces]);
  const showPolicyOperations = operationsRecordType === "all" || operationsRecordType === "policy";
  const showUsageOperations = operationsRecordType === "all" || operationsRecordType === "usage";
  const showContextOperations = operationsRecordType === "all" || operationsRecordType === "context";
  const showLatencyOperations = operationsRecordType === "all" || operationsRecordType === "latency";
  const showAuditOperations = operationsRecordType === "all" || operationsRecordType === "audit";

  function updatePlatformProvider(patch: Partial<BackendPlatformSettings["provider"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, provider: { ...platformDraft.provider, ...patch } });
  }

  function updatePlatformBackground(patch: Partial<BackendPlatformSettings["background"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, background: { ...platformDraft.background, ...patch } });
  }

  function updatePlatformFeatures(patch: Partial<BackendPlatformSettings["features"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, features: { ...platformDraft.features, ...patch } });
  }

  function updatePlatformAdministration(patch: Partial<BackendPlatformSettings["administration"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, administration: { ...platformDraft.administration, ...patch } });
  }

  async function createInvite() {
    setAdminActionStatus("Creating invite...");
    notify("Creating invite...", { type: "info" });
    try {
      const result = await onCreateInvite({
        note: inviteNote,
        maxUses: inviteMaxUses,
        expiresInDays: inviteExpiresInDays,
      });
      setCreatedInviteUrl(result.inviteUrl);
      setAdminActionStatus("Invite created.");
      notify("Invite created.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite creation failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function savePlatformSettings() {
    if (!platformDraft) return;
    const confirmed = await confirmAction({
      title: "Save platform settings?",
      message: "These settings apply backend-wide to everyone using the platform defaults.",
      confirmLabel: "Save Settings",
    });
    if (!confirmed) return;
    setAdminActionStatus("Saving platform settings...");
    notify("Saving platform settings...", { type: "info" });
    try {
      const result = await onSavePlatformSettings(platformDraft);
      setPlatformDraft(result);
      setAdminActionStatus("Platform settings saved.");
      notify("Platform settings saved.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Platform settings save failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function updateSafetyEvent(eventId: string, nextStatus: "open" | "reviewed" | "dismissed") {
    setSafetyEventActionId(eventId);
    setAdminActionStatus(`Updating safety event ${shortId(eventId)}...`);
    notify(`Updating safety event ${shortId(eventId)}...`, { type: "info" });
    try {
      await onUpdateSafetyEvent(eventId, nextStatus);
      setAdminActionStatus(`Safety event ${shortId(eventId)} marked ${nextStatus}.`);
      notify(`Safety event marked ${nextStatus}.`, { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Safety event update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    } finally {
      setSafetyEventActionId("");
    }
  }

  async function updateUserStatus(userId: string, nextStatus: "pending_verification" | "active" | "disabled") {
    const userLabel = formatUserReference(userId, usersById);
    const confirmed = await confirmAction({
      title: "Change account status?",
      message: `Set ${userLabel} to ${nextStatus}? This changes their account access.`,
      confirmLabel: "Change Status",
      danger: nextStatus === "disabled",
    });
    if (!confirmed) return;
    setAdminActionStatus(`Updating ${userLabel}...`);
    notify("Updating account status...", { type: "info" });
    try {
      await onSetUserStatus(userId, nextStatus);
      setAdminActionStatus(`${userLabel} set to ${nextStatus}.`);
      notify("Account status updated.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "User status update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function updateUserRole(userId: string, nextRole: "user" | "admin") {
    const userLabel = formatUserReference(userId, usersById);
    const confirmed = await confirmAction({
      title: "Change account role?",
      message: `Set ${userLabel} to ${nextRole}? Admin accounts can manage users, invites, platform settings, and operations data.`,
      confirmLabel: "Change Role",
      danger: nextRole !== "admin",
    });
    if (!confirmed) return;
    setAdminActionStatus(`Updating ${userLabel}...`);
    notify("Updating account role...", { type: "info" });
    try {
      await onSetUserRole(userId, nextRole);
      setAdminActionStatus(`${userLabel} set to ${nextRole}.`);
      notify("Account role updated.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "User role update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function applyRestriction() {
    if (!targetUser) return;
    const targetUserLabel = userDisplayName(targetUser);
    const confirmed = await confirmAction({
      title: "Apply restriction?",
      message: `Apply ${restrictionLevel} restriction to ${targetUserLabel}? This can limit sharing or generation for the account.`,
      confirmLabel: "Apply Restriction",
      danger: restrictionLevel === "banned" || restrictionLevel === "generation_hold" || generationDisabled || sharingDisabled,
    });
    if (!confirmed) return;
    setAdminActionStatus(`Applying restriction to ${targetUserLabel}...`);
    notify("Applying account restriction...", { type: "info" });
    try {
      await onCreateRestriction(targetUser.id, {
        level: restrictionLevel,
        reason: restrictionReason,
        sharingDisabled,
        generationDisabled,
        contextTokenCap: contextTokenCap || undefined,
      });
      setAdminActionStatus(`Restriction applied to ${targetUserLabel}.`);
      notify("Restriction applied.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restriction update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function disableInvite(inviteId: string) {
    const confirmed = await confirmAction({
      title: "Deactivate invite?",
      message: "This invite link will no longer work for new account signup.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!confirmed) return;
    setInviteActionId(inviteId);
    setAdminActionStatus(`Disabling invite ${shortId(inviteId)}...`);
    notify("Deactivating invite...", { type: "info" });
    try {
      await onDisableInvite(inviteId);
      setAdminActionStatus(`Invite ${shortId(inviteId)} disabled.`);
      notify("Invite deactivated.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite disable failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    } finally {
      setInviteActionId("");
    }
  }

  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Admin Console</h2>
          </div>
        </header>
        <p className="notice">Admin Console is available in backend mode.</p>
      </section>
    );
  }

  if (!backendSession || backendSession.user.role !== "admin") {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Admin Console</h2>
          </div>
        </header>
        <p className="notice">Admin access is required. Admin role is assigned only by backend configuration or backend data.</p>
      </section>
    );
  }

  const isLoading = !data && (!status || status.toLowerCase().includes("loading"));
  const hasLoadError = !data && Boolean(status) && !isLoading;

  return (
    <section className="page library-page admin-console-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Admin Console</h2>
          <p className="muted">Signed in as {formatUserReference(backendSession.user.id, usersById)}</p>
        </div>
      </header>

      {status && data && <p className="notice">{status}</p>}

      {data ? (
        <>
          <div className="admin-metric-grid">
            <Metric label="Users" value={totals.users} detail={`${totals.activeUsers} active`} />
            <Metric label="Adventures" value={totals.adventures} />
            <Metric label="Scenarios" value={totals.scenarioDrafts} detail={`${totals.publishedScenarioRevisions} published revisions`} />
            <Metric label="Safety" value={totals.openSafetyEvents} detail="open events" />
            <Metric label="Policy" value={totals.policyDecisions} detail="decisions" />
            <Metric label="Usage" value={totals.usageLogs} detail="model calls" />
            <Metric label="Latency" value={totals.performanceTraces} detail="trace events" />
          </div>

          {adminActionStatus && <p className="notice">{adminActionStatus}</p>}

          <div className="admin-view-tabs" role="tablist" aria-label="Admin console sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "overview"}
              className={activeView === "overview" ? "active" : ""}
              onClick={() => setActiveView("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "safetyArchive"}
              className={activeView === "safetyArchive" ? "active" : ""}
              onClick={() => setActiveView("safetyArchive")}
            >
              Safety Archive
              {resolvedSafetyEvents.length ? <span>{resolvedSafetyEvents.length}</span> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "operations"}
              className={activeView === "operations" ? "active" : ""}
              onClick={() => setActiveView("operations")}
            >
              Operations
            </button>
          </div>

          {activeView === "overview" && (
            <>
          <article className="panel settings-card settings-section-full">
            <div className="panel-heading">
              <div>
                <h3>Invite Links</h3>
                <p className="muted">Create account invites here. Admin roles are stored in backend data and can be managed from this console.</p>
              </div>
              <button type="button" onClick={() => void createInvite()}>
                Create Invite
              </button>
            </div>
            <div className="grid three">
              <Field label="Invite note">
                <input value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} />
              </Field>
              <Field label="Max uses">
                <NumberInput min={1} value={inviteMaxUses} onChange={setInviteMaxUses} />
              </Field>
              <Field label="Expires in days">
                <NumberInput min={1} value={inviteExpiresInDays} onChange={setInviteExpiresInDays} />
              </Field>
            </div>
            {createdInviteUrl && (
              <Field label="Created invite link">
                <input readOnly value={createdInviteUrl} />
              </Field>
            )}
          </article>

          <article className="panel settings-card settings-section-full">
            <div className="panel-heading">
              <div>
                <h3>Platform Settings</h3>
                <p className="muted">Backend-wide non-secret defaults. Provider API keys and OAuth secrets stay in environment files.</p>
              </div>
              <button type="button" onClick={() => void savePlatformSettings()} disabled={!platformDraft}>
                Save Platform Settings
              </button>
            </div>
            {platformDraft ? (
              <>
                <div className="grid three">
                  <Field label="Provider name">
                    <input value={platformDraft.provider.name} onChange={(event) => updatePlatformProvider({ name: event.target.value })} />
                  </Field>
                  <Field label="Provider base URL">
                    <input value={platformDraft.provider.baseUrl} onChange={(event) => updatePlatformProvider({ baseUrl: event.target.value })} />
                  </Field>
                  <Field label="Provider model">
                    <input value={platformDraft.provider.model} onChange={(event) => updatePlatformProvider({ model: event.target.value })} />
                  </Field>
                  <Field label="Temperature">
                    <NumberInput min={0} max={2} value={platformDraft.provider.temperature} onChange={(temperature) => updatePlatformProvider({ temperature })} />
                  </Field>
                  <Field label="Max output tokens">
                    <NumberInput min={1} value={platformDraft.provider.maxOutputTokens} onChange={(maxOutputTokens) => updatePlatformProvider({ maxOutputTokens })} />
                  </Field>
                  <Field label="Top P">
                    <NumberInput min={0} max={1} value={platformDraft.provider.topP ?? 1} onChange={(topP) => updatePlatformProvider({ topP })} />
                  </Field>
                  <Field label="Presence penalty">
                    <NumberInput min={0} max={2} value={platformDraft.provider.presencePenalty ?? 0} onChange={(presencePenalty) => updatePlatformProvider({ presencePenalty })} />
                  </Field>
                  <Field label="Frequency penalty">
                    <NumberInput min={0} max={2} value={platformDraft.provider.frequencyPenalty ?? 0} onChange={(frequencyPenalty) => updatePlatformProvider({ frequencyPenalty })} />
                  </Field>
                  <CheckboxField
                    label="Prompt caching"
                    checked={platformDraft.provider.promptCaching ?? false}
                    onChange={(promptCaching) => updatePlatformProvider({ promptCaching })}
                  />
                  <Field label="OpenRouter routing preference">
                    <select
                      value={platformDraft.provider.openRouterProviderSort ?? ""}
                      onChange={(event) =>
                        updatePlatformProvider({
                          openRouterProviderSort: (event.target.value || undefined) as BackendPlatformSettings["provider"]["openRouterProviderSort"],
                        })
                      }
                    >
                      <option value="">Balanced default</option>
                      <option value="price">Lowest price</option>
                      <option value="latency">Lowest latency</option>
                      <option value="throughput">Highest throughput</option>
                    </select>
                  </Field>
                  <Field label="OpenRouter data policy">
                    <select
                      value={platformDraft.provider.openRouterDataCollection ?? ""}
                      onChange={(event) =>
                        updatePlatformProvider({
                          openRouterDataCollection: (event.target.value || undefined) as BackendPlatformSettings["provider"]["openRouterDataCollection"],
                        })
                      }
                    >
                      <option value="">Key or workspace default</option>
                      <option value="allow">Allow provider data collection</option>
                      <option value="deny">Exclude data-collection providers</option>
                    </select>
                  </Field>
                </div>
                  <p className="muted">
                    OpenRouter routing is platform-wide when users use the platform model. Balanced default lets OpenRouter
                    weigh cost and uptime; price, latency, or throughput force a stronger preference. Data policy controls
                    OpenRouter provider filtering. If endpoint errors persist on Allow, the OpenRouter key/workspace privacy
                    or ZDR setting is still blocking the selected model.
                  </p>
                <div className="grid three" style={{ marginTop: "0.75rem" }}>
                  <CheckboxField
                    label="Enable semantic evaluation"
                    checked={platformDraft.background.semanticEvaluationEnabled}
                    onChange={(semanticEvaluationEnabled) => updatePlatformBackground({ semanticEvaluationEnabled })}
                  />
                  <Field label="Semantic eval every N turns">
                    <NumberInput min={0} value={platformDraft.background.semanticEvalEveryNTurns} onChange={(semanticEvalEveryNTurns) => updatePlatformBackground({ semanticEvalEveryNTurns })} />
                  </Field>
                  <CheckboxField
                    label="Enable memory detection"
                    checked={platformDraft.background.memoryDetectionEnabled}
                    onChange={(memoryDetectionEnabled) => updatePlatformBackground({ memoryDetectionEnabled })}
                  />
                  <Field label="Memory detection every N turns">
                    <NumberInput min={1} value={platformDraft.background.memoryDetectionEveryNTurns} onChange={(memoryDetectionEveryNTurns) => updatePlatformBackground({ memoryDetectionEveryNTurns })} />
                  </Field>
                  <CheckboxField
                    label="Scenario publishing"
                    checked={platformDraft.features.scenarioPublishingEnabled}
                    onChange={(scenarioPublishingEnabled) => updatePlatformFeatures({ scenarioPublishingEnabled })}
                  />
                  <CheckboxField
                    label="Developer tools visible to admins"
                    checked={platformDraft.features.developerToolsVisibleToAdmins}
                    onChange={(developerToolsVisibleToAdmins) => updatePlatformFeatures({ developerToolsVisibleToAdmins })}
                  />
                </div>
                <Field label="Bootstrap admin emails">
                  <textarea
                    rows={3}
                    value={(platformDraft.administration?.adminEmails ?? []).join("\n")}
                    onChange={(event) => updatePlatformAdministration({
                      adminEmails: event.target.value.split(/[\n,]/).map((email) => email.trim()).filter(Boolean),
                    })}
                    placeholder="one@example.com"
                  />
                </Field>
                <p className="muted">
                  Stored account roles are authoritative. These emails are only a bootstrap/repair list: matching verified accounts become admin, but removing an email does not silently demote an existing admin.
                </p>
              </>
            ) : (
              <p className="muted">Platform settings load with the admin console.</p>
            )}
          </article>

          <article className="panel settings-card settings-section-full">
            <h3>Admin Actions</h3>
            <p className="muted">Promote admins here after bootstrap. Keep at least one active admin account.</p>
            <div className="grid three">
              <Field label="Target user">
                <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
                  {(data.users ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {userDisplayName(user)} ({user.role})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Account status">
                <select
                  value={targetUser?.status ?? "active"}
                  onChange={(event) => targetUser && void updateUserStatus(targetUser.id, event.target.value as "pending_verification" | "active" | "disabled")}
                >
                  <option value="pending_verification">pending_verification</option>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </Field>
              <Field label="Account role">
                <select
                  value={targetUser?.role ?? "user"}
                  onChange={(event) => targetUser && void updateUserRole(targetUser.id, event.target.value as "user" | "admin")}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </Field>
              <Field label="Restriction level">
                <select value={restrictionLevel} onChange={(event) => setRestrictionLevel(event.target.value as RestrictionLevel)}>
                  <option value="none">none</option>
                  <option value="watched">watched</option>
                  <option value="restricted">restricted</option>
                  <option value="generation_hold">generation_hold</option>
                  <option value="banned">banned</option>
                </select>
              </Field>
            </div>
            <Field label="Restriction reason">
              <input value={restrictionReason} onChange={(event) => setRestrictionReason(event.target.value)} />
            </Field>
            <div className="grid three">
              <CheckboxField label="Disable sharing" checked={sharingDisabled} onChange={setSharingDisabled} />
              <CheckboxField label="Disable generation" checked={generationDisabled} onChange={setGenerationDisabled} />
              <Field label="Context token cap (0 = unset)">
                <NumberInput min={0} value={contextTokenCap} onChange={setContextTokenCap} />
              </Field>
            </div>
            <div className="toolbar">
              <button
                type="button"
                disabled={!targetUser}
                onClick={() => void applyRestriction()}
              >
                Apply Restriction
              </button>
            </div>
          </article>

          <Section title="Users">
            <div className="context-table-wrap">
              <table className="context-table admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Restriction</th>
                    <th>Usage</th>
                    <th>Assets</th>
                    <th>Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.users ?? []).map((user) => {
                    const stats = userUsageStats(user);
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{userDisplayName(user)}</strong>
                          <div className="muted">{user.email}</div>
                        </td>
                        <td>{user.role}</td>
                        <td>{user.status}</td>
                        <td>{userRestrictionLevel(user)}</td>
                        <td>
                          <strong>{formatCount(stats.usageLogCount)} calls</strong>
                          <div className="muted">
                            {formatTokenCount(stats.totalTokens)} tokens
                            {stats.totalDurationMs ? ` / ${formatDuration(stats.totalDurationMs)}` : ""}
                          </div>
                          {stats.lastUsedAt && <div className="muted">Last {formatDate(stats.lastUsedAt)}</div>}
                        </td>
                        <td>{numberOrZero(user.adventureCount)} adv / {numberOrZero(user.scenarioCount)} scen</td>
                        <td>{numberOrZero(user.openSafetyEventCount)} open / {numberOrZero(user.safetyEventCount)} total</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Open Safety Events" description="Reviewed or dismissed events leave this view and move to Safety Archive.">
            <SafetyEventsTable
              events={openSafetyEvents.slice(0, 50)}
              usersById={usersById}
              safetyEventActionId={safetyEventActionId}
              onUpdateSafetyEvent={updateSafetyEvent}
            />
          </Section>
            </>
          )}

          {activeView === "safetyArchive" && (
            <>
          <Section title="Resolved Safety Events" description="Reviewed and dismissed events are archived here. Reopen an event if it needs active follow-up again.">
            <SafetyEventsTable
              events={resolvedSafetyEvents.slice(0, 50)}
              usersById={usersById}
              safetyEventActionId={safetyEventActionId}
              onUpdateSafetyEvent={updateSafetyEvent}
            />
          </Section>

          <Section title="Restrictions">
            <CompactList
              items={(data.restrictions ?? []).slice(0, 30).map((restriction) => ({
                id: restriction.id,
                title: `${restriction.level} - ${formatUserReference(restriction.userId, usersById)}`,
                detail: `${restriction.reason || "No reason"} | sharing ${restriction.sharingDisabled ? "off" : "on"} | generation ${restriction.generationDisabled ? "off" : "on"}`,
                meta: formatDate(restriction.createdAt),
              }))}
            />
          </Section>
            </>
          )}

          {activeView === "operations" && (
            <>
          <Section title="Operations Filters" description="Filters apply to policy decisions, usage logs, context builds, latency traces, and audit rows. Counts below reflect the currently loaded admin activity slice.">
            <div className="grid three">
              <Field label="Search operations">
                <input
                  value={operationsSearch}
                  onChange={(event) => setOperationsSearch(event.target.value)}
                  placeholder="Route, model, category, phase, user..."
                />
              </Field>
              <Field label="User filter">
                <select value={operationsUserId} onChange={(event) => setOperationsUserId(event.target.value)}>
                  <option value="">All users</option>
                  {(data.users ?? []).map((user) => (
                    <option key={user.id} value={user.id}>{userDisplayName(user)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Record type">
                <select value={operationsRecordType} onChange={(event) => setOperationsRecordType(event.target.value as OperationsRecordType)}>
                  <option value="all">All records</option>
                  <option value="policy">Policy decisions</option>
                  <option value="usage">Usage calls</option>
                  <option value="context">Context builds</option>
                  <option value="latency">Latency traces</option>
                  <option value="audit">Admin audit</option>
                </select>
              </Field>
              <Field label="Focus">
                <select value={operationsFocus} onChange={(event) => setOperationsFocus(event.target.value as OperationsFocus)}>
                  <option value="all">Everything loaded</option>
                  <option value="attention">Needs attention</option>
                </select>
              </Field>
            </div>
          </Section>

          {operationsRecordType === "all" && (
            <>
          <Section title="Invites">
            {(data.invites ?? []).length ? (
              <div className="admin-compact-list">
                {(data.invites ?? []).slice(0, 30).map((invite) => {
                  const disabled = Boolean(invite.disabledAt);
                  const usedUp = invite.useCount >= invite.maxUses;
                  return (
                    <div key={invite.id} className="admin-compact-row">
                      <div>
                        <strong>{invite.useCount}/{invite.maxUses} used - {invite.tokenHashPrefix}</strong>
                        <div className="muted">
                          {invite.note || "No note"} / expires {formatDate(invite.expiresAt)}
                          {invite.createdByUserId ? ` / created by ${formatUserReference(invite.createdByUserId, usersById)}` : ""}
                          {disabled ? ` / disabled ${formatDate(invite.disabledAt)}` : ""}
                        </div>
                      </div>
                      <div className="toolbar">
                        {disabled ? (
                          <span className="status-pill">Disabled</span>
                        ) : usedUp ? (
                          <span className="status-pill">Used up</span>
                        ) : (
                          <button
                            type="button"
                            className="danger"
                            disabled={inviteActionId === invite.id}
                            onClick={() => void disableInvite(invite.id)}
                          >
                            {inviteActionId === invite.id ? "Disabling..." : "Deactivate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No records.</p>
            )}
          </Section>

          <Section title="Adventures">
            <CompactList
              items={(data.adventures ?? []).slice(0, 30).map((adventure) => ({
                id: adventure.id,
                title: adventure.title,
                detail: `${adventure.turnCount} turns, ${adventure.storyEntryCount} entries, owner ${formatUserReference(adventure.ownerUserId, usersById)}`,
                meta: formatDate(adventure.updatedAt),
              }))}
            />
          </Section>

          <Section title="Scenarios">
            <CompactList
              items={(data.scenarios ?? []).slice(0, 30).map((scenario) => ({
                id: scenario.id,
                title: scenario.title,
                detail: `${scenario.revisionCount} revisions, ${scenario.publishedRevisionCount} published, owner ${formatUserReference(scenario.ownerUserId, usersById)}`,
                meta: formatDate(scenario.updatedAt),
              }))}
            />
          </Section>
            </>
          )}

          {showPolicyOperations && (
          <Section title="Policy Decisions" description="Content-gate decisions. Blocks, manual review, and severity 4+ are the rows to inspect first.">
            <InsightStrip
              items={[
                { label: "shown", value: formatCount(filteredPolicyDecisions.length), detail: `${formatCount((data.policyDecisions ?? []).length)} loaded` },
                { label: "blocked", value: formatCount(policyStats.blocked) },
                { label: "manual review", value: formatCount(policyStats.manualReview) },
                { label: "severity 4+", value: formatCount(policyStats.highSeverity) },
              ]}
            />
            <CompactList
              items={filteredPolicyDecisions.slice(0, 40).map((decision) => ({
                id: decision.id,
                title: `${decision.action} / ${decision.gate} / severity ${policySeverity(decision)}`,
                detail: [
                  decision.userId ? `user ${formatUserReference(decision.userId, usersById)}` : undefined,
                  policyCategories(decision).join(", ") || "No categories",
                  decision.manualReviewRequired ? "manual review" : undefined,
                  decision.rationale,
                ].filter(Boolean).join(" / "),
                meta: formatDate(decision.createdAt),
              }))}
            />
          </Section>
          )}

          {(showUsageOperations || showContextOperations) && (
          <Section title="Usage And Context Builds" description="Usage rows are completed model calls. Context builds show how much prompt was assembled and whether anything was excluded.">
            <div className="admin-inspection-grid">
              {showUsageOperations && (
              <div className="admin-inspection-block">
                  <h3>Usage Logs</h3>
                  <InsightStrip
                    items={[
                      { label: "shown", value: formatCount(usageStats.calls), detail: `${formatCount((data.usageLogs ?? []).length)} loaded` },
                      { label: "tokens", value: formatTokenCount(usageStats.tokens) },
                      { label: "duration", value: formatDuration(usageStats.durationMs) },
                      { label: "attention", value: formatCount(usageStats.slowCalls) },
                    ]}
                  />
                  <CompactList
                    items={filteredUsageLogs.slice(0, 20).map((usage) => ({
                      id: usage.id,
                      title: `${usage.providerName} / ${usage.model}`,
                      detail: [
                        `user ${formatUserReference(usage.userId, usersById)}`,
                        `adventure ${shortId(usage.adventureId)}`,
                        numericValue(usage.durationMs) !== undefined ? formatDuration(usage.durationMs) : undefined,
                        usageTokens(usage.usage) !== undefined ? `${formatTokenCount(usageTokens(usage.usage) ?? 0)} tokens` : undefined,
                      ].filter(Boolean).join(" / "),
                      meta: formatDate(usage.createdAt),
                    }))}
                  />
              </div>
              )}
              {showContextOperations && (
              <div className="admin-inspection-block">
                  <h3>Context Builds</h3>
                  <InsightStrip
                    items={[
                      { label: "shown", value: formatCount(contextStats.builds), detail: `${formatCount((data.contextBuilds ?? []).length)} loaded` },
                      { label: "avg tokens", value: formatTokenCount(contextStats.averageTokens) },
                      { label: "excluded", value: formatCount(contextStats.excludedBuilds) },
                    ]}
                  />
                  <CompactList
                    items={filteredContextBuilds.slice(0, 20).map((build) => ({
                      id: build.id,
                      title: `${build.gate} / ${numberOrZero(build.totalEstimatedTokens)} tokens`,
                      detail: `user ${formatUserReference(build.userId, usersById)} / ${numberOrZero(build.messageCount)} messages, ${numberOrZero(build.sectionCount)} sections, ${numberOrZero(build.excludedItemCount)} excluded`,
                      meta: formatDate(build.createdAt),
                    }))}
                  />
              </div>
              )}
            </div>
          </Section>
          )}

          {showLatencyOperations && (
          <Section title="Latency Traces" description="Content-free device, server, database, policy, sync, and model timing rows. Use the shared trace id to follow one request across layers; errors, retries, and 1s+ traces need attention first.">
            <InsightStrip
              items={[
                { label: "shown", value: formatCount(traceStats.traces), detail: `${formatCount((data.performanceTraces ?? []).length)} loaded` },
                { label: "errors", value: formatCount(traceStats.errors) },
                { label: "slow", value: formatCount(traceStats.slow) },
                { label: "p50", value: formatDuration(traceStats.p50Ms) },
                { label: "p95", value: formatDuration(traceStats.p95Ms) },
                { label: "worst", value: formatDuration(traceStats.worstMs) },
              ]}
            />
            <p className="muted"><strong>Likely bottleneck in the loaded attention traces:</strong> {traceStats.likelyBottleneck}. This is a coarse hint; correlated layer timings are the evidence.</p>
            <CompactList
              items={filteredPerformanceTraces.slice(0, 50).map((trace) => ({
                id: trace.id,
                title: `${trace.source} / ${trace.phase} / ${trace.status} / ${formatDuration(numberOrZero(trace.durationMs))}`,
                detail: [
                  trace.method,
                  trace.route,
                  trace.userId ? `user ${formatUserReference(trace.userId, usersById)}` : undefined,
                  trace.statusCode ? `HTTP ${trace.statusCode}` : undefined,
                  trace.providerName ? `${trace.providerName} ${trace.model ?? ""}`.trim() : undefined,
                  trace.totalTokens !== undefined ? `${trace.totalTokens} tokens` : undefined,
                  trace.errorCategory,
                  `cause: ${traceCause(trace)}`,
                  `trace ${shortId(trace.traceId)}`,
                ].filter(Boolean).join(" / ") || `trace ${shortId(trace.traceId)}`,
                meta: formatDate(trace.createdAt),
              }))}
            />
          </Section>
          )}

          {showAuditOperations && (
          <Section title="Admin Audit Log" description="Admin-side mutations and review actions. Use this with the user filter to reconstruct account changes.">
            <InsightStrip
              items={[
                { label: "shown", value: formatCount(filteredAdminActions.length), detail: `${formatCount((data.adminActions ?? []).length)} loaded` },
                { label: "attention", value: formatCount(filteredAdminActions.filter(auditNeedsAttention).length) },
              ]}
            />
            <CompactList
              items={filteredAdminActions.slice(0, 40).map((action) => ({
                id: action.id,
                title: `${action.action} / ${formatAdminTarget(action.targetType, action.targetId, usersById)}`,
                detail: `${action.reason || "No reason"} / by ${formatUserReference(action.adminUserId, usersById)}`,
                meta: formatDate(action.createdAt),
              }))}
            />
          </Section>
          )}
            </>
          )}
        </>
      ) : isLoading ? (
        <AdminConsoleLoading status={status || "Loading admin console..."} />
      ) : hasLoadError ? (
        <AdminConsoleLoadError message={status || "Admin console load failed."} onRefresh={onRefresh} />
      ) : (
        <AdminConsoleLoading status="Waiting for admin data..." />
      )}
    </section>
  );
}

function AdminConsoleLoadError({ message, onRefresh }: { message: string; onRefresh?: () => Promise<void> | void }) {
  return (
    <article className="panel admin-load-error" role="alert">
      <div>
        <p className="eyebrow">Load failed</p>
        <h3>Admin data could not load.</h3>
        <p className="muted">{message}</p>
      </div>
      {onRefresh && (
        <button type="button" onClick={() => void onRefresh()}>
          Retry
        </button>
      )}
    </article>
  );
}

function AdminConsoleLoading({ status }: { status: string }) {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <div className="admin-loading-banner">
        <span className="admin-loading-spinner" aria-hidden="true" />
        <div>
          <p className="admin-loading-title">{status}</p>
          <p className="muted">Fetching users, adventures, scenarios, safety events, usage, and platform settings.</p>
        </div>
      </div>
      <div className="admin-metric-grid admin-loading-grid" aria-hidden="true">
        {["Users", "Adventures", "Scenarios", "Safety", "Policy", "Usage", "Latency"].map((label) => (
          <article className="panel admin-metric-card admin-metric-card-loading" key={label}>
            <p className="eyebrow">{label}</p>
            <span className="skeleton-line skeleton-number" />
            <span className="skeleton-line skeleton-caption" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <article className="panel admin-metric-card">
      <p className="eyebrow">{label}</p>
      <strong>{value.toLocaleString()}</strong>
      {detail && <span className="muted">{detail}</span>}
    </article>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <article className="panel settings-card settings-section-full admin-section">
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {children}
    </article>
  );
}

function InsightStrip({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <div className="admin-insight-strip">
      {items.map((item) => (
        <span key={item.label}>
          <strong>{item.value}</strong>
          <small>{item.label}{item.detail ? ` / ${item.detail}` : ""}</small>
        </span>
      ))}
    </div>
  );
}

function UserReference({ userId, usersById }: { userId: string; usersById: UserLookup }) {
  const user = usersById.get(userId);
  if (!user) return <span>{formatUserReference(userId, usersById)}</span>;
  return (
    <span className="admin-user-reference">
      <strong>{userDisplayName(user)}</strong>
      <span className="muted">{user.email}</span>
    </span>
  );
}

function SafetyEventsTable({
  events,
  usersById,
  safetyEventActionId,
  onUpdateSafetyEvent,
}: {
  events: BackendAdminConsoleData["safetyEvents"];
  usersById: UserLookup;
  safetyEventActionId: string;
  onUpdateSafetyEvent: (eventId: string, nextStatus: "open" | "reviewed" | "dismissed") => Promise<void>;
}) {
  if (events.length === 0) return <p className="muted">No records.</p>;
  return (
    <div className="context-table-wrap">
      <table className="context-table admin-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>User</th>
            <th>Category</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{shortId(event.id)}<div className="muted">{formatDate(event.createdAt)}</div></td>
              <td><UserReference userId={event.userId} usersById={usersById} /></td>
              <td>{event.category} / severity {event.severity}</td>
              <td>{event.status}</td>
              <td>
                <div className="toolbar">
                  <button
                    type="button"
                    disabled={safetyEventActionId === event.id || event.status === "reviewed"}
                    onClick={() => void onUpdateSafetyEvent(event.id, "reviewed")}
                  >
                    {safetyEventActionId === event.id ? "Saving..." : "Review"}
                  </button>
                  <button
                    type="button"
                    disabled={safetyEventActionId === event.id || event.status === "dismissed"}
                    onClick={() => void onUpdateSafetyEvent(event.id, "dismissed")}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={safetyEventActionId === event.id || event.status === "open"}
                    onClick={() => void onUpdateSafetyEvent(event.id, "open")}
                  >
                    Reopen
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactList({ items }: { items: Array<{ id: string; title: string; detail: string; meta: string }> }) {
  if (items.length === 0) return <p className="muted">No records.</p>;
  return (
    <div className="admin-compact-list">
      {items.map((item) => (
        <div key={item.id} className="admin-compact-row">
          <div>
            <strong>{item.title}</strong>
            <p className="muted">{item.detail}</p>
          </div>
          <span className="status-pill">{item.meta}</span>
        </div>
      ))}
    </div>
  );
}
