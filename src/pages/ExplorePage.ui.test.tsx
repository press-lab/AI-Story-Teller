/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { BackendExploreScenarioSummary, BackendSessionState } from "../runtime/backendApi";
import type { PremadeAdventureDefinition } from "../dev/premadeAdventures";
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

function backendScenario(): BackendExploreScenarioSummary {
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
  };
}

function premade(): PremadeAdventureDefinition {
  return {
    id: "rookery",
    title: "The Rookery",
    eyebrow: "Powered Mercenary Drama",
    summary: "A built-in setup.",
    tags: ["original"],
    createAdventure: () => createDefaultAdventure("The Rookery"),
    createAdventureJson: () => "{}",
    createStoryCardsJson: () => "[]",
  };
}

describe("ExplorePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exposes built-in premades in browser-local mode with the variable warning", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onStartPremade = vi.fn(async () => undefined);

    render(
      <ExplorePage
        backendMode={false}
        scenarios={[]}
        premadeAdventures={[premade()]}
        onRefresh={vi.fn()}
        onStartPremade={onStartPremade}
      />,
    );

    expect(screen.getByText(/does not substitute user variables yet/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Premade Scenarios" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Adventure" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("does not substitute user variables yet"));
    expect(onStartPremade).toHaveBeenCalledWith("rookery");
  });

  it("starts backend community scenarios after warning confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onStartScenario = vi.fn(async () => undefined);

    render(
      <ExplorePage
        backendMode
        backendSession={session()}
        scenarios={[backendScenario()]}
        premadeAdventures={[]}
        onRefresh={vi.fn()}
        onStartScenario={onStartScenario}
      />,
    );

    expect(screen.getByRole("heading", { name: "Published Scenarios" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start Adventure" }));

    expect(onStartScenario).toHaveBeenCalledWith("revision-1");
  });
});
