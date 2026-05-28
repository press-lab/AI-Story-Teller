import type {
  Adventure,
  ContextBuildResult,
  ContextBuildDecision,
  ContextInclusionPolicy,
  ContextItem,
  ContextSection,
  ContextSectionKind,
  ExcludedContextItem,
  MemoryProposal,
  Message,
} from "../types/adventure";
import { approximateTokenCount } from "../tokenizer/approximateTokenCount";
import { matchPatterns } from "../triggers/matching";

const SYSTEM_SHELL = `You are the story engine for AI Story Teller. The context below is assembled for you each turn.

CONTEXT SECTIONS (read all, honour their order):
  B. AI Instructions — narrative rules and style for this adventure.
  C. Plot Essentials — permanent world facts and canon plot state. Ground truth.
  E. Components — general world-building context (always-on or pinned entries).
  F. Story Cards — World Info entries injected when their trigger keywords appear in recent text.
  G. Brains — internal mental state of named characters. Private to the narrator; never quote directly.
  H. Quest State — active quest objectives.
  I. Rolling Summary — compressed history of earlier turns. Treat as canon.
  D. Author's Note — immediate narrative direction for this turn. Highest-priority steering.
  J. Next Output Bias — one-turn instruction. Apply it, then disregard it.
  K. Recent Messages — the most recent story turns in chronological order.

Honour every section. Continue the scene in prose. Keep the player able to act.`;

interface BuildOptions {
  currentInput?: string;
  latestModelOutput?: string;
}

function prioritySort<T extends { priority: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function item(
  id: string,
  sourceType: ContextItem["sourceType"],
  title: string,
  content: string,
  priority = 0,
  protectedItem = false,
  pinned = false,
  active = true,
  inclusionPolicy: ContextInclusionPolicy = "triggered",
  generatedBy: ContextItem["generatedBy"] = "user",
): ContextItem {
  return {
    id,
    sourceType,
    title,
    content,
    priority,
    protected: protectedItem,
    pinned,
    active,
    inclusionPolicy,
    generatedBy,
    tokenEstimate: approximateTokenCount(content),
  };
}

function section(id: ContextSectionKind, label: string, order: number, items: ContextItem[]): ContextSection {
  const content = items.map((entry) => `## ${entry.title}\n${entry.content}`).join("\n\n");
  return {
    id,
    label,
    order,
    items,
    content,
    tokenEstimate: approximateTokenCount(content),
  };
}

function excluded(
  sourceType: ExcludedContextItem["sourceType"],
  id: string,
  title: string,
  reason: ExcludedContextItem["reason"],
  detail?: string,
): ExcludedContextItem {
  return { sourceType, id, title, reason, detail };
}

function decision(
  entry: Pick<ContextItem, "id" | "sourceType" | "title">,
  action: ContextBuildDecision["action"],
  reason: string,
  detail: string,
): ContextBuildDecision {
  return { itemId: entry.id, sourceType: entry.sourceType, title: entry.title, action, reason, detail };
}

function sourceDecision(
  sourceType: ContextItem["sourceType"],
  id: string,
  title: string,
  action: ContextBuildDecision["action"],
  reason: string,
  detail: string,
): ContextBuildDecision {
  return { itemId: id, sourceType, title, action, reason, detail };
}

function recentText(adventure: Adventure, options: BuildOptions): string {
  const windowSize = adventure.tokenBudgetSettings.recentMessageWindow;
  const recent = adventure.messages
    .slice(-windowSize)
    .map((message) => message.content)
    .join("\n");
  return [options.currentInput, options.latestModelOutput, recent].filter(Boolean).join("\n");
}

function isForced(adventure: Adventure, sourceType: ContextItem["sourceType"], id: string): boolean {
  const turn = adventure.activeState.turn;
  return adventure.activeState.forceIncludeNextTurn.some(
    (entry) =>
      entry.targetId === id &&
      entry.expiresTurn >= turn &&
      ((entry.targetType === "storyCard" && sourceType === "storyCard") ||
        (entry.targetType === "autoCard" && sourceType === "autoCard") ||
        (entry.targetType === "brain" && sourceType === "brain") ||
        (entry.targetType === "component" && sourceType === "component") ||
        (entry.targetType === "quest" && sourceType === "quest")),
  );
}

function selectedRecentMessages(adventure: Adventure, seedMessage?: Message): Message[] {
  const tokenCap = adventure.tokenBudgetSettings.sectionBudgets.recentMessages;
  const countCap = adventure.tokenBudgetSettings.maxRecentMessages;
  const messages = adventure.messages;
  const result: Message[] = [];
  let tokens = 0;
  // Walk newest-first; token cap is the primary constraint, count cap is a safety ceiling
  for (let i = messages.length - 1; i >= 0; i--) {
    if (result.length >= countCap) break;
    const msg = messages[i];
    const cost = approximateTokenCount(msg.content);
    if (tokenCap && tokens + cost > tokenCap) break;
    tokens += cost;
    result.push(msg);
  }
  // Append seed (opening scene) as oldest entry if it fits
  if (seedMessage && result.length < countCap) {
    const cost = approximateTokenCount(seedMessage.content);
    if (!tokenCap || tokens + cost <= tokenCap) {
      result.push(seedMessage);
    }
  }
  return result; // newest-first; seed is last (oldest)
}

function recalculate(sections: ContextSection[]): ContextSection[] {
  return sections.map((entry) => section(entry.id, entry.label, entry.order, entry.items));
}

function totalTokens(sections: ContextSection[]): number {
  return sections.reduce((sum, entry) => sum + entry.tokenEstimate, 0);
}

function truncateFromFront(text: string, targetTokens: number): string {
  if (targetTokens <= 0) return "";
  const words = text.split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < words.length && approximateTokenCount(words.slice(start).join(" ")) > targetTokens) {
    start += 1;
  }
  return words.slice(start).join(" ");
}

function buildPayload(sections: ContextSection[], recentMessagesNewestFirst: Message[], openingScene?: string, lengthHintText?: string) {
  const contextText = sections
    .filter((entry) => entry.id !== "recentMessages" && entry.content.length > 0)
    .sort((a, b) => a.order - b.order)
    .map((entry) => `# ${entry.label}\n${entry.content}`)
    .join("\n\n");

  const systemContent = lengthHintText ? `${contextText}\n\n${lengthHintText}` : contextText;
  const chronologicalRecent = [...recentMessagesNewestFirst].reverse();
  return [
    { role: "system" as const, content: systemContent },
    ...(openingScene ? [{ role: "assistant" as const, content: openingScene }] : []),
    ...chronologicalRecent.map((message) => ({ role: message.role, content: message.content })),
  ];
}

function sourceToGeneratedBy(source: "manual" | "imported" | "generated" | undefined): ContextItem["generatedBy"] {
  return source === "generated" ? "ai" : "user";
}

export function buildContext(adventure: Adventure, options: BuildOptions = {}): ContextBuildResult {
  const excludedItems: ExcludedContextItem[] = [];
  const decisions: ContextBuildDecision[] = [];
  const triggerText = recentText(adventure, options);
  const budgetSettings = adventure.tokenBudgetSettings;

  function pushExcluded(
    sourceType: ExcludedContextItem["sourceType"],
    id: string,
    title: string,
    reason: ExcludedContextItem["reason"],
    detail?: string,
  ) {
    excludedItems.push(excluded(sourceType, id, title, reason, detail));
    decisions.push(sourceDecision(sourceType, id, title, reason === "budget_exceeded" ? "dropped" : "excluded", reason, detail ?? reason));
  }

  function pushIncluded(entry: ContextItem, detail: string) {
    decisions.push(decision(entry, "included", "included", detail));
  }

  // A. System Shell
  const systemItem = item("system-shell", "system", "System Shell", SYSTEM_SHELL, 1000, true, false, true, "always", "system");
  pushIncluded(systemItem, "System shell is always included and protected.");

  // Track which component IDs have already been logged as excluded to avoid double-logging
  const loggedExcluded = new Set<string>();

  function logExcludedOnce(id: string, title: string, reason: ExcludedContextItem["reason"], detail?: string) {
    if (!loggedExcluded.has(id)) {
      loggedExcluded.add(id);
      pushExcluded("component", id, title, reason, detail);
    }
  }

  // B. Narration Rules — components with type === "narrationRules" (loaded first, before AI Instructions)
  const narrationRulesItems = prioritySort(adventure.components).flatMap((component) => {
    if (component.type !== "narrationRules") return [];
    if (!component.active) {
      logExcludedOnce(component.id, component.title, "inactive");
      return [];
    }
    const next = item(component.id, "component", component.title, component.content, component.priority, component.protected, component.pinned, component.active, component.inclusionPolicy, "user");
    pushIncluded(next, `Narration Rules loaded; priority=${component.priority}; protected=${component.protected}.`);
    return [next];
  });
  const systemSection = section("system", "A. System Shell / Global Generation Rules", 0, [systemItem, ...narrationRulesItems]);

  // B2. AI Instructions — all active components with type === "aiInstructions"
  const aiInstructionItems = prioritySort(adventure.components).flatMap((component) => {
    if (component.type !== "aiInstructions") return [];
    if (!component.active) {
      logExcludedOnce(component.id, component.title, "inactive");
      return [];
    }
    const next = item(component.id, "component", component.title, component.content, component.priority, component.protected, component.pinned, component.active, component.inclusionPolicy, "user");
    pushIncluded(next, `AI Instructions loaded; priority=${component.priority}; protected=${component.protected}.`);
    return [next];
  });

  // C. Plot Essentials — all active components with type === "plotEssentials"
  const plotEssentialItems = prioritySort(adventure.components).flatMap((component) => {
    if (component.type !== "plotEssentials") return [];
    if (!component.active) {
      logExcludedOnce(component.id, component.title, "inactive");
      return [];
    }
    const next = item(component.id, "component", component.title, component.content, component.priority, component.protected, component.pinned, component.active, component.inclusionPolicy, "user");
    pushIncluded(next, `Plot Essentials loaded; priority=${component.priority}; protected=${component.protected}.`);
    return [next];
  });

  // D. Author's Note — all active components with type === "authorNote"
  const authorNoteItems = prioritySort(adventure.components).flatMap((component) => {
    if (component.type !== "authorNote") return [];
    if (!component.active) {
      logExcludedOnce(component.id, component.title, "inactive");
      return [];
    }
    const next = item(component.id, "component", component.title, component.content, component.priority, component.protected, component.pinned, component.active, component.inclusionPolicy, "user");
    pushIncluded(next, `Author's Note loaded; priority=${component.priority}; protected=${component.protected}.`);
    return [next];
  });

  // E. Components — general always-on or pinned components (not a special typed section above)
  const generalComponentItems = prioritySort(adventure.components).flatMap((component) => {
    if (component.type === "narrationRules" || component.type === "aiInstructions" || component.type === "plotEssentials" || component.type === "authorNote") return [];
    if (!component.active) {
      logExcludedOnce(component.id, component.title, "inactive");
      return [];
    }
    if (component.inclusionPolicy !== "always" && !component.alwaysOn && !component.pinned) return [];
    const next = item(component.id, "component", component.title, component.content, component.priority, component.protected, component.pinned, component.active, component.inclusionPolicy, "user");
    pushIncluded(next, `Component loaded by ${component.pinned ? "pin" : `alwaysOn/inclusionPolicy=${component.inclusionPolicy}`}; priority=${component.priority}; protected=${component.protected}.`);
    return [next];
  });

  // F. Story Cards + Auto-Cards
  const storyCardItems: ContextItem[] = [];
  for (const card of prioritySort(adventure.storyCards)) {
    const forced = isForced(adventure, "storyCard", card.id);
    if (!card.active && !forced) {
      pushExcluded("storyCard", card.id, card.title, "inactive");
      continue;
    }
    const match = matchPatterns(triggerText, card.keys, card.matchType ?? "phrase");
    const matched = card.inclusionPolicy === "always" || card.pinned || forced || (card.inclusionPolicy !== "manual" && match.matched);
    if (matched) {
      const next = item(card.id, "storyCard", card.title, card.content, card.priority, card.protected, card.pinned, card.active, card.inclusionPolicy, "user");
      pushIncluded(next, `Story card included by ${card.pinned ? "pin" : forced ? "manual force" : card.inclusionPolicy === "always" ? "always policy" : `trigger ${match.pattern}`}; priority=${card.priority}; protected=${card.protected}.`);
      storyCardItems.push(next);
    } else {
      pushExcluded("storyCard", card.id, card.title, "not_triggered", "No story card trigger matched current input, output, or recent history.");
    }
  }

  for (const card of prioritySort(adventure.autoCards)) {
    const forced = isForced(adventure, "autoCard", card.id);
    if (!card.active && !forced) {
      pushExcluded("autoCard", card.id, card.title, "inactive");
      continue;
    }
    if (card.lastUpdatedTurn !== undefined && card.cooldownTurns > 0 && adventure.activeState.turn - card.lastUpdatedTurn < card.cooldownTurns) {
      pushExcluded("autoCard", card.id, card.title, "cooldown");
      continue;
    }
    const patterns = card.triggers.length ? card.triggers : [card.detectedEntity, card.title];
    const match = matchPatterns(triggerText, patterns, "phrase");
    const matched = card.inclusionPolicy === "always" || card.pinned || forced || (card.inclusionPolicy !== "manual" && match.matched);
    if (matched) {
      const next = item(card.id, "autoCard", card.title, card.content, card.priority, card.protected, card.pinned, card.active, card.inclusionPolicy, sourceToGeneratedBy(card.source));
      pushIncluded(next, `Auto-Card included by ${card.pinned ? "pin" : forced ? "manual force" : card.inclusionPolicy === "always" ? "always policy" : `trigger ${match.pattern}`}; priority=${card.priority}; protected=${card.protected}.`);
      storyCardItems.push(next);
    } else {
      pushExcluded("autoCard", card.id, card.title, "not_triggered", "No Auto-Card trigger matched current input, output, or recent history.");
    }
  }

  // G. Brains
  const brainItems = prioritySort(adventure.brains).flatMap((brain) => {
    const forced = isForced(adventure, "brain", brain.id);
    if (!brain.active && !forced) {
      pushExcluded("brain", brain.id, brain.characterName, "inactive");
      return [];
    }
    const patterns = [brain.characterName, ...brain.aliases, ...brain.triggers].filter(Boolean);
    const match = matchPatterns(triggerText, patterns, "phrase");
    const matched = brain.inclusionPolicy === "always" || brain.pinned || forced || (brain.inclusionPolicy !== "manual" && match.matched);
    if (!matched) {
      pushExcluded("brain", brain.id, brain.characterName, "not_triggered", "No brain trigger matched current input, output, or recent history.");
      return [];
    }
    const content = [
      brain.currentState && `Current state: ${brain.currentState}`,
      brain.thoughts && `Thoughts: ${brain.thoughts}`,
      brain.relationshipPressure && `Relationship pressure: ${brain.relationshipPressure}`,
      brain.emotionalInterpretation && `Emotional interpretation: ${brain.emotionalInterpretation}`,
      brain.recentDevelopments && `Recent developments: ${brain.recentDevelopments}`,
    ]
      .filter(Boolean)
      .join("\n");
    const next = item(brain.id, "brain", brain.characterName, content, brain.priority, brain.protected, brain.pinned, brain.active, brain.inclusionPolicy, sourceToGeneratedBy(brain.source));
    pushIncluded(next, `Brain included by ${brain.pinned ? "pin" : forced ? "manual force" : brain.inclusionPolicy === "always" ? "always policy" : `trigger ${match.pattern}`}; priority=${brain.priority}; protected=${brain.protected}.`);
    return [next];
  });

  // H. Quest State
  const questItems = prioritySort(adventure.quests).flatMap((quest) => {
    const forced = isForced(adventure, "quest", quest.id);
    if (quest.status !== "active" && !forced) {
      pushExcluded("quest", quest.id, quest.title, "inactive");
      return [];
    }
    const step = quest.steps.find((entry) => entry.id === quest.currentStepId);
    const content = [
      quest.description,
      step?.objective && `Current objective: ${step.objective}`,
      step?.contextText,
    ]
      .filter(Boolean)
      .join("\n");
    const next = item(quest.id, "quest", quest.title, content, quest.priority, quest.protected, quest.pinned, quest.status === "active", quest.inclusionPolicy, "user");
    pushIncluded(next, `Quest context included for active objective; priority=${quest.priority}; protected=${quest.protected}.`);
    return [next];
  });

  // I. Rolling Summary — pre-cap to sectionBudgets.rollingSummary before assembly
  const summaryCap = budgetSettings.sectionBudgets.rollingSummary;
  const rawSummaryContent = adventure.rollingSummary.content;
  const summaryContent = summaryCap && rawSummaryContent ? truncateFromFront(rawSummaryContent, summaryCap) : rawSummaryContent;
  const summaryItems = summaryContent
    ? [item("rolling-summary", "summary", "Rolling Summary", summaryContent, 0, false, false, true, "always", "user")]
    : [];
  summaryItems.forEach((entry) => pushIncluded(entry, `Rolling summary included${summaryCap ? `; pre-capped to ${summaryCap} tokens` : ""}.`));

  // J. Next Output Bias (+ response length hint)
  const nextTurnNote = adventure.activeState.nextTurnNote;
  if (nextTurnNote?.content.trim() && !nextTurnNote.active) {
    pushExcluded("nextTurnNote", "next-turn-note", "Next Output Bias", "inactive", "Next Output Bias has content but is not active.");
  }
  const nextTurnNoteItems =
    nextTurnNote?.active && nextTurnNote.content.trim()
      ? [
          item(
            "next-turn-note",
            "nextTurnNote",
            "Next Output Bias",
            nextTurnNote.content.trim(),
            nextTurnNote.priority,
            nextTurnNote.protected,
            nextTurnNote.pinned,
            nextTurnNote.active,
            "always",
            "user",
          ),
        ]
      : [];
  nextTurnNoteItems.forEach((entry) =>
    pushIncluded(
      entry,
      `Next Output Bias included for immediate next generation; priority=${entry.priority}; pinned=${entry.pinned}; protected=${entry.protected}; expiresAfterUse=${nextTurnNote.expiresAfterUse}.`,
    ),
  );

  // K. Recent Messages — opening scene is a virtual oldest message, subject to normal budget management
  const openingSeed: Message | undefined = adventure.openingScene
    ? { id: "opening-scene", role: "assistant" as const, content: adventure.openingScene, createdAt: adventure.createdAt }
    : undefined;
  const recentMessages = selectedRecentMessages(adventure, openingSeed);

  // Protect Last Exchange: newest assistant response (Last Scene) and the user turn that preceded it
  const lastAssistantIndex = recentMessages.findIndex((m) => m.role === "assistant" && m.id !== "opening-scene");
  const lastUserIndex =
    lastAssistantIndex >= 0 && recentMessages[lastAssistantIndex + 1]?.role === "user"
      ? lastAssistantIndex + 1
      : -1;

  const recentMessageItems = recentMessages.map((message, index) =>
    item(
      message.id,
      "message",
      message.id === "opening-scene" ? "Opening Scene" : `${message.role} message ${index + 1}`,
      message.content,
      recentMessages.length - index,
      index === lastAssistantIndex || index === lastUserIndex,
      false,
      true,
      "always",
      message.role === "assistant" ? "ai" : message.role === "system" ? "system" : "user",
    ),
  );
  recentMessageItems.forEach((entry, index) =>
    pushIncluded(
      entry,
      `Recent message included newest-first; recencyPriority=${recentMessages.length - index}${index === lastAssistantIndex ? "; protected=last scene" : index === lastUserIndex ? "; protected=last exchange" : ""}.`,
    ),
  );

  let sections = recalculate([
    systemSection,
    section("aiInstructions", "B. AI Instructions", 1, aiInstructionItems),
    section("plotEssentials", "C. Plot Essentials", 2, plotEssentialItems),
    section("components", "E. Components", 3, generalComponentItems),
    section("storyCards", "F. Story Cards", 4, storyCardItems),
    section("brains", "G. Brains", 5, brainItems),
    section("questState", "H. Quest State", 6, questItems),
    section("rollingSummary", "I. Rolling Summary", 7, summaryItems),
    // D. Author's Note is placed just before recent messages (AID-style) for maximum recency influence
    section("authorNote", "D. Author's Note", 8, authorNoteItems),
    section("nextTurnNote", "J. Next Output Bias", 9, nextTurnNoteItems),
    section("recentMessages", "K. Recent Messages", 10, recentMessageItems),
  ]);

  const budget = budgetSettings.maxContextTokens;

  const isDroppable = (sectionId: ContextSectionKind, entry: ContextItem): boolean => {
    if (entry.protected || entry.sourceType === "system") return false;
    if (
      sectionId === "storyCards" &&
      !entry.pinned &&
      (entry.sourceType === "storyCard" || entry.sourceType === "autoCard") &&
      !budgetSettings.allowSystemToDropUnpinnedTriggeredCards
    ) {
      return false;
    }
    return true;
  };

  const dropItem = (sectionId: ContextSectionKind, dropped: ContextItem, detail: string): boolean => {
    const target = sections.find((entry) => entry.id === sectionId);
    if (!target) return false;
    target.items = target.items.filter((entry) => entry.id !== dropped.id);
    pushExcluded(dropped.sourceType, dropped.id, dropped.title, "budget_exceeded", detail);
    sections = recalculate(sections);
    return true;
  };

  const dropOldestRecent = (): boolean => {
    const recentSection = sections.find((entry) => entry.id === "recentMessages");
    if (!recentSection) return false;
    const dropped = [...recentSection.items].reverse().find((entry) => isDroppable("recentMessages", entry));
    return dropped ? dropItem("recentMessages", dropped, "Dropped oldest recent message according to userLocked/hybrid priority behavior.") : false;
  };

  const truncateSummaryIfPossible = (): boolean => {
    if (!budgetSettings.allowSystemToTruncateSummary) return false;
    const rolling = sections.find((entry) => entry.id === "rollingSummary");
    const rollingItem = rolling?.items[0];
    if (!rolling || !rollingItem || !isDroppable("rollingSummary", rollingItem)) return false;
    const protectedCost = totalTokens(sections.filter((entry) => entry.id !== "rollingSummary"));
    const sectionOverhead = Math.max(0, rolling.tokenEstimate - rollingItem.tokenEstimate);
    const remaining = Math.max(0, budget - protectedCost - sectionOverhead);
    const truncated = truncateFromFront(rollingItem.content, remaining);
    if (truncated === rollingItem.content) return false;
    pushExcluded("summary", rollingItem.id, rollingItem.title, "budget_exceeded", "Truncated rolling summary from the front.");
    decisions.push(decision(rollingItem, "truncated", "budget_exceeded", "Rolling summary is truncatable and was cut from the front."));
    rolling.items = truncated
      ? [{ ...rollingItem, content: truncated, tokenEstimate: approximateTokenCount(truncated) }]
      : [];
    sections = recalculate(sections);
    return true;
  };

  const candidateScore = (sectionId: ContextSectionKind, entry: ContextItem): number => {
    const pinnedBonus = entry.pinned ? 1000 : 0;
    const policyPenalty = entry.inclusionPolicy === "systemSuggested" ? -100 : 0;
    const sectionBonus = sectionId === "recentMessages" ? 0 : 10;
    return entry.priority + pinnedBonus + policyPenalty + sectionBonus;
  };

  const dropLowestAny = (filter: (sectionId: ContextSectionKind, entry: ContextItem) => boolean = () => true, detail = "Dropped lowest-priority unprotected context item."): boolean => {
    const candidates = sections.flatMap((sectionEntry) =>
      sectionEntry.items
        .filter((entry) => isDroppable(sectionEntry.id, entry) && filter(sectionEntry.id, entry))
        .map((entry) => ({ sectionId: sectionEntry.id, entry, score: candidateScore(sectionEntry.id, entry) })),
    );
    candidates.sort((a, b) => a.score - b.score || a.entry.priority - b.entry.priority || a.entry.id.localeCompare(b.entry.id));
    const candidate = candidates[0];
    return candidate ? dropItem(candidate.sectionId, candidate.entry, detail) : false;
  };

  const dropLowestTriggered = (): boolean =>
    dropLowestAny(
      (sectionId, entry) => sectionId === "storyCards" && !entry.pinned,
      "Dropped lowest-priority unpinned triggered memory after recent messages and summary cuts.",
    );

  const dropSystemSuggested = (): boolean =>
    dropLowestAny(
      (_sectionId, entry) => entry.inclusionPolicy === "systemSuggested",
      "Hybrid mode dropped system-suggested context before user-locked context.",
    );

  const applyUserLockedBudget = (): boolean => {
    if (dropOldestRecent()) return true;
    if (truncateSummaryIfPossible()) return true;
    if (budgetSettings.allowSystemToDropUnpinnedTriggeredCards && dropLowestTriggered()) return true;
    if (dropLowestAny((_sectionId, entry) => !entry.pinned, "Dropped lowest-priority unprotected, unpinned context item.")) return true;
    return dropLowestAny(() => true, "Dropped pinned but unprotected context item because protected context alone exceeded the budget.");
  };

  const applySystemSuggestedBudget = (): boolean => {
    if (budgetSettings.allowSystemToPrioritizeMemory && dropLowestAny(() => true, "System-suggested priority mode dropped the lowest scored unprotected item.")) {
      return true;
    }
    if (dropOldestRecent()) return true;
    if (truncateSummaryIfPossible()) return true;
    return dropLowestAny();
  };

  const applyHybridBudget = (): boolean => {
    if (budgetSettings.allowSystemToPrioritizeMemory && dropSystemSuggested()) return true;
    return applyUserLockedBudget();
  };

  while (totalTokens(sections) > budget) {
    const changed =
      budgetSettings.memoryPriorityMode === "systemSuggested"
        ? applySystemSuggestedBudget()
        : budgetSettings.memoryPriorityMode === "hybrid"
          ? applyHybridBudget()
          : applyUserLockedBudget();
    if (!changed) break;
  }

  sections.forEach((contextSection) => {
    contextSection.items.forEach((entry, index) => {
      decisions.push(
        decision(
          entry,
          "ordered",
          "priority_order",
          `${contextSection.label}: position ${index + 1}; priority=${entry.priority}; pinned=${entry.pinned}; protected=${entry.protected}; inclusionPolicy=${entry.inclusionPolicy}; generatedBy=${entry.generatedBy}.`,
        ),
      );
    });
  });

  const recentSection = sections.find((entry) => entry.id === "recentMessages");
  const finalRecentMessageIds = new Set(recentSection?.items.map((entry) => entry.id) ?? []);
  const finalRecentMessages = recentMessages.filter((message) => finalRecentMessageIds.has(message.id));

  const pendingProposals: MemoryProposal[] = adventure.activeState.memoryProposals.filter(
    (proposal) => proposal.status === "pending",
  );

  const wordTarget = typeof adventure.activeState.responseLengthHint === "number"
    ? Math.max(50, Math.min(200, adventure.activeState.responseLengthHint))
    : 150;
  const lengthHintText = `RESPONSE LENGTH: Aim for approximately ${wordTarget} words.`;

  return {
    messages: buildPayload(sections, finalRecentMessages, undefined, lengthHintText),
    sections: sections.sort((a, b) => a.order - b.order),
    totalEstimatedTokens: totalTokens(sections),
    excludedItems,
    decisions,
    pendingProposals,
  };
}
