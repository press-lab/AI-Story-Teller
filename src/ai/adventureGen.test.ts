import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import type { ProviderConfig } from "../types/adventure";
import { runAdventureGen } from "./adventureGen";

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
          { title: "Pressure", type: "activePressure", content: "The ward is collapsing." },
          { title: "Momentum", type: "immediateMomentum", content: "The old next beat should be ignored." },
          { title: "Rules", type: "narrationRules", content: "Not allowed from generation." },
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

    expect(result.components.map((component) => component.title)).toEqual(["Premise", "Pressure"]);
    expect(result.storyCards.map((card) => card.title)).toEqual(["Margo"]);
  });

  it("does not allow generated reference cards to arrive pinned", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({
        title: "Unpinned",
        openingScene: "Begin.",
        components: [],
        storyCards: [
          { title: "Margo", type: "character", content: "Valid.", keys: ["Margo"], pinned: true },
        ],
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    const result = await runAdventureGen("A premise", config);

    expect(result.storyCards).toHaveLength(1);
    expect(result.storyCards[0].pinned).toBe(false);
  });

  it("uses native DeepSeek structured output controls and memory-specific component guidance", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({ title: "Structured", openingScene: "", components: [], storyCards: [] }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    await runAdventureGen("A premise", {
      ...config,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    });

    const request = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[0][0];
    expect(request.responseFormat).toBe("json_object");
    expect(request.thinking).toBe("disabled");
    expect(request.messages[0].content).toContain('"activePressure"');
    expect(request.messages[0].content).not.toContain('"immediateMomentum"');
    expect(request.messages[0].content).toContain("exactly one concise sentence");
    expect(request.messages[0].content).toContain('"authorNote"');
    expect(request.messages[0].content).toContain("Do not create cards for current scene position");
  });

  it("uses JSON object response format for OpenRouter setup generation", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({ title: "Structured", openingScene: "", components: [], storyCards: [] }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    await runAdventureGen("A premise", {
      ...config,
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v3.2",
    });

    const request = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[0][0];
    expect(request.responseFormat).toBe("json_object");
    expect(request.thinking).toBeUndefined();
    expect(request.config.maxOutputTokens).toBeGreaterThanOrEqual(4000);
  });

  it("retries with compact JSON instructions when the first response is malformed", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion)
      .mockResolvedValueOnce({
        content: "```json\n{\"title\":\"Broken\",\"openingScene\":\"Unfinished",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        raw: {},
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ title: "Recovered", openingScene: "Begin again.", components: [], storyCards: [] }),
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        raw: {},
      });

    const result = await runAdventureGen("A premise", config);

    expect(result.title).toBe("Recovered");
    expect(vi.mocked(sendOpenAICompatibleChatCompletion)).toHaveBeenCalledTimes(2);
    const retryRequest = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[1][0];
    expect(retryRequest.messages[1].content).toContain("Retry requirements");
    expect(retryRequest.messages[1].content).toContain("Do not wrap the JSON in markdown or code fences.");
    expect(retryRequest.config.temperature).toBeLessThanOrEqual(0.35);
    expect(retryRequest.config.maxOutputTokens).toBeGreaterThanOrEqual(6000);
  });

  it("passes setup preferences into the generation prompt", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({ title: "Preferences", openingScene: "", components: [], storyCards: [] }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    await runAdventureGen("A messy crew romance premise", config, {
      storyShape: "romanceDrama",
      proseMode: "cinematic",
      playerControl: "minorActions",
      adultContent: "explicitAdult",
      boundaries: "No fade to black.",
    });

    const request = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[0][0];
    const userPrompt = request.messages[1].content;
    expect(userPrompt).toContain("Story shape: Romance drama");
    expect(userPrompt).toContain("Prose mode: Cinematic prose");
    expect(userPrompt).toContain("bridge tiny implied motions");
    expect(userPrompt).toContain("explicit opt-in adult layer");
    expect(userPrompt).toContain("Boundaries and limits to respect: No fade to black.");
  });

  it("routes storyteller profile guidance without leaking the UI profile name", async () => {
    vi.mocked(sendOpenAICompatibleChatCompletion).mockResolvedValue({
      content: JSON.stringify({ title: "Profiled", openingScene: "", components: [], storyCards: [] }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      raw: {},
    });

    await runAdventureGen("A Rookery job where Nix Calder tests a dangerous lockpick.", config, {
      storytellerProfile: "mara",
    });

    const request = vi.mocked(sendOpenAICompatibleChatCompletion).mock.calls[0][0];
    const systemPrompt = request.messages[0].content;
    const userPrompt = request.messages[1].content;
    expect(systemPrompt).toContain("Preserve user-provided proper-noun spelling exactly");
    expect(systemPrompt).toContain("Do not import names, characters, relationships, lore, or examples");
    expect(userPrompt).toContain("Storyteller guide: explicit adult romance guide");
    expect(userPrompt).not.toContain("Mara");
    expect(userPrompt).toContain("Nix Calder");
  });
});
