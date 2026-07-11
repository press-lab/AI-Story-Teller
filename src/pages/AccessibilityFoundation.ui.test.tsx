/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultAdventure, makeComponent } from "../state/defaults";
import { ChroniclePage } from "./ChroniclePage";
import { ContextPreviewPage } from "./ContextPreviewPage";

describe("editor page interaction semantics", () => {
  afterEach(() => cleanup());

  it("edits Chronicle entries only through an explicit button", async () => {
    const user = userEvent.setup();
    const adventure = {
      ...createDefaultAdventure("Chronicle Accessibility"),
      messages: [
        {
          id: "message-1",
          role: "assistant" as const,
          content: "Rain waits outside.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    render(<ChroniclePage adventure={adventure} dispatch={() => undefined} />);

    const entryText = screen.getByText("Rain waits outside.");
    await user.click(entryText);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit chronicle entry 1" }));
    expect(screen.getByRole("textbox")).toHaveValue("Rain waits outside.");
  });

  it("expands Context details with a disclosure button instead of a clickable row", async () => {
    const user = userEvent.setup();
    const adventure = {
      ...createDefaultAdventure("Context Accessibility"),
      components: [
        makeComponent({
          id: "component-ward-key",
          title: "Ward Key Plot",
          type: "plotEssentials",
          content: "The red ward key opens the east tower archive.",
          active: true,
          alwaysOn: true,
        }),
      ],
    };

    render(
      <ContextPreviewPage
        adventure={adventure}
        dispatch={() => undefined}
        onBuildContext={() => undefined}
      />,
    );

    const title = screen.getByText("Ward Key Plot");
    const inspect = screen.getByRole("button", { name: "Inspect details for Ward Key Plot" });
    expect(inspect).toHaveAttribute("aria-expanded", "false");

    await user.click(title);
    expect(inspect).toHaveAttribute("aria-expanded", "false");

    const detailsId = inspect.getAttribute("aria-controls");
    expect(detailsId).toBeTruthy();
    await user.click(inspect);

    const hide = screen.getByRole("button", { name: "Hide details for Ward Key Plot" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(detailsId!)).toHaveTextContent("The red ward key opens the east tower archive.");

    await user.click(hide);
    expect(screen.getByRole("button", { name: "Inspect details for Ward Key Plot" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
