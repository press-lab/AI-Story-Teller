/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure } from "../state/defaults";
import type { Adventure, AdventureAction, InputMode } from "../types/adventure";
import { DashboardPage } from "./DashboardPage";

const timestamp = "2026-01-01T00:00:00.000Z";
type SubmitTurnHandler = (text: string, mode: InputMode) => Promise<void>;
type AsyncHandler = () => Promise<void>;

const noopSubmitTurn: SubmitTurnHandler = async () => undefined;
const noopAsync: AsyncHandler = async () => undefined;

function dashboardAdventure(): Adventure {
  return {
    ...createDefaultAdventure("Dashboard Adventure"),
    messages: [
      { id: "msg-user", role: "user", content: "I open the door.", createdAt: timestamp },
      { id: "msg-ai", role: "assistant", content: "Rain waits outside.", createdAt: timestamp },
    ],
  };
}

function StatefulDashboardPage({
  initialAdventure = dashboardAdventure(),
  onSubmitTurn = noopSubmitTurn,
  onContinue = noopAsync,
  onRegenerate = noopAsync,
}: {
  initialAdventure?: Adventure;
  onSubmitTurn?: SubmitTurnHandler;
  onContinue?: AsyncHandler;
  onRegenerate?: AsyncHandler;
}) {
  const [adventure, setAdventure] = useState(initialAdventure);
  const dispatch = (action: AdventureAction) => setAdventure((current) => adventureReducer(current, action));

  return (
    <DashboardPage
      adventure={adventure}
      dispatch={dispatch}
      loading={false}
      saveStatus="saved"
      onSubmitTurn={onSubmitTurn}
      onContinue={onContinue}
      onRegenerate={onRegenerate}
      onBuildContext={() => undefined}
      onOpenContext={() => undefined}
      onRememberThis={async () => undefined}
    />
  );
}

describe("DashboardPage AID-style controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits AID Do-mode input and exposes continue and retry controls", async () => {
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    const onContinue = vi.fn<AsyncHandler>(async () => undefined);
    const onRegenerate = vi.fn<AsyncHandler>(async () => undefined);

    render(<StatefulDashboardPage onSubmitTurn={onSubmitTurn} onContinue={onContinue} onRegenerate={onRegenerate} />);

    await user.click(screen.getByRole("button", { name: "Do" }));
    await user.type(screen.getByPlaceholderText("Continue the story, take an action, or talk to the AI as author..."), "draw your sword");
    await user.click(screen.getByRole("button", { name: "Take a Turn" }));

    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("erases, undoes, and redoes the latest generated story section", async () => {
    const user = userEvent.setup();
    render(<StatefulDashboardPage />);

    expect(screen.getByText("Rain waits outside.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Erase" }));
    expect(screen.queryByText("Rain waits outside.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Rain waits outside.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.queryByText("Rain waits outside.")).not.toBeInTheDocument();
  });
});
