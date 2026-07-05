/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure, defaultModelConfig } from "../state/defaults";
import type { AdventureAction } from "../types/adventure";
import { SettingsPage } from "./SettingsPage";
import type { ProviderPreset, UiPreferences } from "./pageTypes";
import { defaultGlobalAdventureSettings, defaultUiPreferences } from "./pageTypes";

function makePreset(): ProviderPreset {
  return {
    ...defaultModelConfig,
    apiKey: "test-key",
    id: "preset-test",
    label: "Test Model",
    promptCaching: false,
  };
}

describe("SettingsPage API throttle controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets the user enable prompt caching on the active provider preset", async () => {
    const user = userEvent.setup();
    const onProviderPresetsChange = vi.fn();
    const dispatch = vi.fn<(action: AdventureAction) => void>();
    const advancedPrefs: UiPreferences = { ...defaultUiPreferences, showAdvancedSettings: true };

    function StatefulSettingsPage() {
      const [presets, setPresets] = useState([makePreset()]);
      return (
        <SettingsPage
          adventure={createDefaultAdventure("Prompt Cache Test")}
          dispatch={dispatch}
          providerPresets={presets}
          activePresetId="preset-test"
          onProviderPresetsChange={(next) => {
            setPresets(next);
            onProviderPresetsChange(next);
          }}
          onSelectPreset={vi.fn()}
          uiPreferences={advancedPrefs}
          onUiPreferencesChange={vi.fn()}
          globalAdventureSettings={defaultGlobalAdventureSettings}
          onGlobalAdventureSettingsChange={vi.fn()}
        />
      );
    }

    render(<StatefulSettingsPage />);

    await user.click(screen.getByRole("button", { name: /Test Model/ }));
    await user.click(screen.getByLabelText("Enable prompt caching / sticky sessions"));

    expect(onProviderPresetsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preset-test",
          promptCaching: true,
        }),
      ]),
    );
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "SET_MODEL_CONFIG",
        config: expect.objectContaining({ promptCaching: true }),
      }),
    );
  });

  it("lets the user choose an OpenRouter routing preference", async () => {
    const user = userEvent.setup();
    const onProviderPresetsChange = vi.fn();
    const dispatch = vi.fn<(action: AdventureAction) => void>();
    const advancedPrefs: UiPreferences = { ...defaultUiPreferences, showAdvancedSettings: true };

    function StatefulSettingsPage() {
      const [presets, setPresets] = useState([makePreset()]);
      return (
        <SettingsPage
          adventure={createDefaultAdventure("Routing Test")}
          dispatch={dispatch}
          providerPresets={presets}
          activePresetId="preset-test"
          onProviderPresetsChange={(next) => {
            setPresets(next);
            onProviderPresetsChange(next);
          }}
          onSelectPreset={vi.fn()}
          uiPreferences={advancedPrefs}
          onUiPreferencesChange={vi.fn()}
          globalAdventureSettings={defaultGlobalAdventureSettings}
          onGlobalAdventureSettingsChange={vi.fn()}
        />
      );
    }

    render(<StatefulSettingsPage />);

    await user.click(screen.getByRole("button", { name: /Test Model/ }));
    await user.selectOptions(screen.getByLabelText("OpenRouter routing preference"), "price");

    expect(onProviderPresetsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preset-test",
          openRouterProviderSort: "price",
        }),
      ]),
    );
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "SET_MODEL_CONFIG",
        config: expect.objectContaining({ openRouterProviderSort: "price" }),
      }),
    );
  });

  it("lets the user configure provider request throttling", async () => {
    const user = userEvent.setup();
    const onProviderPresetsChange = vi.fn();
    const dispatch = vi.fn<(action: AdventureAction) => void>();
    const advancedPrefs: UiPreferences = { ...defaultUiPreferences, showAdvancedSettings: true };

    function StatefulSettingsPage() {
      const [presets, setPresets] = useState([makePreset()]);
      return (
        <SettingsPage
          adventure={createDefaultAdventure("Throttle Test")}
          dispatch={dispatch}
          providerPresets={presets}
          activePresetId="preset-test"
          onProviderPresetsChange={(next) => {
            setPresets(next);
            onProviderPresetsChange(next);
          }}
          onSelectPreset={vi.fn()}
          uiPreferences={advancedPrefs}
          onUiPreferencesChange={vi.fn()}
          globalAdventureSettings={defaultGlobalAdventureSettings}
          onGlobalAdventureSettingsChange={vi.fn()}
        />
      );
    }

    render(<StatefulSettingsPage />);

    await user.click(screen.getByRole("button", { name: /Test Model/ }));
    await user.click(screen.getByLabelText("Enable API request throttle"));

    expect(onProviderPresetsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preset-test",
          requestThrottle: expect.objectContaining({ enabled: true }),
        }),
      ]),
    );
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "SET_MODEL_CONFIG",
        config: expect.objectContaining({
          requestThrottle: expect.objectContaining({ enabled: true }),
        }),
      }),
    );

    await user.clear(screen.getByLabelText("Minimum seconds between API calls"));
    await user.type(screen.getByLabelText("Minimum seconds between API calls"), "7");

    expect(onProviderPresetsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preset-test",
          requestThrottle: expect.objectContaining({ minSecondsBetweenRequests: 7 }),
        }),
      ]),
    );
  });

  it("hides model and background controls for normal backend accounts", () => {
    render(
      <SettingsPage
        adventure={createDefaultAdventure("Backend User Settings")}
        dispatch={vi.fn()}
        providerPresets={[makePreset()]}
        activePresetId="preset-test"
        onProviderPresetsChange={vi.fn()}
        onSelectPreset={vi.fn()}
        uiPreferences={{ ...defaultUiPreferences, showAdvancedSettings: true }}
        onUiPreferencesChange={vi.fn()}
        globalAdventureSettings={defaultGlobalAdventureSettings}
        onGlobalAdventureSettingsChange={vi.fn()}
        runtimeConfig={{ mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" }}
        hideDeveloperControls
        backendSession={{
          sessionToken: "session-test",
          user: {
            id: "user-test",
            email: "player@example.com",
            displayName: "Player",
            status: "active",
            emailVerified: true,
            createdAt: "2026-07-04T00:00:00.000Z",
            updatedAt: "2026-07-04T00:00:00.000Z",
          },
          profile: {
            userId: "user-test",
            displayName: "Player",
            bio: "",
            createdAt: "2026-07-04T00:00:00.000Z",
            updatedAt: "2026-07-04T00:00:00.000Z",
          },
        }}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Background Cost" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "LLM Evaluation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Memory Detection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runtime" })).not.toBeInTheDocument();
    expect(screen.queryByText("Personal Cloud Sync")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show advanced settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Safety audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Local Google Stub" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Backend API URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Execution mode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Import source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Backend import JSON")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Verification token")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("Model Source")).toBeInTheDocument();
  });

  it("lets backend users opt into a personal model without showing the full model panel", async () => {
    const user = userEvent.setup();
    const onProviderPresetsChange = vi.fn();
    const onBackendModelModeChange = vi.fn();

    function StatefulSettingsPage() {
      const [presets, setPresets] = useState([makePreset()]);
      const [mode, setMode] = useState<"platform" | "personal">("platform");
      return (
        <SettingsPage
          adventure={createDefaultAdventure("Backend User Settings")}
          dispatch={vi.fn()}
          providerPresets={presets}
          activePresetId="preset-test"
          onProviderPresetsChange={(next) => {
            setPresets(next);
            onProviderPresetsChange(next);
          }}
          onSelectPreset={vi.fn()}
          uiPreferences={{ ...defaultUiPreferences, showAdvancedSettings: true }}
          onUiPreferencesChange={vi.fn()}
          globalAdventureSettings={defaultGlobalAdventureSettings}
          onGlobalAdventureSettingsChange={vi.fn()}
          runtimeConfig={{ mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" }}
          hideDeveloperControls
          backendModelMode={mode}
          onBackendModelModeChange={(next) => {
            setMode(next);
            onBackendModelModeChange(next);
          }}
          backendSession={{
            sessionToken: "session-test",
            user: {
              id: "user-test",
              email: "player@example.com",
              displayName: "Player",
              status: "active",
              emailVerified: true,
              createdAt: "2026-07-04T00:00:00.000Z",
              updatedAt: "2026-07-04T00:00:00.000Z",
            },
            profile: {
              userId: "user-test",
              displayName: "Player",
              bio: "",
              createdAt: "2026-07-04T00:00:00.000Z",
              updatedAt: "2026-07-04T00:00:00.000Z",
            },
          }}
        />
      );
    }

    render(<StatefulSettingsPage />);

    await user.click(screen.getByText("Model Source"));
    await user.selectOptions(screen.getByLabelText("Generation model source"), "personal");
    expect(onBackendModelModeChange).toHaveBeenCalledWith("personal");
    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Provider"), "https://openrouter.ai/api/v1");
    expect(onProviderPresetsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "preset-test",
          name: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
        }),
      ]),
    );
  });

  it("keeps platform settings out of Settings for backend admin accounts", () => {
    render(
      <SettingsPage
        adventure={createDefaultAdventure("Admin Settings")}
        dispatch={vi.fn()}
        providerPresets={[makePreset()]}
        activePresetId="preset-test"
        onProviderPresetsChange={vi.fn()}
        onSelectPreset={vi.fn()}
        uiPreferences={{ ...defaultUiPreferences, showAdvancedSettings: true }}
        onUiPreferencesChange={vi.fn()}
        globalAdventureSettings={defaultGlobalAdventureSettings}
        onGlobalAdventureSettingsChange={vi.fn()}
        runtimeConfig={{ mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" }}
        backendSession={{
          sessionToken: "session-admin",
          user: {
            id: "user-admin",
            email: "admin@example.com",
            displayName: "Admin",
            role: "admin",
            status: "active",
            emailVerified: true,
            createdAt: "2026-07-04T00:00:00.000Z",
            updatedAt: "2026-07-04T00:00:00.000Z",
          },
          profile: {
            userId: "user-admin",
            displayName: "Admin",
            bio: "",
            createdAt: "2026-07-04T00:00:00.000Z",
            updatedAt: "2026-07-04T00:00:00.000Z",
          },
        }}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Background Cost" })).not.toBeInTheDocument();
    expect(screen.queryByText("Personal Cloud Sync")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Backend API URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Execution mode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Import source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Backend import JSON")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("Model Source")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Platform Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Safety audit" })).not.toBeInTheDocument();
  });
});
