/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Adventure } from "./types/adventure";
import App from "./App";

let savedAdventures: Adventure[] = [];

vi.mock("./db/adventureDb", () => ({
  listAdventures: vi.fn(async () =>
    savedAdventures.map((adventure) => ({
      id: adventure.id,
      title: adventure.title,
      createdAt: adventure.createdAt,
      updatedAt: adventure.updatedAt,
      turnCount: adventure.activeState.turn,
      storyEntryCount: adventure.messages.filter(
        (message) => message.role === "user" || message.role === "assistant",
      ).length,
    })),
  ),
  saveAdventure: vi.fn(async (adventure: Adventure) => {
    savedAdventures = [adventure, ...savedAdventures.filter((existing) => existing.id !== adventure.id)];
  }),
  getAdventure: vi.fn(async (id: string) => savedAdventures.find((adventure) => adventure.id === id)),
  deleteAdventure: vi.fn(async (id: string) => {
    savedAdventures = savedAdventures.filter((adventure) => adventure.id !== id);
  }),
}));

vi.mock("./providers/openAICompatible", () => ({
  sendOpenAICompatibleChatCompletion: vi.fn(async () => ({ content: "Mock response", raw: {} })),
}));

function installLocalStorage(initial: Record<string, unknown> = {}) {
  const storage = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const localStorageMock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
    get length() {
      return storage.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}

describe("App adventure tool workspace", () => {
  beforeEach(() => {
    savedAdventures = [];
    installLocalStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens management tools in the editor workspace without losing the adventure", async () => {
    const user = userEvent.setup();
    installLocalStorage({
      "ai-story-teller-runtime-config": { mode: "local", apiBaseUrl: "http://127.0.0.1:8787" },
      "ai-story-teller-backend-session": {
        sessionToken: "session-test",
        user: {
          id: "user-test",
          email: "player@example.com",
          displayName: "Player",
          status: "active",
          emailVerified: true,
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z",
        },
        profile: {
          userId: "user-test",
          displayName: "Player",
          bio: "",
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z",
        },
      },
    });
    render(<App />);

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Explore" })).toBeEnabled();
    expect(within(nav).getByRole("button", { name: "Play" })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: "Story Studio" })).toBeDisabled();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Stories" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New Story" }));
    const titleInput = screen.getByDisplayValue("New Story");
    await user.clear(titleInput);
    await user.type(titleInput, "Workspace Test");
    await user.click(screen.getByRole("button", { name: "Create Story" }));

    // After creation the app lands on the dashboard — title appears as a heading
    await screen.findByRole("heading", { name: "Workspace Test" });
    expect(within(nav).getByRole("button", { name: "Play" })).toBeEnabled();
    expect(within(nav).getByRole("button", { name: "Story Studio" })).toBeEnabled();
    expect(within(nav).getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Context Inspector" })).not.toBeInTheDocument();

    await user.click(within(nav).getByRole("button", { name: "Story Studio" }));
    const editorNav = screen.getByRole("navigation", { name: "Adventure editor" });
    expect(within(editorNav).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Story & Direction",
      "World & Lore",
      "Characters",
      "Suggestions",
    ]);
    const advancedStoryTools = screen.getByText("Advanced Story Tools").closest("details");
    expect(advancedStoryTools).toBeTruthy();
    await user.click(screen.getByText("Advanced Story Tools"));
    const automationButton = within(advancedStoryTools as HTMLElement).getByRole("button", { name: "Automation" });
    const contextButton = within(advancedStoryTools as HTMLElement).getByRole("button", { name: "Context Inspector" });
    expect(automationButton).toBeInTheDocument();
    expect(contextButton).toBeInTheDocument();
    await user.click(automationButton);
    expect(screen.getByText(/Automations watch turns/)).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Story Studio" })).toHaveAttribute("aria-current", "page");
    await user.click(within(screen.getByText("Advanced Story Tools").closest("details") as HTMLElement).getByRole("button", { name: "Context Inspector" }));
    expect(screen.getByRole("button", { name: "Rebuild Preview" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Story Studio" })).toHaveAttribute("aria-current", "page");
    await user.click(within(editorNav).getByRole("button", { name: "World & Lore" }));

    // Now in the editor — title is an editable input
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Workspace Test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Reference Card" })).toBeInTheDocument();

    // Adventure tab returns to dashboard — heading again
    await user.click(within(nav).getByRole("button", { name: "Home" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Continue Story" }).length).toBeGreaterThan(0);
  });

  it("shows only the welcome account gate without a session", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Sign in to continue." })).toBeInTheDocument();
    expect(screen.queryByLabelText("Backend API URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Verification token")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Story" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("opens Browser Local directly without requiring a backend account", async () => {
    installLocalStorage({
      "ai-story-teller-runtime-config": { mode: "local", apiBaseUrl: "http://127.0.0.1:8787" },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Your Stories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Story" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Sign in to continue." })).not.toBeInTheDocument();
  });
});
