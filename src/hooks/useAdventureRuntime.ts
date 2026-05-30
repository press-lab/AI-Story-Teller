import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { buildContext } from "../contextBuilder/contextBuilder";
import { saveAdventure } from "../db/adventureDb";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { adventureReducer } from "../state/adventureReducer";
import { buildRollingSummaryPayload, buildSceneStatePayload } from "../state/rollingSummary";
import {
  applyRuntimeEngines,
  createMemoryProposalAction,
  latestAssistantOutput,
  reduceActions,
  runTurnPipeline,
} from "../state/turnPipeline";
import {
  runManualAutoCardGeneration,
  runManualBrainUpdate,
  runManualPlotEssentialsUpdate,
  runManualStoryCardsUpdate,
  runRememberThis,
  runSemanticPostTurnEvaluation,
} from "../triggers/semanticEngine";
import type {
  Adventure,
  AdventureAction,
  ContextBuildResult,
  InputMode,
  PendingAdventureUpdate,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { RuntimeProviderSettings } from "../pages/pageTypes";

function mergeProviderConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  return { ...adventure.modelConfig, ...settings, apiKey: settings.apiKey };
}

export function useAdventureRuntime(
  adventure: Adventure | undefined,
  setAdventure: Dispatch<SetStateAction<Adventure | undefined>>,
  providerSettings: RuntimeProviderSettings,
  setSaveStatus: (status: string) => void,
  setContextResult: (result: ContextBuildResult | undefined) => void,
  openTab: (tabId: "memoryInbox") => void,
  refreshAdventures: () => Promise<void>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const adventureRef = useRef<Adventure | undefined>(adventure);
  const providerSettingsRef = useRef(providerSettings);
  const isSubmittingRef = useRef(false);
  const queuedUpdatesRef = useRef<PendingAdventureUpdate[]>([]);

  useEffect(() => { adventureRef.current = adventure; }, [adventure]);
  useEffect(() => { providerSettingsRef.current = providerSettings; }, [providerSettings]);

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

  function applyMemoryProposalFromOutput(snapshot: Adventure, text: string): Adventure {
    const action = createMemoryProposalAction(snapshot, text);
    return action ? adventureReducer(snapshot, action) : snapshot;
  }

  async function startSemanticEvaluation(snapshot: Adventure) {
    if (!snapshot.semanticEvaluationSettings.enabled) return;
    const result = await runSemanticPostTurnEvaluation(
      snapshot,
      mergeProviderConfig(snapshot, providerSettingsRef.current),
    );
    if (isSubmittingRef.current) {
      queuePendingUpdate(result.actions, "semanticEvaluation");
      return;
    }
    applyActionsAndPersist(result.actions);
  }

  async function startAutoSceneState(adventureState: Adventure) {
    try {
      const { messages: sceneMessages } = buildSceneStatePayload(adventureState);
      const response = await sendOpenAICompatibleChatCompletion({
        config: mergeProviderConfig(adventureState, providerSettingsRef.current),
        messages: sceneMessages,
      });
      if (isSubmittingRef.current) {
        queuePendingUpdate([{ type: "UPDATE_SCENE_STATE", content: response.content }], "autoSceneState");
        return;
      }
      applyActionsAndPersist([{ type: "UPDATE_SCENE_STATE", content: response.content }]);
    } catch {
      // silent — auto scene state is best-effort
    }
  }

  async function startAutoSummary(adventureState: Adventure) {
    try {
      const { messages: summaryMessages, lastIndex } = buildRollingSummaryPayload(adventureState);
      const response = await sendOpenAICompatibleChatCompletion({
        config: mergeProviderConfig(adventureState, providerSettingsRef.current),
        messages: summaryMessages,
      });
      if (isSubmittingRef.current) {
        queuePendingUpdate(
          [{ type: "UPDATE_ROLLING_SUMMARY", content: response.content, lastSummarizedMessageIndex: lastIndex }],
          "autoSummary",
        );
        return;
      }
      applyActionsAndPersist([
        { type: "UPDATE_ROLLING_SUMMARY", content: response.content, lastSummarizedMessageIndex: lastIndex },
      ]);
    } catch {
      // silent — auto-summary is best-effort
    }
  }

  function checkAutoSummary(adventureState: Adventure) {
    const bs = adventureState.tokenBudgetSettings;
    if (bs.autoSummarize && adventureState.activeState.turn > 0 && adventureState.activeState.turn % bs.autoSummarizeEveryNTurns === 0) {
      void startAutoSummary(adventureState);
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

    const base = flushPendingBeforeContext(adventure);
    let snapshotWithUserMsg: typeof adventure | undefined;

    try {
      const result = await runTurnPipeline({
        adventure: base,
        text,
        mode,
        sendChatCompletion: async (messages, snapshot, context) => {
          snapshotWithUserMsg = snapshot;
          setAdventure(snapshot);
          setContextResult(context);
          return sendOpenAICompatibleChatCompletion({
            messages,
            config: mergeProviderConfig(snapshot, providerSettings),
          });
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
        checkAutoSummary(next);
      }
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Provider request failed.");
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
      const response = await sendOpenAICompatibleChatCompletion({
        messages: context.messages,
        config: mergeProviderConfig(next, providerSettings),
      });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content, usage: response.usage });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      next = applyMemoryProposalFromOutput(next, response.content);
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
      checkAutoSummary(next);
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
      const response = await sendOpenAICompatibleChatCompletion({
        messages: context.messages,
        config: mergeProviderConfig(next, providerSettings),
      });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content, usage: response.usage });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      next = applyMemoryProposalFromOutput(next, response.content);
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

  async function generateDurableSummary(): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const { messages: summaryMessages } = buildRollingSummaryPayload(adventure);
    const response = await sendOpenAICompatibleChatCompletion({
      config: activeProviderConfig,
      messages: summaryMessages,
    });
    return response.content;
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
    generateAutoCardNow,
    suggestPlotUpdates,
    suggestCardUpdates,
    generateDurableSummary,
    generateSceneState,
    applyActionsAndPersist,
  };
}
