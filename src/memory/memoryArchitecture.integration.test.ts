import { describe, expect, it } from "vitest";
import { buildContext } from "../contextBuilder/contextBuilder";
import { progressQuest } from "../quests/questEngine";
import { adventureReducer } from "../state/adventureReducer";
import { makeBrain, makeQuest } from "../state/defaults";
import { goldenAdventure, makeMemoryProposal } from "../test/goldenAdventure";
import { triggerActionToAdventureActions } from "../triggers/triggerEngine";
import type { Adventure, MemoryProposal } from "../types/adventure";
import { applyAIMemoryUpdate } from "./applyAIMemoryUpdate";
import { classifyMemory } from "./classificationPolicy";

function reduceAll(adventure: Adventure, actions: Parameters<typeof adventureReducer>[1][]): Adventure {
  return actions.reduce((state, action) => adventureReducer(state, action), adventure);
}

describe("memory architecture smoke path", () => {
  it("keeps proposals out of active context until approved, then routes approved memory safely", () => {
    let adventure: Adventure = {
      ...goldenAdventure(),
      storyCards: [],
      brains: [makeBrain({ id: "brain-margo", characterName: "Margo", triggers: ["Margo"], currentState: "guarded" })],
      quests: [
        makeQuest({
          id: "quest-elevator",
          title: "Reach the Elevator",
          status: "active",
          currentStepId: "step-1",
          steps: [
            {
              id: "step-1",
              title: "Arrive",
              objective: "Reach the elevator",
              status: "active",
              completionCondition: "when the group reaches the elevator",
              triggerConditions: [],
              onStartActions: [],
              onCompleteActions: [{ type: "createMilestoneCard", questId: "quest-elevator", title: "Elevator Reached", content: "The group reached the elevator." }],
              contextText: "The elevator is the current objective.",
            },
            {
              id: "step-2",
              title: "Ascend",
              objective: "Take the elevator up",
              status: "pending",
              completionCondition: "when the group ascends",
              triggerConditions: [],
              onStartActions: [],
              onCompleteActions: [],
              contextText: "The next objective is to ascend.",
            },
          ],
        }),
      ],
    };

    const turnOneClassification = classifyMemory("Margo calls Seth 'hedge prince' as a private joke");
    const proposal: MemoryProposal = makeMemoryProposal({
      id: "proposal-1",
      proposedType: turnOneClassification.proposedType,
      title: turnOneClassification.title,
      content: turnOneClassification.content,
      suggestedTriggers: turnOneClassification.suggestedTriggers,
      confidence: turnOneClassification.confidence,
      rationale: turnOneClassification.rationale,
    });
    adventure = adventureReducer(adventure, { type: "ADD_MEMORY_PROPOSAL", proposal });
    expect(adventure.activeState.memoryProposals[0].status).toBe("pending");
    expect(buildContext(adventure, { currentInput: "hedge prince" }).sections.find((section) => section.id === "storyCards")?.items).toEqual([]);

    adventure = adventureReducer(adventure, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "proposal-1" });
    expect(adventure.activeState.memoryProposals[0].status).toBe("approved");
    expect(adventure.storyCards).toHaveLength(1);
    expect(buildContext(adventure, { currentInput: "Seth hears Margo say hedge prince." }).sections.find((section) => section.id === "storyCards")?.items[0].title).toBe("Margo");

    const brainUpdate = applyAIMemoryUpdate(adventure, [
      {
        type: "brainPatch",
        brainId: "brain-margo",
        patch: { currentState: "Margo feels jealous but hides it." },
        mode: "replace",
        turn: 3,
      },
    ]);
    adventure = reduceAll(adventure, brainUpdate.actions);
    const brainSection = buildContext(adventure, { currentInput: "Margo watches Seth." }).sections.find((section) => section.id === "brains");
    expect(brainSection?.content).toContain("Margo feels jealous but hides it.");

    const roomLayout = classifyMemory("The couch is against the west wall");
    const ignoredProposal = makeMemoryProposal({
      id: "proposal-room",
      proposedType: roomLayout.proposedType,
      title: roomLayout.title,
      content: roomLayout.content,
      status: "ignored",
    });
    adventure = adventureReducer(adventure, { type: "ADD_MEMORY_PROPOSAL", proposal: ignoredProposal });
    expect(adventure.storyCards.some((card) => card.content.includes("couch"))).toBe(false);

    const questBefore = adventure.quests.find((quest) => quest.id === "quest-elevator");
    expect(questBefore?.currentStepId).toBe("step-1");
    adventure = reduceAll(adventure, triggerActionToAdventureActions(adventure, { type: "progressQuest", questId: "quest-elevator", stepId: "step-1" }));
    expect(adventure.quests.find((quest) => quest.id === "quest-elevator")?.currentStepId).toBe("step-2");
    expect(progressQuest(questBefore!, "step-1").currentStepId).toBe("step-2");
    expect(adventure.storyCards.some((card) => card.title === "Elevator Reached")).toBe(true);
  });
});
