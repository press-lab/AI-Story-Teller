/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { AdventureStore } from "../runtime/adventureStore";
import { useAdventureAutosave } from "./useAdventureAutosave";

afterEach(() => {
  vi.useRealTimers();
});

describe("useAdventureAutosave", () => {
  it("saves the latest adventure after a rapid adventure switch", async () => {
    vi.useFakeTimers();
    const first = createDefaultAdventure("First");
    first.id = "adv-first";
    const second = createDefaultAdventure("Second");
    second.id = "adv-second";
    const save = vi.fn(async () => undefined);
    const store: AdventureStore = { list: vi.fn(), get: vi.fn(), save, delete: vi.fn() };

    const { rerender } = renderHook(
      ({ adventure }) => useAdventureAutosave(adventure, store, vi.fn(), vi.fn()),
      { initialProps: { adventure: first } },
    );
    rerender({ adventure: second });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: "adv-second" }));
  });
});
