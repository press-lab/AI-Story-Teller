/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildContext } from "../contextBuilder/contextBuilder";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure, makeStoryCard } from "../state/defaults";
import type { Adventure, AdventureAction, ProviderConfig } from "../types/adventure";
import { ContextPreviewPage } from "./ContextPreviewPage";

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
  it("updates compact Story Card context immediately after accepting a condensed draft", async () => {
    const user = userEvent.setup();
    const card = makeStoryCard({
      id: "card-pact",
      title: "Seth's Pact",
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

    const cardRow = screen.getByText("Seth's Pact").closest("tr");
    expect(cardRow).not.toBeNull();
    await user.click(within(cardRow!).getByRole("button", { name: "Condense" }));
    await user.click(await screen.findByRole("button", { name: "Accept Draft" }));

    expect(screen.getByText(/Condensed pact context/)).toBeInTheDocument();
    expect(screen.queryByText(/OLD CORE FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OLD CURRENT FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OLD RECENT FACT SHOULD DISAPPEAR/)).not.toBeInTheDocument();
  });
});
