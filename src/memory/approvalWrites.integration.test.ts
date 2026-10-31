import { beforeEach, describe, expect, it, vi } from "vitest";
import { runManualBrainUpdate, runManualStoryCardsUpdate, runStoryCardAIBuilder, runRememberThis, runSemanticPostTurnEvaluation, runMemoryReconcile } from "../triggers/semanticEngine";
import { runTurnPipeline } from "../state/turnPipeline";
import { adventureReducer as reduce } from "../state/adventureReducer";
import { makeTriggerRule } from "../state/defaults";
import { buildContext } from "../contextBuilder/contextBuilder";
import { approvalAdventure, approvalProposal, existingApprovalCard } from "../test/memoryApproval";
import type { AdventureAction, StoryCardType } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

vi.mock("../providers/openAICompatible", () => ({ isNativeDeepSeekProvider: () => false, sendOpenAICompatibleChatCompletion: vi.fn() }));
const provider = vi.mocked(sendOpenAICompatibleChatCompletion);
const config = approvalAdventure().modelConfig;
beforeEach(() => provider.mockReset());
const cardCases = (["character", "lore", "location", "plot", "custom"] as StoryCardType[]).flatMap(type => [false, true].map(enabled => ({ type, enabled })));
function category(type: StoryCardType) { return type === "character" ? "otherStoryCard" : type === "lore" ? "loreStoryCard" : "otherStoryCard"; }
function proposals(actions: AdventureAction[]) { return actions.filter(a => a.type === "ADD_MEMORY_PROPOSAL").map(a => a.proposal); }

describe("AI write paths share category approval", () => {
  it.each(cardCases)("manual card update: $type ON=$enabled", async ({ type, enabled }) => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard(type)]; a.memoryAutoApprove[category(type)] = enabled;
    provider.mockResolvedValueOnce({ content: "A changed enduring fact about Mira.", raw: {} });
    const result = await runManualStoryCardsUpdate(a, config);
    expect(proposals(result.actions)[0].storyCardType).toBe(type);
    const next = result.actions.reduce(reduce, a);
    expect(next.storyCards[0].content.includes("changed enduring fact")).toBe(enabled);
    expect(next.activeState.memoryProposals.find(p => p.targetId === "card")?.status).toBe(enabled ? "approved" : "pending");
  });

  it.each(cardCases)("AI builder preserves stored $type ON=$enabled despite AI subtype", async ({ type, enabled }) => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard(type)]; a.memoryAutoApprove[category(type)] = enabled;
    provider.mockResolvedValueOnce({ content: JSON.stringify({ proposals: [{ action: "update", cardId: "card", title: "Mira", storyCardType: type === "lore" ? "character" : "lore", memoryMode: "static", content: "Mira founded the northern observatory.", appendContent: true }]}), raw: {} });
    const result = await runStoryCardAIBuilder(a, config, { intent: "character", description: "Update Mira", targetCardId: "card" });
    expect(proposals(result.actions)[0].storyCardType).toBe(type);
    const next = result.actions.reduce(reduce, a);
    expect(next.storyCards[0].type).toBe(type);
    expect(next.storyCards[0].content.includes("founded")).toBe(enabled);
  });

  it.each(cardCases)("Remember This creates declared $type ON=$enabled", async ({ type, enabled }) => {
    const a = approvalAdventure(); a.memoryAutoApprove[category(type)] = enabled;
    provider.mockResolvedValueOnce({ content: JSON.stringify({ proposals: [{ action: "create", title: "The Observatory", storyCardType: type, memoryMode: "static", content: "The northern observatory was founded by Mira.", keys: ["observatory"] }], rationale: "Durable fact" }), raw: {} });
    const result = await runRememberThis(a, config, "Remember the observatory's founder.");
    expect(proposals(result.actions)[0].storyCardType).toBe(type);
    expect(result.actions.reduce(reduce, a).storyCards.length).toBe(enabled ? 1 : 0);
  });

  it("Remember This leaves an invalid new subtype for manual review", async () => {
    const a = approvalAdventure(); a.memoryAutoApprove.otherStoryCard = true;
    provider.mockResolvedValueOnce({ content: JSON.stringify({ proposals: [{ action: "create", title: "Observatory", storyCardType: "invented", content: "Mira founded it." }] }), raw: {} });
    const result = await runRememberThis(a, config, "Remember the founder");
    const next = result.actions.reduce(reduce, a);
    expect(next.storyCards).toEqual([]); expect(next.activeState.memoryProposals[0].status).toBe("pending");
  });

  it("does not generate memory writes for a non-memory component target", async () => {
    const a = approvalAdventure(); a.components[0].type = "aiInstructions";
    a.triggerRules = [makeTriggerRule({ id: "rule", name: "Forbidden", condition: "Always", actions: [{ type: "updateComponent", componentId: "plot" }] })];
    provider.mockResolvedValueOnce({ content: '["trigger:rule"]', raw: {} });
    const result = await runSemanticPostTurnEvaluation(a, config);
    expect(proposals(result.actions)).toEqual([]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(result.logEntry.errors.join(" ")).toContain("Plot Essentials component not found");
  });

  it.each([false, true])("semantic trigger Brain writes obey Character Self=%s and preserve append/replace", async enabled => {
    for (const mode of ["append", "replace"] as const) {
      const a = approvalAdventure(); a.memoryAutoApprove.brainUpdate = enabled; a.brains[0].updateMode = mode;
      a.triggerRules = [makeTriggerRule({ id: "rule", name: "Mira changes", condition: "Mira changes", actions: [{ type: "updateBrain", brainId: "brain" }] })];
      provider.mockResolvedValueOnce({ content: '["trigger:rule"]', raw: {} }).mockResolvedValueOnce({ content: '{"currentState":"Fresh state"}', raw: {} });
      const result = await runSemanticPostTurnEvaluation(a, config);
      expect(proposals(result.actions)[0].brainUpdateMode).toBe(mode);
      expect(result.actions.some(a => a.type === "APPLY_BRAIN_UPDATE")).toBe(false);
      let next = result.actions.reduce(reduce, a);
      if (!enabled) { expect(next.brains[0].currentState).toBe("Old state"); next = reduce(next, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposals(result.actions)[0].id }); }
      expect(next.brains[0].currentState).toBe(mode === "append" ? "Old state\nFresh state" : "Fresh state");
    }
  });

  it.each([false, true])("inline thoughts obey Character Self=%s and stay out of context while pending", async enabled => {
    const a = approvalAdventure(); a.memoryAutoApprove.brainUpdate = enabled;
    const result = await runTurnPipeline({ adventure: a, text: "Mira checks the tower.", assistantMessageId: "inline-source", sendChatCompletion: async () => ({ content: 'The tower holds. <thought name="Mira" key="secret">The compass is lying to me.</thought>' }) });
    const p = result.adventure.activeState.memoryProposals.find(p => p.proposedType === "brainUpdate")!;
    expect(p.brainUpdateMode).toBe("append"); expect(p.status).toBe(enabled ? "approved" : "pending");
    const context = buildContext(result.adventure, { currentInput: "Mira" });
    expect(JSON.stringify(context.messages).includes("compass is lying")).toBe(enabled);
  });

  it.each([{ brainEnabled: false, cardEnabled: true }, { brainEnabled: true, cardEnabled: false }])("generated companion notes follow cards=$cardEnabled independently of Brain=$brainEnabled", async ({ brainEnabled, cardEnabled }) => {
    const a = approvalAdventure(); a.brains[0].linkedStoryCardId = "card"; a.storyCards = [existingApprovalCard("character")];
    a.memoryAutoApprove.brainUpdate = brainEnabled; a.memoryAutoApprove.otherStoryCard = cardEnabled;
    provider.mockResolvedValueOnce({ content: JSON.stringify({ currentState: "New state", storyCardNote: "Mira founded a permanent observatory guild." }), raw: {} });
    const result = await runManualBrainUpdate(a, config, "brain");
    const next = result.actions.reduce(reduce, a);
    expect(next.brains[0].currentState.includes("New state")).toBe(brainEnabled);
    expect(next.storyCards[0].content.includes("permanent observatory guild")).toBe(cardEnabled);
  });

  it.each([false, true])("Brain notes and replacement history use their own Character Story Card toggle=%s", async cardEnabled => {
    const a = approvalAdventure(); a.memoryAutoApprove.brainUpdate = true; a.memoryAutoApprove.otherStoryCard = cardEnabled;
    a.storyCards = [existingApprovalCard("character")]; a.brains[0].linkedStoryCardId = "card"; a.brains[0].updateMode = "replace";
    a.brains[0].notes = "Mira once trusted the northern compass to lead her safely across the winter pass.";
    provider.mockResolvedValueOnce({ content: JSON.stringify({ notes: "Mira now doubts the compass.", storyCardNote: "Mira has a permanent fear of northern compasses." }), raw: {} });
    const result = await runManualBrainUpdate(a, config, "brain");
    expect(proposals(result.actions)).toHaveLength(2);
    const next = result.actions.reduce(reduce, a);
    expect(next.brains[0].notes).toBe("Mira now doubts the compass.");
    expect(next.storyCards[0].content.includes("permanent fear")).toBe(cardEnabled);
    const history = next.activeState.memoryProposals.find(p => p.content.includes("winter pass"))!;
    expect(history.storyCardType).toBe("character"); expect(history.status).toBe(cardEnabled ? "approved" : "pending");
  });

  it.each([false, true])("Plot Essentials history obeys Lore Cards=%s independently", enabled => {
    const a = approvalAdventure(); a.memoryAutoApprove.plotEssentialsUpdate = true; a.memoryAutoApprove.loreStoryCard = enabled;
    a.components[0].content = "The northern tower collapsed during the winter siege and sealed the observatory beneath the pass.";
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: approvalProposal("plotEssentialsUpdate", { content: "The astronomer has moved to the western refuge." }) });
    expect(next.components[0].content).toContain("western refuge");
    expect(next.storyCards.length > 0).toBe(enabled);
    expect(next.activeState.memoryProposals.find(p => p.proposedType === "storyCard")?.status).toBe(enabled ? "approved" : "pending");
  });

  it.each([false, true])("reconciliation preserves the actual Lore category ON=%s", async enabled => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard("lore")]; a.memoryAutoApprove.loreStoryCard = enabled;
    provider.mockResolvedValueOnce({ content: JSON.stringify({ updates: [{ targetId: "card", storyCardType: "character", memoryMode: "static", content: "Mira founded the observatory after the northern tower collapsed." }] }), raw: {} });
    const result = await runMemoryReconcile(a, config, { directive: "Mira", entryCount: 10, includeBrains: false });
    expect(result.logEntry.errors).toEqual([]);
    expect(proposals(result.actions)[0].storyCardType).toBe("lore");
    const next = result.actions.reduce(reduce, a);
    expect(next.storyCards[0].type).toBe("lore");
    expect(next.storyCards[0].content.includes("collapsed")).toBe(enabled);
  });
});
