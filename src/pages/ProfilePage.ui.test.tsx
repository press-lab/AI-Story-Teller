/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendProfileSummary, BackendPublicProfileSummary, BackendSessionState } from "../runtime/backendApi";
import { createDefaultAdventure } from "../state/defaults";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { ProfilePage } from "./ProfilePage";

const timestamp = "2026-07-04T00:00:00.000Z";
const adventureThumbnail = {
  dataUrl: "data:image/png;base64,YWR2ZW50dXJl",
  mimeType: "image/png",
  altText: "Private adventure cover",
  updatedAt: timestamp,
};
const scenarioThumbnail = {
  dataUrl: "data:image/png;base64,c2NlbmFyaW8=",
  mimeType: "image/png",
  altText: "Draft scenario cover",
  updatedAt: timestamp,
};
const publicScenarioThumbnail = {
  dataUrl: "data:image/png;base64,cHVibGlj",
  mimeType: "image/png",
  altText: "Published scenario cover",
  updatedAt: timestamp,
};

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
        thumbnailImage: adventureThumbnail,
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
        thumbnailImage: scenarioThumbnail,
        revisionCount: 1,
        publishedRevisionCount: 0,
        latestRevision: {
          id: "revision-1",
          version: 1,
          status: "draft",
          createdAt: timestamp,
        },
      },
      {
        id: "scenario-2",
        title: "Published Scenario",
        description: "Reusable published setup.",
        sourceAdventureId: "adventure-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        thumbnailImage: publicScenarioThumbnail,
        revisionCount: 1,
        publishedRevisionCount: 1,
        latestRevision: {
          id: "revision-2",
          version: 1,
          status: "published",
          createdAt: timestamp,
          publishedAt: timestamp,
        },
      },
    ],
  };
}

function publicProfile(): BackendPublicProfileSummary {
  return {
    user: {
      id: "user-creator",
      displayName: "Creator",
      createdAt: timestamp,
    },
    profile: {
      userId: "user-creator",
      displayName: "Creator",
      bio: "Builds shared worlds.",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    scenarios: [
      {
        scenarioId: "scenario-public",
        revisionId: "revision-public",
        ownerUserId: "user-creator",
        ownerDisplayName: "Creator",
        title: "Published World",
        description: "A public setup.",
        version: 2,
        createdAt: timestamp,
        publishedAt: timestamp,
        thumbnailImage: publicScenarioThumbnail,
      },
    ],
  };
}

describe("ProfilePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("separates scenarios from adventures and exposes library actions", async () => {
    const user = userEvent.setup();
    const onOpenAdventure = vi.fn(async () => undefined);
    const onEditAdventure = vi.fn(async () => undefined);
    const onDeleteAdventure = vi.fn(async () => undefined);
    const onPublishAdventure = vi.fn(async () => undefined);
    const onPublishScenarioRevision = vi.fn(async () => undefined);
    const onUnpublishScenarioRevision = vi.fn(async () => undefined);
    const onStartScenario = vi.fn(async () => undefined);
    const onDeleteScenario = vi.fn(async () => undefined);
    const onLogout = vi.fn();

    render(
      <ProfilePage
        backendMode
        backendSession={session()}
        profile={profile()}
        onOpenAdventure={onOpenAdventure}
        onEditAdventure={onEditAdventure}
        onDeleteAdventure={onDeleteAdventure}
        onPublishAdventure={onPublishAdventure}
        onPublishScenarioRevision={onPublishScenarioRevision}
        onUnpublishScenarioRevision={onUnpublishScenarioRevision}
        onStartScenario={onStartScenario}
        onDeleteScenario={onDeleteScenario}
        onLogout={onLogout}
      />,
    );

    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    const scenariosHeading = screen.getByRole("heading", { name: "Scenarios" });
    const adventuresHeading = screen.getByRole("heading", { name: "Adventures" });
    expect(scenariosHeading.compareDocumentPosition(adventuresHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByAltText("Draft scenario cover")).toBeInTheDocument();
    expect(screen.getByAltText("Private adventure cover")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start adventure from Draft Scenario" }));
    expect(onStartScenario).toHaveBeenCalledWith("revision-1");

    await user.click(screen.getByRole("button", { name: "Publish Latest" }));
    expect(onPublishScenarioRevision).toHaveBeenCalledWith("revision-1");

    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(onUnpublishScenarioRevision).toHaveBeenCalledWith("revision-2");

    await user.click(screen.getByRole("button", { name: "Delete scenario Draft Scenario" }));
    expect(onDeleteScenario).toHaveBeenCalledWith("scenario-1");

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Publish Scenario" }));
    expect(onPublishAdventure).toHaveBeenCalledWith("adventure-1");

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("uses the live adventure thumbnail when profile summaries are stale", () => {
    const staleProfile = profile();
    staleProfile.adventures[0].thumbnailImage = undefined;
    staleProfile.scenarios[0].thumbnailImage = undefined;
    const liveAdventure = createDefaultAdventure("Private Playthrough");
    liveAdventure.id = "adventure-1";
    liveAdventure.metadata = thumbnailMetadataPatch({
      dataUrl: "data:image/png;base64,bGl2ZQ==",
      mimeType: "image/png",
      altText: "Live adventure cover",
      updatedAt: timestamp,
    });

    render(
      <ProfilePage
        backendMode
        backendSession={session()}
        profile={staleProfile}
        liveAdventure={liveAdventure}
      />,
    );

    const images = screen.getAllByAltText("Live adventure cover");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "data:image/png;base64,bGl2ZQ==");
  });

  it("shows public profiles without private account data", async () => {
    const user = userEvent.setup();
    const onStartScenario = vi.fn(async () => undefined);
    const onViewOwnProfile = vi.fn();

    render(
      <ProfilePage
        backendMode
        backendSession={session()}
        publicProfile={publicProfile()}
        viewMode="public"
        onStartScenario={onStartScenario}
        onViewOwnProfile={onViewOwnProfile}
      />,
    );

    expect(screen.getByRole("heading", { name: "Creator" })).toBeInTheDocument();
    expect(screen.getByText("Builds shared worlds.")).toBeInTheDocument();
    expect(screen.getByText("Published World")).toBeInTheDocument();
    expect(screen.getByAltText("Published scenario cover")).toBeInTheDocument();
    expect(screen.queryByText("player@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Private Playthrough")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start Adventure" }));
    expect(onStartScenario).toHaveBeenCalledWith("revision-public");

    await user.click(screen.getByRole("button", { name: "Your Profile" }));
    expect(onViewOwnProfile).toHaveBeenCalledOnce();
  });
});
