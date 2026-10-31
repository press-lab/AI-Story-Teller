/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { adventureReducer } from "../state/adventureReducer";
import { approvalAdventure, approvalProposal, existingApprovalCard } from "../test/memoryApproval";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { defaultGlobalAdventureSettings, normalizeGlobalAdventureSettings, type GlobalAdventureSettings } from "./pageTypes";
import { MemoryInboxPage } from "./MemoryInboxPage";

const controls = [
  ["Legacy Summary", "summaryUpdate"], ["Plot Essentials", "plotEssentialsUpdate"], ["Active Pressure", "plotPressureUpdate"],
  ["Current Arc", "currentArcUpdate"], ["Arc Proposals", "arcProposal"], ["Character Story Cards", "characterStoryCard"],
  ["Lore Cards", "loreStoryCard"], ["Other Story Cards", "otherStoryCard"], ["Character Self", "brainUpdate"],
] as const;
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), clear: () => data.clear() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("offers exactly one independent approval toggle per category with detection disabled", async () => {
  const user = userEvent.setup(); const initial = approvalAdventure();
  initial.activeState.memoryProposals = [approvalProposal("brainUpdate")];
  function Harness() {
    const [adventure, dispatch] = useReducer(adventureReducer, initial);
    return <><MemoryInboxPage adventure={adventure} dispatch={dispatch} /><output data-testid="settings">{JSON.stringify(adventure.memoryAutoApprove)}</output><output data-testid="status">{adventure.activeState.memoryProposals[0].status}</output></>;
  }
  render(<Harness />);
  for (const [label, key] of controls) {
    expect(screen.getAllByLabelText(label)).toHaveLength(1);
    const before = JSON.parse(screen.getByTestId("settings").textContent!);
    await user.click(screen.getByLabelText(label));
    expect(JSON.parse(screen.getByTestId("settings").textContent!)).toEqual({ ...before, [key]: true });
    expect(screen.getByTestId("status")).toHaveTextContent("pending");
  }
  expect(screen.queryByLabelText(/Route all auto-updates|Require review for automatic/i)).not.toBeInTheDocument();
});

it("shows the stored card subtype and prevents the proposal from changing it", () => {
  const a = approvalAdventure(); a.storyCards = [existingApprovalCard("lore")];
  a.activeState.memoryProposals = [approvalProposal("characterStoryCard", { title: "Mira", targetId: "card" })];
  render(<MemoryInboxPage adventure={a} dispatch={() => undefined} />);
  expect(screen.getByLabelText("Reference Card Type")).toHaveValue("lore");
  expect(screen.getByLabelText("Reference Card Type")).toBeDisabled();
});

it("migrates global localStorage preferences once and preserves choices on reopening", () => {
  const key = "approval-global-test";
  localStorage.setItem(key, JSON.stringify({ ...defaultGlobalAdventureSettings, semanticEvaluationSettings: { ...defaultGlobalAdventureSettings.semanticEvaluationSettings, backgroundProviderConfig: { baseUrl: "https://example.test", model: "background", apiKey: "local-test-key" } }, memoryAutoApprove: { storyCard: true, characterStoryCard: false, brainUpdate: true, summaryUpdate: true } }));
  const hook = renderHook(() => useLocalStorage<GlobalAdventureSettings>(key, defaultGlobalAdventureSettings, normalizeGlobalAdventureSettings));
  expect(hook.result.current[0].memoryAutoApprove).toMatchObject({ characterStoryCard: false, loreStoryCard: true, otherStoryCard: true, brainUpdate: true, summaryUpdate: true });
  expect(hook.result.current[0].semanticEvaluationSettings.backgroundProviderConfig?.apiKey).toBe("local-test-key");
  const settings = hook.result.current[0];
  act(() => hook.result.current[1]({ ...settings, memoryAutoApprove: { ...settings.memoryAutoApprove, loreStoryCard: false } }));
  hook.unmount();
  const reopened = renderHook(() => useLocalStorage<GlobalAdventureSettings>(key, defaultGlobalAdventureSettings, normalizeGlobalAdventureSettings));
  expect(reopened.result.current[0].memoryAutoApprove).toEqual({ ...settings.memoryAutoApprove, loreStoryCard: false });
});
