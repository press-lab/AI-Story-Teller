/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure, makeComponent } from "../state/defaults";
import type { Adventure, AdventureAction, InputMode } from "../types/adventure";
import { PlayPage } from "./PlayPage";

const timestamp = "2026-01-01T00:00:00.000Z";
type SubmitTurnHandler = (text: string, mode: InputMode) => Promise<void>;
type AsyncHandler = () => Promise<void>;

const noopSubmitTurn: SubmitTurnHandler = async () => undefined;
const noopAsync: AsyncHandler = async () => undefined;

function playAdventure(): Adventure {
  return {
    ...createDefaultAdventure("UI Adventure"),
    messages: [
      { id: "msg-user", role: "user", content: "I open the door.", createdAt: timestamp },
      { id: "msg-ai", role: "assistant", content: "Rain waits outside.", createdAt: timestamp },
    ],
  };
}

function StatefulPlayPage({
  initialAdventure = playAdventure(),
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
    <PlayPage
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

describe("PlayPage AID-style controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits a turn, continues, and retries through the visible controls", async () => {
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    const onContinue = vi.fn<AsyncHandler>(async () => undefined);
    const onRegenerate = vi.fn<AsyncHandler>(async () => undefined);
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} onContinue={onContinue} onRegenerate={onRegenerate} />);

    await user.type(screen.getByPlaceholderText("Guide the next story beat..."), "The hallway tilts.");
    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    expect(onSubmitTurn).toHaveBeenCalledWith("The hallway tilts.", "story");

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("transforms Do mode input like AID action input", async () => {
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Do" }));
    await user.type(screen.getByPlaceholderText("What do you do? (prefixed with 'You ')"), "draw your sword");
    await user.click(screen.getByRole("button", { name: "Take a Turn" }));

    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
  });

  it("edits story text inline and supports erase, undo, and redo", async () => {
    const user = userEvent.setup();
    render(<StatefulPlayPage />);

    const assistantMessage = screen.getByText("Rain waits outside.").closest("article");
    expect(assistantMessage).toBeTruthy();
    await user.click(within(assistantMessage as HTMLElement).getByRole("button", { name: "Edit" }));
    const editor = screen.getByDisplayValue("Rain waits outside.");
    await user.clear(editor);
    await user.type(editor, "Rain lashes the threshold.");
    expect(screen.getByDisplayValue("Rain lashes the threshold.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Erase" }));
    expect(screen.queryByDisplayValue("Rain lashes the threshold.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Rain lashes the threshold.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.queryByText("Rain lashes the threshold.")).not.toBeInTheDocument();
  });

  it("deletes a specific transcript entry from the story text", async () => {
    const user = userEvent.setup();
    render(<StatefulPlayPage />);

    const userMessage = screen.getByText("I open the door.").closest("article");
    expect(userMessage).toBeTruthy();
    await user.click(within(userMessage as HTMLElement).getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("I open the door.")).not.toBeInTheDocument();
    expect(screen.getByText("Rain waits outside.")).toBeInTheDocument();
  });

  it("opens context preview from the composer's Context Preview button", async () => {
    const user = userEvent.setup();
    const onOpenTab = vi.fn();
    const onBuildContext = vi.fn();
    render(
      <PlayPage
        adventure={playAdventure()}
        dispatch={() => undefined}
        loading={false}
        saveStatus="saved"
        onSubmitTurn={noopSubmitTurn}
        onContinue={noopAsync}
        onRegenerate={noopAsync}
        onBuildContext={onBuildContext}
        onOpenContext={() => onOpenTab("context")}
        onRememberThis={async () => undefined}
        onOpenTab={onOpenTab}
      />,
    );

    // The tool strip was removed — Context Preview is now in the composer actions row
    const contextBtn = screen.getByRole("button", { name: "Context Preview" });
    await user.click(contextBtn);
    expect(onBuildContext).toHaveBeenCalledTimes(1);
    expect(onOpenTab).toHaveBeenCalledWith("context");
  });

  it("toggles the inline Remember input from the composer", async () => {
    const user = userEvent.setup();
    const onRememberThis = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayPage
        adventure={playAdventure()}
        dispatch={() => undefined}
        loading={false}
        saveStatus="saved"
        onSubmitTurn={noopSubmitTurn}
        onContinue={noopAsync}
        onRegenerate={noopAsync}
        onBuildContext={() => undefined}
        onOpenContext={() => undefined}
        onRememberThis={onRememberThis}
        onOpenTab={() => undefined}
      />,
    );

    expect(screen.queryByPlaceholderText(/Mira and Kael/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remember" }));
    expect(screen.getByPlaceholderText(/Mira and Kael/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Mira and Kael/), "Kael lost his sword");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onRememberThis).toHaveBeenCalledWith("Kael lost his sword");
    // input dismisses after save
    expect(screen.queryByPlaceholderText(/Mira and Kael/)).not.toBeInTheDocument();
  });

  it("edits the visible Next Output Bias controls through reducer actions", async () => {
    const user = userEvent.setup();
    render(<StatefulPlayPage />);

    await user.click(screen.getByText("Next Output Bias (empty)"));
    await user.type(
      screen.getByLabelText("Visible next-output steering note"),
      "Do not resolve the argument yet.",
    );
    expect(screen.getByDisplayValue("Do not resolve the argument yet.")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Protected"));
    await user.click(screen.getByLabelText("Expires after output"));
    expect(screen.getByLabelText("Protected")).toBeChecked();
    expect(screen.getByLabelText("Expires after output")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByDisplayValue("Do not resolve the argument yet.")).not.toBeInTheDocument();
  });

  it("edits Author's Note inline from the Play surface", async () => {
    const user = userEvent.setup();
    const adventure = {
      ...playAdventure(),
      components: [
        makeComponent({
          id: "author-note",
          title: "Author's Note",
          type: "authorNote",
          content: "Keep the mood restrained.",
          alwaysOn: true,
          pinned: true,
          protected: true,
        }),
      ],
    };
    render(<StatefulPlayPage initialAdventure={adventure} />);

    const editor = screen.getByLabelText("Immediate narrative direction");
    await user.clear(editor);
    await user.type(editor, "Let the silence carry the threat.");

    expect(screen.getByDisplayValue("Let the silence carry the threat.")).toBeInTheDocument();
    expect(screen.getByText(/protected from AI mutation/i)).toBeInTheDocument();
  });
});
