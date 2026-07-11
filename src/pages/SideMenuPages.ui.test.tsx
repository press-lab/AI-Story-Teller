/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

function renderWithAdventure(
  renderPage: (adventure: Adventure, dispatch: (action: AdventureAction) => void) => ReactNode,
  initialAdventure: Adventure = seedAdventure(),
) {
  function StatefulPage() {
    const [adventure, setAdventure] = useState(initialAdventure);
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
    await user.click(screen.getByRole("button", { name: "Create Reference Card" }));
    expect(screen.getByDisplayValue("New Reference Card")).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <BrainsPage adventure={adventure} dispatch={dispatch} loading={false} onUpdateBrainNow={async () => undefined} />
    ));
    await user.click(screen.getByRole("button", { name: "Create Character Self" }));
    expect(screen.getByDisplayValue("New Character")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Additional Triggers / Aliases"), "Blazer, Blonde Blazer, Mandy");
    expect(screen.getByDisplayValue("Blazer, Blonde Blazer, Mandy")).toBeInTheDocument();
  });

  it("stages Reference Card editing around the story memory and progressive disclosures", async () => {
    const user = userEvent.setup();
    const adventure: Adventure = {
      ...seedAdventure(),
      storyCards: [makeStoryCard({ title: "Morgana", keys: ["Morgana", "Guild"], content: "Morgana leads the lesson." })],
    };

    renderWithAdventure(
      (current, dispatch) => <StoryCardsPage adventure={current} dispatch={dispatch} />,
      adventure,
    );

    expect(screen.getByRole("heading", { name: "Reference Cards" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search Reference Cards")).toBeInTheDocument();

    const filters = screen.getByText("Filter and sort").closest("details");
    expect(filters).not.toHaveAttribute("open");

    await user.click(screen.getByText("Morgana", { selector: ".story-card-title" }));
    expect(screen.getByRole("heading", { name: "Memory the storyteller receives" })).toBeInTheDocument();

    const structuredMemory = screen.getByText("Structured facts (optional)").closest("details");
    const advanced = screen.getByText("Advanced context and automation").closest("details");
    expect(structuredMemory).not.toHaveAttribute("open");
    expect(advanced).not.toHaveAttribute("open");
    expect(screen.getByDisplayValue("Morgana leads the lesson.")).toBeInTheDocument();
  });

  it("opens and scrolls focused Reference Card and World Block sources", async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const onFocusedCard = vi.fn();
      const storyAdventure: Adventure = {
        ...seedAdventure(),
        storyCards: [
          makeStoryCard({
            id: "card-focus",
            title: "Focused Card",
            content: "Focused card context.",
            active: true,
          }),
        ],
      };
      render(
        <StoryCardsPage
          adventure={storyAdventure}
          dispatch={() => undefined}
          focusCard={{ id: "card-focus", requestId: 1 }}
          onFocusedCard={onFocusedCard}
        />,
      );

      await waitFor(() => expect(onFocusedCard).toHaveBeenCalledWith("card-focus"));
      expect(document.getElementById("story-card-source-card-focus")).toHaveAttribute("open");
      expect(scrollIntoView).toHaveBeenCalled();
      cleanup();

      scrollIntoView.mockClear();
      const onFocusedComponent = vi.fn();
      const componentAdventure: Adventure = {
        ...seedAdventure(),
        components: [
          makeComponent({
            id: "component-focus",
            title: "Focused Component",
            type: "custom",
            content: "Focused component context.",
            active: true,
          }),
        ],
      };
      render(
        <ComponentsPage
          adventure={componentAdventure}
          dispatch={() => undefined}
          focusComponent={{ id: "component-focus", requestId: 1 }}
          onFocusedComponent={onFocusedComponent}
        />,
      );

      await waitFor(() => expect(onFocusedComponent).toHaveBeenCalledWith("component-focus"));
      expect(document.getElementById("component-source-component-focus")).toHaveAttribute("open");
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
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

  it("shows when the Current Arc break has been manually armed", async () => {
    const user = userEvent.setup();
    const arcAdventure: Adventure = {
      ...seedAdventure(),
      components: [
        makeComponent({
          title: "Current Story Arc",
          type: "currentArc",
          content: "The Red Ring tightens.",
          arcThreadKeys: ["baddie"],
          arcBreakInstruction: "The baddie forces the confrontation.",
        }),
      ],
    };

    renderWithAdventure(
      (adventure, dispatch) => <ComponentsPage adventure={adventure} dispatch={dispatch} />,
      arcAdventure,
    );

    await user.click(screen.getByRole("button", { name: "Spring it now" }));

    expect(screen.getByRole("button", { name: "Break armed" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Break armed for next output");
  });

  it("keeps Arc Director controls visible in the Play sidebar for an empty aftermath arc", async () => {
    const user = userEvent.setup();
    const arcAdventure: Adventure = {
      ...seedAdventure(),
      components: [
        makeComponent({
          title: "Current Story Arc",
          type: "currentArc",
          content: "",
          arcPremise: "",
          arcThreadKeys: ["baddie"],
          arcState: { phase: "aftermath", tier: 0, threadEngagement: {}, pendingBreak: false },
        }),
      ],
    };

    renderWithAdventure(
      (adventure, dispatch) => (
        <div className="play-sidebar-panel-body">
          <ComponentsPage adventure={adventure} dispatch={dispatch} />
        </div>
      ),
      arcAdventure,
    );

    const arcSummary = screen.getByText("Current Story Arc", { selector: ".story-card-title" }).closest("summary");
    expect(arcSummary).toBeTruthy();
    await user.click(arcSummary as HTMLElement);

    const arcDetails = document.querySelector(".component-arc-details");
    expect(arcDetails).toHaveAttribute("open");
    expect(within(arcDetails as HTMLElement).getByText("Arc Director")).toBeInTheDocument();
    expect(within(arcDetails as HTMLElement).getAllByText("AFTERMATH")).toHaveLength(2);
    expect(within(arcDetails as HTMLElement).getByText("No arc log")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No arc premise or log to save yet.");
    expect(screen.getByRole("button", { name: "Complete Arc -> Reference Card" })).toBeDisabled();
  });

  it("completes the Current Arc into a Reference Card with visible feedback", async () => {
    const user = userEvent.setup();
    const arcAdventure: Adventure = {
      ...seedAdventure(),
      components: [
        makeComponent({
          title: "Current Story Arc",
          type: "currentArc",
          content: "The Red Ring fell apart after the tower fight.",
          arcPremise: "Break the Red Ring",
          arcThreadKeys: ["baddie"],
          arcBreakInstruction: "The baddie forces the confrontation.",
        }),
      ],
    };

    renderWithAdventure(
      (adventure, dispatch) => (
        <>
          <ComponentsPage adventure={adventure} dispatch={dispatch} />
          <span data-testid="story-card-count">{adventure.storyCards.length}</span>
        </>
      ),
      arcAdventure,
    );

    await user.click(screen.getByRole("button", { name: "Complete Arc -> Reference Card" }));

    expect(screen.getByRole("status")).toHaveTextContent("Completed arc saved as Reference Card: Break the Red Ring.");
    expect(screen.getByTestId("story-card-count")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Complete Arc -> Reference Card" })).toBeDisabled();
  });

  it("sends a guided Reference Card builder request to the AI memory suggestion flow", async () => {
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
    await user.type(screen.getByLabelText("Describe what to generate"), description);
    await user.click(screen.getByRole("button", { name: "Draft Reference Card Suggestions" }));

    expect(onBuildStoryCardMemory).toHaveBeenCalledWith({
      description,
      intent: "relationship",
      memoryMode: "living",
      recentMessageCount: 8,
      cardCount: 1,
      targetCardId: undefined,
      autoUpdate: true,
      autoUpdateCooldownTurns: 3,
    });
  });

  it("generates selected World Blocks from a prompt and applies the draft", async () => {
    const user = userEvent.setup();
    const onGenerateComponents = vi.fn(async () => [
      {
        title: "Plot Essentials",
        type: "plotEssentials" as const,
        content: "Fresh Plot Essentials",
        priority: 80,
        alwaysOn: true,
        pinned: true,
        protected: true,
      },
    ]);
    renderWithAdventure((adventure, dispatch) => (
      <ComponentsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onGenerateComponents={onGenerateComponents}
      />
    ));

    const description = "Help with PE for a tense Rookery downtime scene.";
    await user.type(screen.getByLabelText("World Block prompt"), description);
    await user.click(screen.getByRole("button", { name: "Generate World Block Drafts" }));

    await waitFor(() => expect(screen.getByDisplayValue("Fresh Plot Essentials")).toBeInTheDocument());
    expect(onGenerateComponents).toHaveBeenCalledWith({
      description,
      targets: ["plotEssentials"],
      includeRecentStory: true,
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByDisplayValue("Fresh Plot Essentials")).toBeInTheDocument();
  });

  it("surfaces Reference Card cleanup as a maintenance action", async () => {
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

    expect(screen.getByText("Review and Maintain Reference Cards")).toBeInTheDocument();
    expect(screen.getByText("Clean up Reference Cards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean Up Reference Cards" })).toBeInTheDocument();
    expect(screen.getByLabelText("Include AI semantic pass")).not.toBeChecked();
    expect(screen.getByText("Automatic Reference Card Updates")).toBeInTheDocument();
    expect(screen.getByText("Reference Card JSON")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clean Up Reference Cards" }));
    expect(onAuditStoryCards).toHaveBeenCalledWith(20, false);
  });

  it("surfaces World Block cleanup as a maintenance action", async () => {
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

    expect(screen.getByText("Review and Maintain World Blocks")).toBeInTheDocument();
    expect(screen.getByText("Clean up World Blocks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean Up World Blocks" })).toBeInTheDocument();
    expect(screen.getByLabelText("Include AI semantic pass")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Clean Up World Blocks" }));
    expect(onAuditComponents).toHaveBeenCalledWith(20, false);
  });

  it("surfaces Character Brain cleanup as a maintenance action", async () => {
    const user = userEvent.setup();
    const onAuditBrains = vi.fn(async () => []);

    renderWithAdventure((adventure, dispatch) => (
      <BrainsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onUpdateBrainNow={async () => undefined}
        onAuditBrains={onAuditBrains}
      />
    ));

    expect(screen.getByText("Review and Maintain Character Brains")).toBeInTheDocument();
    expect(screen.getByText("Clean up existing brains")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean Up Brains" })).toBeInTheDocument();
    expect(screen.getByLabelText("Include AI semantic pass")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Clean Up Brains" }));
    expect(onAuditBrains).toHaveBeenCalledWith(20, false);
  });

  it("filters Reference Cards by active status and living mode", async () => {
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

  it("filters Reference Cards by pinned and protected flags", async () => {
    const user = userEvent.setup();
    const adventure: Adventure = {
      ...seedAdventure(),
      storyCards: [
        makeStoryCard({ title: "Pinned Plot", content: "Load this before triggered cards.", pinned: true }),
        makeStoryCard({ title: "Protected Secret", content: "Cannot be dropped by token truncation.", protected: true }),
        makeStoryCard({ title: "Loose Note", content: "Normal triggered context." }),
      ],
    };

    render(<StoryCardsPage adventure={adventure} dispatch={() => undefined} />);
    const flagFilter = screen.getByRole("group", { name: "Card flag filter" });

    await user.click(within(flagFilter).getByRole("button", { name: "Flagged" }));
    let visibleCards = document.querySelectorAll(".story-card-editor-item");
    expect(visibleCards).toHaveLength(2);
    expect(visibleCards[0]).toHaveTextContent("Pinned Plot");
    expect(visibleCards[1]).toHaveTextContent("Protected Secret");
    expect(screen.getByText("2 shown")).toBeInTheDocument();

    await user.click(within(flagFilter).getByRole("button", { name: "Pinned" }));
    visibleCards = document.querySelectorAll(".story-card-editor-item");
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0]).toHaveTextContent("Pinned Plot");
    expect(visibleCards[0]).not.toHaveTextContent("Protected Secret");
    expect(visibleCards[0]).not.toHaveTextContent("Loose Note");

    await user.click(within(flagFilter).getByRole("button", { name: "Protected" }));
    visibleCards = document.querySelectorAll(".story-card-editor-item");
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0]).toHaveTextContent("Protected Secret");
    expect(visibleCards[0]).not.toHaveTextContent("Pinned Plot");
    expect(visibleCards[0]).not.toHaveTextContent("Loose Note");
    expect(screen.getByText("1 shown")).toBeInTheDocument();
  });

  it("keeps exact token estimates out of ordinary plot, card, and brain summaries", () => {
    const adventure: Adventure = {
      ...seedAdventure(),
      storyCards: [
        makeStoryCard({ title: "Signal Card", content: "Alpha beta.", active: true }),
      ],
      components: [
        makeComponent({ title: "Plot Essentials", type: "plotEssentials", content: "Alpha beta." }),
      ],
      brains: [
        makeBrain({ characterName: "Margo", thoughts: { turn_1: "Alpha beta." } }),
      ],
    };

    render(<StoryCardsPage adventure={adventure} dispatch={() => undefined} />);
    const cardRow = screen.getByText("Signal Card", { selector: ".story-card-title" }).closest(".story-card-editor-item");
    expect(cardRow).toBeTruthy();
    expect(within(cardRow as HTMLElement).queryByText(/tokens$/)).not.toBeInTheDocument();
    cleanup();

    render(<ComponentsPage adventure={adventure} dispatch={() => undefined} />);
    const componentRow = screen.getByText("Plot Essentials", { selector: ".story-card-title" }).closest(".component-editor-item");
    expect(componentRow).toBeTruthy();
    expect(within(componentRow as HTMLElement).queryByText(/tokens$/)).not.toBeInTheDocument();
    cleanup();

    render(<BrainsPage adventure={adventure} dispatch={() => undefined} loading={false} onUpdateBrainNow={async () => undefined} />);
    const brainRow = screen.getByText("Margo", { selector: ".story-card-title" }).closest(".brain-item");
    expect(brainRow).toBeTruthy();
    expect(within(brainRow as HTMLElement).queryByText(/tokens$/)).not.toBeInTheDocument();
  });

  it("edits visible current and archived brain thoughts inline", async () => {
    const user = userEvent.setup();
    const adventure: Adventure = {
      ...seedAdventure(),
      brains: [
        makeBrain({
          id: "brain-margo",
          characterName: "Margo",
          thoughts: { turn_4: "4 -> I am watching the ward for cracks." },
          archivedThoughts: { turn_1: "1 -> The first read was too simple." },
        }),
      ],
    };

    renderWithAdventure(
      (adventureState, dispatch) => (
        <BrainsPage adventure={adventureState} dispatch={dispatch} loading={false} onUpdateBrainNow={async () => undefined} />
      ),
      adventure,
    );

    const brainSummary = screen.getByText("Margo", { selector: ".story-card-title" }).closest("summary");
    expect(brainSummary).toBeTruthy();
    await user.click(brainSummary as HTMLElement);

    await user.click(screen.getByRole("button", { name: "Edit current thought turn_4" }));
    const currentText = screen.getByLabelText("Thought text (turn_4)");
    await user.clear(currentText);
    await user.type(currentText, "4 -> Edited current thought.");
    await user.click(screen.getByRole("button", { name: "Save thought" }));
    expect(screen.getAllByText("4 -> Edited current thought.")).toHaveLength(2);
    expect(screen.queryByText("4 -> I am watching the ward for cracks.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit archived thought turn_1" }));
    const archivedText = screen.getByLabelText("Thought text (turn_1)");
    await user.clear(archivedText);
    await user.type(archivedText, "1 -> Edited archived thought.");
    await user.click(screen.getByRole("button", { name: "Save thought" }));
    expect(screen.getByText("1 -> Edited archived thought.")).toBeInTheDocument();
    expect(screen.queryByText("1 -> The first read was too simple.")).not.toBeInTheDocument();
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
          content: "The Beast is hunting Avery.",
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

    await user.type(screen.getByLabelText("Source Text"), "Margo calls Avery hedge prince as a private joke.");
    await user.click(screen.getByRole("button", { name: "Create Suggestion" }));

    expect(screen.getAllByDisplayValue("Margo calls Avery hedge prince as a private joke.")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/· approved/i)).toBeInTheDocument();
  });

  it("allows Memory reconcile without a What changed value", async () => {
    const user = userEvent.setup();
    const onReconcileMemory = vi.fn(async () => undefined);
    renderWithAdventure((adventure, dispatch) => (
      <MemoryInboxPage adventure={adventure} dispatch={dispatch} onReconcileMemory={onReconcileMemory} />
    ));

    await user.click(screen.getByRole("button", { name: "Check & Draft Updates" }));

    expect(onReconcileMemory).toHaveBeenCalledWith({
      directive: "",
      entryCount: 20,
      includeBrains: true,
      targetScope: "auto",
    });
  });

  it("drafts Plot and Reference Card reconcile from recent entries", async () => {
    const user = userEvent.setup();
    const onReconcileMemory = vi.fn(async () => ({ generatedCount: 2, pendingDelta: 0, recordedDelta: 2 }));
    renderWithAdventure((adventure, dispatch) => (
      <MemoryInboxPage adventure={adventure} dispatch={dispatch} onReconcileMemory={onReconcileMemory} />
    ));

    await user.type(screen.getByLabelText("What changed? (optional)"), "Update Plot and Reference Cards from the recent OOC planning conversation.");
    await user.click(screen.getByRole("button", { name: "Draft Plot & Reference Card Updates" }));

    expect(onReconcileMemory).toHaveBeenCalledWith({
      directive: "Update Plot and Reference Cards from the recent OOC planning conversation.",
      entryCount: 20,
      includeBrains: false,
      targetScope: "plotAndStoryCards",
    });
    expect(await screen.findByText("Plot and card review auto-approved 2 suggestions. Check History.")).toBeInTheDocument();
  });

  it("covers Inspector pages and Chronicle/Summary entry points", async () => {
    const user = userEvent.setup();
    const onBuildContext = vi.fn();
    const onImportAdventure = vi.fn(async () => undefined);
    const onSaveToCloud = vi.fn(async () => undefined);

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
        onSaveToCloud={onSaveToCloud}
        cloudSaveStatus="Cloud ready."
      />
    ));
    expect(screen.getByText("Back up this adventure")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Back Up/i })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Save to Cloud" }));
    expect(onSaveToCloud).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tab", { name: /Migrate/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Restore/i }));
    expect(screen.getByText("Open an adventure backup")).toBeInTheDocument();
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

  it("shows per-adventure device-only storage controls to admins in Import / Export", async () => {
    const user = userEvent.setup();
    const onDeviceOnlyDataModeChange = vi.fn(async () => undefined);

    renderWithAdventure((adventure, dispatch) => (
      <ImportExportPage
        adventure={adventure}
        dispatch={dispatch}
        onImportAdventure={vi.fn(async () => undefined)}
        onDeviceOnlyDataModeChange={onDeviceOnlyDataModeChange}
      />
    ));
    expect(screen.queryByLabelText("Keep this adventure on this device only")).not.toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <ImportExportPage
        adventure={adventure}
        dispatch={dispatch}
        onImportAdventure={vi.fn(async () => undefined)}
        isBackendAdmin
        deviceOnlyDataMode
        onDeviceOnlyDataModeChange={onDeviceOnlyDataModeChange}
      />
    ));

    expect(screen.getByRole("heading", { name: "Adventure storage" })).toBeInTheDocument();
    const deviceOnlyToggle = screen.getByLabelText("Keep this adventure on this device only");
    expect(deviceOnlyToggle).toBeChecked();
    expect(screen.getByText(/Controls only this adventure/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save to Cloud" })).not.toBeInTheDocument();

    await user.click(deviceOnlyToggle);
    expect(onDeviceOnlyDataModeChange).toHaveBeenCalledWith(false);
  });
});
