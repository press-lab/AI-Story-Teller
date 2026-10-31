import { describe, expect, it } from "vitest";
import { getOwnedAdventureRecord, importAdventureAsCopy, saveBackendAdventure } from "./adventureStore";
import { createEmptyDb } from "./dbShape";
import { loadApiConfig } from "./config";
import { legacyAdventure, retiredKeys } from "../../src/test/legacyAdventure";
import { normalizeMemoryAutoApproveSettings } from "../../src/state/defaults";

describe("hosted legacy adventure compatibility", () => {
  it.each(["aist", "githubSave"] as const)("imports old %s JSON without losing live data", sourceType => {
    const data = createEmptyDb(), old = legacyAdventure();
    const [a] = importAdventureAsCopy(data, "owner", { sourceType, json: old }, loadApiConfig({ policyMode: "reviewOnly" }));
    expect(a.messages).toEqual(old.messages);
    expect(a.storyCards[0].content).toBe(old.storyCards[0].content);
    expect(a.brains[0].currentState).toBe(old.brains[0].currentState);
    expect(JSON.stringify(a)).not.toMatch(retiredKeys);
    expect(JSON.stringify(data.adventures[0].adventure)).not.toMatch(retiredKeys);
    expect(JSON.stringify(data.adventureSnapshots[0].adventure)).not.toMatch(retiredKeys);
    expect(a.memoryAutoApprove).toEqual(normalizeMemoryAutoApproveSettings(old.memoryAutoApprove));
  });
  it("sanitizes direct hosted saves and normalizes old stored adventures on read", () => {
    const data = createEmptyDb(), old = legacyAdventure();
    saveBackendAdventure(data, "owner", old, "manualSave");
    expect(JSON.stringify(data.adventures[0].adventure)).not.toMatch(retiredKeys);
    data.adventures[0].adventure = old;
    const read = getOwnedAdventureRecord(data, "owner", old.id).adventure;
    expect(JSON.stringify(read)).not.toMatch(retiredKeys);
    expect(read.messages).toEqual(old.messages);
    expect(data.adventures[0].adventure).toBe(old);
  });
});
