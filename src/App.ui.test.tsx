/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

function installLocalStorage() {
  const storage = new Map<string, string>();
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

describe("App adventure tool windows", () => {
  beforeEach(() => {
    savedAdventures = [];
    installLocalStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens management tools as modal windows without leaving the adventure cockpit", async () => {
    const user = userEvent.setup();
    render(<App />);

    const titleInput = screen.getByDisplayValue("New Adventure");
    await user.clear(titleInput);
    await user.type(titleInput, "Modal Test");
    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    await screen.findByText("Adventure Cockpit");
    await user.click(screen.getByRole("button", { name: "Story Cards" }));

    const dialog = await screen.findByRole("dialog", { name: "Story Cards" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Adventure Cockpit")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create Story Card" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Adventure Cockpit")).toBeInTheDocument();
  });
});
