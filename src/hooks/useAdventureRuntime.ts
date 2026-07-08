import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { buildContext } from "../contextBuilder/contextBuilder";
import { regenerateProposalContent } from "../memory/memoryDetection";
import { generateArcContinuations, generateArcDirector, generateArcFromHistory, generateBrainFromName as generateBrainEntry, generateComponentContent, generateComponentDrafts, pickConvergentContinuation, type ComponentAIBuilderRequest, type GeneratedComponentDraft } from "../ai/generators";
import { PLOT_ESSENTIALS_BEST_PRACTICES } from "../ai/authoringBestPractices";
import { runStoryCardAudit, type AuditRecommendation } from "../memory/storyCardAudit";
import { runComponentAudit, type ComponentAuditRecommendation } from "../memory/componentAudit";
import { runBrainAudit, type BrainAuditRecommendation } from "../memory/brainAudit";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { resolveBackgroundProviderConfig } from "../providers/backgroundProvider";
import { adventureReducer } from "../state/adventureReducer";
import {
  applyProviderResponse,
  latestAssistantOutput,
  reduceActions,
  runTurnPipeline,
} from "../state/turnPipeline";
import {
  buildStoryResponseCorrectionMessages,
  evaluateStoryResponseGuard,
  storyResponseWordLimit,
} from "../state/storyResponseGuard";
import {
  runManualBrainUpdate,
  runManualPEComponentUpdate,
  runManualPlotEssentialsUpdate,
  runManualStoryCardsUpdate,
  runMemoryReconcile,
  runPlotAIBuilder,
  runMemoryCycle,
  runRememberThis,
  runSemanticPostTurnEvaluation,
  runStoryCardAIBuilder,
} from "../triggers/semanticEngine";
import type {
  Adventure,
  AdventureAction,
  ChatMessage,
  ContextBuildResult,
  InputMode,
  MemoryDetectionSettings,
  MemoryReconcileRequest,
  PendingAdventureUpdate,
  PlotAIBuilderRequest,
  ProviderUsage,
  StoryCardAIBuilderRequest,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { RuntimeProviderSettings } from "../pages/pageTypes";
import type { AdventureStore, ContextPreviewSource, TurnRunner } from "../runtime/adventureStore";

function mergeProviderConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  const sessionId = `ai-story-teller:${adventure.id}`.slice(0, 256);
  return { ...adventure.modelConfig, ...settings, apiKey: settings.apiKey, sessionId };
}

export interface BackendAiTools {
  buildStoryCardMemory(adventureId: string, request: StoryCardAIBuilderRequest): Promise<{ adventure: Adventure }>;
  suggestStoryCardUpdates(adventureId: string): Promise<{ adventure: Adventure }>;
  reconcileMemory(adventureId: string, request: MemoryReconcileRequest): Promise<{ adventure: Adventure }>;
  auditStoryCards(adventureId: string, nTurns: number, includeAI: boolean): Promise<AuditRecommendation[]>;
  generateBrain(adventureId: string, name: string): Promise<{ adventure: Adventure }>;
  updateBrain(adventureId: string, brainId: string): Promise<{ adventure: Adventure }>;
  auditBrains(adventureId: string, nTurns: number, includeAI: boolean): Promise<BrainAuditRecommendation[]>;
}

export interface MemoryReconcileRunSummary {
  generatedCount: number;
  pendingDelta: number;
  recordedDelta: number;
  error?: string;
}

function pendingMemoryProposalCount(adventure: Adventure): number {
  return adventure.activeState.memoryProposals.filter((proposal) => proposal.status === "pending").length;
}

function memoryReconcileGeneratedCount(adventure: Adventure): number | undefined {
  const latest = adventure.activeState.evaluationLog[0];
  const text = latest?.actionsExecuted.join("\n") ?? "";
  const match = text.match(/Memory Reconcile:\s+(\d+)\s+proposal/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function summarizeMemoryReconcile(before: Adventure, after: Adventure, generatedCount: number, error?: string): MemoryReconcileRunSummary {
  return {
    generatedCount,
    pendingDelta: Math.max(0, pendingMemoryProposalCount(after) - pendingMemoryProposalCount(before)),
    recordedDelta: Math.max(0, after.activeState.memoryProposals.length - before.activeState.memoryProposals.length),
    error,
  };
}

export function applyResponseLengthHint(config: RuntimeProviderSettings, hint: number, hiddenReserveTokens = 0): RuntimeProviderSettings {
  const wordTarget = Number.isFinite(hint) ? Math.max(50, Math.min(500, Math.round(hint))) : 250;
  const visibleTokenCap = Math.ceil(wordTarget * 1.5) + 80;
  const hiddenReserve = Math.max(0, Math.min(90, Math.ceil(hiddenReserveTokens * 0.25)));
  const lengthBoundedCap = visibleTokenCap + hiddenReserve;
  const configuredCap = Number.isFinite(config.maxOutputTokens) && config.maxOutputTokens > 0
    ? config.maxOutputTokens
    : lengthBoundedCap;
  return { ...config, maxOutputTokens: Math.min(configuredCap, lengthBoundedCap) };
}

function hiddenOutputReserveTokens(context: ContextBuildResult): number {
  const payloadText = context.messages.map((message) => message.content).join("\n");
  const thoughtExamples = payloadText.match(/<thought\s+name=/gi)?.length ?? 0;
  const memoryTaggingReserve = payloadText.includes("[MEMORY TAGGING]") ? 120 : 0;
  return thoughtExamples * 42 + memoryTaggingReserve;
}

function correctionConfig(config: RuntimeProviderSettings, responseLengthHint: number): RuntimeProviderSettings {
  const bounded = applyResponseLengthHint(
    {
      ...config,
      temperature: Math.min(config.temperature, 0.2),
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    responseLengthHint,
    0,
  );
  const correctionCap = Math.ceil(storyResponseWordLimit(responseLengthHint) * 1.15) + 35;
  return { ...bounded, maxOutputTokens: Math.min(bounded.maxOutputTokens, correctionCap) };
}

export function combineProviderUsage(...usages: Array<ProviderUsage | undefined>): ProviderUsage | undefined {
  const present = usages.filter((usage): usage is ProviderUsage => usage !== undefined);
  if (present.length === 0) return undefined;
  const promptTokens = present.reduce((sum, usage) => sum + usage.promptTokens, 0);
  const completionTokens = present.reduce((sum, usage) => sum + usage.completionTokens, 0);
  const totalTokens = present.reduce(
    (sum, usage) => sum + (usage.totalTokens || usage.promptTokens + usage.completionTokens),
    0,
  );
  const cacheRead = present.reduce((sum, usage) => sum + (usage.cacheReadTokens ?? 0), 0);
  const cacheWrite = present.reduce((sum, usage) => sum + (usage.cacheCreationTokens ?? 0), 0);
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    ...(present.some((usage) => usage.cacheReadTokens !== undefined) ? { cacheReadTokens: cacheRead } : {}),
    ...(present.some((usage) => usage.cacheCreationTokens !== undefined) ? { cacheCreationTokens: cacheWrite } : {}),
  };
}

async function sendStoryCompletionWithGuard({
  messages,
  config,
  responseLengthHint,
  playerInput,
}: {
  messages: ChatMessage[];
  config: RuntimeProviderSettings;
  responseLengthHint: number;
  playerInput: string;
}): Promise<{ content: string; usage?: ProviderUsage }> {
  const response = await sendOpenAICompatibleChatCompletion({ messages, config });
  const guard = evaluateStoryResponseGuard(response.content, responseLengthHint, playerInput);
  if (!guard.needsCorrection) return response;

  const correctionMessages = buildStoryResponseCorrectionMessages({
    playerInput,
    draft: response.content,
    wordLimit: guard.visibleWordLimit,
    reasons: guard.reasons,
  });
  const corrected = await sendOpenAICompatibleChatCompletion({
    messages: correctionMessages,
    config: correctionConfig(config, responseLengthHint),
  });
  return { content: corrected.content, usage: combineProviderUsage(response.usage, corrected.usage) };
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

const BACKEND_TURN_RECOVERY_DELAYS_MS = [0, 750, 1500, 3000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function isRecoveredBackendTurn(before: Adventure, recovered: Adventure | undefined, submittedText: string): recovered is Adventure {
  if (!recovered || recovered.id !== before.id) return false;
  const recoveredAdvanced = recovered.messages.length > before.messages.length || recovered.updatedAt > before.updatedAt;
  if (!recoveredAdvanced) return false;

  const newMessages = recovered.messages.slice(before.messages.length);
  const normalizedSubmitted = submittedText.trim().replace(/\s+/g, " ");
  const hasSubmittedUserMessage = normalizedSubmitted.length === 0 || newMessages.some((message) => {
    if (message.role !== "user") return false;
    return message.content.trim().replace(/\s+/g, " ") === normalizedSubmitted;
  });
  const hasAssistantResponse = newMessages.some((message) => message.role === "assistant");
  return hasSubmittedUserMessage && hasAssistantResponse;
}

function shouldRecoverBackendTurn(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("aborted") ||
    message.includes("aborterror") ||
    message.includes("load failed") ||
    message.includes("connection") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504")
  );
}

export async function saveDeviceAdventureBeforeBackendTurn(
  adventure: Adventure,
  adventureStore: AdventureStore,
  setSaveStatus: (status: string) => void,
  refreshAdventures: () => Promise<void>,
): Promise<Adventure> {
  setSaveStatus("saving");
  try {
    if (adventureStore.saveForGeneration) {
      const savedAdventure = await adventureStore.saveForGeneration(adventure);
      setSaveStatus("saved");
      await refreshAdventures();
      return savedAdventure;
    }
    await adventureStore.save(adventure);
    setSaveStatus("saved");
    await refreshAdventures();
    return adventure;
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : "save failed");
    throw error;
  }
}

function buildBackgroundConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  const base = mergeProviderConfig(adventure, settings);
  return resolveBackgroundProviderConfig(adventure, base) as RuntimeProviderSettings;
}

export function useAdventureRuntime(
  adventure: Adventure | undefined,
  setAdventure: Dispatch<SetStateAction<Adventure | undefined>>,
  providerSettings: RuntimeProviderSettings,
  adventureStore: AdventureStore,
  setSaveStatus: (status: string) => void,
  setContextResult: (result: ContextBuildResult | undefined) => void,
  openTab: (tabId: "memoryInbox") => void,
  refreshAdventures: () => Promise<void>,
  globalMemorySettings: MemoryDetectionSettings,
  backendTurnRunner?: TurnRunner,
  backendContextPreview?: ContextPreviewSource,
  backendAiTools?: BackendAiTools,
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
  const clearError = useCallback(() => setError(undefined), []);

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
      void adventureStore.save(next).then(() => {
        setSaveStatus("saved");
        void refreshAdventures();
      });
      return next;
    });
  }, [adventureStore, setAdventure, setSaveStatus, refreshAdventures]);

  async function applyBackendAdventureResult(next: Adventure) {
    adventureRef.current = next;
    setAdventure(next);
    setContextResult(undefined);
    setSaveStatus("saved");
    await refreshAdventures();
  }

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


  const buildPreview = useCallback(() => {
    if (!adventure) return;
    if (backendContextPreview) {
      void backendContextPreview.build(adventure.id)
        .then(setContextResult)
        .catch((error) => setError(error instanceof Error ? error.message : "Backend context preview failed."));
      return;
    }
    setContextResult(buildContext(adventure, { latestModelOutput: latestAssistantOutput(adventure) }));
  }, [adventure, backendContextPreview, setContextResult]);

  // When an arc reaches aftermath, draft next-arc directions once so the player can pick
  // where the story goes next without architecting it. Gated by arcContinuationOptions
  // being undefined so it runs a single time per resolution.
  async function checkArcContinuation(snapshot: Adventure) {
    const arc = snapshot.components.find(
      (c) =>
        c.type === "currentArc" &&
        c.arcState?.phase === "aftermath" &&
        c.arcContinuationOptions === undefined &&
        (c.arcThreadKeys?.length ?? 0) > 0,
    );
    if (!arc) return;
    try {
      const options = await generateArcContinuations(snapshot, activeProviderConfig, arc);
      if (arc.arcAutoContinue) {
        // Silent auto-continue: the Director picks the most convergent direction and seeds it
        // itself — no chooser, no spoiler. The new threat surfaces through play.
        const pick = pickConvergentContinuation(options, arc.arcState?.threadEngagement ?? {});
        if (pick) applyActionsAndPersist([{ type: "APPLY_ARC_CONTINUATION", componentId: arc.id, option: pick }]);
        else applyActionsAndPersist([{ type: "SET_ARC_CONTINUATIONS", componentId: arc.id, options: [] }]);
      } else {
        applyActionsAndPersist([{ type: "SET_ARC_CONTINUATIONS", componentId: arc.id, options }]);
      }
    } catch {
      // non-fatal — options stay ungenerated and we retry next turn
    }
  }

  async function recoverBackendTurnCompletion(before: Adventure, submittedText: string): Promise<boolean> {
    for (const delayMs of BACKEND_TURN_RECOVERY_DELAYS_MS) {
      if (delayMs > 0) await delay(delayMs);
      try {
        const recovered = await adventureStore.get(before.id);
        if (!isRecoveredBackendTurn(before, recovered, submittedText)) continue;
        setAdventure(recovered);
        setContextResult(undefined);
        setSaveStatus("saved");
        await refreshAdventures();
        return true;
      } catch {
        // If the backend is still unreachable, keep polling through the short recovery window.
      }
    }
    return false;
  }

  async function submitTurn(text: string, mode: InputMode = "story") {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    if (backendTurnRunner) {
      try {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendTurnRunner.runTurn({ adventureId: syncedAdventure.id, input: text, mode });
        setAdventure(result.adventure);
        setContextResult(result.postTurnContext ?? result.preProviderContext);
        setSaveStatus("saved");
        await refreshAdventures();
      } catch (backendError) {
        if (shouldRecoverBackendTurn(backendError) && await recoverBackendTurnCompletion(adventureRef.current ?? adventure, text)) return;
        setError(backendError instanceof Error ? backendError.message : "Backend turn failed.");
        throw backendError;
      } finally {
        setLoading(false);
        isSubmittingRef.current = false;
      }
      return;
    }

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
          const storyConfig = applyResponseLengthHint(
            mergeProviderConfig(snapshot, providerSettings),
            snapshot.activeState.responseLengthHint,
            hiddenOutputReserveTokens(context),
          );
          if (mode === "comms") {
            return sendOpenAICompatibleChatCompletion({ messages, config: storyConfig });
          }
          return sendStoryCompletionWithGuard({
            messages,
            config: storyConfig,
            responseLengthHint: snapshot.activeState.responseLengthHint,
            playerInput: text,
          });
        },
      });

      let next = mergeQueuedUpdates(result.adventure);
      setAdventure(next);
      setContextResult(result.postTurnContext);
      await adventureStore.save(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      if (mode !== "comms") {
        void startSemanticEvaluation(next);
          checkMemoryCycle(next);
        void checkArcContinuation(next);
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
      await adventureStore.save(errorState);
      throw providerError;
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

    if (backendTurnRunner) {
      try {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendTurnRunner.runTurn({
          adventureId: syncedAdventure.id,
          input: "[continue]",
          mode: "story",
          recordUserInput: false,
          providerCue: "[continue]",
        });
        setAdventure(result.adventure);
        setContextResult(result.postTurnContext ?? result.preProviderContext);
        setSaveStatus("saved");
        await refreshAdventures();
      } catch (backendError) {
        setError(backendError instanceof Error ? backendError.message : "Backend continue failed.");
      } finally {
        setLoading(false);
        isSubmittingRef.current = false;
      }
      return;
    }

    try {
      const base = flushPendingBeforeContext(adventure);
      const result = await runTurnPipeline({
        adventure: base,
        text: "[continue]",
        mode: "story",
        recordUserInput: false,
        providerCue: "[continue]",
        providerConfig: mergeProviderConfig(base, providerSettings),
        sendChatCompletion: async (messages, snapshot, context) => {
          setAdventure(snapshot);
          setContextResult(context);
          const continueConfig = applyResponseLengthHint(
            mergeProviderConfig(snapshot, providerSettings),
            snapshot.activeState.responseLengthHint,
            hiddenOutputReserveTokens(context),
          );
          return sendStoryCompletionWithGuard({
            messages,
            config: continueConfig,
            responseLengthHint: snapshot.activeState.responseLengthHint,
            playerInput: "[continue]",
          });
        },
      });
      let next = result.adventure;
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(result.postTurnContext);
      await adventureStore.save(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
      checkMemoryCycle(next);
      void checkArcContinuation(next);
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Continue failed.");
      setAdventure(adventure);
      await adventureStore.save(adventure);
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

    if (backendTurnRunner) {
      try {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendTurnRunner.runTurn({
          adventureId: syncedAdventure.id,
          input: "[regenerate]",
          mode: "story",
          recordUserInput: false,
          regenerateLastAssistant: true,
        });
        setAdventure(result.adventure);
        setContextResult(result.postTurnContext ?? result.preProviderContext);
        setSaveStatus("saved");
        await refreshAdventures();
      } catch (backendError) {
        setError(backendError instanceof Error ? backendError.message : "Backend regeneration failed.");
      } finally {
        setLoading(false);
        isSubmittingRef.current = false;
      }
      return;
    }

    let next = flushPendingBeforeContext(adventure);
    next = adventureReducer(next, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" });
    const lastUser = [...next.messages].reverse().find((m) => m.role === "user")?.content ?? "Continue.";
    const context = buildContext(next, { currentInput: lastUser, latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);

    try {
      const regenConfig = applyResponseLengthHint(
        mergeProviderConfig(next, providerSettings),
        next.activeState.responseLengthHint,
        hiddenOutputReserveTokens(context),
      );
      const response = await sendStoryCompletionWithGuard({
        messages: context.messages,
        config: regenConfig,
        responseLengthHint: next.activeState.responseLengthHint,
        playerInput: lastUser,
      });
      const applied = await applyProviderResponse({
        adventure: next,
        response,
        mode: "story",
        providerConfig: regenConfig,
        preProviderContext: context,
        incrementTurn: false,
        advanceArcPacing: false,
      });
      next = applied.adventure;
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: applied.responseContent }));
      await adventureStore.save(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
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
      const proposalCount = result.actions.filter((action) => action.type === "ADD_MEMORY_PROPOSAL").length;
      if (proposalCount === 0) {
        throw new Error(result.logEntry.errors[0] ?? "The AI did not produce a Story Card suggestion.");
      }
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
      if (backendAiTools) {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendAiTools.updateBrain(syncedAdventure.id, brainId);
        await applyBackendAdventureResult(result.adventure);
        return;
      }
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
      if (backendAiTools) {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendAiTools.suggestStoryCardUpdates(syncedAdventure.id);
        await applyBackendAdventureResult(result.adventure);
        openTab("memoryInbox");
        return;
      }
      const result = await runManualStoryCardsUpdate(adventure, activeProviderConfig);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story card update suggestions failed.");
    } finally {
      setLoading(false);
    }
  }

  async function buildStoryCardMemory(request: StoryCardAIBuilderRequest) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      if (backendAiTools) {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendAiTools.buildStoryCardMemory(syncedAdventure.id, request);
        await applyBackendAdventureResult(result.adventure);
        openTab("memoryInbox");
        return;
      }
      const result = await runStoryCardAIBuilder(adventure, activeProviderConfig, request);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story Card builder failed.");
    } finally {
      setLoading(false);
    }
  }

  async function buildPlotMemory(request: PlotAIBuilderRequest) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runPlotAIBuilder(adventure, activeProviderConfig, request);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plot builder failed.");
    } finally {
      setLoading(false);
    }
  }

  async function reconcileMemory(request: MemoryReconcileRequest): Promise<MemoryReconcileRunSummary | undefined> {
    if (!adventure || loading) return undefined;
    setLoading(true);
    setError(undefined);
    try {
      if (backendAiTools) {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendAiTools.reconcileMemory(syncedAdventure.id, request);
        const latestLog = result.adventure.activeState.evaluationLog[0];
        const issue = latestLog?.errors[0];
        const generatedCount = memoryReconcileGeneratedCount(result.adventure)
          ?? Math.max(0, result.adventure.activeState.memoryProposals.length - syncedAdventure.activeState.memoryProposals.length);
        const summary = summarizeMemoryReconcile(syncedAdventure, result.adventure, generatedCount, issue);
        await applyBackendAdventureResult(result.adventure);
        openTab("memoryInbox");
        if (summary.generatedCount <= 0 && summary.error) setError(summary.error);
        return summary;
      }
      const result = await runMemoryReconcile(adventure, activeProviderConfig, request);
      const proposalCount = result.actions.filter((action) => action.type === "ADD_MEMORY_PROPOSAL").length;
      const next = reduceActions(adventure, result.actions);
      const summary = summarizeMemoryReconcile(adventure, next, proposalCount, result.logEntry.errors[0]);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
      if (proposalCount === 0 && result.logEntry.errors.length > 0) {
        setError(result.logEntry.errors[0]);
      }
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Memory reconcile failed.";
      setError(message);
      return { generatedCount: 0, pendingDelta: 0, recordedDelta: 0, error: message };
    } finally {
      setLoading(false);
    }
  }

  async function auditStoryCards(nTurns: number, includeAI = false): Promise<AuditRecommendation[]> {
    if (!adventure) return [];
    if (backendAiTools) {
      const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
      setAdventure(syncedAdventure);
      return backendAiTools.auditStoryCards(syncedAdventure.id, nTurns, includeAI);
    }
    return runStoryCardAudit(adventure, activeProviderConfig, nTurns, { includeAI });
  }

  async function auditComponents(nTurns: number, includeAI = false): Promise<ComponentAuditRecommendation[]> {
    if (!adventure) return [];
    return runComponentAudit(adventure, activeProviderConfig, nTurns, { includeAI });
  }

  async function auditBrains(nTurns: number, includeAI = false): Promise<BrainAuditRecommendation[]> {
    if (!adventure) return [];
    if (backendAiTools) {
      const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
      setAdventure(syncedAdventure);
      return backendAiTools.auditBrains(syncedAdventure.id, nTurns, includeAI);
    }
    return runBrainAudit(adventure, activeProviderConfig, nTurns, { includeAI });
  }

  async function regenerateMemoryProposal(proposalId: string): Promise<void> {
    if (!adventure) return;
    const proposal = adventure.activeState.memoryProposals.find((p) => p.id === proposalId);
    if (!proposal) return;
    const newContent = await regenerateProposalContent(proposal, adventure, activeProviderConfig);
    if (!newContent) return;
    const appendContent = proposal.appendContent ?? (proposal.proposedType === "plotEssentialsUpdate" ? false : undefined);
    applyActionsAndPersist([{ type: "UPDATE_MEMORY_PROPOSAL", proposalId, patch: { content: newContent, appendContent } }]);
  }

  async function regeneratePlotEssentials(componentId: string): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const component = adventure.components.find((c) => c.id === componentId && c.type === "plotEssentials");
    if (!component) throw new Error("Plot Essentials component not found.");
    const recentTurns = adventure.messages.slice(-20).map((m) => `${m.role}: ${m.content}`).join("\n");
    const systemPrompt = `You are maintaining plot essentials for an interactive fiction game.
${PLOT_ESSENTIALS_BEST_PRACTICES}

Current plot essentials:
${component.content}

Recent story turns:
${recentTurns}

Rewrite the plot essentials as a clean, current, non-redundant replacement block.
Remove resolved events and outdated constraints. Keep active pressures, open tensions, obligations, and major constraints.
Write 4-7 tight bullets or short labeled lines. Do not append a small update note.
Respond with ONLY the new content — no preamble, no labels, no explanation.`;
    const response = await sendOpenAICompatibleChatCompletion({
      config: activeProviderConfig,
      messages: [{ role: "user", content: systemPrompt }],
    });
    return response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  /** Generate fresh content for a Narration Rules / AI Instructions / Author's Note component. Returns a string for review. */
  async function generateComponent(componentId: string): Promise<string> {
    if (!adventure) throw new Error("No adventure loaded.");
    const component = adventure.components.find((c) => c.id === componentId);
    if (!component) throw new Error("Component not found.");
    return generateComponentContent(adventure, activeProviderConfig, component);
  }

  async function generateComponents(request: ComponentAIBuilderRequest): Promise<GeneratedComponentDraft[]> {
    if (!adventure) throw new Error("No adventure loaded.");
    return generateComponentDrafts(adventure, activeProviderConfig, request);
  }

  /** Generate an Arc Director setup from a concept and apply it to the Current Arc component. */
  async function generateArc(componentId: string, concept: string): Promise<void> {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const arc = await generateArcDirector(adventure, activeProviderConfig, concept);
      applyActionsAndPersist([{ type: "UPDATE_COMPONENT", componentId, patch: arc }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arc generation failed.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Read recent play and draft an arc, dropping it into the Memory Inbox for approval (does not
   * apply it). For a story that's gone stale in aftermath and wants a new direction.
   */
  async function proposeArcFromHistory(componentId: string): Promise<void> {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const arc = await generateArcFromHistory(adventure, activeProviderConfig);
      const timestamp = nowIso();
      applyActionsAndPersist([
        {
          type: "ADD_MEMORY_PROPOSAL",
          proposal: {
            id: createId("proposal"),
            sourceTurnId: adventure.messages.at(-1)?.id ?? "manual",
            sourceText: "Arc suggested from recent play.",
            proposedType: "arcProposal",
            title: arc.label,
            content: JSON.stringify(
              {
                arcPremise: arc.arcPremise,
                arcSimmerInstruction: arc.arcSimmerInstruction,
                arcBreakInstruction: arc.arcBreakInstruction,
                arcPace: arc.arcPace,
                arcTriggerMode: arc.arcTriggerMode,
                arcThreadKeys: arc.arcThreadKeys,
              },
              null,
              2,
            ),
            suggestedTriggers: [],
            confidence: 0.7,
            rationale: arc.rationale,
            status: "pending",
            targetId: componentId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arc suggestion failed.");
    } finally {
      setLoading(false);
    }
  }

  /** Generate a character Brain from just a name and add it to the adventure. */
  async function generateBrainFromName(name: string): Promise<void> {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      if (backendAiTools) {
        const syncedAdventure = await saveDeviceAdventureBeforeBackendTurn(adventure, adventureStore, setSaveStatus, refreshAdventures);
        setAdventure(syncedAdventure);
        const result = await backendAiTools.generateBrain(syncedAdventure.id, name);
        await applyBackendAdventureResult(result.adventure);
        return;
      }
      const brain = await generateBrainEntry(adventure, activeProviderConfig, name);
      applyActionsAndPersist([{ type: "UPSERT_BRAIN", brain }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character generation failed.");
    } finally {
      setLoading(false);
    }
  }

  continueTurnRef.current = continueTurn;

  return {
    loading,
    error,
    clearError,
    activeProviderConfig,
    buildPreview,
    submitTurn,
    continueTurn,
    regenerateLastResponse,
    rememberThis,
    updateBrainNow,
    updatePEComponentNow,
    suggestPlotUpdates,
    suggestCardUpdates,
    buildStoryCardMemory,
    buildPlotMemory,
    reconcileMemory,
    auditStoryCards,
    auditComponents,
    auditBrains,
    regenerateMemoryProposal,
    regeneratePlotEssentials,
    generateComponent,
    generateComponents,
    generateArc,
    proposeArcFromHistory,
    generateBrainFromName,
    applyActionsAndPersist,
  };
}
