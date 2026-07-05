# Backend Implementation Plan

This is the implementation plan for adding a backend, accounts, invite-only signup, Google and Apple login, scenario/adventure sharing, subscriptions, deterministic content policy, and prompt-injection defenses without breaking the current local setup.

The companion architecture document is `docs/backend-architecture.md`.

## Implementation Principles

- Keep the current app usable at every phase.
- Add cloud mode beside local mode before replacing any local behavior.
- Prefer adapters and shared packages over rewrites.
- Keep reducer and context-builder parity measurable.
- Treat policy, prompt-injection defense, usage, and billing as backend concerns.
- Make public sharing opt-in, versioned, and policy-gated.

## Parallel Setup Preservation

The current setup must survive during backend implementation.

Current local workflow to preserve:

- IndexedDB local adventures.
- BYO API key in localStorage.
- Browser-to-provider generation.
- JSON backup and restore.
- AI Dungeon import.
- GitHub save slots.
- GitHub cloud sync.
- Local development with `npm.cmd run dev`.
- Existing validation commands.

Do not remove or degrade these while cloud features are being added.

Add these abstractions first:

```ts
type RuntimeMode = "local" | "cloud";

interface RuntimeConfig {
  mode: RuntimeMode;
  apiBaseUrl?: string;
}

interface AdventureStore {
  list(): Promise<AdventureSummary[]>;
  get(id: string): Promise<Adventure | undefined>;
  save(adventure: Adventure): Promise<void>;
  delete(id: string): Promise<void>;
}

interface TurnRunner {
  runTurn(adventureId: string, input: string): Promise<TurnResult>;
}

interface ContextPreviewSource {
  build(adventureId: string): Promise<ContextBuildResult>;
}
```

Local adapters wrap existing code. Cloud adapters call backend endpoints.

Acceptance criteria:

- Local mode is default until cloud mode is deliberately selected.
- Existing local saves load without migration.
- GitHub saves remain visible and functional in local mode.
- Cloud import uses copies, not in-place conversion.
- A failed cloud request cannot corrupt local IndexedDB state.

## Phase 0: Repository Preparation

Goal: make backend work possible without changing runtime behavior.

Tasks:

- Add workspace structure for `apps/web`, `apps/api`, and `packages/story-engine`, or use a transitional package layout if a full move is too large.
- Move shared pure code into `packages/story-engine`.
- Re-export types and functions so the web app imports from the package.
- Keep the public behavior of local mode unchanged.
- Add parity tests for imported reducer/context/default behavior.

Files likely involved:

- `package.json`
- `tsconfig*.json`
- `vite.config.ts`
- `src/types`
- `src/state`
- `src/contextBuilder`
- `src/memory`
- `src/triggers`
- `src/tokenizer`
- `src/importers`

Validation:

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run smoke:prod`

Exit criteria:

- No UI or save behavior changes.
- Existing tests pass.
- Shared engine can be imported from web and backend test stubs.

## Phase 1: Runtime Adapters

Goal: make local/cloud switching explicit.

Tasks:

- Add local `AdventureStore` adapter around IndexedDB.
- Add local `TurnRunner` adapter around the current provider flow.
- Add runtime mode setting, defaulting to `local`.
- Add no-op cloud adapter shell that reports "cloud mode unavailable" until backend exists.
- Add tests proving local mode still hits IndexedDB and browser provider flow.

Acceptance tests:

- Existing local adventure list renders.
- Existing play flow still works in local mode.
- Export/import still works.
- GitHub saves are still reachable from local mode.

Exit criteria:

- The app has an explicit seam for cloud work.
- No production backend dependency exists yet.

## Phase 2: Backend Skeleton

Goal: create the API service without moving generation.

Tasks:

- Add `apps/api`.
- Add Fastify or Hono server.
- Add health endpoint.
- Add typed environment validation.
- Add structured logger.
- Add Postgres connection.
- Add migration runner.
- Add local dev script for API.
- Add API test setup.

Initial endpoints:

```text
GET /health
GET /version
```

Initial database:

- migrations table, if not supplied by migration tool
- app metadata table

Exit criteria:

- API starts locally.
- API tests run.
- Web local mode is unaffected.

## Phase 3: Auth And Invite Gate

Goal: support invite-only accounts with Google and Apple login.

Tasks:

- Choose auth provider.
- Configure Google OAuth.
- Configure Apple OAuth.
- Add invite table and signup intent table.
- Add admin invite creation endpoint.
- Add invite preview endpoint.
- Add invite acceptance endpoint.
- Add auth callback or auth hook integration.
- Add default user/profile/author-profile creation.
- Add tests for valid, expired, revoked, overused, and replayed invites.

Tables:

```text
users
auth_identities
invite_links
signup_intents
profiles
author_profiles
admin_actions
```

Security requirements:

- Store invite token hashes only.
- Use high-entropy random invite tokens.
- Expire signup intents quickly.
- Mark invite use in the same transaction that creates account state.
- Do not depend on email alone for Apple signups.
- Rate-limit invite preview and accept endpoints.

Exit criteria:

- No account can be activated without a valid invite.
- Admin can create and revoke invites.
- Invite use is auditable.

## Phase 4: Cloud Adventure Persistence

Goal: add cloud saves without touching existing local saves.

Tasks:

- Add adventure tables.
- Add cloud adventure CRUD endpoints.
- Add JSON import endpoint for current local exports.
- Add cloud export endpoint.
- Add version checks for writes.
- Add server-side normalization through shared engine.
- Add cloud adventure list UI behind runtime mode.
- Add "copy local adventure to cloud" flow.

Tables:

```text
adventures
adventure_snapshots
adventure_events
messages
components
story_cards
brains
memory_proposals
```

Rules:

- Import creates a new cloud copy.
- Local IndexedDB record remains untouched.
- Runtime provider secrets are stripped on import.
- Writes require ownership.
- Writes include base version.

Exit criteria:

- A local adventure can be copied to cloud.
- A cloud adventure can be exported back to current JSON format.
- Local mode still works if the API is offline.

## Phase 5: Server Context Preview

Goal: make server context assembly visible and comparable before server generation.

Tasks:

- Add `GET /adventures/:id/context-preview`.
- Build context on the server with shared engine.
- Store context build metadata.
- Compare server payload with local payload for imported fixtures.
- Add UI indication for cloud context preview.

Tables:

```text
context_build_events
```

Acceptance tests:

- Same adventure input produces same ordered context sections locally and on the server.
- Empty sections remain present in build result but absent from provider payload.
- `generatedBy` metadata remains correct.
- Arc Director break instruction remains hidden before break phase.

Exit criteria:

- Server context preview is trustworthy before server generation is enabled.

## Phase 6: Deterministic Policy Engine

Goal: implement hard policy gates before public sharing and before server generation broadens.

Tasks:

- Add policy package or API module.
- Define `PolicyDecision`.
- Define versioned rulesets.
- Add input, context, output, memory-write, import, share, and profile gates.
- Add policy decision storage.
- Add deterministic unit fixtures.
- Add adversarial fixtures for hard-block categories.
- Add safe user-facing blocked-turn messages.

Hard-block categories:

- minor or minor-coded sexual content
- sexual exploitation, grooming, trafficking, or coercion
- non-consensual sexual content or sexualized violence
- sexual content involving animals
- sexual content involving corpses or unconscious/non-participating people
- eroticized torture, cruelty, mutilation, or suffering
- real-person sexual content without consent
- illegal sexual content by jurisdiction or provider contract
- instructions enabling abuse, evasion, exploitation, or harm
- doxxing/private data exposure
- self-harm instruction or encouragement
- malicious cyber instructions
- extremist recruitment or operational support

Allowed when profile permits and no hard block applies:

- consensual adult romance
- consensual adult sexual content
- adult flirting and innuendo
- fictional violence within content profile limits

Policy decision shape:

```ts
interface PolicyDecision {
  id: string;
  policyVersion: string;
  rulesetVersion: string;
  gate: "input" | "context" | "output" | "memoryWrite" | "import" | "share" | "profile";
  subjectType: "message" | "context" | "modelOutput" | "memoryProposal" | "adventure" | "scenario" | "attachment" | "profile";
  subjectId?: string;
  decision: "allow" | "warn" | "block" | "redact" | "escalate";
  severity: "none" | "low" | "medium" | "high" | "critical";
  matchedRules: Array<{
    ruleId: string;
    category: string;
    action: "warn" | "block" | "redact" | "escalate";
    spans?: Array<{ start: number; end: number; hash?: string }>;
  }>;
  createdAt: string;
}
```

Rules:

- No share/publish without share gate.
- No durable AI memory write without memory-write gate.
- No provider call without input and context gates.
- No assistant output persistence without output gate.
- Classifier labels may be used, but deterministic rules decide outcomes.

Exit criteria:

- Hard-block fixtures fail closed.
- Allowed consensual adult fixtures pass when profile permits.
- Policy decisions are stored and inspectable.

## Phase 7: Prompt-Injection Defense

Goal: make untrusted text unable to override app, policy, billing, provider, or tool behavior.

Tasks:

- Add trust-level metadata to context items.
- Add provenance metadata for imports, scenario text, previous model output, user-authored instructions, and system instructions.
- Add prompt-injection detector rules.
- Add context gate checks for instruction override attempts.
- Add import/share gate checks for malicious scenario text.
- Add tests for common injection patterns.
- Update system shell to clarify instruction precedence.

Trust levels:

```text
system: app/server generated instruction
policy: server policy or entitlement instruction
userInstruction: user-authored AI Instructions or Author's Note
currentUserInput: current user message
adventureData: Story Cards, Brains, components, transcript
externalData: imported/shared/scenario text
modelOutput: previous assistant text
```

Blocked or flagged injection patterns:

- attempts to override system/developer/policy instructions
- attempts to reveal hidden prompts or policy text
- attempts to disable safety, billing, logging, or moderation
- attempts to make imported scenario text act as higher-priority instruction
- attempts to exfiltrate provider keys, session tokens, or internal IDs
- attempts to induce hidden tool use or backend actions from story prose

Implementation rules:

- The model never receives provider credentials.
- The backend never executes commands from model prose.
- Public scenario text is always data.
- Imported text is always data.
- Previous model output is always data.
- Context Preview exposes section provenance and trust level.

Exit criteria:

- Prompt-injection fixtures are blocked or downgraded to inert story data.
- Context Preview shows enough provenance to inspect suspicious items.
- No hidden tool or provider secret is reachable through model output.

## Phase 8: Server-Side Turn Execution

Goal: move cloud generation behind the backend.

Tasks:

- Add `POST /adventures/:id/turn`.
- Load user, subscription, profile, and adventure.
- Run entitlement check.
- Run input policy gate.
- Apply user-message reducer action.
- Build context server-side.
- Run context and prompt-injection gates.
- Select provider/model server-side.
- Call provider with server-owned credentials.
- Strip control tags.
- Run output policy gate.
- Persist allowed assistant response.
- Persist blocked-turn placeholder for blocked outputs.
- Append model-call and usage records.
- Enqueue background jobs.

Tables:

```text
model_call_events
usage_ledger
policy_decisions
context_build_events
worker_jobs
```

Blocked output behavior:

- Do not show blocked raw output.
- Persist user message and blocked assistant placeholder.
- Do not increment successful generation counters.
- Log provider cost internally.
- Make user-facing quota behavior explicit in plan terms.

Exit criteria:

- Cloud mode can complete a turn without browser provider keys.
- Usage and policy decisions are recorded.
- Local mode still runs browser-to-provider generation.

## Phase 9: Scenario Publishing And Adventure Sharing

Goal: add sharing after policy and injection gates exist.

Tasks:

- Add scenario tables.
- Add scenario draft UI/API.
- Add scenario revision API.
- Add publish endpoint.
- Add share/fork endpoint.
- Add private adventure snapshot share links.
- Add report endpoint.
- Add moderation/admin views.

Tables:

```text
scenarios
scenario_revisions
scenario_assets
scenario_publications
scenario_forks
scenario_share_links
adventure_share_links
scenario_reports
```

Rules:

- Public scenario revisions are immutable.
- Publishing runs share policy and prompt-injection gates.
- Private adventure transcript is excluded from scenario export unless explicitly selected.
- Share links are revocable.
- Forking copies content into the recipient account.
- Reported public content can be hidden by admin action.

Exit criteria:

- A user can publish a policy-cleared scenario revision.
- Another user can fork it.
- A user can revoke a share link.
- Unsafe or injection-bearing scenario text cannot be published publicly.

## Phase 10: Subscriptions And Usage

Goal: gate expensive features and context usage server-side.

Tasks:

- Add plan definitions.
- Add subscriptions table.
- Add effective entitlement resolver.
- Add Stripe checkout endpoint.
- Add Stripe customer portal endpoint.
- Add idempotent webhook endpoint.
- Add usage ledger display API.
- Gate model tier, context tokens, output tokens, cloud adventure count, background jobs, and publishing.

Tables:

```text
plans
subscriptions
entitlement_grants
usage_ledger
billing_webhook_events
subscription_events
```

Entitlement resolver:

```ts
interface EffectiveEntitlements {
  planCode: string;
  status: "trialing" | "active" | "past_due" | "grace" | "canceled" | "unpaid" | "comped";
  canGenerate: boolean;
  canUseAdvancedModels: boolean;
  canRunBackgroundMemory: boolean;
  canPublishScenarios: boolean;
  maxContextTokens: number;
  monthlyCreditLimit: number;
  remainingCredits: number;
  allowedModelTiers: string[];
  reason?: string;
}
```

Rules:

- Never trust the client for subscription state.
- Checkout success does not grant access until webhook or provider verification confirms state.
- Webhooks are idempotent.
- Usage ledger is append-only.
- Provider cost and user-visible credits are separate fields.

Exit criteria:

- Plan limits affect generation before provider calls.
- Usage is visible to users.
- Admin can grant credits or comp accounts.
- Billing webhook replay is safe.

## Phase 11: Workers And Background Jobs

Goal: move background AI work out of browser tabs for cloud adventures.

Tasks:

- Add Redis and BullMQ.
- Add worker app/process.
- Move semantic evaluation to worker for cloud adventures.
- Move memory detection/cycle to worker for cloud adventures.
- Add retry and dead-letter handling.
- Add job usage accounting.
- Add user-visible background job status where useful.

Worker jobs:

- semantic evaluation
- memory detection
- memory cycle
- Story Card audit
- Brain audit
- import processing
- export packaging
- thumbnail generation
- report processing

Exit criteria:

- Cloud background jobs continue after browser close.
- Worker jobs use same shared engine and same policy engine.
- Failed jobs are inspectable.

## Phase 12: Admin And Support Console

Goal: make the production system operable.

Tasks:

- Add admin roles.
- Add user lookup.
- Add adventure diagnostics.
- Add model-call view.
- Add context build event view.
- Add policy decision view.
- Add subscription view.
- Add invite management.
- Add report queue.
- Add admin action audit log.

Admin rules:

- Every admin action is audit-logged.
- Raw text visibility follows retention and permission rules.
- Support can diagnose without reading private content by default.
- Account holds and credits are explicit actions.

Exit criteria:

- A failed turn can be diagnosed from logs.
- A blocked policy decision can be inspected.
- Invite abuse can be traced.
- Subscription problems can be resolved without database spelunking.

## Test Matrix

Keep existing validation:

```sh
npm.cmd test
npm.cmd run build
npm.cmd run smoke:prod
```

Add backend validation:

```sh
npm.cmd run test:api
npm.cmd run test:engine
npm.cmd run test:policy
npm.cmd run test:integration
```

Required test groups:

- reducer parity
- context payload golden tests
- import/export round trip
- local mode adapter tests
- cloud mode adapter tests
- invite gate tests
- OAuth callback/auth hook tests
- policy hard-block fixtures
- consensual adult allowed fixtures
- prompt-injection fixtures
- server turn orchestration integration
- usage ledger accounting
- billing webhook idempotency
- scenario publish/fork/share tests
- data deletion tests

## Rollout Order

Use feature flags:

```text
cloudModeEnabled
cloudGenerationEnabled
scenarioPublishingEnabled
subscriptionsEnabled
policyStrictModeEnabled
workerJobsEnabled
adminConsoleEnabled
```

Recommended rollout:

1. Internal local mode only.
2. Internal cloud save import/export.
3. Internal server context preview.
4. Internal server generation.
5. Invite-only alpha with no public sharing.
6. Invite-only alpha with private sharing.
7. Scenario publishing for trusted users.
8. Subscriptions in test mode.
9. Subscriptions in production mode.
10. Wider invite batches.

## Done Definition

The backend migration is not done when the API exists. It is done when:

- local mode still works
- cloud mode works without browser provider keys
- invite-only account creation is enforced
- generation is entitlement-gated
- hard policy gates run on input/context/output/memory/share/import
- prompt-injection fixtures fail safely
- scenario publishing is revisioned and policy-gated
- adventure sharing is revocable
- subscriptions update through idempotent webhooks
- usage is ledgered and visible
- support/admin can diagnose failed, blocked, or expensive turns
- current JSON import/export remains compatible
