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
import { AutoCardsPage } from "./AutoCardsPage";
import { BrainsPage } from "./BrainsPage";
import { ChroniclePage } from "./ChroniclePage";
import { ComponentsPage } from "./ComponentsPage";
import { ContextPreviewPage } from "./ContextPreviewPage";
import { ImportExportPage } from "./ImportExportPage";
import { MemoryInboxPage } from "./MemoryInboxPage";
import { QuestsPage } from "./QuestsPage";
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
    expect(screen.getByDisplayValue("New Block")).toBeInTheDocument();
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
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <AutoCardsPage adventure={adventure} dispatch={dispatch} loading={false} onGenerateAutoCardNow={async () => undefined} />
    ));
    await user.click(screen.getByRole("button", { name: "Create Auto-Card" }));
    expect(screen.getAllByDisplayValue("New Auto-Card")[0]).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => <QuestsPage adventure={adventure} dispatch={dispatch} />);
    await user.click(screen.getByRole("button", { name: "Create Quest" }));
    expect(screen.getByDisplayValue("New Quest")).toBeInTheDocument();
  });

  it("covers Memory Inbox proposal creation and approval", async () => {
    const user = userEvent.setup();
    renderWithAdventure((adventure, dispatch) => <MemoryInboxPage adventure={adventure} dispatch={dispatch} />);

    await user.type(screen.getByLabelText("Source Text"), "Margo calls Seth hedge prince as a private joke.");
    await user.click(screen.getByRole("button", { name: "Create Suggestion" }));

    expect(screen.getAllByDisplayValue("Margo calls Seth hedge prince as a private joke.")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });

  it("covers Inspector pages and Chronicle/Summary entry points", async () => {
    const user = userEvent.setup();
    const onBuildContext = vi.fn();
    const onGenerateSummary = vi.fn(async () => undefined);
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
    await user.click(screen.getByRole("button", { name: "Open AID import wizard" }));
    expect(screen.getByText("Step 1: Story Text or Action JSON")).toBeInTheDocument();
    cleanup();

    renderWithAdventure((adventure, dispatch) => (
      <SummaryPage adventure={adventure} dispatch={dispatch} loading={false} onGenerateSummary={onGenerateSummary} />
    ));
    await user.click(screen.getByRole("button", { name: "Generate Summary From History" }));
    expect(onGenerateSummary).toHaveBeenCalledTimes(1);
    cleanup();

    renderWithAdventure((adventure, dispatch) => <ChroniclePage adventure={adventure} dispatch={dispatch} />);
    expect(screen.getByDisplayValue("Rain waits outside.")).toBeInTheDocument();
  });
});
