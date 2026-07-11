/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PremadeAdventureDefinition } from "../dev/premadeAdventures";
import type { BackendExploreScenarioSummary, BackendPublicProfileSearchResult, BackendSessionState } from "../runtime/backendApi";
import { createDefaultAdventure } from "../state/defaults";
import { ExplorePage } from "./ExplorePage";

const createdAt = "2026-07-04T00:00:00.000Z";

function session(): BackendSessionState {
  return {
    sessionToken: "session-player",
    user: {
      id: "user-player",
      email: "player@example.com",
      displayName: "Player",
      status: "active",
      emailVerified: true,
      createdAt,
      updatedAt: createdAt,
    },
    profile: {
      userId: "user-player",
      displayName: "Player",
      bio: "",
      createdAt,
      updatedAt: createdAt,
    },
  };
}

function backendScenario(overrides: Partial<BackendExploreScenarioSummary> = {}): BackendExploreScenarioSummary {
  return {
    scenarioId: "scenario-1",
    revisionId: "revision-1",
    ownerUserId: "user-creator",
    ownerDisplayName: "Creator",
    title: "Community Scenario",
    description: "Shared setup.",
    version: 1,
    createdAt,
    publishedAt: createdAt,
    ...overrides,
  };
}

function profileResult(overrides: Partial<BackendPublicProfileSearchResult> = {}): BackendPublicProfileSearchResult {
  return {
    userId: "user-creator",
    displayName: "Creator",
    bio: "Writes weird little clockwork tragedies.",
    createdAt,
    scenarioCount: 1,
    followerCount: 2,
    isFollowing: true,
    friendshipStatus: "friends",
    scenarios: [backendScenario({ title: "Clockwork City" })],
    ...overrides,
  };
}

function premade(overrides: Partial<PremadeAdventureDefinition> = {}): PremadeAdventureDefinition {
  const title = overrides.title ?? "The Rookery";
  return {
    id: "rookery",
    title,
    eyebrow: "Powered Mercenary Drama",
    summary: "A built-in setup.",
    tags: ["original", "romance"],
    createAdventure: () => createDefaultAdventure(title),
    createAdventureJson: () => "{}",
    createStoryCardsJson: () => "[]",
    ...overrides,
  };
}

describe("ExplorePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("previews a built-in Scenario before creating a private Story", async () => {
    const user = userEvent.setup();
    const onStartPremade = vi.fn(async () => undefined);

    render(
      <ExplorePage
        backendMode={false}
        scenarios={[]}
        premadeAdventures={[premade()]}
        onStartPremade={onStartPremade}
      />,
    );

    expect(screen.getByRole("heading", { name: "Built-in Scenarios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Story" })).not.toBeInTheDocument();
    expect(onStartPremade).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "View details for The Rookery" }));

    const preview = screen.getByRole("region", { name: "The Rookery" });
    expect(within(preview).getByRole("heading", { name: "The Rookery" })).toHaveFocus();
    expect(within(preview).getByText(/creates a private Story for you/i)).toBeInTheDocument();
    expect(within(preview).getByText(/reusable Scenario stays unchanged/i)).toBeInTheDocument();
    const beforeYouStart = within(preview).getByText("Before you start");
    expect(beforeYouStart.closest("details")).not.toHaveAttribute("open");

    await user.click(beforeYouStart);
    expect(beforeYouStart.closest("details")).toHaveAttribute("open");
    expect(within(preview).getByText(/begins with the published player character/i)).toBeInTheDocument();
    await user.click(within(preview).getByRole("button", { name: "Start Story" }));

    expect(onStartPremade).toHaveBeenCalledWith("rookery");
  });

  it("searches persisted text and filters by source and built-in tags", async () => {
    const user = userEvent.setup();
    const secondPremade = premade({
      id: "dispatch-sdn",
      title: "Dispatch",
      eyebrow: "Superhero workplace",
      summary: "Heroes work a difficult shift.",
      tags: ["superheroes"],
    });

    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario()]}
        premadeAdventures={[premade(), secondPremade]}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search scenarios" });
    await user.type(search, "creator");
    expect(screen.getByRole("heading", { name: "Community Scenario" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The Rookery" })).not.toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByRole("button", { name: "Built in" }));
    expect(screen.getByRole("heading", { name: "The Rookery" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Community Scenario" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Built-in tag" }), "superheroes");
    expect(screen.getByRole("heading", { name: "Dispatch" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The Rookery" })).not.toBeInTheDocument();
  });

  it("preserves creator profile navigation and starts a Community Scenario from its preview", async () => {
    const user = userEvent.setup();
    const onStartScenario = vi.fn(async () => undefined);
    const onOpenProfile = vi.fn(async () => undefined);

    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario()]}
        premadeAdventures={[]}
        onStartScenario={onStartScenario}
        onOpenProfile={onOpenProfile}
      />,
    );

    expect(screen.getByRole("heading", { name: "Community Scenarios" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Creator profile" }));
    expect(onOpenProfile).toHaveBeenCalledWith("user-creator");
    expect(onStartScenario).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "View details for Community Scenario" }));
    const profileLinks = screen.getAllByRole("button", { name: "Open Creator profile" });
    await user.click(profileLinks[1]);
    expect(onOpenProfile).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Start Story" }));
    expect(onStartScenario).toHaveBeenCalledWith("revision-1");
  });

  it("uses authored thumbnail images when a Scenario provides them", () => {
    const thumbnail = {
      dataUrl: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      altText: "Community cover art",
    };
    const builtInWithThumbnail = premade({
      createAdventure: () => {
        const adventure = createDefaultAdventure("The Rookery");
        adventure.metadata = { ...adventure.metadata, thumbnailImage: thumbnail };
        return adventure;
      },
    });

    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario({ thumbnailImage: thumbnail })]}
        premadeAdventures={[builtInWithThumbnail]}
      />,
    );

    expect(screen.getAllByRole("img", { name: "Community cover art" })).toHaveLength(2);
  });

  it("shows like totals and wires likes from cards and previews", async () => {
    const user = userEvent.setup();
    const onToggleScenarioLike = vi.fn(async () => undefined);
    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario({ likeCount: 7, likedByViewer: false })]}
        premadeAdventures={[]}
        onToggleScenarioLike={onToggleScenarioLike}
      />,
    );

    expect(screen.getByText("7 likes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Like Community Scenario" }));
    expect(onToggleScenarioLike).toHaveBeenCalledWith("scenario-1", true);

    await user.click(screen.getByRole("button", { name: "View details for Community Scenario" }));
    const likeButtons = screen.getAllByRole("button", { name: "Like Community Scenario" });
    await user.click(likeButtons[0]);
    expect(onToggleScenarioLike).toHaveBeenCalledTimes(2);
  });

  it("searches creator profiles and opens profile results", async () => {
    const user = userEvent.setup();
    const onSearchProfiles = vi.fn(async () => undefined);
    const onOpenProfile = vi.fn(async () => undefined);

    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario()]}
        profileResults={[profileResult()]}
        premadeAdventures={[]}
        onSearchProfiles={onSearchProfiles}
        onOpenProfile={onOpenProfile}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search scenarios" }), "creator");

    await waitFor(() => expect(onSearchProfiles).toHaveBeenLastCalledWith("creator"));
    const people = screen.getByRole("region", { name: "Creator profiles" });
    expect(within(people).getByRole("heading", { name: "Creator" })).toBeInTheDocument();
    expect(within(people).getByText(/Clockwork City/)).toBeInTheDocument();
    expect(within(people).getByText("Following")).toBeInTheDocument();
    expect(within(people).getByText("Friends")).toBeInTheDocument();

    await user.click(within(people).getByRole("button", { name: "View profile" }));
    expect(onOpenProfile).toHaveBeenCalledWith("user-creator");
  });
});
