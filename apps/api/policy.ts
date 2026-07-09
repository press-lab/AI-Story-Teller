import { readFileSync } from "node:fs";
import type { LocalDbData, PolicyAction, PolicyDecisionRecord, PolicyGate } from "./apiTypes";
import type { PolicyMode } from "./config";
import { applySafetyEventForDecision } from "./accountSafety";
import { createId, nowIso } from "./ids";

type PatternKind = "literal" | "regex";

interface RulePattern {
  kind: PatternKind;
  value: string;
}

interface RuleProximityMatch {
  windowChars: number;
  patterns: RulePattern[];
}

interface PolicyCategory {
  id: string;
  severity: number;
  definition: string;
  defaultAction: PolicyAction;
  createsSafetyEvent: boolean;
}

interface PolicyRule {
  id: string;
  categoryId: string;
  gates: PolicyGate[];
  allowRule?: boolean;
  match: {
    all?: RulePattern[];
    any?: RulePattern[];
    near?: RuleProximityMatch[];
  };
}

export interface PolicyRulePack {
  id: string;
  version: number;
  manualReviewRequired: boolean;
  defaultMode: PolicyMode;
  categories: PolicyCategory[];
  rules: PolicyRule[];
}

export interface PolicyEvaluationInput {
  gate: PolicyGate;
  text: string;
  userId?: string;
  subjectType?: string;
  subjectId?: string;
  policyMode: PolicyMode;
}

export interface PolicyEvaluation {
  action: PolicyAction;
  matchedRuleIds: string[];
  categories: string[];
  severity: number;
  manualReviewRequired: boolean;
  rationale: string;
}

const defaultRulePackPath = new URL("./policy/rule-packs/manual-review-draft.json", import.meta.url);
const protectiveCueBeforePattern =
  /(?:\b(?:no|never|avoid(?:s|ed|ing)?|exclude(?:s|d|ing)?|without|prohibit(?:s|ed|ing)?|prevent(?:s|ed|ing)?|disallow(?:s|ed|ing)?|forbid(?:s|den|ding)?|ban(?:s|ned|ning)?|off[- ]limits?)\b|\b(?:must|should|do|does|did|is|are|was|were|be)\s+not\b|\bdon't\b|\bcannot\b|\bcan't\b)[^.!?\n;:]{0,80}$/i;
const protectiveCueAfterPattern =
  /^[^.!?\n;:]{0,80}\b(?:is|are|must be|should be)\s+(?:not allowed|prohibited|forbidden|banned|off[- ]limits?)\b/i;

export function loadPolicyRulePack(path = defaultRulePackPath): PolicyRulePack {
  return JSON.parse(readFileSync(path, "utf8")) as PolicyRulePack;
}

export function evaluatePolicyText(input: PolicyEvaluationInput, rulePack = loadPolicyRulePack()): PolicyEvaluation {
  const text = input.text.toLowerCase();
  const categoryById = new Map(rulePack.categories.map((category) => [category.id, category]));
  const matchedRules = rulePack.rules.filter((rule) => rule.gates.includes(input.gate) && ruleMatches(rule, text));
  const allowMatches = matchedRules.filter((rule) => rule.allowRule);
  const blockMatches = matchedRules.filter((rule) => !rule.allowRule);

  if (blockMatches.length === 0) {
    return {
      action: "allow",
      matchedRuleIds: allowMatches.map((rule) => rule.id),
      categories: allowMatches.map((rule) => rule.categoryId),
      severity: 0,
      manualReviewRequired: rulePack.manualReviewRequired,
      rationale: allowMatches.length > 0 ? "Allowed by explicit allow fixture/rule." : "No blocking policy rule matched.",
    };
  }

  const categories = blockMatches.map((rule) => categoryById.get(rule.categoryId)).filter((category): category is PolicyCategory => Boolean(category));
  const severity = categories.reduce((max, category) => Math.max(max, category.severity), 0);
  const strongestAction = strongestPolicyAction(categories.map((category) => category.defaultAction));
  const reviewBlockedAction = input.policyMode === "reviewOnly" && categories.every((category) => category.id !== "prompt_injection_or_policy_evasion")
    ? "review_only"
    : strongestAction;

  return {
    action: reviewBlockedAction,
    matchedRuleIds: blockMatches.map((rule) => rule.id),
    categories: categories.map((category) => category.id),
    severity,
    manualReviewRequired: rulePack.manualReviewRequired,
    rationale: categories.map((category) => category.definition).join(" "),
  };
}

export function recordPolicyDecision(
  data: LocalDbData,
  input: PolicyEvaluationInput,
  evaluation = evaluatePolicyText(input),
): PolicyDecisionRecord {
  const decision: PolicyDecisionRecord = {
    id: createId("policy"),
    userId: input.userId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    gate: input.gate,
    action: evaluation.action,
    matchedRuleIds: evaluation.matchedRuleIds,
    categories: evaluation.categories,
    severity: evaluation.severity,
    manualReviewRequired: evaluation.manualReviewRequired,
    rationale: evaluation.rationale,
    createdAt: nowIso(),
  };
  data.policyDecisions.push(decision);
  applySafetyEventForDecision(data, decision);
  return decision;
}

export function assertPolicyAllowed(decision: PolicyDecisionRecord): void {
  if (decision.action === "block" || decision.action === "quarantine") {
    const categoryText = decision.categories.length > 0 ? ` (${decision.categories.join(", ")})` : "";
    throw new PolicyBlockedError(`Request blocked by policy${categoryText}.`, decision);
  }
}

export class PolicyBlockedError extends Error {
  decision: PolicyDecisionRecord;

  constructor(message: string, decision: PolicyDecisionRecord) {
    super(message);
    this.name = "PolicyBlockedError";
    this.decision = decision;
  }
}

function ruleMatches(rule: PolicyRule, text: string): boolean {
  const all = rule.match.all ?? [];
  const any = rule.match.any ?? [];
  const near = rule.match.near ?? [];
  const allMatched = all.length === 0 || all.every((pattern) => patternMatches(pattern, text));
  const anyMatched = any.length === 0 || any.some((pattern) => patternMatches(pattern, text));
  const nearMatched = near.length === 0 || near.every((match) => proximityMatches(match, text));
  return allMatched && anyMatched && nearMatched;
}

function patternMatches(pattern: RulePattern, text: string): boolean {
  if (pattern.kind === "literal") return text.includes(pattern.value.toLowerCase());
  try {
    return new RegExp(pattern.value, "i").test(text);
  } catch {
    return false;
  }
}

interface MatchRange {
  start: number;
  end: number;
}

function proximityMatches(match: RuleProximityMatch, text: string): boolean {
  if (match.patterns.length === 0) return false;
  if (match.patterns.length === 1) return patternMatches(match.patterns[0], text);
  const rangesByPattern = match.patterns.map((pattern) => nonProtectivePatternRanges(pattern, text));
  if (rangesByPattern.some((ranges) => ranges.length === 0)) return false;
  const anchors = rangesByPattern[0];
  const others = rangesByPattern.slice(1);
  return anchors.some((anchor) =>
    others.every((ranges) =>
      ranges.some((range) => rangeDistance(anchor, range) <= match.windowChars),
    ),
  );
}

function nonProtectivePatternRanges(pattern: RulePattern, text: string): MatchRange[] {
  return patternRanges(pattern, text).filter((range) => !isProtectiveBoundaryMatch(range, text));
}

function patternRanges(pattern: RulePattern, text: string): MatchRange[] {
  if (pattern.kind === "literal") {
    const literal = pattern.value.toLowerCase();
    if (!literal) return [];
    const ranges: MatchRange[] = [];
    let index = text.indexOf(literal);
    while (index !== -1) {
      ranges.push({ start: index, end: index + literal.length });
      index = text.indexOf(literal, index + Math.max(1, literal.length));
    }
    return ranges;
  }
  try {
    const regex = new RegExp(pattern.value, "gi");
    const ranges: MatchRange[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
    return ranges;
  } catch {
    return [];
  }
}

function isProtectiveBoundaryMatch(range: MatchRange, text: string): boolean {
  const beforeStart = Math.max(0, range.start - 100);
  const afterEnd = Math.min(text.length, range.end + 100);
  const before = text.slice(beforeStart, range.start);
  const after = text.slice(range.end, afterEnd);
  return protectiveCueBeforePattern.test(before) || protectiveCueAfterPattern.test(after);
}

function rangeDistance(a: MatchRange, b: MatchRange): number {
  if (a.end < b.start) return b.start - a.end;
  if (b.end < a.start) return a.start - b.end;
  return 0;
}

function strongestPolicyAction(actions: PolicyAction[]): PolicyAction {
  const rank: Record<PolicyAction, number> = {
    allow: 0,
    review_only: 1,
    redact: 2,
    quarantine: 3,
    block: 4,
  };
  return actions.reduce((strongest, action) => rank[action] > rank[strongest] ? action : strongest, "allow" as PolicyAction);
}
