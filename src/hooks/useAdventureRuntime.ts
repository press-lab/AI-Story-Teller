import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { buildContext } from "../contextBuilder/contextBuilder";
import { saveAdventure } from "../db/adventureDb";
import { regenerateProposalContent } from "../memory/memoryDetection";
import { runStoryCardAudit, type AuditRecommendation } from "../memory/storyCardAudit";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { adventureReducer } from "../state/adventureReducer";
import { buildRollingSummaryPayload, buildSceneStatePayload } from "../state/rollingSummary";
import {
  applyRuntimeEngines,
  latestAssistantOutput,
  reduceActions,
  runTurnPipeline,
} from "../state/turnPipeline";
import {
  runManualAutoCardGeneration,
  runManualBrainUpdate,
  runManualPEComponentUpdate,
  runManualPlotEssentialsUpdate,
  runManualStoryCardsUpdate,
  runMemoryCycle,
  runRememberThis,
  runSemanticPostTurnEvaluation,
} from "../triggers/semanticEngine";
import type {
  Adventure,
  AdventureAction,
  ContextBuildResult,
  InputMode,
  MemoryDetectionSettings,
  PendingAdventureUpdate,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { RuntimeProviderSettings } from "../pages/pageTypes";

function mergeProviderConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  return { ...adventure.modelConfig, ...settings, apiKey: settings.apiKey };
}

function applyResponseLengthHint(config: RuntimeProviderSettings, _hint: number): RuntimeProviderSettings {
  // The word-count instruction in the system prompt guides length.
  // Capping max_tokens here breaks models that use extended thinking (thinking tokens
  // exhaust the budget before any text is generated). Leave max_tokens at the model default.
  return config;
}

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

const CHALLENGE_PHRASES = [
  /i don'?t remember that/i,
  /that didn'?t happen/i,
  /\bcontinuity\b/i,
  /that'?s not (right|correct|what happened)/i,
  /you'?re making that up/i,
  /that was never (said|established|agreed)/i,
  /where did (you|that) come from/i,
];

function buildBackgroundConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  const base = mergeProviderConfig(adventure, settings);
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (!bg?.baseUrl) return base;
  return { ...base, baseUrl: bg.baseUrl, apiKey: bg.apiKey ?? base.apiKey, model: bg.model || base.model };
}

export function useAdventureRuntime(
  adventure: Adventure | undefined,
  setAdventure: Dispatch<SetStateAction<Adventure | undefined>>,
  providerSettings: RuntimeProviderSettings,
  setSaveStatus: (status: string) => void,
  setContextResult: (result: ContextBuildResult | undefined) => void,
  openTab: (tabId: "memoryInbox") => void,
  refreshAdventures: () => Promise<void>,
  globalMemorySettings: MemoryDetectionSettings,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const adventureRef = useRef<Adventure | undefined>(adventure);
  const providerSettingsRef = useRef(providerSettings);
  const globalMemorySettingsRef = useRef(globalMemorySettings);
  const isSubmittingRef = useRef(false);
  const queuedUpdatesRef = useRef<PendingAdventureUpdate[]>([]);
  const wasHiddenRef = useRef(false);
  const pendingRetryRef = useRef(false);
  const continueTurnRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => { adventureRef.current = adventure; }, [adventure]);
  useEffect(() => { providerSettingsRef.current = providerSettings; }, [providerSettings]);
  useEffect(() => { globalMemorySettingsRef.current = globalMemorySettings; }, [globalMemorySettings]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
      } else if (pendingRetryRef.current) {
        pendingRetryRef.current = false;
        wasHiddenRef.current = false;
        setError(undefined);
        void continueTurnRef.current?.();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const activeProviderConfig = useMemo(
    () => adventure ? mergeProviderConfig(adventure, providerSettings) : providerSettings,
    [adventure, providerSettings],
  );

  const applyActionsAndPersist = useCallback((actions: AdventureAction[]) => {
    setAdventure((current) => {
      if (!current) return current;
      const next = reduceActions(current, actions);
      adventureRef.current = next;
      void saveAdventure(next).then(() => {
        setSaveStatus("saved");
        void refreshAdventures();
      });
      return next;
    });
  }, [setAdventure, setSaveStatus, refreshAdventures]);

  function queuePendingUpdate(actions: AdventureAction[], source: PendingAdventureUpdate["source"]) {
    const update: PendingAdventureUpdate = {
      id: createId("pending"),
      createdAt: nowIso(),
      source,
      actions,
    };
    queuedUpdatesRef.current = [...queuedUpdatesRef.current, update];
    setAdventure((current) => current ? adventureReducer(current, { type: "QUEUE_PENDING_UPDATE", update }) : current);
  }

  function mergeQueuedUpdates(adventureState: Adventure): Adventure {
    if (queuedUpdatesRef.current.length === 0) return adventureState;
    let next = adventureState;
    for (const update of queuedUpdatesRef.current) {
      next = adventureReducer(next, { type: "QUEUE_PENDING_UPDATE", update });
    }
    queuedUpdatesRef.current = [];
    return next;
  }

  function flushPendingBeforeContext(adventureState: Adventure): Adventure {
    return adventureReducer(mergeQueuedUpdates(adventureState), { type: "FLUSH_PENDING_UPDATES" });
  }

  function checkMemoryCycle(adventureState: Adventure) {
    const settings = globalMemorySettingsRef.current;
    if (!settings.enabled) return;
    const currentTurn = adventureState.activeState.turn;
    const last = adventureState.activeState.lastMemoryCycleTurn;
    if (last !== undefined && currentTurn - last < settings.everyNTurns) return;
    void startMemoryCycle(adventureState);
  }

  async function startMemoryCycle(adventureState: Adventure) {
    try {
      const result = await runMemoryCycle(adventureState, buildBackgroundConfig(adventureState, providerSettingsRef.current));
      if (isSubmittingRef.current) {
        queuePendingUpdate(result.actions, "memoryCycle");
        return;
      }
      applyActionsAndPersist(result.actions);
    } catch {
      // silent — memory cycle is best-effort
    }
  }

  async function startSemanticEvaluation(snapshot: Adventure) {
    if (!snapshot.semanticEvaluationSettings.enabled) return;
    const everyN = snapshot.semanticEvaluationSettings.semanticEvalEveryNTurns ?? 1;
    if (everyN === 0) return;
    const last = snapshot.activeState.lastSemanticEvalTurn;
    if (last !== undefined && snapshot.activeState.turn - last < everyN) return;
    const result = await runSemanticPostTurnEvaluation(
      snapshot,
      mergeProviderConfig(snapshot, providerSettingsRef.current),
    );
    const stampAction: AdventureAction = { type: "SET_LAST_SEMANTIC_EVAL_TURN", turn: snapshot.activeState.turn };
    const tokenAction: AdventureAction | undefined = result.tokenUsage
      ? { type: "ACCUMULATE_BACKGROUND_TOKENS", promptTokens: result.tokenUsage.promptTokens, completionTokens: result.tokenUsage.completionTokens }
      : undefined;
    const allActions = [...result.actions, stampAction, ...(tokenAction ? [tokenAction] : [])];
    if (isSubmittingRef.current) {
      queuePendingUpdate(allActions, "semanticEvaluation");
      return;
    }
    applyActionsAndPersist(allActions);
  }

  async function startAutoSceneState(adventureState: Adventure) {
    const everyN = adventureState.tokenBudgetSettings.autoSceneStateEveryNTurns ?? 1;
    if (everyN === 0) return;
    const last = adventureState.activeState.lastSceneStateTurn;
    if (last !== undefined && adventureState.activeState.turn - last < everyN) return;
    try {
      const { messages: sceneMessages } = buildSceneStatePayload(adventureState);
      const response = await sendOpenAICompatibleChatCompletion({
        config: buildBackgroundConfig(adventureState, providerSettingsRef.current),
        messages: sceneMessages,
      });
      const content = stripThinkTags(response.content);
      const actions: AdventureAction[] = [
        { type: "UPDATE_SCENE_STATE", content },
        { type: "SET_LAST_SCENE_STATE_TURN", turn: adventureState.activeState.turn },
        ...(response.usage ? [{ type: "ACCUMULATE_BACKGROUND_TOKENS" as const, promptTokens: response.usage.promptTokens ?? 0, completionTokens: response.usage.completionTokens ?? 0 }] : []),
      ];
      if (isSubmittingRef.current) {
        queuePendingUpdate(actions, "autoSceneState");
        return;
      }
      applyActionsAndPersist(actions);
    } catch {
      // silent — auto scene state is best-effort
    }
  }

  const buildPreview = useCallback(() => {
    if (!adventure) return;
    setContextResult(buildContext(adventure, { latestModelOutput: latestAssistantOutput(adventure) }));
  }, [adventure, setContextResult]);

  async function submitTurn(text: string, mode: InputMode = "story") {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    let base = flushPendingBeforeContext(adventure);
    if (mode !== "comms" && CHALLENGE_PHRASES.some((re) => re.test(text))) {
      base = adventureReducer(base, { type: "SET_CHALLENGE_MODE" });
    }
    let snapshotWithUserMsg: typeof adventure | undefined;

    try {
      const result = await runTurnPipeline({
        adventure: base,
        text,
        mode,
        providerConfig: mergeProviderConfig(base, providerSettings),
        sendChatCompletion: async (messages, snapshot, context) => {
          snapshotWithUserMsg = snapshot;
          setAdventure(snapshot);
          setContextResult(context);
          const storyConfig = applyResponseLengthHint(mergeProviderConfig(snapshot, providerSettings), snapshot.activeState.responseLengthHint);
          return sendOpenAICompatibleChatCompletion({ messages, config: storyConfig });
        },
      });

      let next = mergeQueuedUpdates(result.adventure);
      setAdventure(next);
      setContextResult(result.postTurnContext);
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      if (mode !== "comms") {
        void startSemanticEvaluation(next);
        void startAutoSceneState(next);
        checkMemoryCycle(next);
      }
    } catch (providerError) {
      const errMsg = providerError instanceof Error ? providerError.message : "Provider request failed.";
      const isNetworkError = errMsg.startsWith("Network error");
      if (isNetworkError && wasHiddenRef.current) {
        pendingRetryRef.current = true;
        if (document.visibilityState === "visible") {
          pendingRetryRef.current = false;
          wasHiddenRef.current = false;
          setError(undefined);
          setTimeout(() => void continueTurnRef.current?.(), 0);
        } else {
          setError("Connection lost — will retry automatically when you return.");
        }
      } else {
        wasHiddenRef.current = false;
        setError(errMsg);
      }
      const errorState = snapshotWithUserMsg ?? base;
      setAdventure(errorState);
      await saveAdventure(errorState);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      void refreshAdventures();
    }
  }

  async function continueTurn() {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    let next = flushPendingBeforeContext(adventure);
    const context = buildContext(next, { latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);
    setAdventure(next);

    try {
      const continueConfig = applyResponseLengthHint(mergeProviderConfig(next, providerSettings), next.activeState.responseLengthHint);
      const response = await sendOpenAICompatibleChatCompletion({ messages: context.messages, config: continueConfig });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content, usage: response.usage });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      void 0; // memory cycle runs post-turn via checkMemoryCycle
      setAdventure(next);
      next = applyRuntimeEngines(next, { source: "output", text: response.content });
      next = adventureReducer(next, { type: "INCREMENT_TURN" });
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: response.content }));
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
      void startAutoSceneState(next);
      checkMemoryCycle(next);
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Continue failed.");
      setAdventure(next);
      await saveAdventure(next);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      void refreshAdventures();
    }
  }

  async function regenerateLastResponse() {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    let next = flushPendingBeforeContext(adventure);
    next = adventureReducer(next, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" });
    const lastUser = [...next.messages].reverse().find((m) => m.role === "user")?.content ?? "Continue.";
    const context = buildContext(next, { currentInput: lastUser, latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);

    try {
      const regenConfig = applyResponseLengthHint(mergeProviderConfig(next, providerSettings), next.activeState.responseLengthHint);
      const response = await sendOpenAICompatibleChatCompletion({ messages: context.messages, config: regenConfig });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content, usage: response.usage });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      void 0; // memory cycle runs post-turn via checkMemoryCycle
      setAdventure(next);
      next = applyRuntimeEngines(next, { source: "output", text: response.content });
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: response.content }));
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
      void startAutoSceneState(next);
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Regeneration failed.");
      setAdventure(next);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function rememberThis(fact: string) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runRememberThis(adventure, activeProviderConfig, fact);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (rememberError) {
      setError(rememberError instanceof Error ? rememberError.message : "Remember This failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBrainNow(brainId: string) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualBrainUpdate(adventure, activeProviderConfig, brainId);
      applyActionsAndPersist(result.actions);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "Manual brain update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePEComponentNow(componentId: string) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualPEComponentUpdate(adventure, activeProviderConfig, componentId);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual PE update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateAutoCardNow() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualAutoCardGeneration(adventure, activeProviderConfig);
      applyActionsAndPersist(result.actions);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "Manual Auto-Card generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function suggestPlotUpdates() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualPlotEssentialsUpdate(adventure, activeProviderConfig);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plot update suggestions failed.");
    } finally {
      setLoading(false);
    }
  }

  async function suggestCardUpdates() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualStoryCardsUpdate(adventure, activeProviderConfig);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story card update suggestions failed.");
    } finally {
      setLoading(false);
    }
  }

  async function auditStoryCards(nTurns: number): Promise<AuditRecommendation[]> {
    if (!adventure) return [];
    return runStoryCardAudit(adventure, activeProviderConfig, nTurns);
  }

  async function regenerateMemoryProposal(proposalId: string): Promise<void> {
    if (!adventure) return;
    const proposal = adventure.activeState.memoryProposals.find((p) => p.id === proposalId);
    if (!proposal) return;
    const newContent = await regenerateProposalContent(proposal, adventure, activeProviderConfig);
    if (!newContent) return;
    applyActionsAndPersist([{ type: "UPDATE_MEMORY_PROPOSAL", proposalId, patch: { content: newContent, appendContent: proposal.proposedType === "plotEssentialsUpdate", updatedAt: new Date().toISOString() } }]);
  }

  async function regeneratePlotEssentials(componentId: string): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const component = adventure.components.find((c) => c.id === componentId && c.type === "plotEssentials");
    if (!component) throw new Error("Plot Essentials component not found.");
    const recentTurns = adventure.messages.slice(-20).map((m) => `${m.role}: ${m.content}`).join("\n");
    const systemPrompt = `You are maintaining plot essentials for an interactive fiction game.
Current plot essentials:
${component.content}

Recent story turns:
${recentTurns}
${adventure.rollingSummary.content ? `\nRolling summary:\n${adventure.rollingSummary.content.slice(0, 400)}` : ""}

Rewrite the plot essentials as a clean, current, non-redundant block.
Remove resolved events and outdated constraints. Keep active pressures, open tensions, and immediate momentum.
Write as tight bullet points with bold headers like **Active pressure:**, **Immediate momentum:**, **Open tension:**.
Respond with ONLY the new content — no preamble, no labels, no explanation.`;
    const response = await sendOpenAICompatibleChatCompletion({
      config: activeProviderConfig,
      messages: [{ role: "user", content: systemPrompt }],
    });
    return response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  async function generateDurableSummary(): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const { messages: summaryMessages } = buildRollingSummaryPayload(adventure);
    const response = await sendOpenAICompatibleChatCompletion({
      config: activeProviderConfig,
      messages: summaryMessages,
    });
    const additions = stripThinkTags(response.content).trim();
    const existing = adventure.rollingSummary.content.trim();
    return additions ? (existing ? `${existing}\n\n${additions}` : additions) : existing;
  }

  async function generateSceneState(): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const { messages: sceneMessages } = buildSceneStatePayload(adventure);
    const response = await sendOpenAICompatibleChatCompletion({
      config: activeProviderConfig,
      messages: sceneMessages,
    });
    return response.content;
  }

  continueTurnRef.current = continueTurn;

  return {
    loading,
    error,
    clearError: () => setError(undefined),
    activeProviderConfig,
    buildPreview,
    submitTurn,
    continueTurn,
    regenerateLastResponse,
    rememberThis,
    updateBrainNow,
    updatePEComponentNow,
    generateAutoCardNow,
    suggestPlotUpdates,
    suggestCardUpdates,
    auditStoryCards,
    regenerateMemoryProposal,
    regeneratePlotEssentials,
    generateDurableSummary,
    generateSceneState,
    applyActionsAndPersist,
  };
}
