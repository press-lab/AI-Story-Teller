/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import type { Adventure } from "../types/adventure";
import { DashboardPage } from "./DashboardPage";

const timestamp = "2026-01-01T00:00:00.000Z";

function dashboardAdventure(): Adventure {
  return {
    ...createDefaultAdventure("Dashboard Adventure"),
    messages: [
      { id: "msg-user", role: "user", content: "I open the door.", createdAt: timestamp },
      { id: "msg-ai", role: "assistant", content: "Rain waits outside.", createdAt: timestamp },
    ],
  };
}

describe("DashboardPage adventure detail", () => {
  afterEach(() => {
    cleanup();
  });

  it("presents the current adventure as a detail page with primary destinations", async () => {
    const user = userEvent.setup();
    const onOpenTab = vi.fn();
    const onBuildContext = vi.fn();
    const onOpenContext = vi.fn();

    render(
      <DashboardPage
        adventure={dashboardAdventure()}
        dispatch={() => undefined}
        loading={false}
        saveStatus="saved"
        onSubmitTurn={async () => undefined}
        onContinue={async () => undefined}
        onRegenerate={async () => undefined}
        onBuildContext={onBuildContext}
        onOpenContext={onOpenContext}
        onRememberThis={async () => undefined}
        onOpenTab={onOpenTab}
      />,
    );

    expect(screen.getByRole("heading", { name: "Dashboard Adventure" })).toBeInTheDocument();
    expect(screen.getByText("Rain waits outside.")).toBeInTheDocument();
    expect(screen.getByText("Context is healthy")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ tokens/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue Story" }));
    expect(onOpenTab).toHaveBeenCalledWith("play");

    await user.click(screen.getByRole("button", { name: "Open Story Studio" }));
    expect(onOpenTab).toHaveBeenCalledWith("edit");

    await user.click(screen.getByRole("button", { name: "Context details" }));
    expect(onBuildContext).toHaveBeenCalledTimes(1);
    expect(onOpenContext).toHaveBeenCalledTimes(1);
  });

  it("offers upload-local and download-server actions for a conflicted current adventure", async () => {
    const user = userEvent.setup();
    const onResolveSyncConflict = vi.fn(async () => undefined);

    render(
      <DashboardPage
        adventure={dashboardAdventure()}
        dispatch={() => undefined}
        loading={false}
        saveStatus="Local backup conflict. Duplicate this local copy or restore a server backup before syncing."
        onSubmitTurn={async () => undefined}
        onContinue={async () => undefined}
        onRegenerate={async () => undefined}
        onBuildContext={() => undefined}
        onOpenContext={() => undefined}
        onRememberThis={async () => undefined}
        hasSyncConflict
        syncConflictSummary={{
          id: "dashboard-conflict",
          title: "Dashboard Adventure",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-07-05T10:00:00.000Z",
          localBackupUpdatedAt: "2026-07-05T10:00:00.000Z",
          lastServerUpdatedAt: "2026-07-05T10:05:00.000Z",
          turnCount: 2,
          storyEntryCount: 2,
          syncStatus: "conflict",
        }}
        onResolveSyncConflict={onResolveSyncConflict}
      />,
    );

    expect(screen.getByText(/Server save is ahead/)).toBeInTheDocument();
    expect(screen.getByText(/Both versions are preserved until you choose/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep this device's version" }));
    await user.click(screen.getByRole("button", { name: "Use the server version" }));

    expect(onResolveSyncConflict).toHaveBeenNthCalledWith(1, "uploadLocal");
    expect(onResolveSyncConflict).toHaveBeenNthCalledWith(2, "downloadServer");
  });
});
