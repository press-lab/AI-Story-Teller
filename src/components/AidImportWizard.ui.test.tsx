/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Adventure } from "../types/adventure";
import { AidImportWizard } from "./AidImportWizard";

describe("AidImportWizard plot component upload", () => {
  afterEach(cleanup);

  it("creates a new adventure with uploaded plot components replacing matching defaults", async () => {
    const user = userEvent.setup();
    const onCreateAdventureFromImport = vi.fn(async (_adventure: Adventure) => undefined);
    const file = new File(
      [
        JSON.stringify({
          components: [
            {
              title: "Plot Essentials",
              type: "plotEssentials",
              content: "Nyx remains secret from everyone except Seth.",
              priority: 90,
              alwaysOn: true,
              pinned: true,
              protected: true,
            },
            {
              title: "Active Pressure",
              type: "activePressure",
              content: "Relay inspectors are closing in.",
              priority: 245,
              autoUpdate: true,
            },
          ],
        }),
      ],
      "crown-below-components.json",
      { type: "application/json" },
    );

    render(
      <AidImportWizard
        onCreateAdventureFromImport={onCreateAdventureFromImport}
        onComplete={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText("Plot component files (multi-file OK)"), file);
    await waitFor(() => expect(screen.getByText("Component Preview (2)")).toBeInTheDocument());
    expect(screen.getByText("Nyx remains secret from everyone except Seth.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Adventure" }));

    expect(onCreateAdventureFromImport).toHaveBeenCalledTimes(1);
    const adventure = onCreateAdventureFromImport.mock.calls[0][0];
    expect(adventure.components.filter((component) => component.type === "plotEssentials")).toHaveLength(1);
    expect(adventure.components.find((component) => component.type === "plotEssentials")).toMatchObject({
      content: "Nyx remains secret from everyone except Seth.",
      priority: 90,
    });
    expect(adventure.components.filter((component) => component.type === "activePressure")).toHaveLength(1);
    expect(adventure.components.find((component) => component.type === "activePressure")).toMatchObject({
      content: "Relay inspectors are closing in.",
      autoUpdate: true,
    });
    expect(adventure.components.some((component) => component.type === "narrationRules")).toBe(true);
  });
});
