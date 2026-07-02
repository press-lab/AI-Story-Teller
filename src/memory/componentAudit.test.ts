import { describe, expect, it } from "vitest";
import { createDefaultAdventure, makeComponent } from "../state/defaults";
import { runComponentAudit } from "./componentAudit";

describe("runComponentAudit", () => {
  it("flags disabled legacy Immediate Momentum blocks without needing an LLM pass", async () => {
    const adventure = {
      ...createDefaultAdventure("Component Audit"),
      components: [
        makeComponent({
          id: "legacy-momentum",
          title: "Immediate Momentum",
          type: "immediateMomentum",
          content: "Go to the next room.",
          active: true,
        }),
      ],
    };

    const recommendations = await runComponentAudit(adventure, adventure.modelConfig, 20);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      action: "delete",
      componentId: "legacy-momentum",
      suggestedType: "custom",
    });
  });
});
