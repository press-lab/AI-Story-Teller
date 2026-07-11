import { describe, expect, it } from "vitest";
import { contentSnippet } from "./shared";

describe("contentSnippet", () => {
  it("shows a recognition-first preview even when the user is not searching", () => {
    expect(contentSnippet("The guild is under pressure from a closing deadline.", ""))
      .toBe("The guild is under pressure from a closing deadline.");
  });

  it("gives empty context blocks a clear writing prompt", () => {
    expect(contentSnippet("   ", "")).toBe("No guidance has been written yet.");
  });

  it("keeps the matching text in view while searching", () => {
    expect(contentSnippet("Alpha beta gamma delta", "gamma", 4)).toContain("gamma");
  });
});
