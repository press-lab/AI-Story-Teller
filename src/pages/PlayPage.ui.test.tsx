/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure } from "../state/defaults";
import type { Adventure, AdventureAction, InputMode } from "../types/adventure";
import { PlayPage } from "./PlayPage";

// jsdom doesn't implement IntersectionObserver or scrollBy
global.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;
Element.prototype.scrollBy = () => {};
Element.prototype.scrollIntoView = () => {};

const draftStorage = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    get length() { return draftStorage.size; },
    clear() { draftStorage.clear(); },
    getItem(key: string) { return draftStorage.get(key) ?? null; },
    key(index: number) { return [...draftStorage.keys()][index] ?? null; },
    removeItem(key: string) { draftStorage.delete(key); },
    setItem(key: string, value: string) { draftStorage.set(key, String(value)); },
  } satisfies Storage,
});

const originalInnerWidth = window.innerWidth;
const originalMatchMedia = window.matchMedia;
const timestamp = "2026-01-01T00:00:00.000Z";
type SubmitTurnHandler = (text: string, mode: InputMode) => Promise<void>;
type AsyncHandler = () => Promise<void>;

const noopSubmitTurn: SubmitTurnHandler = async () => undefined;
const noopAsync: AsyncHandler = async () => undefined;

function mediaQueryList(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  } as unknown as MediaQueryList;
}

function setMobileComposerViewport() {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => mediaQueryList(
      query,
      query.includes("max-width: 640px") || query.includes("max-width: 860px") || query.includes("pointer: coarse"),
    )),
  });
}

function restoreViewport() {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: originalInnerWidth });
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
}

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
    localStorage.clear();
    restoreViewport();
  });

  it("submits a turn, continues, and retries through the visible controls", async () => {
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    const onContinue = vi.fn<AsyncHandler>(async () => undefined);
    const onRegenerate = vi.fn<AsyncHandler>(async () => undefined);
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} onContinue={onContinue} onRegenerate={onRegenerate} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" })); // open composer
    await user.click(screen.getByRole("button", { name: "Story" }));
    await user.type(screen.getByPlaceholderText("Guide the next story beat..."), "The hallway tilts.");
    await user.keyboard("{Enter}");
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

    await user.click(screen.getByRole("button", { name: "Take a Turn" })); // open composer
    await user.type(screen.getByPlaceholderText("What does your character do?"), "draw your sword");
    await user.keyboard("{Enter}");

    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
  });

  it("collapses the composer after desktop Enter while keeping submitted text until the turn resolves", async () => {
    const user = userEvent.setup();
    const adventure = playAdventure();
    const draftKey = `play-input-draft-${adventure.id}`;
    let resolveSubmit: (() => void) | undefined;
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));
    render(<StatefulPlayPage initialAdventure={adventure} onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    const input = screen.getByPlaceholderText("What does your character do?");
    await user.type(input, "draw your sword");
    await user.keyboard("{Enter}");

    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
    expect(input).toHaveValue("draw your sword");
    expect(localStorage.getItem(draftKey)).toBe("draw your sword");
    expect(input.closest(".composer")).toHaveClass("composer-input-closed");
    expect(screen.getByRole("button", { name: "Take a Turn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    expect(input.closest(".composer")).not.toHaveClass("composer-input-closed");
    expect(input).toHaveValue("draw your sword");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    resolveSubmit?.();
    await waitFor(() => expect(input).toHaveValue(""));
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("uses Shift+Enter for a desktop newline without submitting", async () => {
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    const input = screen.getByPlaceholderText("What does your character do?");
    await user.type(input, "draw your sword");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmitTurn).not.toHaveBeenCalled();
    expect(input).toHaveValue("draw your sword\n");
  });

  it("does not submit with Enter in the mobile composer", async () => {
    setMobileComposerViewport();
    const user = userEvent.setup();
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => undefined);
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    const input = screen.getByPlaceholderText("What does your character do?");
    await user.type(input, "draw your sword");
    await user.keyboard("{Enter}");

    expect(onSubmitTurn).not.toHaveBeenCalled();
    expect(input).toHaveValue("draw your sword\n");

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
  });

  it("keeps mobile turn text visible until submit resolves", async () => {
    setMobileComposerViewport();
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));
    render(<StatefulPlayPage onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    const input = screen.getByPlaceholderText("What does your character do?");
    await user.type(input, "draw your sword");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
    expect(input).toHaveValue("draw your sword");
    expect(input.closest(".composer")).toHaveClass("composer-input-closed");
    expect(screen.getByRole("button", { name: "Take a Turn" })).toBeInTheDocument();

    resolveSubmit?.();
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("keeps mobile turn text after a rejected submit", async () => {
    setMobileComposerViewport();
    const user = userEvent.setup();
    const adventure = playAdventure();
    const draftKey = `play-input-draft-${adventure.id}`;
    const onSubmitTurn = vi.fn<SubmitTurnHandler>(async () => {
      throw new Error("Network failed");
    });
    render(<StatefulPlayPage initialAdventure={adventure} onSubmitTurn={onSubmitTurn} />);

    await user.click(screen.getByRole("button", { name: "Take a Turn" }));
    const input = screen.getByPlaceholderText("What does your character do?");
    await user.type(input, "draw your sword");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do"));
    expect(onSubmitTurn).toHaveBeenCalledWith("You draw your sword", "do");
    expect(input.closest(".composer")).not.toHaveClass("composer-input-closed");
    expect(input).toHaveValue("draw your sword");
    expect(localStorage.getItem(draftKey)).toBe("draw your sword");
  });

  it("keeps every essential story destination reachable from the mobile Story tools sheet", async () => {
    setMobileComposerViewport();
    const user = userEvent.setup();
    const onOpenPlayTool = vi.fn();
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
        onOpenContext={() => undefined}
        onRememberThis={async () => undefined}
        onOpenTab={onOpenTab}
        onOpenPlayTool={onOpenPlayTool}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Story tools" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const sheet = screen.getByRole("region", { name: "Story tools" });
    await user.click(within(sheet).getByRole("button", { name: "Story & Direction" }));
    await user.click(within(sheet).getByRole("button", { name: "World & Lore" }));
    await user.click(within(sheet).getByRole("button", { name: "Characters" }));
    await user.click(within(sheet).getByRole("button", { name: "Suggestions" }));
    await user.click(within(sheet).getByRole("button", { name: "Context details" }));

    expect(onOpenPlayTool.mock.calls.map(([destination]) => destination)).toEqual([
      "components",
      "storyCards",
      "brains",
      "memoryInbox",
      "context",
    ]);
    expect(onBuildContext).toHaveBeenCalledTimes(1);

    await user.click(within(sheet).getByRole("button", { name: "Studio / Edit all" }));
    expect(onOpenTab).toHaveBeenCalledWith("edit");
  });

  it("makes Edit and Delete reachable from a touch-friendly mobile message action control", async () => {
    setMobileComposerViewport();
    const user = userEvent.setup();
    render(<StatefulPlayPage />);

    const assistantMessage = screen.getByText("Rain waits outside.").closest("article");
    expect(assistantMessage).toBeTruthy();
    const actionTrigger = within(assistantMessage as HTMLElement).getByRole("button", { name: "Story entry actions" });
    expect(actionTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(actionTrigger);

    expect(actionTrigger).toHaveAttribute("aria-expanded", "true");
    expect(within(assistantMessage as HTMLElement).getByRole("button", { name: "Edit" })).toBeVisible();
    expect(within(assistantMessage as HTMLElement).getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("announces a plain-language generation status beside the composer", () => {
    render(
      <PlayPage
        adventure={playAdventure()}
        dispatch={() => undefined}
        loading
        saveStatus="saved"
        onSubmitTurn={noopSubmitTurn}
        onContinue={noopAsync}
        onRegenerate={noopAsync}
        onBuildContext={() => undefined}
        onOpenContext={() => undefined}
        onRememberThis={async () => undefined}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Writing the next scene...");
  });

  it("renders runtime errors inside the story frame before transcript text", () => {
    const error = "Provider error 403: OpenRouter key limit exceeded. Raise or reset the key limit.";
    render(
      <PlayPage
        adventure={playAdventure()}
        dispatch={() => undefined}
        loading={false}
        error={error}
        saveStatus="saved"
        onSubmitTurn={noopSubmitTurn}
        onContinue={noopAsync}
        onRegenerate={noopAsync}
        onBuildContext={() => undefined}
        onOpenContext={() => undefined}
        onRememberThis={async () => undefined}
        onDismissError={() => undefined}
      />,
    );

    const alert = screen.getByRole("alert");
    const storyFrame = alert.closest(".story-text-frame");
    expect(storyFrame).toBeTruthy();
    expect(alert).toHaveClass("play-error");
    expect(storyFrame?.children[0]).toBe(alert);
    expect(screen.getByText("I open the door.").compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
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

  it("scrolls to the top of the newest transcript entry", () => {
    const scrollCalls: Array<{ element: Element; options?: boolean | ScrollIntoViewOptions }> = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(options?: boolean | ScrollIntoViewOptions) {
      scrollCalls.push({ element: this, options });
    };

    try {
      const nextAdventure = playAdventure();
      const initialAdventure = { ...nextAdventure, messages: nextAdventure.messages.slice(0, 1) };
      const props = {
        dispatch: () => undefined,
        loading: false,
        saveStatus: "saved" as const,
        onSubmitTurn: noopSubmitTurn,
        onContinue: noopAsync,
        onRegenerate: noopAsync,
        onBuildContext: () => undefined,
        onOpenContext: () => undefined,
        onRememberThis: async () => undefined,
      };

      const { rerender } = render(<PlayPage adventure={initialAdventure} {...props} />);
      scrollCalls.length = 0;

      rerender(<PlayPage adventure={nextAdventure} {...props} />);

      const newestEntry = screen.getByText("Rain waits outside.").closest("article");
      const lastCall = scrollCalls.at(-1);
      expect(lastCall?.element).toBe(newestEntry);
      expect(lastCall?.options).toEqual({ behavior: "smooth", block: "start" });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("opens context preview from the toolkit nav", async () => {
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

    const contextBtn = screen.getAllByRole("button", { name: "Context details" })[0];
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

  it("edits the visible Next Turn Note controls through reducer actions", async () => {
    const user = userEvent.setup();
    render(<StatefulPlayPage />);

    await user.click(screen.getByText("Next Turn Note (empty)", { exact: false }));
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

});
