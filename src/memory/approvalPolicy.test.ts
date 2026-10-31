import { describe, expect, it } from "vitest";
import { getApprovalCategory, shouldAutoApprove } from "./approvalPolicy";
import { adventureReducer as reduce } from "../state/adventureReducer";
import { normalizeAdventure, normalizeMemoryAutoApproveSettings } from "../state/defaults";
import { normalizeGlobalAdventureSettings, defaultGlobalAdventureSettings } from "../pages/pageTypes";
import { approvalAdventure, approvalCategories, approvalProposal, existingApprovalCard, memoryData } from "../test/memoryApproval";
import type { StoryCardType } from "../types/adventure";

const cases = approvalCategories.flatMap(category => [false, true].map(enabled => ({ category, enabled })));
describe("one approval category per write", () => {
  it.each(cases)("$category ON=$enabled controls application independently of global review and detection", ({ category, enabled }) => {
    const a = approvalAdventure();
    for (const other of approvalCategories) a.memoryAutoApprove[other] = other === category ? enabled : !enabled;
    const proposal = approvalProposal(category);
    expect(getApprovalCategory(a, proposal)).toBe(category);
    expect(shouldAutoApprove(a, proposal)).toBe(enabled);
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal });
    if (enabled) {
      expect(memoryData(next)).not.toEqual(memoryData(a));
      expect(next.activeState.memoryProposals.find(p => p.id === proposal.id)?.status).toBe("approved");
    } else {
      expect(memoryData(next)).toEqual(memoryData(a));
      expect(next.activeState.memoryProposals.find(p => p.id === proposal.id)?.status).toBe("pending");
      const manual = reduce(next, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id });
      const automatic = reduce({ ...a, memoryAutoApprove: { ...a.memoryAutoApprove, [category]: true } }, { type: "ADD_MEMORY_PROPOSAL", proposal });
      expect(memoryData(manual)).toEqual(memoryData(automatic));
    }
  });

  it.each(["character", "lore", "location", "plot", "custom"] as StoryCardType[])("uses the stored %s type even when the AI claims a different subtype", type => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard(type)];
    const category = type === "character" ? "characterStoryCard" : type === "lore" ? "loreStoryCard" : "otherStoryCard";
    a.memoryAutoApprove[category] = true;
    const p = approvalProposal("loreStoryCard", { title: "Mira", targetId: "card", storyCardType: type === "lore" ? "character" : "lore", appendContent: true });
    expect(getApprovalCategory(a, p)).toBe(category);
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(next.storyCards[0].type).toBe(type);
    expect(next.storyCards[0].content).toContain("northern tower collapsed");
  });

  it.each([undefined, "unknown"])("keeps new cards with unvalidated type %s pending", type => {
    const a = approvalAdventure(); for (const c of approvalCategories) a.memoryAutoApprove[c] = true;
    const p = approvalProposal("loreStoryCard", { storyCardType: type as StoryCardType });
    expect(getApprovalCategory(a, p)).toBeUndefined();
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(next.storyCards).toEqual([]);
    expect(next.activeState.memoryProposals[0].status).toBe("pending");
  });

  it.each([false, true])("missing-Brain fallback obeys Character Story Cards=%s, independently of Character Self", enabled => {
    const a = approvalAdventure(); a.brains = []; a.memoryAutoApprove.brainUpdate = !enabled; a.memoryAutoApprove.characterStoryCard = enabled;
    const p = approvalProposal("brainUpdate", { content: "Mira swore an enduring oath to defend the observatory." });
    expect(getApprovalCategory(a, p)).toBe("characterStoryCard");
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(next.storyCards.length).toBe(enabled ? 1 : 0);
    expect(next.brains).toEqual([]);
  });

  it("does not replay old pending suggestions when toggles change, and accepts fresh content for the same target", () => {
    const a = approvalAdventure(); const p = approvalProposal("brainUpdate");
    const pending = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    const enabled = reduce(pending, { type: "SET_MEMORY_AUTO_APPROVE", settings: { ...a.memoryAutoApprove, brainUpdate: true } });
    expect(enabled.activeState.memoryProposals[0].status).toBe("pending");
    expect(memoryData(enabled)).toEqual(memoryData(a));
    const next = reduce(enabled, { type: "ADD_MEMORY_PROPOSAL", proposal: { ...p, id: "fresh", content: JSON.stringify({ currentState: "A fresh development" }) } });
    expect(next.brains[0].currentState).toBe("A fresh development");
    expect(next.activeState.memoryProposals.find(p => p.id === "fresh")?.status).toBe("approved");
    expect(next.activeState.memoryProposals.find(entry => entry.id === p.id)?.status).toBe("pending");
  });

  it.each(["append", "replace"] as const)("preserves Brain %s mode for manual and automatic approval", mode => {
    const a = approvalAdventure(); const p = approvalProposal("brainUpdate", { brainUpdateMode: mode });
    let manual = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    manual = reduce(manual, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: p.id });
    a.memoryAutoApprove.brainUpdate = true;
    const automatic = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(memoryData(manual)).toEqual(memoryData(automatic));
    expect(automatic.brains[0].currentState).toBe(mode === "append" ? "Old state\nNew state" : "New state");
  });

  it("context protection does not introduce another approval override", () => {
    const a = approvalAdventure(); a.memoryAutoApprove.brainUpdate = true; a.brains[0].protected = true;
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: approvalProposal("brainUpdate") });
    expect(next.activeState.memoryProposals.find(p => p.proposedType === "brainUpdate")?.status).toBe("approved");
    expect(next.brains[0].currentState).toBe("New state");
    expect(next.brains[0].protected).toBe(true);
  });

  it("never marks failed, invalid, or unchanged writes approved, nor applies approval twice", () => {
    let a = approvalAdventure(); a.components = []; a.memoryAutoApprove.currentArcUpdate = true;
    const p = approvalProposal("currentArcUpdate");
    a = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(a.activeState.memoryProposals[0].status).toBe("pending");
    expect(reduce(a, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: p.id })).toBe(a);
    const bad = approvalProposal("brainUpdate", { content: '{"thoughts":{"bad":123}}' });
    expect(reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: bad })).toBe(a);
    const same = approvalProposal("brainUpdate", { id: "same", content: '{"currentState":"Old state"}' });
    a.memoryAutoApprove.brainUpdate = true;
    a = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: same });
    expect(a.activeState.memoryProposals.find(p => p.id === "same")?.status).toBe("pending");
    expect(reduce(a, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "same" })).toBe(a);
    const fresh = approvalProposal("brainUpdate", { id: "new" });
    a = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: fresh });
    expect(a.activeState.memoryProposals.find(p => p.id === "new")?.status).toBe("approved");
    expect(reduce(a, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "new" })).toBe(a);
  });

  it("does not mark unchanged Story Cards or summaries approved", () => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard("lore")];
    a.memoryAutoApprove.loreStoryCard = true; a.memoryAutoApprove.summaryUpdate = true;
    a.rollingSummary = { ...a.rollingSummary, content: "Unchanged summary" };
    for (const p of [approvalProposal("loreStoryCard", { title: "Mira", targetId: "card", memoryMode: "static", content: a.storyCards[0].content, suggestedTriggers: [], appendContent: false }), approvalProposal("summaryUpdate", { content: "Unchanged summary" })]) {
      const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
      expect(next.activeState.memoryProposals.find(entry => entry.id === p.id)?.status).not.toBe("approved");
      expect(memoryData(next)).toEqual(memoryData(a));
    }
  });

  it("validates missing-Brain fallback content before routing it to a card", () => {
    const a = approvalAdventure(); a.brains = []; a.memoryAutoApprove.characterStoryCard = true;
    const bad = approvalProposal("brainUpdate", { content: '{"thoughts":{"bad":123}}' });
    expect(reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: bad })).toBe(a);
  });

  it("does not accept runtime card patches that override an existing subtype", () => {
    const a = approvalAdventure(); a.storyCards = [existingApprovalCard("lore")]; a.memoryAutoApprove.loreStoryCard = true;
    const p = approvalProposal("loreStoryCard", { title: "Mira", targetId: "card", appendContent: true });
    p.storyCardPatch = { type: "character" } as unknown as typeof p.storyCardPatch;
    expect(reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p }).storyCards[0].type).toBe("lore");
  });

  it.each(["summaryUpdate", "currentArcUpdate", "plotEssentialsUpdate"] as const)("does not reapply duplicate %s append content", category => {
    const a = approvalAdventure(); a.memoryAutoApprove[category] = true;
    const p = approvalProposal(category, { appendContent: true });
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    const duplicate = reduce(next, { type: "ADD_MEMORY_PROPOSAL", proposal: { ...p, id: "duplicate" } });
    expect(memoryData(duplicate)).toEqual(memoryData(next));
    expect(duplicate.activeState.memoryProposals.find(p => p.id === "duplicate")?.status).not.toBe("approved");
  });

  it("does not approve a component write to a missing or forbidden explicit target", () => {
    const a = approvalAdventure(); a.memoryAutoApprove.plotEssentialsUpdate = true;
    const p = approvalProposal("plotEssentialsUpdate", { targetId: "missing-target" });
    const next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    expect(memoryData(next)).toEqual(memoryData(a));
    expect(next.activeState.memoryProposals[0].status).toBe("pending");
    expect(reduce(next, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: p.id })).toBe(next);
  });

  it("preserves explicit manual approval of a dismissed suggestion without applying it twice", () => {
    const a = approvalAdventure(); const p = approvalProposal("brainUpdate");
    let next = reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: p });
    next = reduce(next, { type: "REJECT_MEMORY_PROPOSAL", proposalId: p.id });
    expect(next.brains[0].currentState).toBe("Old state");
    next = reduce(next, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: p.id });
    expect(next.brains[0].currentState).toBe("New state");
    expect(next.activeState.memoryProposals.find(entry => entry.id === p.id)?.status).toBe("approved");
    expect(reduce(next, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: p.id })).toBe(next);
  });

  it.each(["static", "living", "historical"] as const)("approval is independent of %s memory mode", mode => {
    const a = approvalAdventure(); a.memoryAutoApprove.loreStoryCard = true;
    expect(reduce(a, { type: "ADD_MEMORY_PROPOSAL", proposal: approvalProposal("loreStoryCard", { memoryMode: mode }) }).storyCards[0].memoryMode).toBe(mode);
  });
});

describe("saved preference migration", () => {
  it.each([false, true])("migrates legacy Story Card=%s without overwriting individual choices", storyCard => {
    const old = { storyCard, summaryUpdate: true, brainUpdate: true, plotPressureUpdate: false, characterStoryCard: false };
    const migrated = normalizeMemoryAutoApproveSettings(old);
    expect(migrated).toMatchObject({ characterStoryCard: false, loreStoryCard: storyCard, otherStoryCard: storyCard, summaryUpdate: true, brainUpdate: true, plotPressureUpdate: false, plotMomentumUpdate: false });
    const a = approvalAdventure(); a.memoryAutoApprove = migrated;
    const p = approvalProposal("brainUpdate"); a.activeState.memoryProposals = [p];
    const loaded = normalizeAdventure(JSON.parse(JSON.stringify(a)));
    expect(loaded.memoryAutoApprove).toEqual(migrated);
    expect(loaded.activeState.memoryProposals[0].status).toBe("pending");
    expect(loaded.semanticEvaluationSettings.requireApprovalForAutoUpdates).toBeUndefined();
    const global = normalizeGlobalAdventureSettings({ ...defaultGlobalAdventureSettings, memoryAutoApprove: old as unknown as typeof migrated });
    expect(global.memoryAutoApprove).toEqual(migrated);
    expect(a.memoryAutoApprove).toEqual(migrated);
  });
});
