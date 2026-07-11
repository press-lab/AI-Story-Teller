/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendAdminConsoleData, BackendSessionState } from "../runtime/backendApi";
import { AdminConsolePage } from "./AdminConsolePage";

const createdAt = "2026-07-04T00:00:00.000Z";

function session(role: "user" | "admin"): BackendSessionState {
  return {
    sessionToken: `session-${role}`,
    user: {
      id: `user-${role}`,
      email: `${role}@example.com`,
      displayName: role,
      role,
      status: "active",
      emailVerified: true,
      createdAt,
      updatedAt: createdAt,
    },
    profile: {
      userId: `user-${role}`,
      displayName: role,
      bio: "",
      createdAt,
      updatedAt: createdAt,
    },
  };
}

function adminData(): BackendAdminConsoleData {
  return {
    totals: {
      users: 1,
      activeUsers: 1,
      adventures: 1,
      scenarioDrafts: 1,
      publishedScenarioRevisions: 1,
      openSafetyEvents: 1,
      policyDecisions: 1,
      usageLogs: 1,
      performanceTraces: 1,
    },
    users: [{
      id: "user-target",
      email: "target@example.com",
      displayName: "Target",
      profileDisplayName: "Target",
      role: "user",
      status: "active",
      emailVerified: true,
      createdAt,
      updatedAt: createdAt,
      adventureCount: 1,
      scenarioCount: 1,
      publishedScenarioCount: 1,
      safetyEventCount: 1,
      openSafetyEventCount: 1,
      usageStats: {
        usageLogCount: 3,
        promptTokens: 1200,
        completionTokens: 450,
        totalTokens: 1650,
        cacheReadTokens: 100,
        cacheCreationTokens: 25,
        totalDurationMs: 3200,
        lastUsedAt: createdAt,
      },
      currentRestriction: {
        id: "restriction-current",
        userId: "user-target",
        level: "watched",
        reason: "Review",
        sharingDisabled: true,
        generationDisabled: false,
        createdAt,
      },
    }],
    invites: [{
      id: "invite-1",
      tokenHashPrefix: "abcdef1234",
      createdAt,
      maxUses: 1,
      useCount: 0,
      note: "Tester",
    }],
    adventures: [{
      id: "adventure-1",
      ownerUserId: "user-target",
      title: "Adventure",
      createdAt,
      updatedAt: createdAt,
      turnCount: 2,
      storyEntryCount: 2,
    }],
    scenarios: [{
      id: "scenario-1",
      ownerUserId: "user-target",
      title: "Scenario",
      description: "Description",
      revisionCount: 1,
      publishedRevisionCount: 1,
      createdAt,
      updatedAt: createdAt,
    }],
    scenarioRevisions: [{
      id: "revision-1",
      scenarioId: "scenario-1",
      ownerUserId: "user-target",
      version: 1,
      title: "Scenario",
      status: "published",
      createdAt,
      publishedAt: createdAt,
    }],
    safetyEvents: [{
      id: "event-1",
      userId: "user-target",
      category: "illegal_sexual_exploitation",
      severity: 5,
      gate: "input",
      status: "open",
      createdAt,
    }],
    restrictions: [{
      id: "restriction-1",
      userId: "user-target",
      level: "watched",
      reason: "Safety event",
      sharingDisabled: true,
      generationDisabled: false,
      createdAt,
    }],
    policyDecisions: [{
      id: "decision-1",
      gate: "input",
      action: "block",
      categories: ["illegal_sexual_exploitation"],
      severity: 5,
      manualReviewRequired: true,
      rationale: "Fixture",
      createdAt,
    }],
    usageLogs: [{
      id: "usage-1",
      userId: "user-target",
      adventureId: "adventure-1",
      providerName: "test",
      model: "model",
      durationMs: 1200,
      traceId: "trace-1",
      createdAt,
    }],
    performanceTraces: [{
      id: "perf-1",
      traceId: "trace-1",
      source: "ai",
      phase: "provider_call",
      route: "/adventures/adventure-1/turn",
      method: "POST",
      userId: "user-target",
      adventureId: "adventure-1",
      providerName: "test",
      model: "model",
      status: "ok",
      statusCode: 200,
      durationMs: 1200,
      totalTokens: 15,
      createdAt,
    }],
    contextBuilds: [{
      id: "context-1",
      userId: "user-target",
      adventureId: "adventure-1",
      gate: "turn",
      createdAt,
      messageCount: 2,
      sectionCount: 3,
      totalEstimatedTokens: 200,
      excludedItemCount: 0,
      decisionCount: 4,
    }],
    adminActions: [{
      id: "admin-action-1",
      adminUserId: "user-admin",
      action: "create_manual_restriction",
      targetType: "user",
      targetId: "user-target",
      reason: "Review",
      createdAt,
    }],
    platformSettings: {
      provider: {
        name: "test",
        baseUrl: "http://127.0.0.1",
        model: "model",
        temperature: 0.7,
        maxOutputTokens: 1200,
        openRouterDataCollection: "allow",
      },
      background: {
        semanticEvaluationEnabled: true,
        semanticEvalEveryNTurns: 1,
        memoryDetectionEnabled: true,
        memoryDetectionEveryNTurns: 3,
      },
      features: {
        scenarioPublishingEnabled: true,
        developerToolsVisibleToAdmins: true,
      },
      administration: {
        adminEmails: ["admin@example.com"],
      },
      updatedAt: createdAt,
    },
  };
}

describe("AdminConsolePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not expose the console to normal backend users", () => {
    render(
      <AdminConsolePage
        backendMode
        backendSession={session("user")}
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={vi.fn()}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    expect(screen.getByText(/Admin access is required/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Restriction" })).not.toBeInTheDocument();
  });

  it("shows a structured loading state while admin data loads", () => {
    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        status="Loading admin console..."
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={vi.fn()}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading admin console...");
    expect(screen.getByText(/Fetching users, adventures, scenarios/)).toBeInTheDocument();
    expect(screen.queryByText(/Admin data loads automatically/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Invite" })).not.toBeInTheDocument();
  });

  it("shows a retryable failed-load state without the loading skeleton", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn(async () => undefined);
    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        status="Load failed"
        onRefresh={onRefresh}
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={vi.fn()}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Admin data could not load.");
    expect(screen.getByRole("alert")).toHaveTextContent("Load failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fetching users, adventures, scenarios/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("lets backend admin sessions review users and safety events", async () => {
    const user = userEvent.setup();
    const onSetUserStatus = vi.fn(async () => undefined);
    const onSetUserRole = vi.fn(async () => undefined);
    const onCreateRestriction = vi.fn(async () => undefined);
    const onUpdateSafetyEvent = vi.fn(async () => undefined);
    const onCreateInvite = vi.fn(async () => ({
      token: "invite-token-test",
      inviteUrl: "https://example.com/app/#invite=invite-token-test",
    }));
    const onDisableInvite = vi.fn(async () => undefined);
    const onSavePlatformSettings = vi.fn(async (settings: Partial<BackendAdminConsoleData["platformSettings"]>) => ({
      ...adminData().platformSettings,
      ...settings,
      provider: { ...adminData().platformSettings.provider, ...(settings.provider ?? {}) },
      background: { ...adminData().platformSettings.background, ...(settings.background ?? {}) },
      features: { ...adminData().platformSettings.features, ...(settings.features ?? {}) },
      administration: { ...adminData().platformSettings.administration, ...(settings.administration ?? {}) },
    }));
    const onCheckProviderHealth = vi.fn(async () => ({
      ok: true as const,
      providerName: "test",
      model: "model",
      durationMs: 42,
      statusCode: 200,
      retryCount: 0,
      usage: { promptTokens: 4, completionTokens: 1, totalTokens: 5 },
      contentPreview: "OK",
    }));

    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        data={adminData()}
        onSetUserStatus={onSetUserStatus}
        onSetUserRole={onSetUserRole}
        onCreateRestriction={onCreateRestriction}
        onUpdateSafetyEvent={onUpdateSafetyEvent}
        onCreateInvite={onCreateInvite}
        onDisableInvite={onDisableInvite}
        onSavePlatformSettings={onSavePlatformSettings}
        onCheckProviderHealth={onCheckProviderHealth}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite Links" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open Safety Events" })).toBeInTheDocument();
    expect(screen.getByText(/Promote admins here after bootstrap/)).toBeInTheDocument();
    expect(screen.getByText("3 calls")).toBeInTheDocument();
    expect(screen.getByText(/1,650 tokens/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Invite note"));
    await user.type(screen.getByLabelText("Invite note"), "UAT tester");
    await user.click(screen.getByRole("button", { name: "Create Invite" }));
    expect(onCreateInvite).toHaveBeenCalledWith(expect.objectContaining({ note: "UAT tester", maxUses: 1, expiresInDays: 14 }));
    expect(await screen.findByLabelText("Created invite link")).toHaveValue("https://example.com/app/#invite=invite-token-test");
    expect(screen.queryByDisplayValue("invite-token-test")).not.toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("tab", { name: "Operations" }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(onDisableInvite).toHaveBeenCalledWith("invite-1");

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    await user.clear(screen.getByLabelText("Provider model"));
    await user.type(screen.getByLabelText("Provider model"), "deepseek/deepseek-chat");
    await user.click(screen.getByRole("button", { name: "Test Model Provider" }));
    expect(onCheckProviderHealth).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Provider check passed: test \/ model replied/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("OpenRouter routing preference"), "latency");
    await user.selectOptions(screen.getByLabelText("OpenRouter data policy"), "allow");
    await user.clear(screen.getByLabelText("Bootstrap admin emails"));
    await user.type(screen.getByLabelText("Bootstrap admin emails"), "ops@example.com");
    await user.click(screen.getByRole("button", { name: "Save Platform Settings" }));
    expect(onSavePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({
          model: "deepseek/deepseek-chat",
          openRouterProviderSort: "latency",
          openRouterDataCollection: "allow",
        }),
        administration: expect.objectContaining({
          adminEmails: ["ops@example.com"],
        }),
      }),
    );

    await user.selectOptions(screen.getByLabelText("Account status"), "disabled");
    expect(onSetUserStatus).toHaveBeenCalledWith("user-target", "disabled");
    await user.selectOptions(screen.getByLabelText("Account role"), "admin");
    expect(onSetUserRole).toHaveBeenCalledWith("user-target", "admin");

    await user.click(screen.getByRole("button", { name: "Apply Restriction" }));
    expect(onCreateRestriction).toHaveBeenCalledWith(
      "user-target",
      expect.objectContaining({
        level: "watched",
        sharingDisabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(onUpdateSafetyEvent).toHaveBeenCalledWith("event-1", "reviewed");

    await user.click(screen.getByRole("tab", { name: "Operations" }));
    expect(screen.getByRole("heading", { name: "Adventures" })).toBeInTheDocument();
    expect(screen.getAllByText(/owner Target/).length).toBeGreaterThan(0);
  });

  it("archives resolved safety events behind the safety archive view", async () => {
    const user = userEvent.setup();
    const onUpdateSafetyEvent = vi.fn(async () => undefined);
    const data = adminData();
    data.users[0].safetyEventCount = 2;
    data.safetyEvents.push({
      id: "event-archived",
      userId: "user-target",
      category: "prompt_injection_or_policy_evasion",
      severity: 3,
      gate: "input",
      status: "reviewed",
      createdAt,
    });

    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        data={data}
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={onUpdateSafetyEvent}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Open Safety Events" })).toBeInTheDocument();
    expect(screen.queryByText("event-archived")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Safety Archive/ }));

    expect(screen.getByRole("heading", { name: "Resolved Safety Events" })).toBeInTheDocument();
    expect(screen.getByText("event-archived")).toBeInTheDocument();
    expect(screen.getAllByText("Target").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(onUpdateSafetyEvent).toHaveBeenCalledWith("event-archived", "open");
  });

  it("filters operations diagnostics by record type, focus, and search", async () => {
    const user = userEvent.setup();
    const data = adminData();
    data.performanceTraces.push({
      id: "perf-fast",
      traceId: "trace-fast",
      source: "database",
      phase: "quick_read",
      route: "/admin/console",
      method: "GET",
      userId: "user-target",
      status: "ok",
      statusCode: 200,
      durationMs: 24,
      createdAt,
    });

    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        data={data}
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={vi.fn()}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Operations" }));

    expect(screen.getByRole("heading", { name: "Operations Filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Policy Decisions" })).toBeInTheDocument();
    expect(screen.getByText(/provider_call/)).toBeInTheDocument();
    expect(screen.getByText(/quick_read/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Record type"), "latency");

    expect(screen.getByRole("heading", { name: "Latency Traces" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Policy Decisions" })).not.toBeInTheDocument();
    expect(screen.getByText("p50")).toBeInTheDocument();
    expect(screen.getByText("p95")).toBeInTheDocument();
    expect(screen.getAllByText(/model provider/i).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText("Focus"), "attention");

    expect(screen.getByText(/provider_call/)).toBeInTheDocument();
    expect(screen.queryByText(/quick_read/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Focus"), "all");
    await user.type(screen.getByLabelText("Search operations"), "quick_read");

    expect(screen.getByText(/quick_read/)).toBeInTheDocument();
    expect(screen.queryByText(/provider_call/)).not.toBeInTheDocument();
  });

  it("renders legacy partial admin activity rows without blanking the console", async () => {
    const user = userEvent.setup();
    const data = adminData();
    (data.users[0] as unknown as { usageStats?: unknown; currentRestriction?: unknown }).usageStats = undefined;
    (data.users[0] as unknown as { usageStats?: unknown; currentRestriction?: unknown }).currentRestriction = undefined;
    (data.policyDecisions[0] as unknown as { categories?: unknown; matchedRuleIds?: unknown; severity?: unknown }).categories = undefined;
    (data.policyDecisions[0] as unknown as { categories?: unknown; matchedRuleIds?: unknown; severity?: unknown }).matchedRuleIds = undefined;
    (data.policyDecisions[0] as unknown as { categories?: unknown; matchedRuleIds?: unknown; severity?: unknown }).severity = undefined;
    (data.performanceTraces[0] as unknown as { durationMs?: unknown; statusCode?: unknown }).durationMs = undefined;
    (data.performanceTraces[0] as unknown as { durationMs?: unknown; statusCode?: unknown }).statusCode = undefined;

    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        data={data}
        onSetUserStatus={vi.fn()}
        onSetUserRole={vi.fn()}
        onCreateRestriction={vi.fn()}
        onUpdateSafetyEvent={vi.fn()}
        onCreateInvite={vi.fn()}
        onDisableInvite={vi.fn()}
        onSavePlatformSettings={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.getAllByText("none").length).toBeGreaterThan(0);
    expect(screen.getByText("0 calls")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Operations" }));

    expect(screen.getByRole("heading", { name: "Policy Decisions" })).toBeInTheDocument();
    expect(screen.getByText(/severity 0/)).toBeInTheDocument();
    expect(screen.getByText(/No categories/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Latency Traces" })).toBeInTheDocument();
  });
});
