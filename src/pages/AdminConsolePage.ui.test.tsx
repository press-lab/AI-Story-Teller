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

  it("lets backend admin sessions review users and safety events", async () => {
    const user = userEvent.setup();
    const onSetUserStatus = vi.fn(async () => undefined);
    const onCreateRestriction = vi.fn(async () => undefined);
    const onUpdateSafetyEvent = vi.fn(async () => undefined);
    const onCreateInvite = vi.fn(async () => ({ token: "invite-token-test" }));
    const onDisableInvite = vi.fn(async () => undefined);
    const onSavePlatformSettings = vi.fn(async (settings: Partial<BackendAdminConsoleData["platformSettings"]>) => ({
      ...adminData().platformSettings,
      ...settings,
      provider: { ...adminData().platformSettings.provider, ...(settings.provider ?? {}) },
      background: { ...adminData().platformSettings.background, ...(settings.background ?? {}) },
      features: { ...adminData().platformSettings.features, ...(settings.features ?? {}) },
    }));

    render(
      <AdminConsolePage
        backendMode
        backendSession={session("admin")}
        data={adminData()}
        onSetUserStatus={onSetUserStatus}
        onCreateRestriction={onCreateRestriction}
        onUpdateSafetyEvent={onUpdateSafetyEvent}
        onCreateInvite={onCreateInvite}
        onDisableInvite={onDisableInvite}
        onSavePlatformSettings={onSavePlatformSettings}
      />,
    );

    expect(screen.getByRole("heading", { name: "Admin Console" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite Links" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Safety Events" })).toBeInTheDocument();
    expect(screen.getByText(/Admin role is read-only here/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Invite note"));
    await user.type(screen.getByLabelText("Invite note"), "UAT tester");
    await user.click(screen.getByRole("button", { name: "Create Invite" }));
    expect(onCreateInvite).toHaveBeenCalledWith(expect.objectContaining({ note: "UAT tester", maxUses: 1, expiresInDays: 14 }));
    expect(await screen.findByDisplayValue("invite-token-test")).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(onDisableInvite).toHaveBeenCalledWith("invite-1");

    await user.clear(screen.getByLabelText("Provider model"));
    await user.type(screen.getByLabelText("Provider model"), "deepseek/deepseek-chat");
    await user.selectOptions(screen.getByLabelText("OpenRouter routing preference"), "latency");
    await user.click(screen.getByRole("button", { name: "Save Platform Settings" }));
    expect(onSavePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({
          model: "deepseek/deepseek-chat",
          openRouterProviderSort: "latency",
        }),
      }),
    );

    await user.selectOptions(screen.getByLabelText("Account status"), "disabled");
    expect(onSetUserStatus).toHaveBeenCalledWith("user-target", "disabled");

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
  });
});
