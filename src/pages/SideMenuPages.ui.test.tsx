/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure } from "../state/defaults";
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
  });

  it("sends a Story Card description to the AI memory suggestion flow", async () => {
    const user = userEvent.setup();
    const onGenerateMemorySuggestion = vi.fn(async () => undefined);
    renderWithAdventure((adventure, dispatch) => (
      <StoryCardsPage
        adventure={adventure}
        dispatch={dispatch}
        loading={false}
        onGenerateMemorySuggestion={onGenerateMemorySuggestion}
      />
    ));

    const description = "Margo is a ward engineer who hides fear behind dry teasing.";
    await user.type(screen.getByLabelText("Story Card description"), description);
    await user.click(screen.getByRole("button", { name: "Generate Memory Suggestion" }));

    expect(onGenerateMemorySuggestion).toHaveBeenCalledWith(description);
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
    expect(screen.getByText("Export Adventure")).toBeInTheDocument();
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
