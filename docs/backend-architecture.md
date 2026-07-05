# Backend Architecture

This is the target architecture for adding accounts, invite-gated signup, Google and Apple login, scenario/adventure sharing, subscriptions, deterministic content policy, and prompt-injection defenses to AI Story Teller.

The core product rule remains unchanged: the story engine is the product. The backend exists to make the existing engine durable, account-backed, billable, shareable, and enforceable without turning the model context into hidden server magic.

## Current App To Preserve

AI Story Teller currently works as a browser-only local app:

- React, TypeScript, Vite.
- IndexedDB adventure persistence through `src/db/adventureDb.ts`.
- Small runtime settings and BYO provider API key in localStorage.
- Browser-to-provider generation through `src/providers/openAICompatible.ts`.
- Optional GitHub saves and GitHub sync.
- Reducer-driven adventure mutation through `adventureReducer`.
- Deterministic context assembly through `buildContext`.
- Inspectable Context Preview that must match the provider payload.

Do not break this setup while the backend is added. Local play remains a supported mode during migration. Cloud mode is additive until it is proven stable.

## Architecture North Star

Production AI Story Teller should become a server-authoritative story platform:

- The browser remains the rich editor and play UI.
- The backend owns identity, invite gating, persistence, provider credentials, model routing, usage, billing, policy gates, public sharing, and audit logs.
- The current deterministic engine is extracted into a shared TypeScript package used by both browser and backend.
- Server mode and local mode coexist behind explicit runtime adapters.
- Public sharing and subscriptions are built on explicit domain models, not flags sprinkled through the UI.

## Recommended Stack

- Web: existing React/Vite app.
- API: TypeScript Node service using Fastify or Hono.
- Shared engine: workspace package containing reducer, types, defaults, context builder, tokenizer, trigger logic, memory boundaries, import/export sanitizers, and response guard.
- Database: Postgres.
- Queue/cache/rate limit: Redis plus BullMQ.
- Object storage: S3-compatible storage for thumbnails, exports, scenario assets, and support replay bundles.
- Auth: managed auth with Google and Apple OAuth, plus a server-side invite check. Supabase Auth, Clerk, Auth0, or a custom OAuth stack can work. Supabase is attractive because it pairs Postgres, OAuth providers, and auth hooks, but the app domain must still live in our backend.
- Billing: Stripe Billing by default, with our own entitlement and usage ledger.
- Observability: structured logs, model-call events, policy decision records, metrics, and error tracking.

Start as a modular monolith. Split services only after one module has a clear independent scaling or release need.

## Hard Boundary: Local Mode vs Cloud Mode

Introduce an explicit runtime mode, not a hidden half-migration.

```ts
type RuntimeMode = "local" | "cloud";
```

Local mode:

- Uses IndexedDB for saves.
- Uses localStorage for BYO provider settings.
- Calls OpenAI-compatible providers from the browser.
- Keeps current GitHub save and sync features.
- Requires no account.
- Is allowed in development and during migration.

Cloud mode:

- Requires authenticated account.
- Stores adventures in Postgres.
- Calls model providers only through the backend.
- Uses server-owned provider credentials.
- Enforces invite/account/subscription/policy/usage server-side.
- Uses server-side context preview and turn execution.
- Treats GitHub saves as import/export compatibility, not production persistence.

The frontend should route persistence and generation through interfaces:

```ts
interface AdventureStore {
  list(): Promise<AdventureSummary[]>;
  get(id: string): Promise<Adventure | undefined>;
  save(adventure: Adventure): Promise<void>;
  delete(id: string): Promise<void>;
}

interface TurnRunner {
  runTurn(adventureId: string, input: string): Promise<TurnResult>;
}
```

Local adapters use the current code. Cloud adapters call the backend. This keeps the current workflow alive while backend features are built.

## Shared Story Engine

The backend must reuse the real story engine rather than reimplementing behavior.

Package contents:

- `src/types`
- `src/state`
- `src/contextBuilder`
- `src/triggers`
- `src/memory`
- `src/tokenizer`
- `src/importers`
- `src/utils/json`
- response sanitization and control-tag stripping

Invariants:

- All adventure changes still go through reducer actions.
- Context sections remain named and inspectable.
- Context Preview is produced from the same build result as the provider payload.
- AI-generated memory writes stay inside approved mutation paths.
- Pending proposals never become hidden prompt context.
- Arc Director break instructions remain gated until the deterministic phase reaches `break`.

## Auth And Invite-Gated Signup

Account creation is invitation-only.

Domain tables:

```text
users
auth_identities
invite_links
signup_intents
profiles
author_profiles
```

`invite_links`:

- `id`
- `token_hash`
- `created_by_user_id`
- `target_email`, optional
- `max_uses`
- `used_count`
- `expires_at`
- `revoked_at`
- `created_at`

Flow:

1. Admin or trusted user creates an invite.
2. Backend generates a high-entropy random token.
3. Only the token hash is stored.
4. User opens `/join?invite=...`.
5. Backend validates the invite and creates a short-lived signup intent.
6. User signs in with Google or Apple.
7. Auth callback or auth hook verifies the signup intent before account activation.
8. Backend marks invite use transactionally and creates user, default profile, author profile, and starter entitlements.

Do not trust email alone for invite redemption. Apple private relay and provider-specific identity behavior make email an unreliable primary binding. Bind account creation to the invite redemption session plus provider identity.

Existing signed-in users can be invited to features or private betas without creating another account.

## Adventures

An adventure is a private mutable save.

Production persistence should keep the current serialized adventure object as the canonical snapshot while adding normalized projections for querying, support, and sharing.

Core tables:

- `adventures`
- `adventure_snapshots`
- `adventure_events`
- `messages`
- `components`
- `story_cards`
- `brains`
- `memory_proposals`

Rules:

- `adventures.latest_snapshot_id` points at the current full JSON snapshot.
- Writes include a base version to prevent silent overwrite.
- Reducer events are logged with action type, actor, before version, after version, and payload hash.
- Runtime provider secrets are never stored in adventure JSON.
- Local JSON import remains supported.
- GitHub save import remains supported.

## Scenarios

A scenario is a reusable template, not a live save.

Do not publish full private adventures by accident. Public scenario publishing must create an explicit scenario revision.

Core tables:

- `scenarios`
- `scenario_revisions`
- `scenario_assets`
- `scenario_publications`
- `scenario_forks`
- `scenario_reports`

Scenario revision contents:

- title
- summary
- tags
- visibility
- opening scene
- components
- story cards
- optional brains intentionally included by author
- author profile
- thumbnail asset
- content policy decision
- source adventure id, if created from an adventure

Publishing rules:

- Public scenario revisions are immutable.
- Editing a public scenario creates a new revision.
- Public publish runs import/share policy gates.
- Private/unlisted share links are revocable.
- Forking copies a scenario revision into a user's own adventure or draft scenario.
- Adventure transcript and private runtime memory are excluded unless the author explicitly exports them into the scenario package.

## Adventure Sharing

Adventure sharing is separate from scenario publishing.

Initial sharing modes:

- Private snapshot link.
- Unlisted view-only link.
- Copy/fork into my account.
- Revocable share token.

Avoid live collaboration in the first backend version. It requires permission scopes, conflict semantics, moderation, and real-time state management that would distract from account-backed generation and scenario publishing.

## Subscriptions And Entitlements

Subscriptions control access to expensive and advanced features. They are not just payment state.

Domain tables:

- `plans`
- `subscriptions`
- `entitlement_grants`
- `usage_ledger`
- `model_call_events`
- `billing_webhook_events`

Plans should control:

- max cloud adventures
- max cloud saves or snapshots
- max context tokens
- allowed model tiers
- monthly included credits
- background memory jobs
- advanced context tools
- scenario publishing
- priority queue
- support tier

Every generation endpoint checks effective entitlements before provider calls.

Usage accounting is append-only:

- `story_turn`
- `semantic_eval`
- `memory_detection`
- `memory_cycle`
- `audit`
- `generation_button`
- `import_processing`
- `thumbnail_generation`

Internal credits should be separate from provider cost. Provider cost is operational accounting. Internal credits are product entitlement accounting.

## Deterministic Content Policy

The product may allow consensual adult content when enabled by the user profile. The global safety floor cannot be disabled.

Hard-block categories:

- sexual content involving minors or minor-coded participants
- sexual exploitation, trafficking, grooming, or coercion
- non-consensual sexual content or sexualized violence
- sexual content involving animals
- sexual content involving corpses or unconscious/non-participating people
- eroticized torture, cruelty, mutilation, or suffering
- real-person sexual content without consent
- illegal sexual content by jurisdiction or provider contract
- instructions that enable abuse, exploitation, evasion, or harm
- doxxing/private-data exposure
- self-harm instruction or encouragement
- malicious cyber instructions
- extremist recruitment or operational support

Allowed by profile, subject to the global floor:

- consensual adult romance
- consensual adult sexual content
- non-graphic adult flirting or innuendo
- fictional violence within user profile limits

The policy engine is deterministic:

- Rules are versioned.
- Decisions are structured.
- Same text plus same metadata plus same ruleset produces the same decision.
- LLM/ML classifiers may provide labels, but rules decide what those labels mean.
- Policy decisions are logged without requiring long-term raw text retention.

Policy gates:

- input gate
- context gate
- output gate
- memory-write gate
- import gate
- share/publish gate
- profile gate

The context gate matters because unsafe material can enter from Story Cards, Brains, Plot Essentials, imported scenarios, old transcript, or memory proposals.

## Prompt-Injection Defense

Prompt injection is a product and architecture issue, not just a prompt wording issue.

Trust levels:

1. System instructions generated by the app.
2. Server policy and entitlement instructions.
3. User-authored AI Instructions and Author's Note.
4. Current user turn.
5. Adventure content: components, Story Cards, Brains, summaries, imports.
6. Public scenario text and shared adventure text.
7. Model output from previous turns.

Rules:

- Untrusted content is always data, never instructions.
- Imported/public/shared scenario text is untrusted until inspected and accepted.
- Previous model output is untrusted for instruction purposes.
- Story content cannot override system, policy, billing, provider, or tool rules.
- Context sections carry provenance and trust metadata.
- Prompt-injection attempts are logged as policy/security decisions.
- Backend routes must never execute instructions found inside adventure text, scenario text, imports, or model output.

Required defenses:

- sectioned context assembly with explicit labels
- instruction hierarchy in the system shell
- quoted or delimited untrusted content blocks
- provenance metadata on context items
- context policy scan before provider call
- output scan before persistence
- memory-write scan before durable memory updates
- share/import scan before public publishing
- provider/tool credentials unavailable to the model
- no hidden tool execution from model prose

The existing "no opaque mega-buckets" rule is part of the injection defense. If each context item is named, typed, and inspectable, malicious content has fewer places to hide.

## Production Turn Flow

Cloud turn execution:

1. Authenticate request.
2. Load user, profile, subscription, and adventure.
3. Check invite/account status and generation entitlement.
4. Validate input shape and size.
5. Run input policy gate.
6. Apply reducer action for the user message.
7. Build context server-side.
8. Run prompt-injection and content policy context gates.
9. Select model/provider through server routing.
10. Call provider with server-owned credentials.
11. Parse provider response.
12. Strip control tags.
13. Run output policy gate.
14. If blocked, persist a blocked-turn event and return a neutral response.
15. If allowed, apply assistant message through the reducer.
16. Consume next-turn note and advance turn state.
17. Persist snapshot and normalized events transactionally.
18. Record model usage and cost estimate.
19. Append usage ledger entries.
20. Enqueue background semantic and memory jobs.
21. Return assistant text, usage summary, policy-visible status, and updated adventure version.

## API Surface

Representative endpoints:

```text
GET  /auth/session
POST /auth/logout
GET  /invites/:token/preview
POST /invites/:token/accept
POST /admin/invites

GET  /adventures
POST /adventures/import
POST /adventures
GET  /adventures/:id
PATCH /adventures/:id
DELETE /adventures/:id
POST /adventures/:id/turn
GET  /adventures/:id/context-preview

GET  /scenarios
POST /scenarios
GET  /scenarios/:id
POST /scenarios/:id/revisions
POST /scenarios/:id/publish
POST /scenario-revisions/:id/fork
POST /scenario-revisions/:id/report

GET  /billing/plan
GET  /billing/usage
POST /billing/checkout-session
POST /billing/customer-portal
POST /billing/webhook

GET  /admin/users/:id
GET  /admin/adventures/:id/diagnostics
GET  /admin/model-calls/:id
GET  /admin/policy-decisions
POST /admin/users/:id/hold
POST /admin/users/:id/credit
```

## Migration Strategy

Migration must be boring and reversible.

Phase 1:

- Extract shared engine package.
- Keep local mode as default.
- Add adapter interfaces.
- Prove current tests still pass.

Phase 2:

- Add backend skeleton, auth, invites, and cloud account shell.
- Do not move generation yet.
- Add import/export to cloud adventures.

Phase 3:

- Add cloud adventure CRUD and server context preview.
- Keep local adventures untouched.
- Add "copy local adventure to cloud" instead of automatic migration.

Phase 4:

- Add server-side turn execution behind a cloud-mode toggle.
- Compare server context payload to local context payload with golden tests.

Phase 5:

- Add deterministic policy gates and prompt-injection gates.
- Block public sharing until share policy passes.

Phase 6:

- Add subscriptions and usage enforcement.
- Enforce model tier and context limits server-side.

Phase 7:

- Add scenario publishing, forks, and share links.
- Keep publishing opt-in and revisioned.

Phase 8:

- Move background memory/audit jobs to workers.
- Add admin/support console.

## Non-Negotiables

- Current local play must keep working while cloud mode is built.
- No backend feature may bypass reducer-driven mutation.
- No context surface may become an opaque hidden prompt bucket.
- No public sharing before deterministic share policy exists.
- No subscription enforcement in the browser only.
- No provider keys in browser storage for production cloud mode.
- No account creation without a valid invite until the product owner intentionally disables invite gating.
- No AI-generated memory write without memory-write policy.
- No imported or shared text treated as trusted instructions.
