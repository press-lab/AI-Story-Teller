/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { ContextBuildResult } from "../types/adventure";
import type { AdventureStore } from "../runtime/adventureStore";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { useAdventureLibrary } from "./useAdventureLibrary";

describe("useAdventureLibrary", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function stableCallbacks(errors?: string[]) {
    return {
      setAdventure: vi.fn(),
      setContextResult: vi.fn((_result: ContextBuildResult | undefined) => undefined),
      onNavigate: vi.fn(),
      onModalClose: vi.fn(),
      onError: vi.fn((message: string) => {
        errors?.push(message);
      }),
    };
  }

  it("hydrates missing summary thumbnails from the full adventure record", async () => {
    const adventure = createDefaultAdventure("Profile Cover Source");
    adventure.id = "adv-profile-cover";
    adventure.metadata = thumbnailMetadataPatch({
      dataUrl: "data:image/png;base64,cHJvZmlsZQ==",
      altText: "Profile hydrated cover",
      mimeType: "image/png",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
    const store: AdventureStore = {
      list: vi.fn(async () => [{
        id: adventure.id,
        title: adventure.title,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt,
        turnCount: 0,
        storyEntryCount: 0,
      }]),
      get: vi.fn(async () => adventure),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const callbacks = stableCallbacks();

    function Harness() {
      const library = useAdventureLibrary(
        store,
        "backend",
        callbacks.setAdventure,
        callbacks.setContextResult,
        callbacks.onNavigate,
        callbacks.onModalClose,
        callbacks.onError,
      );
      const summary = library.adventures[0];
      return (
        <div>
          <span data-testid="thumbnail-alt">{summary?.thumbnailImage?.altText ?? "missing"}</span>
        </div>
      );
    }

    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("thumbnail-alt")).toHaveTextContent("Profile hydrated cover"));
    expect(store.get).toHaveBeenCalledWith("adv-profile-cover");
  });

  it("skips full-record thumbnail hydration when the store opts out", async () => {
    const adventure = createDefaultAdventure("Backend Summary Only");
    adventure.id = "adv-backend-summary";
    const store: AdventureStore = {
      hydrateMissingThumbnails: false,
      list: vi.fn(async () => [{
        id: adventure.id,
        title: adventure.title,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt,
        turnCount: 0,
        storyEntryCount: 0,
      }]),
      get: vi.fn(async () => adventure),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const callbacks = stableCallbacks();

    function Harness() {
      const library = useAdventureLibrary(
        store,
        "backend",
        callbacks.setAdventure,
        callbacks.setContextResult,
        callbacks.onNavigate,
        callbacks.onModalClose,
        callbacks.onError,
      );
      return <span data-testid="title">{library.adventures[0]?.title ?? "missing"}</span>;
    }

    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("title")).toHaveTextContent("Backend Summary Only"));
    expect(store.get).not.toHaveBeenCalled();
  });

  it("keeps the previous list visible when a later refresh fails", async () => {
    const adventure = createDefaultAdventure("Server Adventure");
    adventure.id = "adv-server";
    let shouldFail = false;
    const errors: string[] = [];
    const store: AdventureStore = {
      list: vi.fn(async () => {
        if (shouldFail) throw new Error("Backend list timed out.");
        return [{
          id: adventure.id,
          title: adventure.title,
          createdAt: adventure.createdAt,
          updatedAt: adventure.updatedAt,
          turnCount: 0,
          storyEntryCount: 0,
        }];
      }),
      get: vi.fn(async () => adventure),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const callbacks = stableCallbacks(errors);

    function Harness() {
      const library = useAdventureLibrary(
        store,
        "backend",
        callbacks.setAdventure,
        callbacks.setContextResult,
        callbacks.onNavigate,
        callbacks.onModalClose,
        callbacks.onError,
      );
      return (
        <div>
          <span data-testid="titles">{library.adventures.map((entry) => entry.title).join(", ") || "empty"}</span>
          <button type="button" onClick={() => {
            shouldFail = true;
            void library.refreshAdventures();
          }}>
            Refresh
          </button>
        </div>
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("titles")).toHaveTextContent("Server Adventure"));

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(errors).toContain("Backend list timed out."));
    await waitFor(() => expect(store.list).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("titles")).toHaveTextContent("Server Adventure");
  });

  it("surfaces delete failures after confirmation", async () => {
    const adventure = createDefaultAdventure("Stubborn Adventure");
    adventure.id = "adv-stubborn";
    const errors: string[] = [];
    const store: AdventureStore = {
      list: vi.fn(async () => [{
        id: adventure.id,
        title: adventure.title,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt,
        turnCount: 0,
        storyEntryCount: 0,
      }]),
      get: vi.fn(async () => adventure),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => {
        throw new Error("Backend delete failed.");
      }),
    };
    const callbacks = stableCallbacks(errors);

    function Harness() {
      const library = useAdventureLibrary(
        store,
        "backend",
        callbacks.setAdventure,
        callbacks.setContextResult,
        callbacks.onNavigate,
        callbacks.onModalClose,
        callbacks.onError,
      );
      return (
        <button type="button" onClick={() => void library.removeAdventure("adv-stubborn")}>
          Delete
        </button>
      );
    }

    render(<Harness />);
    await waitFor(() => expect(store.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(errors).toContain("Backend delete failed."));
    expect(store.delete).toHaveBeenCalledWith("adv-stubborn");
  });
});
