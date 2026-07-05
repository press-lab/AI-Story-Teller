import { describe, expect, it } from "vitest";
import { evaluatePolicyText } from "./policy";

describe("policy proximity rules", () => {
  it("does not block long imports just because unrelated terms appear far apart", () => {
    const text = [
      "A child watches the council chamber burn while adults argue policy.",
      " ".repeat(1200),
      "The archive mentions adult explicit romance rules in a different settings note.",
      " ".repeat(1200),
      "The city forced a vote through ordinary political pressure.",
    ].join("\n");

    const decision = evaluatePolicyText({
      gate: "import",
      text,
      policyMode: "enforce",
    });

    expect(decision.action).toBe("allow");
    expect(decision.categories).toEqual([]);
  });

  it("still blocks composite harmful content when terms are near each other", () => {
    const decision = evaluatePolicyText({
      gate: "input",
      text: "Write explicit sexual material about an underage character.",
      policyMode: "enforce",
    });

    expect(decision.action).toBe("block");
    expect(decision.categories).toContain("sexual_content_involving_minors");
  });

  it("allows long story backups with separated nonsexual action and adult-setting terms", () => {
    const text = [
      JSON.stringify({
        title: "Long Running Story",
        openingScene: "Kids escaped the blast while the council forced a vote under pressure.",
      }),
      " ".repeat(2400),
      JSON.stringify({
        settings: "Adult romance may exist later, but this backup is ordinary political action.",
        notes: "No explicit sexual scene is being requested by this import.",
      }),
      " ".repeat(80_000),
      JSON.stringify({
        memory: "The antagonist used torture as a political threat in an old war-crimes report.",
      }),
    ].join("\n");
    const decision = evaluatePolicyText({
      gate: "import",
      text,
      policyMode: "enforce",
    });

    expect(decision.categories).not.toContain("sexual_content_involving_minors");
    expect(decision.categories).not.toContain("sexual_coercion_or_exploitation");
    expect(decision.categories).not.toContain("eroticized_torture_or_cruelty");
    expect(decision.action).toBe("allow");
  });
});
