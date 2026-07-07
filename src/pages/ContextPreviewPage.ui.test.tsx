/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "../contextBuilder/contextBuilder";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure, makeComponent, makeStoryCard } from "../state/defaults";
import type { Adventure, AdventureAction, ProviderConfig } from "../types/adventure";
import { ContextPreviewPage } from "./ContextPreviewPage";
import { runContextDedup } from "../ai/contextAI";

vi.mock("../ai/contextAI", () => ({
  runCondenseContent: vi.fn(async () => "Condensed pact context."),
  runContextDedup: vi.fn(async () => []),
}));

const providerConfig: ProviderConfig = {
  name: "test",
  baseUrl: "https://api.example.com",
  apiKey: "test-key",
  model: "test-model",
  temperature: 0.7,
  maxOutputTokens: 256,
};

function renderWithAdventure(
  renderPage: (adventure: Adventure, dispatch: (action: AdventureAction) => void) => ReactNode,
  initialAdventure: Adventure,
) {
  function StatefulPage() {
    const [adventure, setAdventure] = useState(initialAdventure);
    const dispatch = (action: AdventureAction) => setAdventure((current) => adventureReducer(current, action));
    return <>{renderPage(adventure, dispatch)}</>;
  }

  render(<StatefulPage />);
}

describe("ContextPreviewPage condense", () => {
  const mockRunContextDedup = vi.mocked(runContextDedup);

  afterEach(() => {
    cleanup();
  });

  it("updates compact Story Card context immediately after accepting a condensed draft", async () => {
    const user = userEvent.setup();
    const card = makeStoryCard({
      id: "card-pact",
      title: "Avery's Pact",
      content: "",
      keys: ["pact"],
      active: true,
      pinned: true,
      compactKind: "pact",
      compactStatus: "active",
      coreFacts: ["OLD CORE FACT SHOULD DISAPPEAR FROM CONTEXT"],
      currentFacts: ["OLD CURRENT FACT SHOULD DISAPPEAR FROM CONTEXT"],
      recentDevelopments: ["OLD RECENT FACT SHOULD DISAPPEAR FROM CONTEXT"],
    });
    const adventure = { ...createDefaultAdventure("Condense Test"), storyCards: [card] };
    const staleContextResult = buildContext(adventure);

    renderWithAdventure((current, dispatch) => (
      <ContextPreviewPage
        adventure={current}
        dispatch={dispatch}
        contextResult={staleContextResult}
        onBuildContext={() => undefined}
        providerConfig={providerConfig}
      />
    ), adventure);

    expect(screen.getByText(/OLD CORE FACT SHOULD DISAPPEAR/)).toBeInTheDocument();

    const cardRow = screen.getByText("Avery's Pact").closest("tr");
    expect(cardRow).not.toBeNull();
    await user.click(within(cardRow!).getByRole("button", { name: "Condense" }));
    await user.click(await screen.findByRole("button", { name: "Accept Draft" }));

    expect(screen.getByText(/Condensed pact context/)).toBeInTheDocument();
    expect(screen.queryByText(/OLD CORE FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OLD CURRENT FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OLD RECENT FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
  });

  it("runs Auto Dedup deterministically unless the AI pass is checked", async () => {
    mockRunContextDedup.mockClear();
    const user = userEvent.setup();
    const duplicateText = [
      "The red ward key opens the sealed archive under the east tower.",
      "Margo hid the red ward key inside the brass lamp before the gala.",
      "Avery must keep the red ward key away from the Red Ring scouts.",
      "The archive door answers only to the red ward key and Margo's voice.",
    ].join("\n");
    const adventure = {
      ...createDefaultAdventure("Dedup Test"),
      components: [
        makeComponent({
          id: "component-ward-key",
          title: "Ward Key Plot",
          type: "plotEssentials",
          content: duplicateText,
          alwaysOn: true,
          active: true,
        }),
      ],
      storyCards: [
        makeStoryCard({
          id: "card-ward-key",
          title: "Red Ward Key",
          content: duplicateText,
          active: true,
          inclusionPolicy: "always",
          priority: 20,
        }),
      ],
    };

    renderWithAdventure((current, dispatch) => (
      <ContextPreviewPage
        adventure={current}
        dispatch={dispatch}
        onBuildContext={() => undefined}
        providerConfig={providerConfig}
      />
    ), adventure);

    await user.click(screen.getByRole("button", { name: "Auto Dedup" }));

    expect(mockRunContextDedup).not.toHaveBeenCalled();
    expect(await screen.findByText("DETECTED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Duplicate" })).toBeInTheDocument();
  });

  it("filters the displayed context table to duplicate items from the duplicate count", async () => {
    const user = userEvent.setup();
    const duplicateText = [
      "The red ward key opens the sealed archive under the east tower.",
      "Margo hid the red ward key inside the brass lamp before the gala.",
      "Avery must keep the red ward key away from the Red Ring scouts.",
      "The archive door answers only to the red ward key and Margo's voice.",
    ].join("\n");
    const adventure = {
      ...createDefaultAdventure("Duplicate Filter Test"),
      components: [
        makeComponent({
          id: "component-ward-key",
          title: "Ward Key Plot",
          type: "plotEssentials",
          content: duplicateText,
          alwaysOn: true,
          active: true,
        }),
      ],
      storyCards: [
        makeStoryCard({
          id: "card-ward-key",
          title: "Red Ward Key",
          content: duplicateText,
          active: true,
          inclusionPolicy: "always",
          priority: 20,
        }),
        makeStoryCard({
          id: "card-independent-signal",
          title: "Independent Signal",
          content: "Avery carries a clean radio crystal that only hums near unmapped conduits.",
          active: true,
          inclusionPolicy: "always",
        }),
      ],
    };

    renderWithAdventure((current, dispatch) => (
      <ContextPreviewPage
        adventure={current}
        dispatch={dispatch}
        onBuildContext={() => undefined}
        providerConfig={providerConfig}
      />
    ), adventure);

    expect(within(screen.getByRole("table")).getByText("Independent Signal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show duplicate context items only" }));

    const filteredTable = within(screen.getByRole("table"));
    expect(filteredTable.getByText("Ward Key Plot")).toBeInTheDocument();
    expect(filteredTable.getByText("Red Ward Key")).toBeInTheDocument();
    expect(filteredTable.queryByText("Independent Signal")).not.toBeInTheDocument();
    expect(screen.getByText("2 shown")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filter" }));

    expect(within(screen.getByRole("table")).getByText("Independent Signal")).toBeInTheDocument();
  });

  it("unpins Story Cards and Plot Components from context preview actions", async () => {
    const user = userEvent.setup();
    const adventure = {
      ...createDefaultAdventure("Unpin Test"),
      components: [
        makeComponent({
          id: "component-mission-loop",
          title: "Mission Loop",
          type: "custom",
          content: "The team rotates through missions, training, and pressure scenes.",
          active: true,
          alwaysOn: true,
          pinned: true,
        }),
      ],
      storyCards: [
        makeStoryCard({
          id: "card-nyxa",
          title: "Nyxa Tension",
          content: "Nyxa confides doubts while keeping royal distance.",
          active: true,
          inclusionPolicy: "always",
          pinned: true,
        }),
      ],
    };

    renderWithAdventure((current, dispatch) => (
      <ContextPreviewPage
        adventure={current}
        dispatch={dispatch}
        onBuildContext={() => undefined}
        providerConfig={providerConfig}
      />
    ), adventure);

    const cardRow = screen.getByText("Nyxa Tension").closest("tr");
    const componentRow = screen.getByText("Mission Loop").closest("tr");
    expect(cardRow).not.toBeNull();
    expect(componentRow).not.toBeNull();

    await user.click(within(cardRow!).getByRole("button", { name: "Unpin Story Card Nyxa Tension" }));
    await user.click(within(componentRow!).getByRole("button", { name: "Unpin Plot Component Mission Loop" }));

    expect(within(screen.getByText("Nyxa Tension").closest("tr")!).queryByRole("button", { name: "Unpin Story Card Nyxa Tension" })).not.toBeInTheDocument();
    expect(within(screen.getByText("Mission Loop").closest("tr")!).queryByRole("button", { name: "Unpin Plot Component Mission Loop" })).not.toBeInTheDocument();
  });
});
