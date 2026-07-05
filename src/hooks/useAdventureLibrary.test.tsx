/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { ContextBuildResult } from "../types/adventure";
import type { AdventureStore } from "../runtime/adventureStore";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { useAdventureLibrary } from "./useAdventureLibrary";

describe("useAdventureLibrary", () => {
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

    function Harness() {
      const library = useAdventureLibrary(
        store,
        "backend",
        vi.fn(),
        vi.fn((_result: ContextBuildResult | undefined) => undefined),
        vi.fn(),
        vi.fn(),
        vi.fn(),
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
});
