import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import type { ProviderConfig } from "../types/adventure";
import { runAdventureGen } from "./adventureGen";

vi.mock("../providers/openAICompatible", () => ({
  sendOpenAICompatibleChatCompletion: vi.fn(),
}));

const config: ProviderConfig = {
  name: "test",
  baseUrl: "https://example.test",
  model: "test-model",
  temperature: 1,
  maxOutputTokens: 1000,
};

describe("runAdventureGen", () => {
  beforeEach(() => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockReset();
  });

  it("drops generated records with unsupported types or malformed fields", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({
        title: "Validated",
        openingScene: "Begin.",
        components: [
          { title: "Premise", type: "plotEssentials", content: "A valid premise." },
          { title: "Rules", type: "aiInstructions", content: "Not allowed from generation." },
          { title: "Bad priority", type: "custom", content: "No.", priority: "high" },
        ],
        storyCards: [
          { title: "Margo", type: "character", content: "Valid.", keys: ["Margo"] },
          { title: "Unknown", type: "faction", content: "Invalid type." },
          { title: "Bad keys", type: "lore", content: "Invalid keys.", keys: "ward" },
        ],
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    const result = await runAdventureGen("A premise", config);

    expect(result.components.map((component) => component.title)).toEqual(["Premise"]);
    expect(result.storyCards.map((card) => card.title)).toEqual(["Margo"]);
  });
});
