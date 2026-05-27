/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CloudSyncSettings, NewAdventureSetup } from "../types/adventure";
import { AdventuresPage } from "./AdventuresPage";

const cloudSyncSettings: CloudSyncSettings = {
  token: "",
  owner: "",
  repo: "ai-story-teller-sync",
  branch: "main",
  path: "sync/adventures.json",
  createPrivateRepoIfMissing: false,
};

function renderAdventuresPage(
  onCreate = vi.fn(async (_setup: NewAdventureSetup) => undefined),
  syncProps: Partial<ComponentProps<typeof AdventuresPage>> = {},
) {
  render(
    <AdventuresPage
      adventures={[]}
      onCreate={onCreate}
      onOpen={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      {...syncProps}
    />,
  );
  return { onCreate };
}

describe("AdventuresPage new adventure setup", () => {
  afterEach(() => {
    cleanup();
  });

  it("creates a new adventure with starter components and manual Story Cards", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderAdventuresPage();

    await user.clear(screen.getByLabelText("Adventure title"));
    await user.type(screen.getByLabelText("Adventure title"), "Setup Test");
    await user.type(screen.getByLabelText("Opening scene"), "Rain cuts across the bridge.");

    await user.click(screen.getByRole("button", { name: "Add Plot Essentials" }));
    await user.type(screen.getAllByLabelText("Content")[0], "The city is under siege.");

    await user.click(screen.getByRole("button", { name: "Add Manual Card" }));
    await user.clear(screen.getAllByLabelText("Title")[1]);
    await user.type(screen.getAllByLabelText("Title")[1], "Margo");
    await user.type(screen.getByLabelText("Triggers / keys"), "Margo, hedge prince");
    await user.type(screen.getAllByLabelText("Content")[1], "Margo calls Seth hedge prince as a private joke.");

    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const setup = onCreate.mock.calls[0][0];
    expect(setup.title).toBe("Setup Test");
    expect(setup.openingScene).toBe("Rain cuts across the bridge.");
    expect(setup.components).toHaveLength(1);
    expect(setup.components[0]).toMatchObject({
      title: "Plot Essentials",
      type: "plotEssentials",
      content: "The city is under siege.",
      alwaysOn: true,
      protected: true,
    });
    expect(setup.storyCards).toHaveLength(1);
    expect(setup.storyCards[0]).toMatchObject({
      title: "Margo",
      keys: ["Margo", "hedge prince"],
      content: "Margo calls Seth hedge prince as a private joke.",
    });
  });

  it("imports Story Cards from an uploaded JSON file before creating the adventure", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderAdventuresPage();
    const file = new File(
      [
        JSON.stringify([
          {
            title: "Ward Threshold",
            keys: "ward, threshold",
            entry: "Magic cannot cross the warded threshold.",
            type: "lore",
          },
        ]),
      ],
      "story-cards.json",
      { type: "application/json" },
    );

    await user.upload(screen.getByLabelText("Upload .json file"), file);

    await waitFor(() => expect(screen.getByText("1 JSON Story Card(s) ready")).toBeInTheDocument());
    expect(screen.getByText("Ward Threshold")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].storyCards).toHaveLength(1);
    expect(onCreate.mock.calls[0][0].storyCards[0]).toMatchObject({
      title: "Ward Threshold",
      keys: ["ward", "threshold"],
      content: "Magic cannot cross the warded threshold.",
      type: "lore",
    });
  });

  it("lets the user configure and trigger GitHub cloud sync from the Library", async () => {
    const user = userEvent.setup();
    const onCloudSyncSettingsChange = vi.fn();
    const onPullCloudSync = vi.fn(async () => undefined);
    const onPushCloudSync = vi.fn(async () => undefined);

    function StatefulLibrary() {
      const [settings, setSettings] = useState(cloudSyncSettings);
      return (
        <AdventuresPage
          adventures={[]}
          onCreate={vi.fn(async () => undefined)}
          onOpen={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          cloudSyncSettings={settings}
          cloudSyncStatus="Ready"
          onCloudSyncSettingsChange={(next) => {
            setSettings(next);
            onCloudSyncSettingsChange(next);
          }}
          onPullCloudSync={onPullCloudSync}
          onPushCloudSync={onPushCloudSync}
        />
      );
    }

    render(<StatefulLibrary />);

    await user.type(screen.getByLabelText("GitHub token"), "ghp_test");
    expect(onCloudSyncSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ token: "ghp_test" }));

    await user.click(screen.getByRole("button", { name: "Pull From GitHub" }));
    await user.click(screen.getByRole("button", { name: "Push To GitHub" }));

    expect(onPullCloudSync).toHaveBeenCalledTimes(1);
    expect(onPushCloudSync).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/keeps the newest/i)).toBeInTheDocument();
  });

  it("loads the development adventure from the Library dev panel", async () => {
    const user = userEvent.setup();
    const onLoadDevelopmentAdventure = vi.fn(async () => undefined);
    renderAdventuresPage(undefined, { onLoadDevelopmentAdventure });

    await user.click(screen.getByText("Developer Test Adventure"));
    expect(screen.getByText("Dev Scenario: Fire Nation Special Missions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Adventure JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Story Cards JSON" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load Development Adventure" }));

    expect(onLoadDevelopmentAdventure).toHaveBeenCalledTimes(1);
  });
});
