import { describe, expect, it, vi } from "vitest";
import { createDefaultAdventure, makeBrain } from "../state/defaults";
import { runBrainAudit } from "./brainAudit";

vi.mock("../providers/openAICompatible", () => ({
  sendOpenAICompatibleChatCompletion: vi.fn(async () => ({ content: "[]", raw: {} })),
}));

describe("runBrainAudit", () => {
  it("flags duplicate thoughts and broad aliases", async () => {
    const adventure = {
      ...createDefaultAdventure("Brain Audit"),
      brains: [
        makeBrain({
          id: "brain-margo",
          characterName: "Margo",
          triggers: ["Margo", "she", "ward engineer"],
          thoughts: {
            first_read: "4 -> Seth jokes when he is cornered.",
            second_read: "5 -> Seth jokes when he is cornered.",
          },
        }),
      ],
    };

    const recommendations = await runBrainAudit(adventure, adventure.modelConfig, 20);

    expect(recommendations.some((rec) => rec.id === "det-broad-aliases-brain-margo")).toBe(true);
    const duplicateThoughts = recommendations.find((rec) => rec.id === "det-duplicate-thoughts-brain-margo");
    expect(duplicateThoughts?.editedThoughts).toContain("second_read");
    expect(duplicateThoughts?.editedThoughts).not.toContain("first_read");
  });
});
