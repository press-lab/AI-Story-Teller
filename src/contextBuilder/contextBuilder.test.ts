import { describe, expect, it } from "vitest";
import type { Adventure, MemoryPriorityMode, TokenBudgetSettings } from "../types/adventure";
import { createDefaultAdventure, makeAutoCard, makeBrain, makeComponent, makeQuest, makeStoryCard } from "../state/defaults";
import { approximateTokenCount } from "../tokenizer/approximateTokenCount";
import { goldenAdventure, makeMemoryProposal } from "../test/goldenAdventure";
import { buildContext } from "./contextBuilder";

function adventureForContext(): Adventure {
  const always = makeComponent({ title: "Always", content: "Always component", alwaysOn: true, active: true, priority: 100 });
  const pinned = makeComponent({ title: "Pinned", content: "Pinned component", pinned: true, active: true, priority: 90 });
  const story = makeStoryCard({ title: "Keyed Story", content: "Story content", keys: ["lantern"], active: true, priority: 80 });
  const autoCard = makeAutoCard({
    title: "Lantern Auto",
    content: "Auto content",
    detectedEntity: "lantern",
    triggers: ["lantern"],
    active: true,
  });
  const brain = makeBrain({ characterName: "Mira", triggers: ["lantern"], currentState: "Brain state", active: true, priority: 70 });
  const quest = makeQuest({
    title: "Quest",
    description: "Quest description",
    status: "active",
    currentStepId: "step-1",
    steps: [
      {
        id: "step-1",
        title: "Find",
        objective: "Find the lantern",
        status: "active",
        completionCondition: "when the lantern is found",
        triggerConditions: [],
        onStartActions: [],
        onCompleteActions: [],
        contextText: "Quest context",
      },
    ],
  });

  return {
    ...createDefaultAdventure("Context Test"),
    components: [always, pinned],
    storyCards: [story],
    autoCards: [autoCard],
    brains: [brain],
    quests: [quest],
    rollingSummary: { content: "Old summary events. Recent summary events.", updatedAt: "2026-01-01T00:00:00.000Z" },
    messages: [
      { id: "old-msg", role: "user", content: "Old message about the road.", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "new-msg", role: "assistant", content: "New message about the lantern.", createdAt: "2026-01-01T00:01:00.000Z" },
    ],
    tokenBudgetSettings: budget({
      maxContextTokens: 10000,
      maxRecentMessages: 8,
      recentMessageWindow: 8,
      sectionBudgets: {},
    }),
  };
}

function itemTitles(adventure: Adventure, sectionId: string): string[] {
  return buildContext(adventure, { currentInput: "lantern" }).sections.find((section) => section.id === sectionId)?.items.map((item) => item.title) ?? [];
}

function budget(overrides: Partial<TokenBudgetSettings>): TokenBudgetSettings {
  return { ...createDefaultAdventure("Budget").tokenBudgetSettings, ...overrides };
}

function expectPreviewMatchesPayload(adventure: Adventure, mode: MemoryPriorityMode) {
  const configured = {
    ...adventure,
    tokenBudgetSettings: budget({
      ...adventure.tokenBudgetSettings,
      memoryPriorityMode: mode,
      allowSystemToPrioritizeMemory: mode !== "userLocked",
    }),
  } satisfies Adventure;
  const result = buildContext(configured, { currentInput: "signal" });
  const systemPayload = result.messages[0].content;
  for (const section of result.sections.filter((entry) => entry.id !== "recentMessages" && entry.content.length > 0)) {
    expect(systemPayload).toContain(section.content);
  }
  const recentPayload = result.messages.slice(1).map((message) => message.content);
  const includedRecent = [...(result.sections.find((section) => section.id === "recentMessages")?.items ?? [])]
    .reverse()
    .map((item) => item.content);
  expect(recentPayload).toEqual(includedRecent);
}

describe("buildContext", () => {
  it("assembles sections in the required deterministic order (A–J)", () => {
    const result = buildContext(adventureForContext(), { currentInput: "lantern" });
    // All 10 sections must exist in the correct order
    expect(result.sections.map((section) => section.id)).toEqual([
      "system",
      "aiInstructions",
      "plotEssentials",
      "authorNote",
      "components",
      "storyCards",
      "brains",
      "questState",
      "rollingSummary",
      "recentMessages",
    ]);
    expect(result.messages[0].role).toBe("system");
    // adventureForContext uses generic custom-type components (always + pinned), so they land in "components"
    expect(itemTitles(adventureForContext(), "aiInstructions")).toEqual([]);
    expect(itemTitles(adventureForContext(), "plotEssentials")).toEqual([]);
    expect(itemTitles(adventureForContext(), "authorNote")).toEqual([]);
    expect(itemTitles(adventureForContext(), "components")).toEqual(["Always", "Pinned"]);
    expect(itemTitles(adventureForContext(), "storyCards")).toEqual(["Keyed Story", "Lantern Auto"]);
    expect(itemTitles(adventureForContext(), "brains")).toEqual(["Mira"]);
    expect(itemTitles(adventureForContext(), "questState")).toEqual(["Quest"]);
    expect(itemTitles(adventureForContext(), "rollingSummary")).toEqual(["Rolling Summary"]);
    expect(itemTitles(adventureForContext(), "recentMessages")).toEqual(["assistant message 1", "user message 2"]);
  });

  it("routes aiInstructions, plotEssentials, and authorNote each into their own section before general components", () => {
    const ai = makeComponent({ id: "c-ai", title: "AI", type: "aiInstructions", content: "AI", alwaysOn: true, priority: 50 });
    const plotHigh = makeComponent({ id: "c-plot-high", title: "Plot High", type: "plotEssentials", content: "Plot high", priority: 90 });
    const plotLow = makeComponent({ id: "c-plot-low", title: "Plot Low", type: "plotEssentials", content: "Plot low", priority: 10 });
    const pinned = makeComponent({ id: "c-pinned", title: "Pinned", type: "memory", content: "Pinned", pinned: true, priority: 100 });
    const inactive = makeComponent({ id: "c-inactive", title: "Inactive", type: "memory", content: "Inactive", active: false, priority: 500 });
    const adventure = { ...createDefaultAdventure("Components"), components: [ai, plotLow, pinned, inactive, plotHigh] };

    const result = buildContext(adventure);
    expect(result.sections.find((section) => section.id === "system")?.items.map((item) => item.id)).toEqual(["system-shell"]);
    // Each type has its own section
    expect(result.sections.find((section) => section.id === "aiInstructions")?.items.map((item) => item.id)).toEqual(["c-ai"]);
    expect(result.sections.find((section) => section.id === "plotEssentials")?.items.map((item) => item.id)).toEqual(["c-plot-high", "c-plot-low"]);
    expect(result.sections.find((section) => section.id === "authorNote")?.items).toHaveLength(0);
    // Pinned custom component lands in E. Components
    expect(result.sections.find((section) => section.id === "components")?.items.map((item) => item.id)).toEqual(["c-pinned"]);
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: "c-inactive", reason: "inactive" }));
  });

  it("triggers story cards from input, output, recent history, pins, and regex-only match mode", () => {
    const inputCard = makeStoryCard({ id: "card-input", title: "Input", content: "input", keys: ["silver key"], active: true, priority: 50 });
    const outputCard = makeStoryCard({ id: "card-output", title: "Output", content: "output", keys: ["moon bell"], active: true, priority: 40 });
    const historyCard = makeStoryCard({ id: "card-history", title: "History", content: "history", keys: ["old vow"], active: true, priority: 30 });
    const pinnedCard = makeStoryCard({ id: "card-pinned", title: "Pinned", content: "pinned", keys: ["missing"], active: true, pinned: true, priority: 20 });
    const inactiveCard = makeStoryCard({ id: "card-inactive", title: "Inactive", content: "inactive", keys: ["silver key"], active: false });
    const unmatchedCard = makeStoryCard({ id: "card-unmatched", title: "Unmatched", content: "no", keys: ["nope"], active: true });
    const regexCard = makeStoryCard({
      id: "card-regex",
      title: "Regex",
      content: "regex",
      keys: ["chapter\\s+\\d+"],
      matchType: "regex",
      active: true,
      priority: 10,
    });
    const phraseRegexText = makeStoryCard({
      id: "card-phrase-regex",
      title: "Phrase Regex Text",
      content: "phrase",
      keys: ["chapter\\s+\\d+"],
      matchType: "phrase",
      active: true,
    });
    const adventure = {
      ...createDefaultAdventure("Cards"),
      storyCards: [inputCard, outputCard, historyCard, pinnedCard, inactiveCard, unmatchedCard, regexCard, phraseRegexText],
      messages: [{ id: "m1", role: "assistant", content: "They remembered the old vow.", createdAt: "2026-01-01T00:00:00.000Z" }],
      tokenBudgetSettings: budget({ maxContextTokens: 5000, maxRecentMessages: 4, recentMessageWindow: 4, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure, {
      currentInput: "I lift the SILVER KEY and read chapter 42.",
      latestModelOutput: "The moon bell rings.",
    });
    const triggeredIds = result.sections.find((section) => section.id === "storyCards")?.items.map((item) => item.id);
    expect(triggeredIds).toEqual(["card-input", "card-output", "card-history", "card-pinned", "card-regex"]);
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: "card-inactive", reason: "inactive" }));
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: "card-unmatched", reason: "not_triggered" }));
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: "card-phrase-regex", reason: "not_triggered" }));
  });

  it("drops oldest recent messages before cutting other sections", () => {
    const adventure = {
      ...adventureForContext(),
      components: [],
      storyCards: [],
      autoCards: [],
      brains: [],
      quests: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      messages: [
        { id: "old", role: "user", content: "old ".repeat(80), createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "middle", role: "assistant", content: "middle ".repeat(80), createdAt: "2026-01-01T00:01:00.000Z" },
        { id: "new", role: "user", content: "new ".repeat(80), createdAt: "2026-01-01T00:02:00.000Z" },
      ],
      tokenBudgetSettings: budget({ maxContextTokens: 250, maxRecentMessages: 3, recentMessageWindow: 3, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure);
    const recentIds = result.sections.find((section) => section.id === "recentMessages")?.items.map((item) => item.id);
    expect(recentIds).toEqual(["new"]);
    expect(result.excludedItems.filter((item) => item.reason === "budget_exceeded").map((item) => item.id)).toEqual(["old", "middle"]);
  });

  it("truncates rolling summary from the front after recent messages are exhausted", () => {
    const adventure = {
      ...adventureForContext(),
      components: [],
      storyCards: [],
      autoCards: [],
      brains: [],
      quests: [],
      messages: [],
      rollingSummary: {
        content: `${"front ".repeat(120)}keep-tail`,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      tokenBudgetSettings: budget({ maxContextTokens: 240, maxRecentMessages: 0, recentMessageWindow: 0, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure);
    const summary = result.sections.find((section) => section.id === "rollingSummary")?.items[0]?.content ?? "";
    expect(summary.split(/\s+/).length).toBeLessThan(adventure.rollingSummary.content.split(/\s+/).length);
    expect(summary).toContain("keep-tail");
    expect(result.excludedItems).toContainEqual(
      expect.objectContaining({ sourceType: "summary", id: "rolling-summary", reason: "budget_exceeded" }),
    );
  });

  it("drops lowest-priority triggered cards after message and summary cuts", () => {
    const low = makeStoryCard({ title: "Low Priority", content: "low ".repeat(100), keys: ["signal"], active: true, priority: 1 });
    const high = makeStoryCard({ title: "High Priority", content: "high ".repeat(100), keys: ["signal"], active: true, priority: 10 });
    const adventure = {
      ...adventureForContext(),
      storyCards: [low, high],
      autoCards: [],
      brains: [],
      quests: [],
      messages: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      tokenBudgetSettings: budget({ maxContextTokens: 250, maxRecentMessages: 0, recentMessageWindow: 0, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure, { currentInput: "signal" });
    const remainingTitles = result.sections.find((section) => section.id === "storyCards")?.items.map((item) => item.title);
    expect(remainingTitles).toEqual(["High Priority"]);
    expect(result.excludedItems).toContainEqual(
      expect.objectContaining({ id: low.id, title: "Low Priority", reason: "budget_exceeded" }),
    );
  });

  it("distinguishes protected from pinned when enforcing token budget", () => {
    const adventure = {
      ...adventureForContext(),
      components: [
        makeComponent({ id: "protected-huge", title: "Protected Huge", content: "protected ".repeat(80), alwaysOn: true, active: true, priority: 100, protected: true }),
        makeComponent({ id: "pinned-huge", title: "Pinned Huge", content: "pinned ".repeat(80), pinned: true, active: true, priority: 90, protected: false }),
      ],
      storyCards: [],
      autoCards: [],
      brains: [],
      quests: [],
      messages: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      tokenBudgetSettings: budget({ maxContextTokens: 10, maxRecentMessages: 0, recentMessageWindow: 0, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure);
    // Total will exceed budget because protected items can't be dropped
    expect(result.totalEstimatedTokens).toBeGreaterThan(10);
    // System shell always present
    expect(result.sections.find((section) => section.id === "system")?.items).toHaveLength(1);
    // Protected Huge survives in E. Components; Pinned Huge is dropped
    const componentItems = result.sections.find((section) => section.id === "components")?.items ?? [];
    expect(componentItems[0].title).toBe("Protected Huge");
    expect(componentItems).toHaveLength(1);
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: "pinned-huge", reason: "budget_exceeded" }));
  });

  it("applies userLocked, systemSuggested, and hybrid priority modes predictably", () => {
    const lowSystemSuggested = makeStoryCard({
      id: "low-system-suggested",
      title: "Low Suggested",
      content: "suggested ".repeat(80),
      keys: ["signal"],
      priority: -200,
      inclusionPolicy: "systemSuggested",
    });
    const highUserCard = makeStoryCard({
      id: "high-user-card",
      title: "High User",
      content: "user ".repeat(80),
      keys: ["signal"],
      priority: 200,
      inclusionPolicy: "triggered",
    });
    const base = {
      ...adventureForContext(),
      components: [],
      storyCards: [lowSystemSuggested, highUserCard],
      autoCards: [],
      brains: [],
      quests: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      messages: [
        { id: "old", role: "user", content: "old ".repeat(80), createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "new", role: "assistant", content: "new ".repeat(80), createdAt: "2026-01-01T00:01:00.000Z" },
      ],
      tokenBudgetSettings: budget({ maxContextTokens: 260, maxRecentMessages: 2, recentMessageWindow: 2 }),
    } satisfies Adventure;

    const userLocked = buildContext({ ...base, tokenBudgetSettings: budget({ ...base.tokenBudgetSettings, memoryPriorityMode: "userLocked" }) }, { currentInput: "signal" });
    expect(userLocked.excludedItems[0]).toMatchObject({ id: "old", reason: "budget_exceeded" });

    const systemSuggested = buildContext(
      {
        ...base,
        tokenBudgetSettings: budget({
          ...base.tokenBudgetSettings,
          memoryPriorityMode: "systemSuggested",
          allowSystemToPrioritizeMemory: true,
        }),
      },
      { currentInput: "signal" },
    );
    expect(systemSuggested.excludedItems[0]).toMatchObject({ id: "low-system-suggested", reason: "budget_exceeded" });

    const hybrid = buildContext(
      {
        ...base,
        tokenBudgetSettings: budget({
          ...base.tokenBudgetSettings,
          memoryPriorityMode: "hybrid",
          allowSystemToPrioritizeMemory: true,
        }),
      },
      { currentInput: "signal" },
    );
    expect(hybrid.excludedItems[0]).toMatchObject({ id: "low-system-suggested", reason: "budget_exceeded" });
  });

  it("uses user priority changes for ordering and keeps preview payload matched by priority mode", () => {
    const low = makeStoryCard({ id: "low-priority", title: "Low", content: "low", keys: ["signal"], priority: 1 });
    const high = makeStoryCard({ id: "high-priority", title: "High", content: "high", keys: ["signal"], priority: 99 });
    const adventure = {
      ...adventureForContext(),
      components: [],
      storyCards: [low, high],
      autoCards: [],
      brains: [],
      quests: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      messages: [{ id: "m1", role: "user", content: "signal", createdAt: "2026-01-01T00:00:00.000Z" }],
      tokenBudgetSettings: budget({ maxContextTokens: 1000, maxRecentMessages: 1, recentMessageWindow: 1 }),
    } satisfies Adventure;

    const result = buildContext(adventure, { currentInput: "signal" });
    expect(result.sections.find((section) => section.id === "storyCards")?.items.map((item) => item.id)).toEqual(["high-priority", "low-priority"]);
    expectPreviewMatchesPayload(adventure, "userLocked");
    expectPreviewMatchesPayload(adventure, "systemSuggested");
    expectPreviewMatchesPayload(adventure, "hybrid");
  });

  it("logs inactive and cooldown exclusions", () => {
    const inactive = makeStoryCard({ title: "Inactive", content: "hidden", keys: ["lantern"], active: false });
    const cooling = makeAutoCard({
      title: "Cooling",
      content: "cooldown",
      detectedEntity: "lantern",
      triggers: ["lantern"],
      active: true,
      cooldownTurns: 3,
      lastUpdatedTurn: 2,
    });
    const adventure = {
      ...adventureForContext(),
      activeState: { ...adventureForContext().activeState, turn: 3 },
      storyCards: [inactive],
      autoCards: [cooling],
      brains: [],
      quests: [],
      messages: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    } satisfies Adventure;

    const result = buildContext(adventure, { currentInput: "lantern" });
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: inactive.id, reason: "inactive" }));
    expect(result.excludedItems).toContainEqual(expect.objectContaining({ id: cooling.id, reason: "cooldown" }));
  });

  it("sets generatedBy correctly for system, user, and AI items", () => {
    const aiCard = makeAutoCard({ id: "ai-card", title: "AI Card", content: "generated", detectedEntity: "npc", triggers: ["npc"], source: "generated", active: true });
    const manualCard = makeAutoCard({ id: "manual-card", title: "Manual Card", content: "manual", detectedEntity: "place", triggers: ["place"], source: "manual", active: true });
    const aiBrain = makeBrain({ id: "ai-brain", characterName: "npc", triggers: ["npc"], source: "generated", active: true });
    const adventure = {
      ...adventureForContext(),
      components: [],
      storyCards: [],
      autoCards: [aiCard, manualCard],
      brains: [aiBrain],
      quests: [],
      messages: [{ id: "msg-user", role: "user", content: "npc place appears.", createdAt: "2026-01-01T00:00:00.000Z" }],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      tokenBudgetSettings: budget({ maxContextTokens: 5000, maxRecentMessages: 2, recentMessageWindow: 2 }),
    } satisfies Adventure;

    const result = buildContext(adventure, { currentInput: "npc place" });

    // System shell is "system"
    expect(result.sections.find((s) => s.id === "system")?.items[0].generatedBy).toBe("system");

    // AI-generated auto card
    const storySection = result.sections.find((s) => s.id === "storyCards");
    expect(storySection?.items.find((i) => i.id === "ai-card")?.generatedBy).toBe("ai");
    expect(storySection?.items.find((i) => i.id === "manual-card")?.generatedBy).toBe("user");

    // AI-generated brain
    expect(result.sections.find((s) => s.id === "brains")?.items.find((i) => i.id === "ai-brain")?.generatedBy).toBe("ai");

    // Recent user message
    const msgItem = result.sections.find((s) => s.id === "recentMessages")?.items.find((i) => i.id === "msg-user");
    expect(msgItem?.generatedBy).toBe("user");
  });

  it("exposes pending Memory Proposals in pendingProposals without including them in model context", () => {
    const proposal = makeMemoryProposal({ id: "proposal-test", status: "pending" });
    const approved = makeMemoryProposal({ id: "proposal-approved", status: "approved" });
    const adventure = {
      ...adventureForContext(),
      activeState: {
        ...adventureForContext().activeState,
        memoryProposals: [proposal, approved],
      },
    } satisfies Adventure;

    const result = buildContext(adventure, { currentInput: "lantern" });

    // Only pending proposals surfaced
    expect(result.pendingProposals).toHaveLength(1);
    expect(result.pendingProposals[0].id).toBe("proposal-test");

    // Nothing from proposals appears in model payload
    const payloadText = result.messages.map((m) => m.content).join(" ");
    expect(payloadText).not.toContain(proposal.content);
  });

  it("Adventure Chronicle (adventure.messages) is never automatically dumped into context — only maxRecentMessages appears", () => {
    // 50-message chronicle; only 5 should reach the model
    const chronicle = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Turn ${i} content.`,
      createdAt: "2026-01-01T00:00:00.000Z",
    }));

    const adventure = {
      ...createDefaultAdventure("Chronicle"),
      components: [],
      storyCards: [],
      autoCards: [],
      brains: [],
      quests: [],
      rollingSummary: { content: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      messages: chronicle,
      tokenBudgetSettings: budget({ maxContextTokens: 50000, maxRecentMessages: 5, recentMessageWindow: 5, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure);

    // J. Recent Messages section contains exactly maxRecentMessages items (newest first)
    const recentSection = result.sections.find((s) => s.id === "recentMessages");
    expect(recentSection?.items).toHaveLength(5);
    expect(recentSection?.items[0].id).toBe("msg-49"); // newest
    expect(recentSection?.items[4].id).toBe("msg-45"); // oldest of the window

    // Provider payload: 1 system message + 5 recent messages in chronological order
    expect(result.messages).toHaveLength(6);
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[1].content).toBe("Turn 45 content.");
    expect(result.messages[5].content).toBe("Turn 49 content.");

    // System payload does NOT contain the older 45 messages
    const systemText = result.messages[0].content;
    expect(systemText).not.toContain("Turn 0 content.");
    expect(systemText).not.toContain("Turn 44 content.");

    // The full 50-message chronicle is preserved in adventure state
    expect(adventure.messages).toHaveLength(50);
  });

  it("opening scene appears as first assistant message in payload, is protected in section J, and never budget-cut", () => {
    const opening = "The storm broke at midnight. Rain lashed the glass.";
    const adventure = {
      ...adventureForContext(),
      openingScene: opening,
      messages: [
        { id: "m1", role: "user" as const, content: "I look around.", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "m2", role: "assistant" as const, content: "Shadows gather.", createdAt: "2026-01-01T00:01:00.000Z" },
      ],
      tokenBudgetSettings: budget({ maxContextTokens: 50000, maxRecentMessages: 4, recentMessageWindow: 4, sectionBudgets: {} }),
    } satisfies Adventure;

    const result = buildContext(adventure);

    // Opening scene is first message after system, before recent transcript
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[1]).toEqual({ role: "assistant", content: opening });
    expect(result.messages[2].content).toBe("I look around.");
    expect(result.messages[3].content).toBe("Shadows gather.");

    // Opening scene item appears in section J as protected
    const recentSection = result.sections.find((s) => s.id === "recentMessages");
    const openingItem = recentSection?.items.find((i) => i.id === "opening-scene");
    expect(openingItem).toBeDefined();
    expect(openingItem?.protected).toBe(true);
    expect(openingItem?.content).toBe(opening);

    // Opening scene survives an extremely tight budget — it is protected
    const tightAdventure = { ...adventure, tokenBudgetSettings: budget({ maxContextTokens: 1, maxRecentMessages: 4, recentMessageWindow: 4, sectionBudgets: {} }) };
    const tightResult = buildContext(tightAdventure);
    expect(tightResult.messages[1]).toEqual({ role: "assistant", content: opening });
    expect(tightResult.sections.find((s) => s.id === "recentMessages")?.items.find((i) => i.id === "opening-scene")).toBeDefined();
  });

  it("empty sections are omitted from the provider payload but still present in result.sections", () => {
    // adventureForContext has no aiInstructions/plotEssentials/authorNote components
    const result = buildContext(adventureForContext(), { currentInput: "lantern" });
    // All 10 section IDs always present in result.sections
    expect(result.sections.map((s) => s.id)).toHaveLength(10);
    // Empty typed sections do not appear in the system payload
    const payload = result.messages[0].content;
    expect(payload).not.toContain("# B. AI Instructions");
    expect(payload).not.toContain("# C. Plot Essentials");
    expect(payload).not.toContain("# D. Author's Note");
    // Non-empty sections do appear
    expect(payload).toContain("# E. Components");
    expect(payload).toContain("# F. Story Cards");
  });

  it("golden adventure context matches the preview and provider payload contract", () => {
    const result = buildContext(goldenAdventure(), {
      currentInput: "Margo repeats hedge prince to Seth.",
      latestModelOutput: "The Beast howls at the ward.",
    });

    expect(result.sections.map((section) => section.id)).toEqual([
      "system",
      "aiInstructions",
      "plotEssentials",
      "authorNote",
      "components",
      "storyCards",
      "brains",
      "questState",
      "rollingSummary",
      "recentMessages",
    ]);
    expect(result.sections.find((section) => section.id === "aiInstructions")?.items.map((item) => item.id)).toEqual(["component-ai"]);
    expect(result.sections.find((section) => section.id === "plotEssentials")?.items.map((item) => item.id)).toEqual(["component-plot"]);
    expect(result.sections.find((section) => section.id === "authorNote")?.items.map((item) => item.id)).toEqual(["component-author"]);
    expect(result.sections.find((section) => section.id === "components")?.items.map((item) => item.id)).toEqual(["component-pinned"]);
    expect(result.sections.find((section) => section.id === "storyCards")?.items.map((item) => item.id)).toEqual(["card-joke", "card-beast"]);
    expect(result.sections.find((section) => section.id === "brains")?.items.map((item) => item.id)).toEqual(["brain-margo", "brain-seth"]);
    expect(result.sections.find((section) => section.id === "questState")?.items.map((item) => item.id)).toEqual(["quest-ward"]);
    expect(result.sections.find((section) => section.id === "recentMessages")?.items.map((item) => item.id)).toEqual([
      "msg-6",
      "msg-5",
      "msg-4",
      "msg-3",
      "msg-2",
      "msg-1",
    ]);
    expect(result.excludedItems).toEqual([
      expect.objectContaining({ id: "component-inactive", reason: "inactive" }),
      expect.objectContaining({ id: "card-inactive", reason: "inactive" }),
    ]);
    for (const section of result.sections) {
      expect(section.tokenEstimate).toBe(approximateTokenCount(section.content));
    }
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("# A. System Shell / Global Generation Rules");
    expect(result.messages[0].content).toContain("# B. AI Instructions");
    expect(result.messages[0].content).toContain("# F. Story Cards");
    expect(result.messages[0].content).toContain("## Hedge Prince Joke");
    expect(result.messages[0].content).toContain("## Rolling Summary");
    expect(result.messages.slice(1).map((message) => message.content)).toEqual([
      "Rain tapped against the glass.",
      "I ask Margo about the ward.",
      "Margo glances toward Seth.",
      "I repeat the hedge prince joke.",
      "The Beast howls somewhere below.",
      "We hurry toward the threshold.",
    ]);

    // E. Components is present because the golden adventure has a pinned weather component
    expect(result.messages[0].content).toContain("# E. Components");
    expect(result.messages[0].content).toContain("## Pinned Weather");
  });
});
