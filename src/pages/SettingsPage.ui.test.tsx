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
import type { RuntimeProviderSettings } from "./pageTypes";

function providerSettings(): RuntimeProviderSettings {
  return {
    ...defaultModelConfig,
    apiKey: "test-key",
  };
}

describe("SettingsPage API throttle controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets the user configure provider request throttling", async () => {
    const user = userEvent.setup();
    const onProviderSettingsChange = vi.fn();
    const dispatch = vi.fn<(action: AdventureAction) => void>();

    function StatefulSettingsPage() {
      const [settings, setSettings] = useState(providerSettings());
      return (
        <SettingsPage
          adventure={createDefaultAdventure("Throttle Test")}
          dispatch={dispatch}
          providerSettings={settings}
          onProviderSettingsChange={(next) => {
            setSettings(next);
            onProviderSettingsChange(next);
          }}
          darkMode={false}
          onDarkModeChange={vi.fn()}
        />
      );
    }

    render(<StatefulSettingsPage />);

    await user.click(screen.getByLabelText("Enable API request throttle"));

    expect(onProviderSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestThrottle: expect.objectContaining({ enabled: true }),
      }),
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

    expect(onProviderSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestThrottle: expect.objectContaining({ minSecondsBetweenRequests: 7 }),
      }),
    );
  });
});
