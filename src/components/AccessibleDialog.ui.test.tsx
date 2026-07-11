/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { GitHubSaveSlot } from "../types/adventure";
import { ActionFeedbackProvider, useActionFeedback } from "./ActionFeedback";
import { GitHubSaveConflictDialog } from "./GitHubSaveConflictDialog";

function ConfirmationHarness() {
  const { confirmAction } = useActionFeedback();
  return (
    <button
      type="button"
      onClick={() => void confirmAction({
        title: "Delete entry?",
        message: "This removes the entry from the story.",
        confirmLabel: "Delete",
        danger: true,
      })}
    >
      Open confirmation
    </button>
  );
}

describe("accessible modal dialogs", () => {
  afterEach(() => cleanup());

  it("focuses the safe action, traps focus, dismisses with Escape, and restores focus", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ActionFeedbackProvider>
        <ConfirmationHarness />
      </ActionFeedbackProvider>,
    );
    const opener = screen.getByRole("button", { name: "Open confirmation" });

    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Delete entry?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    expect(dialog).toHaveAccessibleDescription("This removes the entry from the story.");
    expect(cancel).toHaveFocus();
    expect(container).toHaveAttribute("aria-hidden", "true");
    expect(container.inert).toBe(true);

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Delete entry?" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(container).not.toHaveAttribute("aria-hidden");
    expect(container.inert).toBe(false);
  });

  it("gives the save-conflict dialog a labelled description and safe backdrop dismissal", async () => {
    const user = userEvent.setup();
    const loaded = {
      ...createDefaultAdventure("Loaded Story"),
      updatedAt: "2026-01-03T00:00:00.000Z",
    };
    const local = {
      ...createDefaultAdventure("Loaded Story"),
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const slot: GitHubSaveSlot = {
      saveId: "save-1",
      adventureId: loaded.id,
      title: loaded.title,
      savedAt: "2026-01-04T00:00:00.000Z",
      turnCount: 3,
      saveType: "manual",
    };

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open conflict</button>
          {open && (
            <GitHubSaveConflictDialog
              loaded={loaded}
              local={local}
              slot={slot}
              onConfirm={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open conflict" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Overwrite local adventure?" });
    expect(dialog).toHaveAccessibleDescription(/already exists locally/i);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Overwrite with GitHub save" })).toHaveFocus();

    const backdrop = document.querySelector<HTMLElement>(".modal-backdrop");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    expect(screen.queryByRole("dialog", { name: "Overwrite local adventure?" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
