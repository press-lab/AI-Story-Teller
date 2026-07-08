import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArcContinuationOption, ProviderConfig } from "../types/adventure";
import { createDefaultAdventure } from "../state/defaults";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { generateComponentDrafts, pickConvergentContinuation } from "./generators";

vi.mock("../providers/openAICompatible", () => ({
  isNativeDeepSeekProvider: vi.fn((config: ProviderConfig) => config.baseUrl.includes("deepseek.com")),
  sendOpenAICompatibleChatCompletion: vi.fn(),
}));

const config: ProviderConfig = {
  name: "test",
  baseUrl: "https://example.test",
  model: "test-model",
  temperature: 1,
  maxOutputTokens: 1000,
};

const opt = (label: string, threadKeys: string[]): ArcContinuationOption => ({
  label,
  premise: label,
  threadKeys,
  simmerInstruction: "",
  breakInstruction: "",
  pace: "epic",
});

describe("pickConvergentContinuation", () => {
  it("returns undefined when there are no options", () => {
    expect(pickConvergentContinuation([], {})).toBeUndefined();
  });

  it("picks the option whose carried threads had the most prior engagement", () => {
    const options = [opt("A", ["x"]), opt("B", ["azula"]), opt("C", ["y"])];
    expect(pickConvergentContinuation(options, { azula: 7, x: 1 })?.label).toBe("B");
  });

  it("falls back to the lead option when nothing overlaps prior engagement", () => {
    const options = [opt("first", ["p"]), opt("second", ["q"])];
    expect(pickConvergentContinuation(options, { z: 5 })?.label).toBe("first");
  });
});

describe("generateComponentDrafts", () => {
  beforeEach(() => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockReset();
  });

  it("generates only the requested component draft types", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({
        components: [
          { type: "plotEssentials", title: "Plot Essentials", content: "- The gala is now a hostage crisis.", priority: 80 },
          { type: "authorNote", title: "Author's Note", content: "Keep the room tense and dialogue sharp." },
          { type: "currentArc", title: "Bad Arc", content: "Should be ignored." },
        ],
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    const result = await generateComponentDrafts(createDefaultAdventure("Component Test"), config, {
      description: "Help with PE and AN for a gala crisis.",
      targets: ["plotEssentials", "authorNote"],
      includeRecentStory: false,
    });

    expect(result.map((draft) => draft.type)).toEqual(["plotEssentials", "authorNote"]);
    expect(result[0]).toMatchObject({ alwaysOn: true, pinned: true, protected: true });
    const request = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[0][0];
    expect(request.messages[0].content).toContain("Targets requested: plotEssentials, authorNote");
    expect(request.messages[0].content).toContain("Return full replacement content");
    expect(request.messages[1].content).toContain("Help with PE and AN for a gala crisis.");
    expect(request.messages[1].content).toContain("(not included by user choice)");
  });
});
