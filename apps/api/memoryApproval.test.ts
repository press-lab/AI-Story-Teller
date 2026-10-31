import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBackendMemoryReconcile, runBackendBrainUpdate, runBackendStoryCardBuilder, saveBackendAdventure } from "./adventureStore";
import { createEmptyDb } from "./dbShape";
import { loadApiConfig } from "./config";
import { runMemoryReconcile, runManualBrainUpdate, runStoryCardAIBuilder } from "../../src/triggers/semanticEngine";
import { sendOpenAICompatibleChatCompletion } from "../../src/providers/openAICompatible";
import { adventureReducer } from "../../src/state/adventureReducer";
import { normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import { approvalAdventure, approvalCategories, approvalProposal, memoryData } from "../../src/test/memoryApproval";

vi.mock("../../src/triggers/semanticEngine", async importOriginal => ({ ...await importOriginal<typeof import("../../src/triggers/semanticEngine")>(), runMemoryReconcile: vi.fn() }));
vi.mock("../../src/providers/openAICompatible", () => ({ isNativeDeepSeekProvider: () => false, sendOpenAICompatibleChatCompletion: vi.fn() }));
const provider = vi.mocked(sendOpenAICompatibleChatCompletion);
const reconcile = vi.mocked(runMemoryReconcile);
const config = loadApiConfig({ providerConfig: { ...approvalAdventure().modelConfig, apiKey: "test-key" } });
beforeEach(() => { provider.mockReset(); reconcile.mockReset(); });

const cases = approvalCategories.flatMap(category => [false, true].map(enabled => ({ category, enabled })));
describe("hosted/browser approval parity", () => {
  it.each(cases)("$category ON=$enabled uses the same reducer and persisted choices", async ({ category, enabled }) => {
    const data = createEmptyDb(); const a = approvalAdventure(); a.memoryAutoApprove[category] = enabled;
    const saved = saveBackendAdventure(data, "owner", a, "manualSave").adventure;
    const proposal = approvalProposal(category);
    const actions = [{ type: "ADD_MEMORY_PROPOSAL" as const, proposal }];
    reconcile.mockResolvedValueOnce({ actions, logEntry: { id: "log", turn: 0, createdAt: a.createdAt, conditionsEvaluated: [], conditionsFired: [], actionsExecuted: [], generatedContent: [], errors: [] } });
    const hosted = await runBackendMemoryReconcile(data, "owner", a.id, { entryCount: 1, includeBrains: true }, config);
    const local = normalizeAdventure(sanitizeAdventureForPersistence(actions.reduce(adventureReducer, saved)));
    expect(memoryData(hosted.adventure)).toEqual(memoryData(local));
    expect(hosted.adventure.memoryAutoApprove).toEqual(local.memoryAutoApprove);
    expect(hosted.adventure.activeState.memoryProposals.map(p => p.status)).toEqual(local.activeState.memoryProposals.map(p => p.status));
    if (enabled) expect(memoryData(hosted.adventure)).not.toEqual(memoryData(saved));
    else expect(memoryData(hosted.adventure)).toEqual(memoryData(saved));
    expect(data.adventures[0].adventure.memoryAutoApprove[category]).toBe(enabled);
  });

  it.each([false, true])("real hosted Brain generator honors Character Self=%s", async enabled => {
    const data = createEmptyDb(); const a = approvalAdventure(); a.memoryAutoApprove.brainUpdate = enabled;
    saveBackendAdventure(data, "owner", a, "manualSave");
    provider.mockResolvedValue({ content: '{"currentState":"New private state"}', raw: {} });
    const hosted = await runBackendBrainUpdate(data, "owner", a.id, "brain", config);
    const localResult = await runManualBrainUpdate(a, config.providerConfig, "brain");
    expect(memoryData(hosted.adventure)).toEqual(memoryData(localResult.actions.reduce(adventureReducer, a)));
    expect(hosted.adventure.brains[0].currentState.includes("New private state")).toBe(enabled);
  });

  it.each([false, true])("real hosted card builder honors Lore Cards=%s", async enabled => {
    const data = createEmptyDb(); const a = approvalAdventure(); a.memoryAutoApprove.loreStoryCard = enabled;
    saveBackendAdventure(data, "owner", a, "manualSave");
    provider.mockResolvedValue({ content: JSON.stringify({ proposals: [{ action: "create", title: "Observatory", storyCardType: "lore", memoryMode: "static", content: "Mira founded the observatory." }] }), raw: {} });
    const request = { intent: "auto" as const, description: "Remember the observatory founder" };
    const hosted = await runBackendStoryCardBuilder(data, "owner", a.id, request, config);
    const local = await runStoryCardAIBuilder(a, config.providerConfig, request);
    expect(memoryData(hosted.adventure)).toEqual(memoryData(local.actions.reduce(adventureReducer, a)));
    expect(hosted.adventure.storyCards.length).toBe(enabled ? 1 : 0);
  });
});
