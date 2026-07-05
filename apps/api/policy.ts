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
  const allMatched = all.length === 0 || all.every((pattern) => patternMatches(pattern, text));
  const anyMatched = any.length === 0 || any.some((pattern) => patternMatches(pattern, text));
  return allMatched && anyMatched;
}

function patternMatches(pattern: RulePattern, text: string): boolean {
  if (pattern.kind === "literal") return text.includes(pattern.value.toLowerCase());
  try {
    return new RegExp(pattern.value, "i").test(text);
  } catch {
    return false;
  }
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
