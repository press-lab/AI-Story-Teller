import type { Adventure, AdventureAction, ContextBuildResult, InputMode, ProviderConfig } from "../types/adventure";

export interface UiPreferences {
  darkMode: boolean;
  density: "compact" | "comfortable";
  storyFontSize: number;
  maxContentWidth: number;
  showTokenEstimates: boolean;
  showAdvancedSettings: boolean;
}

export const defaultUiPreferences: UiPreferences = {
  darkMode: false,
  density: "comfortable",
  storyFontSize: 15,
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

export interface PlayRuntimeProps extends AdventurePageProps {
  contextResult?: ContextBuildResult;
  loading: boolean;
  error?: string;
  saveStatus: string;
  onSubmitTurn: (text: string, mode: InputMode) => Promise<void>;
  onContinue: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onBuildContext: () => void;
  onOpenContext: () => void;
  onRememberThis: (fact: string) => Promise<void>;
  onOpenTab?: (tabId: string) => void;
  /** Opens a tool in the play-page right panel (instead of navigating away). */
  onOpenPlayTool?: (tabId: string) => void;
}
