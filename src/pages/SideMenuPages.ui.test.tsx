/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure, makeBrain, makeComponent, makeStoryCard, makeTriggerRule } from "../state/defaults";
import type { Adventure, AdventureAction } from "../types/adventure";

import { BrainsPage } from "./BrainsPage";
import { ChroniclePage } from "./ChroniclePage";
import { ComponentsPage } from "./ComponentsPage";
import { ContextPreviewPage } from "./ContextPreviewPage";
import { ImportExportPage } from "./ImportExportPage";
import { MemoryInboxPage } from "./MemoryInboxPage";
import { StoryCardsPage } from "./StoryCardsPage";
import { SummaryPage } from "./SummaryPage";
import { TriggersPage } from "./TriggersPage";

const timestamp = "2026-01-01T00:00:00.000Z";

function seedAdventure(): Adventure {
  return {
    ...createDefaultAdventure("Side Menu Test"),
    messages: [{ id: "msg-1", role: "assistant", content: "Rain waits outside.", createdAt: timestamp }],
  };
}

function renderWithAdventure(renderPage: (adventure: Adventure, dispatch: (action: AdventureAction) => void) => ReactNode) {
  function StatefulPage() {
    const [adventure, setAdventure] = useState(seedAdventure());
    const dispatch = (action: AdventureAction) => setAdventure((current) => adventureReducer(current, action));
    return <>{renderPage(adventure, dispatch)}</>;
  }

  render(<StatefulPage />);
}

describe("side menu page smoke coverage", () => {
  afterEach(() => {
    cleanup();
  });

  it("covers World editor creation flows", async () => {
    const user = userEvent.setup();

    renderWithAdventure((adventure, dispatch) => <ComponentsPage adventure={adventure} dispatch={dispatch} />);
    await user.click(screen.getByRole("button", { name: "Add Custom Block" }));
    expect(screen.getByText("Custom", { selector: ".story-card-title" })).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => <StoryCardsPage adventure={adventure} dispatch={dispatch} />);
    await user.click(screen.getByRole("button", { name: "Create Story Card" }));
    expect(screen.getByDisplayValue("New Story Card")).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <BrainsPage adventure={adventure} dispatch={dispatch} loading={false} onUpdateBrainNow={async () => undefined} />
    ));
    await user.click(screen.getByRole("button", { name: "Create Character Self" }));
    expect(screen.getByDisplayValue("New Character")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Additional Triggers / Aliases"), "Blazer, Blonde Blazer, Mandy");
    expect(screen.getByDisplayValue("Blazer, Blonde Blazer, Mandy")).toBeInTheDocument();
  });

  it("renders the Arc Director on a Current Arc component and the AI generators", async () => {
    const arcAdventure: Adventure = {
      ...seedAdventure(),
      components: [makeComponent({ title: "Current Story Arc", type: "currentArc", content: "The Red Ring tightens." })],
    };
    render(
      <ComponentsPage
        adventure={arcAdventure}
        dispatch={() => undefined}
        onGenerateComponent={async () => ""}
        onGenerateArc={async () => undefined}
      />,
    );
    // jsdom keeps <details> content in the DOM regardless of open state
    expect(screen.getByText("🎬 Arc Director")).toBeInTheDocument();
    expect(screen.getByText(/The Baddie/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Arc" })).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <BrainsPage adventure={adventure} dispatch={dispatch} loading={false} onUpdateBrainNow={async () => undefined} onGenerateBrain={async () => undefined} />
    ));
    expect(screen.getByRole("button", { name: "✨ Generate from name" })).toBeInTheDocument();
  });

  it("sends a guided Story Card builder request to the AI memory suggestion flow", async () => {
    const user = userEvent.setup();
    const onBuildStoryCardMemory = vi.fn(async () => undefined);
    renderWithAdventure((adventure, dispatch) => (
      <StoryCardsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onBuildStoryCardMemory={onBuildStoryCardMemory}
      />
    ));

    const description = "Margo is a ward engineer who hides fear behind dry teasing.";
    await user.type(screen.getByLabelText("Story Card description"), description);
    await user.click(screen.getByRole("button", { name: "Draft Card Suggestion" }));

    expect(onBuildStoryCardMemory).toHaveBeenCalledWith({
      description,
      intent: "relationship",
      memoryMode: "living",
      targetCardId: undefined,
      autoUpdate: true,
      autoUpdateCooldownTurns: 3,
    });
  });

  it("surfaces Story Card cleanup as a maintenance action", async () => {
    const user = userEvent.setup();
    const onAuditStoryCards = vi.fn(async () => []);
    const onSuggestCardUpdates = vi.fn(async () => undefined);

    renderWithAdventure((adventure, dispatch) => (
      <StoryCardsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onAuditStoryCards={onAuditStoryCards}
        onSuggestCardUpdates={onSuggestCardUpdates}
      />
    ));

    expect(screen.getByText("Review and Maintain Cards")).toBeInTheDocument();
    expect(screen.getByText("Clean up existing cards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean Up Cards" })).toBeInTheDocument();
    expect(screen.getByText("Automatic Card Updates")).toBeInTheDocument();
    expect(screen.getByText("Story Card JSON")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clean Up Cards" }));
    expect(onAuditStoryCards).toHaveBeenCalledWith(20);
  });

  it("surfaces Plot Component cleanup as a maintenance action", async () => {
    const user = userEvent.setup();
    const onAuditComponents = vi.fn(async () => []);
    const onSuggestPlotUpdates = vi.fn(async () => undefined);

    renderWithAdventure((adventure, dispatch) => (
      <ComponentsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onAuditComponents={onAuditComponents}
        onSuggestPlotUpdates={onSuggestPlotUpdates}
      />
    ));

    expect(screen.getByText("Review and Maintain Components")).toBeInTheDocument();
    expect(screen.getByText("Clean up plot components")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean Up Components" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clean Up Components" }));
    expect(onAuditComponents).toHaveBeenCalledWith(20);
  });

  it("filters Story Cards by active status and living mode", async () => {
    const user = userEvent.setup();
    const adventure: Adventure = {
      ...seedAdventure(),
      storyCards: [
        makeStoryCard({ title: "Living Ally", content: "Changes over time.", active: true, memoryMode: "living" }),
        makeStoryCard({ title: "Static Base", content: "Always true.", active: true, memoryMode: "static" }),
        makeStoryCard({ title: "Dormant Romance", content: "Not currently active.", active: false, memoryMode: "living" }),
      ],
    };

    render(<StoryCardsPage adventure={adventure} dispatch={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Active" }));
    await user.click(screen.getByRole("button", { name: "Living" }));

    const visibleCards = document.querySelectorAll(".story-card-editor-item");
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0]).toHaveTextContent("Living Ally");
    expect(visibleCards[0]).not.toHaveTextContent("Static Base");
    expect(visibleCards[0]).not.toHaveTextContent("Dormant Romance");
    expect(screen.getByText("1 shown")).toBeInTheDocument();
  });

  it("shows update timestamps on editor item summaries", () => {
    const adventure: Adventure = {
      ...seedAdventure(),
      storyCards: [
        makeStoryCard({
          title: "Living Ally",
          content: "Changes over time.",
          active: true,
          lastMemoryUpdatedAt: timestamp,
          updatedAt: timestamp,
        }),
      ],
      components: [
        makeComponent({
          title: "Plot Essentials",
          type: "plotEssentials",
          content: "The Beast is hunting Seth.",
          lastMemoryUpdatedAt: timestamp,
          updatedAt: timestamp,
        }),
      ],
      brains: [
        makeBrain({
          characterName: "Margo",
          updatedAt: timestamp,
        }),
      ],
      triggerRules: [
        makeTriggerRule({
          name: "Door opens",
          updatedAt: timestamp,
        }),
      ],
    };

    render(<StoryCardsPage adventure={adventure} dispatch={() => undefined} />);
    expect(screen.getByTitle(/Updated:/)).toHaveTextContent("Updated");
    expect(screen.getByTitle(/Last memory update:/)).toHaveTextContent("Memory");
    cleanup();

    render(<ComponentsPage adventure={adventure} dispatch={() => undefined} />);
    expect(screen.getByTitle(/Updated:/)).toHaveTextContent("Updated");
    expect(screen.getByTitle(/Last memory update:/)).toHaveTextContent("Memory");
    cleanup();

    render(<BrainsPage adventure={adventure} dispatch={() => undefined} loading={false} onUpdateBrainNow={async () => undefined} />);
    expect(screen.getByTitle(/Updated:/)).toHaveTextContent("Updated");
    cleanup();

    render(<TriggersPage adventure={adventure} dispatch={() => undefined} />);
    expect(screen.getByTitle(/Updated:/)).toHaveTextContent("Updated");
  });

  it("covers Memory Inbox proposal creation and approval", async () => {
    const user = userEvent.setup();
    renderWithAdventure((adventure, dispatch) => <MemoryInboxPage adventure={adventure} dispatch={dispatch} />);

    await user.type(screen.getByLabelText("Source Text"), "Margo calls Seth hedge prince as a private joke.");
    await user.click(screen.getByRole("button", { name: "Create Suggestion" }));

    expect(screen.getAllByDisplayValue("Margo calls Seth hedge prince as a private joke.")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/· approved/i)).toBeInTheDocument();
  });

  it("covers Inspector pages and Chronicle/Summary entry points", async () => {
    const user = userEvent.setup();
    const onBuildContext = vi.fn();
    const onImportAdventure = vi.fn(async () => undefined);
    const onCreateAdventureFromImport = vi.fn(async () => undefined);
    const onOpenImportedAdventure = vi.fn();

    renderWithAdventure((adventure, dispatch) => (
      <ContextPreviewPage adventure={adventure} dispatch={dispatch} onBuildContext={onBuildContext} />
    ));
    await user.click(screen.getByRole("button", { name: "Rebuild Preview" }));
    expect(onBuildContext).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Provider Payload Preview/i)).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => <TriggersPage adventure={adventure} dispatch={dispatch} />);
    await user.click(screen.getByRole("button", { name: "Create Trigger" }));
    expect(screen.getByDisplayValue("New Trigger")).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <ImportExportPage
        adventure={adventure}
        dispatch={dispatch}
        onImportAdventure={onImportAdventure}
        onCreateAdventureFromImport={onCreateAdventureFromImport}
        onOpenImportedAdventure={onOpenImportedAdventure}
      />
    ));
    expect(screen.getByText("Back up this adventure")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Back Up/i })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /Migrate/i }));
    expect(screen.getByText("Step 1: Story Text or Action JSON")).toBeInTheDocument();
    cleanup();

    const onGenerateDurableSummary = vi.fn(async () => "Generated durable summary.");
    const onGenerateSceneState = vi.fn(async () => "Generated scene state.");
    renderWithAdventure((adventure, dispatch) => (
      <SummaryPage adventure={adventure} dispatch={dispatch} onGenerateDurableSummary={onGenerateDurableSummary} onGenerateSceneState={onGenerateSceneState} />
    ));
    const regenerateButtons = screen.getAllByRole("button", { name: "Regenerate" });
    await user.click(regenerateButtons[0]);
    expect(onGenerateDurableSummary).toHaveBeenCalledTimes(1);
    cleanup();

    renderWithAdventure((adventure, dispatch) => <ChroniclePage adventure={adventure} dispatch={dispatch} />);
    expect(screen.getByText("Rain waits outside.")).toBeInTheDocument();
  });
});
