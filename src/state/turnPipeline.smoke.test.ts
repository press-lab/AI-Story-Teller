import { describe, expect, it, vi } from "vitest";
import { buildContext } from "../contextBuilder/contextBuilder";
import { adventureReducer } from "./adventureReducer";
import { createDefaultAdventure, makeBrain, makeComponent, makeStoryCard, makeTriggerRule } from "./defaults";
import type { Adventure, AdventureAction, ChatMessage, ContextBuildResult } from "../types/adventure";
import { makeMemoryProposal } from "../test/goldenAdventure";
import { runTurnPipeline } from "./turnPipeline";

const timestamp = "2026-01-01T00:00:00.000Z";

function dispatch(adventure: Adventure, action: AdventureAction): Adventure {
  return adventureReducer(adventure, action);
}

function reduceAll(adventure: Adventure, actions: AdventureAction[]): Adventure {
  return actions.reduce((next, action) => adventureReducer(next, action), adventure);
}

function makeSmokeAdventure(): Adventure {
  let adventure = createDefaultAdventure("Smoke Adventure");
  adventure = dispatch(adventure, {
    type: "UPSERT_COMPONENT",
    component: makeComponent({
      id: "component-plot",
      title: "Current Premise",
      type: "plotEssentials",
      content: "The ward is fragile tonight, and Margo is trying to keep Seth alive.",
      priority: 250,
      active: true,
    }),
  });
  adventure = dispatch(adventure, {
    type: "UPSERT_STORY_CARD",
    storyCard: makeStoryCard({
      id: "card-ward-law",
      title: "Ward Law",
      keys: ["ward"],
      content: "The ward resists creatures that hunt by old promises.",
      active: true,
      priority: 80,
    }),
  });
  adventure = dispatch(adventure, {
    type: "UPSERT_BRAIN",
    brain: makeBrain({
      id: "brain-margo",
      characterName: "Margo",
      triggers: ["Margo"],
      thoughts: { turn1_protective: "1 → I keep watching the ward for cracks. If it fails, I'm the one between it and Seth." },
      active: true,
      priority: 70,
    }),
  });
  return adventure;
}

function sectionItemIds(result: ContextBuildResult, sectionId: string): string[] {
  return result.sections.find((section) => section.id === sectionId)?.items.map((item) => item.id) ?? [];
}

function expectContextPreviewMatchesProviderPayload(result: ContextBuildResult) {
  const systemPayload = result.messages[0].content;
  for (const section of result.sections.filter((entry) => entry.id !== "recentMessages" && entry.content.length > 0)) {
    expect(systemPayload).toContain(section.content);
  }

  const recentItemsOldestFirst = [
    ...(result.sections.find((section) => section.id === "recentMessages")?.items ?? []),
  ]
    .reverse()
    .map((item) => item.content);
  // Extra messages (length reminder, thought capture) may follow recent messages — check only the first N
  expect(result.messages.slice(1, 1 + recentItemsOldestFirst.length).map((message) => message.content)).toEqual(recentItemsOldestFirst);
}

describe("full turn smoke path", () => {
  it("mirrors AID story controls: take turn, continue, retry, erase, undo, and redo", async () => {
    let adventure = makeSmokeAdventure();

    const provider = vi
      .fn()
      .mockResolvedValueOnce({ content: "The door opens to rain." })
      .mockResolvedValueOnce({ content: "The rain grows colder." })
      .mockResolvedValueOnce({ content: "A cleaner retry response." });

    const turnOne = await runTurnPipeline({
      adventure,
      text: "I open the door.",
      mode: "story",
      userMessageId: "aid-user-1",
      assistantMessageId: "aid-assistant-1",
      createdAt: timestamp,
      sendChatCompletion: provider,
    });
    adventure = turnOne.adventure;
    expect(adventure.activeState.turn).toBe(1);
    expect(adventure.messages.map((message) => message.id)).toEqual(["aid-user-1", "aid-assistant-1"]);
    expect(adventure.messages.at(-1)?.content).toBe("The door opens to rain.");

    const continued = await runTurnPipeline({
      adventure,
      text: "Continue.",
      mode: "story",
      userMessageId: "aid-user-continue",
      assistantMessageId: "aid-assistant-continue",
      createdAt: timestamp,
      sendChatCompletion: provider,
    });
    adventure = continued.adventure;
    expect(adventure.activeState.turn).toBe(2);
    expect(adventure.messages.map((message) => message.id)).toEqual([
      "aid-user-1",
      "aid-assistant-1",
      "aid-user-continue",
      "aid-assistant-continue",
    ]);
    expect(adventure.messages.at(-1)?.content).toBe("The rain grows colder.");

    // Retry mirrors the app flow: erase last generated section, rebuild from the last user input,
    // add replacement assistant output, and do not increment the turn counter again.
    adventure = dispatch(adventure, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" });
    const retryContext = buildContext(adventure, {
      currentInput: "Continue.",
      latestModelOutput: adventure.messages.find((message) => message.id === "aid-assistant-1")?.content,
    });
    const retryResponse = await provider(retryContext.messages, adventure, retryContext);
    adventure = dispatch(adventure, {
      type: "ADD_MESSAGE",
      id: "aid-assistant-retry",
      role: "assistant",
      content: retryResponse.content,
      createdAt: timestamp,
    });
    expect(adventure.activeState.turn).toBe(2);
    expect(adventure.messages.map((message) => message.id)).toEqual([
      "aid-user-1",
      "aid-assistant-1",
      "aid-user-continue",
      "aid-assistant-retry",
    ]);
    expect(adventure.messages.at(-1)?.content).toBe("A cleaner retry response.");
    expect(adventure.messages.some((message) => message.id === "aid-assistant-continue")).toBe(false);

    adventure = dispatch(adventure, { type: "DELETE_LAST_MESSAGE" });
    expect(adventure.messages.map((message) => message.id)).toEqual(["aid-user-1", "aid-assistant-1", "aid-user-continue"]);
    adventure = dispatch(adventure, { type: "UNDO_STORY_EDIT" });
    expect(adventure.messages.map((message) => message.id)).toEqual([
      "aid-user-1",
      "aid-assistant-1",
      "aid-user-continue",
      "aid-assistant-retry",
    ]);
    adventure = dispatch(adventure, { type: "REDO_STORY_EDIT" });
    expect(adventure.messages.map((message) => message.id)).toEqual(["aid-user-1", "aid-assistant-1", "aid-user-continue"]);

    adventure = dispatch(adventure, { type: "DELETE_LAST_MESSAGE" });
    expect(adventure.messages.map((message) => message.id)).toEqual(["aid-user-1", "aid-assistant-1"]);
    adventure = dispatch(adventure, { type: "UNDO_STORY_EDIT" });
    expect(adventure.messages.map((message) => message.id)).toEqual(["aid-user-1", "aid-assistant-1", "aid-user-continue"]);

    adventure = dispatch(adventure, {
      type: "UPDATE_MESSAGE",
      messageId: "aid-user-continue",
      content: "Continue, but focus on the rain.",
    });
    expect(adventure.messages.at(-1)?.content).toBe("Continue, but focus on the rain.");
    adventure = dispatch(adventure, { type: "UNDO_STORY_EDIT" });
    expect(adventure.messages.at(-1)?.content).toBe("Continue.");
    adventure = dispatch(adventure, { type: "REDO_STORY_EDIT" });
    expect(adventure.messages.at(-1)?.content).toBe("Continue, but focus on the rain.");

    expect(provider).toHaveBeenCalledTimes(3);
  });

  it("creates memory through the turn pipeline, keeps preview and provider payload matched, and gates approved memory by trigger or pin", async () => {
    const adventure = makeSmokeAdventure();
    expect(adventure.components.some((component) => component.id === "component-plot")).toBe(true);
    expect(adventure.storyCards.some((card) => card.id === "card-ward-law")).toBe(true);
    expect(adventure.brains.some((brain) => brain.id === "brain-margo")).toBe(true);

    let capturedPayload: ChatMessage[] | undefined;
    const provider = vi.fn(async (messages: ChatMessage[]) => {
      capturedPayload = messages;
      return { content: 'Margo calls Seth "hedge prince" as a private joke.' };
    });

    const result = await runTurnPipeline({
      adventure,
      text: "I ask Margo what Seth should do about the ward.",
      mode: "story",
      userMessageId: "smoke-user-1",
      assistantMessageId: "smoke-assistant-1",
      createdAt: timestamp,
      sendChatCompletion: provider,
    });

    expect(provider).toHaveBeenCalledTimes(1);
    expect(capturedPayload).toBe(result.preProviderContext.messages);
    expect(result.providerPayload).toBe(result.preProviderContext.messages);
    expectContextPreviewMatchesProviderPayload(result.preProviderContext);
    expect(sectionItemIds(result.preProviderContext, "plotEssentials")).toContain("component-plot");
    expect(sectionItemIds(result.preProviderContext, "storyCards")).toContain("card-ward-law");
    expect(sectionItemIds(result.preProviderContext, "brains")).toContain("brain-margo");

    // No heuristic proposals from the turn pipeline — detection is off by default.
    expect(result.adventure.activeState.memoryProposals).toHaveLength(0);

    // Seed a proposal as detection or the user would have produced one.
    const seededProposal = makeMemoryProposal({
      id: "smoke-proposal-1",
      proposedType: "storyCard",
      title: "Margo",
      content: "",
      status: "pending",
      suggestedTriggers: ["hedge prince"],
    });
    const withProposal = dispatch(result.adventure, { type: "ADD_MEMORY_PROPOSAL", proposal: seededProposal });
    const proposal = withProposal.activeState.memoryProposals[0];
    expect(proposal).toMatchObject({ proposedType: "storyCard", status: "pending" });
    expect(result.adventure.storyCards.some((card) => card.title === "Hedge Prince Joke")).toBe(false);
    const postWithProposal = buildContext(withProposal, { latestModelOutput: result.responseContent });
    expect(postWithProposal.pendingProposals.map((entry) => entry.id)).toContain(proposal.id);
    expect(postWithProposal.sections.flatMap((section) => section.items).map((item) => item.id)).not.toContain(proposal.id);

    const approved = dispatch(withProposal, {
      type: "APPROVE_MEMORY_PROPOSAL",
      proposalId: proposal.id,
      editedProposal: {
        title: "Hedge Prince Joke",
        content: "Margo calls Seth hedge prince as a private joke.",
        suggestedTriggers: ["hedge prince"],
      },
    });
    const approvedCard = approved.storyCards.find((card) => card.title === "Hedge Prince Joke");
    expect(approvedCard).toBeDefined();
    expect(approvedCard?.active).toBe(true);
    expect(approvedCard?.pinned).toBe(false);

    const quietAdventure = dispatch(approved, { type: "RESET_RUNTIME_STATE" });
    const untriggered = buildContext(quietAdventure, { currentInput: "I study the ceiling." });
    expect(sectionItemIds(untriggered, "storyCards")).not.toContain(approvedCard?.id);
    expect(untriggered.excludedItems).toContainEqual(
      expect.objectContaining({ id: approvedCard?.id, reason: "not_triggered" }),
    );

    const triggered = buildContext(quietAdventure, { currentInput: "Margo whispers hedge prince before the door opens." });
    expect(sectionItemIds(triggered, "storyCards")).toContain(approvedCard?.id);
    expectContextPreviewMatchesProviderPayload(triggered);

    const pinned = dispatch(quietAdventure, { type: "PIN_STORY_CARD", storyCardId: approvedCard!.id });
    const pinnedContext = buildContext(pinned, { currentInput: "I study the ceiling." });
    expect(sectionItemIds(pinnedContext, "storyCards")).toContain(approvedCard?.id);
    expectContextPreviewMatchesProviderPayload(pinnedContext);
  });

  it("plays a longer deterministic memory and brain scenario without activating unapproved memory", async () => {
    let adventure = makeSmokeAdventure();

    const playTurn = async (text: string, output: string, turn: number) => {
      let capturedPayload: ChatMessage[] | undefined;
      const provider = vi.fn(async (messages: ChatMessage[]) => {
        capturedPayload = messages;
        return { content: output };
      });
      const result = await runTurnPipeline({
        adventure,
        text,
        userMessageId: `long-user-${turn}`,
        assistantMessageId: `long-assistant-${turn}`,
        createdAt: timestamp,
        sendChatCompletion: provider,
      });
      expect(provider).toHaveBeenCalledTimes(1);
      expect(capturedPayload).toBe(result.preProviderContext.messages);
      expectContextPreviewMatchesProviderPayload(result.preProviderContext);
      adventure = result.adventure;
      return result;
    };

    // Turn 1: play the turn, then seed a storyCard proposal (as AI detection would produce).
    await playTurn("I ask Margo if Seth has a nickname.", 'Margo calls Seth "hedge prince" as a private joke.', 1);
    adventure = dispatch(adventure, {
      type: "ADD_MEMORY_PROPOSAL",
      proposal: makeMemoryProposal({
        id: "long-proposal-joke",
        proposedType: "storyCard",
        title: "Margo",
        content: "",
        status: "pending",
        suggestedTriggers: ["hedge prince"],
      }),
    });
    const jokeProposal = adventure.activeState.memoryProposals[0];
    expect(jokeProposal).toMatchObject({ proposedType: "storyCard", status: "pending" });
    expect(adventure.storyCards.some((card) => card.title === "Hedge Prince Joke")).toBe(false);

    adventure = dispatch(adventure, {
      type: "APPROVE_MEMORY_PROPOSAL",
      proposalId: jokeProposal.id,
      editedProposal: {
        title: "Hedge Prince Joke",
        content: "Margo calls Seth hedge prince as a private joke.",
        suggestedTriggers: ["hedge prince", "Margo", "Seth"],
      },
    });
    const jokeCard = adventure.storyCards.find((card) => card.title === "Hedge Prince Joke");
    expect(jokeCard).toBeDefined();

    const turnTwo = await playTurn("Margo says hedge prince again before Seth answers.", "Margo smiles despite herself.", 2);
    expect(sectionItemIds(turnTwo.preProviderContext, "storyCards")).toContain(jokeCard?.id);

    // Turn 3: play, then seed a brainUpdate proposal for Margo.
    await playTurn("Seth steps too close to danger.", "Margo feels jealous but hides it because Seth smiled at the merchant.", 3);
    adventure = dispatch(adventure, {
      type: "ADD_MEMORY_PROPOSAL",
      proposal: makeMemoryProposal({
        id: "long-proposal-brain",
        proposedType: "brainUpdate",
        title: "Margo",
        content: "Margo feels jealous but hides it because Seth smiled at the merchant.",
        status: "pending",
        targetId: "brain-margo",
      }),
    });
    const brainProposal = adventure.activeState.memoryProposals.find(
      (proposal) => proposal.status === "pending" && proposal.proposedType === "brainUpdate",
    );
    expect(brainProposal).toBeDefined();
    adventure = dispatch(adventure, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: brainProposal!.id });
    expect(adventure.brains.find((brain) => brain.id === "brain-margo")?.recentDevelopments).toContain(
      "Margo feels jealous but hides it",
    );
    const brainContext = buildContext(adventure, { currentInput: "Margo watches Seth carefully." });
    expect(sectionItemIds(brainContext, "brains")).toContain("brain-margo");
    expectContextPreviewMatchesProviderPayload(brainContext);

    // Turn 4: ephemeral room detail produces no proposal (detection is off).
    const proposalCountBeforeRoomDetail = adventure.activeState.memoryProposals.length;
    await playTurn("I scan the room.", "The couch is against the west wall.", 4);
    expect(adventure.activeState.memoryProposals).toHaveLength(proposalCountBeforeRoomDetail);
    expect(adventure.storyCards.some((card) => card.content.includes("west wall"))).toBe(false);
  });

  it("sends Next Output Bias in the provider payload and consumes it after one successful output", async () => {
    const adventure = dispatch(makeSmokeAdventure(), {
      type: "SET_NEXT_TURN_NOTE",
      note: {
        content: "Do not resolve the argument yet.",
        expiresAfterUse: true,
        pinned: true,
        protected: false,
      },
    });
    const provider = vi.fn(async () => ({ content: "The argument tightens without resolving." }));

    const result = await runTurnPipeline({
      adventure,
      text: "Margo waits for Seth to answer.",
      userMessageId: "note-user",
      assistantMessageId: "note-assistant",
      createdAt: timestamp,
      sendChatCompletion: provider,
    });

    expect(result.providerPayload[0].content).toContain("# J. Next Output Bias");
    expect(result.providerPayload[0].content).toContain("Do not resolve the argument yet.");
    expect(result.preProviderContext.sections.find((section) => section.id === "nextTurnNote")?.items).toHaveLength(1);
    expect(result.adventure.activeState.nextTurnNote.content).toBe("");
    expect(result.postTurnContext.messages[0].content).not.toContain("Do not resolve the argument yet.");
  });
});
