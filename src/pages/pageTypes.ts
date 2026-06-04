import type { ReactNode } from "react";
import type { Adventure, AdventureAction, ContextBuildResult, InputMode, MemoryAutoApproveSettings, MemoryDetectionSettings, ProviderConfig, SemanticEvaluationSettings, TokenBudgetSettings } from "../types/adventure";
import { defaultMemoryDetectionSettings, defaultSemanticEvaluationSettings, defaultTokenBudgetSettings } from "../state/defaults";

export interface UiPreferences {
  darkMode: boolean;
  density: "compact" | "comfortable";
  storyFontSize: number;
  maxContentWidth: number;
  showTokenEstimates: boolean;
  showAdvancedSettings: boolean;
}

export interface GlobalAdventureSettings {
  tokenBudgetSettings: TokenBudgetSettings;
  semanticEvaluationSettings: SemanticEvaluationSettings;
  memoryDetectionSettings: MemoryDetectionSettings;
  memoryAutoApprove: MemoryAutoApproveSettings;
}

export const defaultGlobalAdventureSettings: GlobalAdventureSettings = {
  tokenBudgetSettings: defaultTokenBudgetSettings,
  semanticEvaluationSettings: defaultSemanticEvaluationSettings,
  memoryDetectionSettings: defaultMemoryDetectionSettings,
  memoryAutoApprove: { summaryUpdate: false, plotEssentialsUpdate: false, currentArcUpdate: true, plotPressureUpdate: true, plotMomentumUpdate: true, storyCard: false, brainUpdate: false },
};

export const defaultUiPreferences: UiPreferences = {
  darkMode: false,
  density: "comfortable",
  storyFontSize: 20,
  maxContentWidth: 1100,
  showTokenEstimates: true,
  showAdvancedSettings: false,
};

export interface AdventurePageProps {
  adventure: Adventure;
  dispatch: (action: AdventureAction) => void;
}

export interface RuntimeProviderSettings extends ProviderConfig {
  apiKey: string;
}

export interface ProviderPreset extends RuntimeProviderSettings {
  id: string;
  label: string;
}

export interface PlayRuntimeProps extends AdventurePageProps {
  contextResult?: ContextBuildResult;
  loading: boolean;
  error?: string;
  onDismissError?: () => void;
  saveStatus: string;
  onSubmitTurn: (text: string, mode: InputMode) => Promise<void>;
  onContinue: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onBuildContext: () => void;
  onOpenContext: () => void;
  onRememberThis: (fact: string) => Promise<void>;
  onPullLatest?: () => Promise<void>;
  onOpenTab?: (tabId: string) => void;
  /** Opens a tool in the play-page right panel (instead of navigating away). */
  onOpenPlayTool?: (tabId: string) => void;
  /** Content to render in the sidebar panel (below the nav buttons). */
  playPanelContent?: ReactNode;
  playPanelTitle?: string;
  onClosePlayPanel?: () => void;
  providerPresets?: ProviderPreset[];
  activePresetId?: string;
  onSelectPreset?: (id: string) => void;
}
