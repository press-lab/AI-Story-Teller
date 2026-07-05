/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendProfileSummary, BackendSessionState } from "../runtime/backendApi";
import { ProfilePage } from "./ProfilePage";

const timestamp = "2026-07-04T00:00:00.000Z";

function session(): BackendSessionState {
  return {
    sessionToken: "session-player",
    user: {
      id: "user-player",
      email: "player@example.com",
      displayName: "Player",
      status: "active",
      emailVerified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    profile: {
      userId: "user-player",
      displayName: "Player",
      bio: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

function profile(): BackendProfileSummary {
  return {
    user: session().user,
    profile: session().profile,
    adventures: [
      {
        id: "adventure-1",
        title: "Private Playthrough",
        createdAt: timestamp,
        updatedAt: timestamp,
        turnCount: 7,
        storyEntryCount: 14,
      },
    ],
    scenarios: [
      {
        id: "scenario-1",
        title: "Draft Scenario",
        description: "Reusable setup.",
        sourceAdventureId: "adventure-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        revisionCount: 1,
        publishedRevisionCount: 0,
        latestRevision: {
          id: "revision-1",
          version: 1,
          status: "draft",
          createdAt: timestamp,
        },
      },
    ],
  };
}

describe("ProfilePage", () => {
  afterEach(() => {
    cleanup();
  });

  it("separates scenarios from adventures and exposes library actions", async () => {
    const user = userEvent.setup();
    const onOpenAdventure = vi.fn(async () => undefined);
    const onEditAdventure = vi.fn(async () => undefined);
    const onPublishAdventure = vi.fn(async () => undefined);
    const onPublishScenarioRevision = vi.fn(async () => undefined);
    const onLogout = vi.fn();

    render(
      <ProfilePage
        backendMode
        backendSession={session()}
        profile={profile()}
        onRefresh={vi.fn()}
        onOpenAdventure={onOpenAdventure}
        onEditAdventure={onEditAdventure}
        onPublishAdventure={onPublishAdventure}
        onPublishScenarioRevision={onPublishScenarioRevision}
        onLogout={onLogout}
      />,
    );

    const scenariosHeading = screen.getByRole("heading", { name: "Scenarios" });
    const adventuresHeading = screen.getByRole("heading", { name: "Adventures" });
    expect(scenariosHeading.compareDocumentPosition(adventuresHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish Latest" }));
    expect(onPublishScenarioRevision).toHaveBeenCalledWith("revision-1");

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Publish Scenario" }));
    expect(onPublishAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
