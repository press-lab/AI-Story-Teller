/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewAdventureSetup } from "../types/adventure";
import { AdventuresPage } from "./AdventuresPage";

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
    await user.type(allContentFields[allContentFields.length - 1], "Margo calls Seth hedge prince as a private joke.");

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

  it("shows adventure thumbnail images in the Library", () => {
    renderAdventuresPage(undefined, {
      adventures: [
        {
          id: "adv-thumbnail",
          title: "Thumbnail Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
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
  });
});
