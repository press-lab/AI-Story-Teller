/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAdventureGen } from "../ai/adventureGen";
import { createDefaultAdventure } from "../state/defaults";
import type { NewAdventureSetup } from "../types/adventure";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { exportAdventureJson } from "../utils/json";
import { AdventuresPage } from "./AdventuresPage";

vi.mock("../ai/adventureGen", async () => {
  const actual = await vi.importActual<typeof import("../ai/adventureGen")>("../ai/adventureGen");
  return {
    ...actual,
    runAdventureGen: vi.fn(),
  };
});

function renderAdventuresPage(
  onCreate = vi.fn(async (_setup: NewAdventureSetup, _options?: { deviceOnly?: boolean }) => undefined),
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
    vi.mocked(runAdventureGen).mockReset();
  });

  it("creates a new adventure with starter components and manual Story Cards", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderAdventuresPage();

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.clear(screen.getByLabelText("Adventure title"));
    await user.type(screen.getByLabelText("Adventure title"), "Setup Test");
    await user.type(screen.getByPlaceholderText(/The scene opens/), "Rain cuts across the bridge.");

    await user.click(screen.getByRole("button", { name: "Add Plot Essentials" }));
    const componentContentFields = screen.getAllByLabelText("Content");
    await user.type(componentContentFields[componentContentFields.length - 1], "The city is under siege.");

    await user.click(screen.getByRole("button", { name: "Add Manual Card" }));
    const titleFields = screen.getAllByLabelText("Title");
    await user.clear(titleFields[titleFields.length - 1]);
    await user.type(titleFields[titleFields.length - 1], "Margo");
    await user.type(screen.getByLabelText("Triggers / keys"), "Margo, hedge prince");
    const allContentFields = screen.getAllByLabelText("Content");
    await user.type(allContentFields[allContentFields.length - 1], "Margo calls Avery hedge prince as a private joke.");

    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const setup = onCreate.mock.calls[0][0];
    expect(setup.title).toBe("Setup Test");
    expect(setup.openingScene).toBe("Rain cuts across the bridge.");
    expect(setup.thumbnailImage).toBeUndefined();
    expect(setup.components).toHaveLength(2);
    expect(setup.components.find((component) => component.type === "plotEssentials")).toMatchObject({
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
      content: "Margo calls Avery hedge prince as a private joke.",
    });
  });

  it("passes admin device-only choice during new adventure creation", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderAdventuresPage(undefined, {
      allowDeviceOnlyScenarioCreation: true,
    });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByLabelText("Keep this adventure on this device only"));
    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][1]).toEqual({ deviceOnly: true });
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

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
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

  it("shows loading and opening states for backend-sized adventure loads", () => {
    const adventure = createDefaultAdventure("Slow Backend Save");
    adventure.id = "adv-slow";
    const summary = {
      id: adventure.id,
      title: adventure.title,
      createdAt: adventure.createdAt,
      updatedAt: adventure.updatedAt,
      turnCount: 12,
      storyEntryCount: 24,
    };

    const { rerender } = render(
      <AdventuresPage
        adventures={[]}
        loading
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading adventures...")).toBeInTheDocument();

    rerender(
      <AdventuresPage
        adventures={[summary]}
        openingAdventureId="adv-slow"
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
    expect(screen.queryByText("No adventures saved yet.")).not.toBeInTheDocument();
  });

  it("passes admin device-only scenario creation choice to publish", async () => {
    const user = userEvent.setup();
    const adventure = createDefaultAdventure("Local Template Candidate");
    adventure.id = "adv-local-source";
    const summary = {
      id: adventure.id,
      title: adventure.title,
      createdAt: adventure.createdAt,
      updatedAt: adventure.updatedAt,
      turnCount: 0,
      storyEntryCount: 0,
    };
    const onPublish = vi.fn(async () => undefined);

    renderAdventuresPage(undefined, {
      adventures: [summary],
      onPublish,
      allowDeviceOnlyScenarioCreation: true,
    });

    await user.click(screen.getByLabelText("Keep this adventure on this device only"));
    await user.click(screen.getByRole("button", { name: "Publish Scenario" }));

    expect(onPublish).toHaveBeenCalledWith("adv-local-source", { deviceOnly: true });
  });

  it("imports a full AIST backup from the New Adventure menu", async () => {
    const user = userEvent.setup();
    const onImportAdventure = vi.fn(async (_text: string) => undefined);
    const backup = createDefaultAdventure("Long Running Story");
    backup.messages = [
      { id: "msg-1", role: "user", content: "I open the old save.", createdAt: "2026-07-04T00:00:00.000Z" },
      { id: "msg-2", role: "assistant", content: "The old save keeps going.", createdAt: "2026-07-04T00:01:00.000Z" },
    ];
    backup.activeState.turn = 44;
    const text = exportAdventureJson(backup);
    const file = new File([text], "long-running-story.json", { type: "application/json" });

    renderAdventuresPage(undefined, { onImportAdventure });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByRole("button", { name: "Import from AIST" }));
    await user.upload(screen.getByLabelText("Upload AIST .json backup"), file);

    await waitFor(() => expect(screen.getByText("Long Running Story")).toBeInTheDocument());
    expect(within(screen.getByText("Turn").closest("div")!).getByText("44")).toBeInTheDocument();
    expect(within(screen.getByText("Messages").closest("div")!).getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import and Continue" }));

    expect(onImportAdventure).toHaveBeenCalledWith(text);
  });

  it("keeps the AIST import screen open when import fails", async () => {
    const user = userEvent.setup();
    const onImportAdventure = vi.fn(async (_text: string) => {
      throw new Error("database rejected unicode");
    });
    const backup = createDefaultAdventure("Unicode Heavy Story");
    const text = exportAdventureJson(backup);
    const file = new File([text], "unicode-heavy-story.json", { type: "application/json" });

    renderAdventuresPage(undefined, { onImportAdventure });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByRole("button", { name: "Import from AIST" }));
    await user.upload(screen.getByLabelText("Upload AIST .json backup"), file);
    await user.click(screen.getByRole("button", { name: "Import and Continue" }));

    expect(await screen.findByText("database rejected unicode")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Import from AIST" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose an adventure" })).not.toBeInTheDocument();
  });

  it("prevents creation when an unpinned Story Card has no triggers", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderAdventuresPage();

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByRole("button", { name: "Add Manual Card" }));
    await user.type(screen.getAllByLabelText("Content").at(-1)!, "A fact that needs to be reachable.");
    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/Add at least one trigger/)).toBeInTheDocument();

    await user.click(screen.getAllByLabelText("Pinned").at(-1)!);
    await user.click(screen.getByRole("button", { name: "Create Adventure" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("replaces prior generated drafts, preserves manual cards, and protects generated Plot Essentials", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async (_setup: NewAdventureSetup) => undefined);
    renderAdventuresPage(onCreate, {
      providerConfig: {
        name: "deepseek",
        baseUrl: "https://api.deepseek.com",
        apiKey: "test-key",
        model: "deepseek-v4-flash",
        temperature: 1,
        maxOutputTokens: 1200,
      },
    });
    vi.mocked(runAdventureGen)
      .mockResolvedValueOnce({
        title: "First Draft",
        openingScene: "The first opening.",
        components: [
          { title: "Plot", type: "plotEssentials", content: "Old canon.", alwaysOn: false, pinned: false, priority: 80 },
          { title: "World", type: "custom", content: "Old world context.", alwaysOn: true, pinned: false, priority: 0 },
        ],
        storyCards: [
          { title: "Old Ally", type: "character", keys: ["old ally"], content: "Old card.", pinned: false, priority: 0 },
        ],
      })
      .mockResolvedValueOnce({
        title: "Second Draft",
        openingScene: "The second opening.",
        components: [
          { title: "Plot", type: "plotEssentials", content: "New canon.", alwaysOn: false, pinned: false, priority: 80 },
          { title: "Pressure", type: "activePressure", content: "The gate is failing.", alwaysOn: true, pinned: false, priority: 245 },
          { title: "World", type: "custom", content: "New world context.", alwaysOn: true, pinned: false, priority: 0 },
        ],
        storyCards: [
          { title: "New Ally", type: "character", keys: ["new ally"], content: "New card.", pinned: false, priority: 0 },
          { title: "New Ally", type: "character", keys: ["duplicate"], content: "Duplicate card.", pinned: false, priority: 0 },
        ],
      });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByRole("button", { name: "Add Manual Card" }));
    const manualTitle = screen.getAllByLabelText("Title").at(-1)!;
    await user.clear(manualTitle);
    await user.type(manualTitle, "Manual Ally");
    await user.type(screen.getByLabelText("Triggers / keys"), "manual ally");
    await user.type(screen.getAllByLabelText("Content").at(-1)!, "Keep this manual card.");
    await user.type(screen.getByLabelText("Premise"), "A ward is failing.");
    await user.selectOptions(screen.getByLabelText("Story setup"), "missionLoop");
    await user.selectOptions(screen.getByLabelText("Prose mode"), "cinematic");
    await user.selectOptions(screen.getByLabelText("Player control"), "minorActions");
    await user.selectOptions(screen.getByLabelText("Adult content / NSFW"), "romanceOnly");

    await user.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByDisplayValue("Old canon.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByDisplayValue("New canon.")).toBeInTheDocument());

    expect(vi.mocked(runAdventureGen)).toHaveBeenLastCalledWith(
      "A ward is failing.",
      expect.objectContaining({ model: "deepseek-v4-flash" }),
      expect.objectContaining({
        storyShape: "missionLoop",
        proseMode: "cinematic",
        playerControl: "minorActions",
        adultContent: "romanceOnly",
      }),
    );

    expect(screen.queryByDisplayValue("Old canon.")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Old world context.")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Old Ally")).not.toBeInTheDocument();
    expect(screen.getAllByDisplayValue("New Ally")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const setup = onCreate.mock.calls[0][0];
    expect(setup.components.find((component) => component.type === "plotEssentials")).toMatchObject({
      content: "New canon.",
      alwaysOn: true,
      pinned: true,
      protected: true,
    });
    expect(setup.components.map((component) => component.content)).not.toContain("Old world context.");
    expect(setup.storyCards.map((card) => card.title)).toEqual(["Manual Ally", "New Ally"]);
  });

  it("generates new adventure setup through a backend generator without a browser provider key", async () => {
    const user = userEvent.setup();
    const onGenerateAdventureSetup = vi.fn(async () => ({
      title: "Server Draft",
      openingScene: "The server writes the opening.",
      components: [
        { title: "Plot", type: "plotEssentials" as const, content: "Server-side canon.", alwaysOn: true, pinned: true, priority: 80 },
      ],
      storyCards: [
        { title: "Server Ally", type: "character" as const, keys: ["server ally"], content: "Generated by the backend.", pinned: false, priority: 0 },
      ],
    }));

    renderAdventuresPage(undefined, { onGenerateAdventureSetup });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.type(screen.getByLabelText("Premise"), "Make a backend-routed scenario.");
    await user.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByDisplayValue("Server Draft")).toBeInTheDocument());
    expect(onGenerateAdventureSetup).toHaveBeenCalledWith(
      "Make a backend-routed scenario.",
      expect.objectContaining({
        storyShape: "balanced",
        proseMode: "balanced",
        playerControl: "strict",
        adultContent: "off",
      }),
    );
    expect(vi.mocked(runAdventureGen)).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Server-side canon.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Server Ally")).toBeInTheDocument();
  });

  it("applies Storyteller profile defaults and passes the selected profile to generation", async () => {
    const user = userEvent.setup();
    renderAdventuresPage(undefined, {
      providerConfig: {
        name: "deepseek",
        baseUrl: "https://api.deepseek.com",
        apiKey: "test-key",
        model: "deepseek-v4-flash",
        temperature: 1,
        maxOutputTokens: 1200,
      },
    });
    vi.mocked(runAdventureGen).mockResolvedValueOnce({
      title: "Mara Draft",
      openingScene: "The lounge waits.",
      components: [],
      storyCards: [],
    });

    await user.click(screen.getByRole("button", { name: "New Adventure" }));
    await user.click(screen.getByRole("radio", { name: /Mara/ }));

    expect(screen.getByLabelText("Story setup")).toHaveValue("romanceDrama");
    expect(screen.getByLabelText("Prose mode")).toHaveValue("dialogueHeavy");
    expect(screen.getByLabelText("Player control")).toHaveValue("strict");
    expect(screen.getByLabelText("Adult content / NSFW")).toHaveValue("explicitAdult");

    await user.type(screen.getByLabelText("Premise"), "A dangerous courtship in a haunted lounge.");
    await user.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByDisplayValue("Mara Draft")).toBeInTheDocument());
    expect(vi.mocked(runAdventureGen)).toHaveBeenCalledWith(
      "A dangerous courtship in a haunted lounge.",
      expect.objectContaining({ model: "deepseek-v4-flash" }),
      expect.objectContaining({
        storytellerProfile: "mara",
        storyShape: "romanceDrama",
        proseMode: "dialogueHeavy",
        playerControl: "strict",
        adultContent: "explicitAdult",
      }),
    );
  });

  it("shows adventure thumbnail images in the Library", () => {
    renderAdventuresPage(undefined, {
      adventures: [
        {
          id: "adv-thumbnail",
          title: "Thumbnail Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          turnCount: 12,
          storyEntryCount: 25,
          thumbnailImage: {
            dataUrl: "data:image/png;base64,abc",
            altText: "A painted fire city",
          },
        },
      ],
    });

    const image = screen.getByAltText("A painted fire city");
    expect(image).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(screen.getByRole("heading", { name: "Thumbnail Adventure" })).toBeInTheDocument();
    expect(screen.getByText(/12 turns/)).toBeInTheDocument();
    expect(screen.getByText(/25 story entries/)).toBeInTheDocument();
  });

  it("uses the live adventure thumbnail when the library summary is stale", () => {
    const currentAdventure = createDefaultAdventure("Open Thumbnail Adventure");
    currentAdventure.id = "adv-open-thumbnail";
    currentAdventure.metadata = thumbnailMetadataPatch({
      dataUrl: "data:image/png;base64,b3Blbg==",
      altText: "Open adventure cover",
      mimeType: "image/png",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });

    renderAdventuresPage(undefined, {
      currentAdventure,
      adventures: [
        {
          id: "adv-open-thumbnail",
          title: "Open Thumbnail Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          turnCount: 12,
          storyEntryCount: 25,
        },
      ],
    });

    const image = screen.getByAltText("Open adventure cover");
    expect(image).toHaveAttribute("src", "data:image/png;base64,b3Blbg==");
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("opens backend backup saves and restores a selected snapshot", async () => {
    const user = userEvent.setup();
    const onListBackups = vi.fn(async () => [
      {
        id: "snapshot-1",
        adventureId: "adv-backup",
        source: "manualSave" as const,
        title: "Backup Adventure",
        createdAt: "2026-07-05T01:00:00.000Z",
        adventureUpdatedAt: "2026-07-05T00:59:00.000Z",
        turnCount: 8,
        storyEntryCount: 16,
      },
    ]);
    const onRestoreBackup = vi.fn(async () => undefined);

    renderAdventuresPage(undefined, {
      onListBackups,
      onRestoreBackup,
      adventures: [
        {
          id: "adv-backup",
          title: "Backup Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          turnCount: 8,
          storyEntryCount: 16,
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Backups" }));
    expect(await screen.findByRole("heading", { name: "Backup Adventure" })).toBeInTheDocument();
    expect(screen.getByText("1 backup save(s) available.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(onRestoreBackup).toHaveBeenCalledWith("adv-backup", "snapshot-1");
    expect(await screen.findByText("Backup restored.")).toBeInTheDocument();
  });

  it("offers upload-local and download-server actions for conflicted backend saves", async () => {
    const user = userEvent.setup();
    const onResolveSyncConflict = vi.fn(async () => undefined);

    renderAdventuresPage(undefined, {
      onResolveSyncConflict,
      adventures: [
        {
          id: "adv-conflict",
          title: "Conflicted Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-07-05T10:10:00.000Z",
          localBackupUpdatedAt: "2026-07-05T10:10:00.000Z",
          lastServerUpdatedAt: "2026-07-05T10:05:00.000Z",
          turnCount: 8,
          storyEntryCount: 16,
          syncStatus: "conflict",
          syncError: "Server copy changed.",
        },
      ],
    });

    expect(screen.getByText("Local backup conflict")).toBeInTheDocument();
    expect(screen.getByText(/Local save is ahead/)).toBeInTheDocument();
    expect(screen.getByText(/Choose which save should win: this device or the server/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upload Local Save" }));
    await user.click(screen.getByRole("button", { name: "Download Server Save" }));

    expect(onResolveSyncConflict).toHaveBeenNthCalledWith(1, "adv-conflict", "uploadLocal");
    expect(onResolveSyncConflict).toHaveBeenNthCalledWith(2, "adv-conflict", "downloadServer");
  });

  it("shows singular turn and story-entry text in the Library", () => {
    renderAdventuresPage(undefined, {
      adventures: [
        {
          id: "adv-one-action",
          title: "One Action Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          turnCount: 1,
          storyEntryCount: 1,
        },
      ],
    });

    expect(screen.getByText(/1 turn/)).toBeInTheDocument();
    expect(screen.getByText(/1 story entry/)).toBeInTheDocument();
  });
});
