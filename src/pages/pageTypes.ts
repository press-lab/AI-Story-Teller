import type { Adventure, AdventureAction, ContextBuildResult, InputMode, ProviderConfig } from "../types/adventure";

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
}
