# Database data dictionary

Last verified against the codebase: 2026-07-10.

This document describes the current hosted Neon/Postgres schema and the JSONB
domain records stored by the API. It is a code-grounded dictionary, not a
proposal. The current SQL schema version is **5** (migrations 001-005). The
canonical sources are:

- `apps/api/migrations/*.sql` for physical tables and indexes;
- `apps/api/apiTypes.ts` and `apps/api/dbShape.ts` for JSONB collections;
- `src/types/adventure.ts` for nested Adventure and context shapes;
- `apps/api/dataLifecycle.ts` and `apps/api/postgresDb.ts` for deletion and retention;
- `apps/api/platformSettings.ts`, `apps/api/scenarioSharing.ts`, and
  `apps/api/socialGraph.ts` for polymorphic JSON fields.

## Conventions and classifications

- Timestamps inside JSONB are ISO-8601 strings. Physical Postgres timestamps
  are `timestamptz`.
- `aist_records.id` is the domain id. With `collection`, it is the physical
  primary key. Most JSON objects repeat the same id in `data.id`.
- `profiles` and `passwordCredentials` are exceptions: their physical id is
  `data.userId`. `platformSettings` uses `data.id` (falling back to `data.key`).
- **Owner** means the user whose account deletion removes the record. It is not
  a Postgres foreign key; ownership is enforced by API queries and domain code.
- **Sensitive** includes authentication material, private account data, private
  story content, moderation data, or operational data linkable to a user.
- Token values are never stored directly. Token hashes and password hashes are
  still sensitive authentication material and must not be logged or exposed.
- Adventure persistence removes `modelConfig.apiKey`, provider `sessionId`, and
  any background provider API key before writing. Provider keys remain runtime
  secrets, not database fields.

## Physical Postgres schema

### `schema_migrations`

Migration ledger used by `runSqlMigrations` and readiness checks.

| Column | Type / nullability | Meaning | Sensitive |
|---|---|---|---|
| `version` | `integer`, not null, primary key | Monotonic migration version. | No |
| `name` | `text`, not null | Migration filename stem. | No |
| `applied_at` | `timestamptz`, not null, default `now()` | When the migration committed. | No |

Retention: permanent operational metadata.

### `aist_meta`

Small database metadata document store. The current row has key `metadata` and
value `{schemaVersion, migrations[]}`. Postgres readiness uses
`schema_migrations`; this row also preserves compatibility with the local JSON
database shape.

| Column | Type / nullability | Meaning | Sensitive |
|---|---|---|---|
| `key` | `text`, not null, primary key | Metadata document key. | No |
| `value` | `jsonb`, not null | Metadata value. Current shape contains `schemaVersion:number` and `migrations:{version,name,appliedAt}[]`. | No |
| `updated_at` | `timestamptz`, not null, default `now()` | Last physical update. | No |

Retention: permanent operational metadata.

### `aist_records`

Shared JSONB domain-record table. Collection-specific dictionaries follow.

| Column | Type / nullability | Meaning | Sensitive |
|---|---|---|---|
| `collection` | `text`, not null, primary-key part | One of the names in `dbCollectionKeys`. | No |
| `id` | `text`, not null, primary-key part | Stable domain id within a collection. | Usually pseudonymous |
| `data` | `jsonb`, not null | Collection-specific record. | Varies; frequently sensitive |
| `updated_at` | `timestamptz`, not null, default `now()` | Last database upsert time, distinct from domain timestamps inside `data`. | No |

Retention: collection-specific. Account deletion and scheduled cleanup are
application-managed; there are intentionally no SQL foreign keys or cascades.

### `aist_idempotency`

Deduplicates provider-backed operations. Rows expire 24 hours after claim and
are removed by lifecycle cleanup (and opportunistically before claims).

| Column | Type / nullability | Meaning | Sensitive |
|---|---|---|---|
| `user_id` | `text`, not null, primary-key part | Requesting user. | Pseudonymous |
| `operation` | `text`, not null, primary-key part | Provider operation name. | Operational |
| `idempotency_key` | `text`, not null, primary-key part | Client-supplied deduplication key. | Sensitive request identifier |
| `request_hash` | `text`, not null | Hash of canonical request JSON; prevents key reuse with different input. | Sensitive derived value |
| `state` | `text`, not null | `pending`, `succeeded`, or `failed`. | Operational |
| `response_status` | `integer`, nullable | Cached response status. | Operational |
| `response_body` | `jsonb`, nullable | Cached success body or sanitized failure body. May contain generated output. | Sensitive |
| `created_at` | `timestamptz`, not null, default `now()` | Claim time. | No |
| `updated_at` | `timestamptz`, not null, default `now()` | Last state change. | No |
| `expires_at` | `timestamptz`, not null | Deletion threshold. | No |

### `aist_rate_limits`

Fixed-window counters. `bucket_key` contains route plus hashed IP and hashed
identity, never a raw IP address or email. Expired rows are deleted by cleanup.

| Column | Type / nullability | Meaning | Sensitive |
|---|---|---|---|
| `bucket_key` | `text`, not null, primary-key part | Route and one-way subject hashes. | Sensitive pseudonymous operational data |
| `window_started_at` | `timestamptz`, not null, primary-key part | Window boundary. | No |
| `request_count` | `integer`, not null | Requests consumed in this window. | Operational |
| `expires_at` | `timestamptz`, not null | End of the window and deletion threshold. | No |

### Removed physical table

Migration 002 briefly created `aist_oauth_exchange_codes`; migration 003 drops
it and moves exchange codes to the `oauthExchangeCodes` JSONB collection. It is
not part of the current schema.

## Current indexes

| Index | Target / purpose |
|---|---|
| `aist_records_pkey` | Unique `(collection, id)` lookup. |
| `aist_records_collection_idx` | Collection scans. |
| `aist_sessions_token_hash_idx` | Session resolution by `data.tokenHash`. |
| `aist_users_email_idx` | Unique case-insensitive user email. |
| `aist_adventures_owner_idx` | Adventure ownership lookup on `data.ownerUserId, id`. |
| `aist_scenarios_owner_idx` | Draft/revision ownership lookup on `data.ownerUserId, id`. |
| `aist_oauth_exchange_code_hash_idx` | Unique OAuth exchange-code hash lookup. |
| `aist_restrictions_user_created_idx` | Restriction history by user and creation time. |
| `aist_safety_events_user_status_idx` | Safety events by user, status, and severity. |
| `aist_snapshots_owner_adventure_idx` | Snapshot history by user/adventure/time. |
| `aist_google_identity_subject_idx` | Unique Google subject per provider. |
| `aist_verification_token_hash_idx` | Verification/password-reset hash lookup. |
| `aist_oauth_state_token_hash_idx` | OAuth state hash lookup. |
| `aist_invite_token_hash_idx` | Invite hash lookup. |
| `aist_performance_created_idx` | Performance trace time-order and retention queries. |
| `aist_performance_user_phase_created_idx` | Per-user/source/phase performance investigation. |
| `aist_scenario_likes_user_scenario_idx` | Unique scenario/user like pair. |
| `aist_user_follows_pair_idx` | Unique directed follower/followed pair. |
| `aist_friendships_pair_idx` | Unique undirected user pair using `LEAST`/`GREATEST`. |
| `aist_idempotency_pkey` | Unique `(user_id, operation, idempotency_key)`. |
| `aist_idempotency_expiry_idx` | Idempotency cleanup. |
| `aist_rate_limits_pkey` | Unique `(bucket_key, window_started_at)`. |
| `aist_rate_limits_expiry_idx` | Rate-limit cleanup. |

## `aist_records` collection summary

| Collection | JSON shape | Domain key / owner | Retention | Sensitivity |
|---|---|---|---|---|
| `users` | `BackendUser` | `id`; self | Account lifetime | Email, role, account status |
| `profiles` | `UserProfile` | physical id `userId`; self | Account lifetime | Bio and privacy preferences |
| `authIdentities` | `AuthIdentity` | `id`; `userId` | Account lifetime | OAuth subject and email |
| `passwordCredentials` | `PasswordCredential` | physical id `userId`; self | Account lifetime | Critical credential hashes/salt |
| `inviteLinks` | `InviteLink` | `id`; admin-created | Until disabled/expired or admin cleanup; not currently age-pruned | Token hash and admin note |
| `signupIntents` | `SignupIntent` | `id`; email/invite | Not currently age-pruned; account deletion removes matching email | Email and signup state |
| `sessions` | `SessionRecord` | `id`; `userId` | Expiry/revocation plus 7 days | Session token hash |
| `verificationTokens` | `VerificationToken` | `id`; `userId` | Expiry plus 7 days | Token hash and purpose |
| `oauthStates` | `OAuthStateRecord` | `id`; transient browser flow | Expiry plus 1 day | State token hash and return target |
| `oauthExchangeCodes` | `OAuthExchangeRecord` | `id`; `userId` | Expiry plus 1 day | Exchange-code hash |
| `adventures` | `BackendAdventureRecord` | `id`; `ownerUserId` | Account/adventure lifetime | Private full story and model context |
| `adventureSnapshots` | `AdventureSnapshotRecord` | `id`; `userId` | Max 100 per user/adventure; account/adventure lifetime | Private full story copies |
| `contextBuildEvents` | `ContextBuildEvent` | `id`; `userId` | 30 days | Exact model payload and exclusions |
| `policyDecisions` | `PolicyDecisionRecord` | `id`; optional `userId` | 365 days | Moderation rationale/categories |
| `accountSafetyEvents` | `AccountSafetyEvent` | `id`; `userId` | 365 days | Safety category/severity |
| `accountRestrictions` | `AccountRestriction` | `id`; `userId` | Account lifetime | Moderation/restriction reason |
| `accountStatusHistory` | `AccountStatusHistory` | `id`; `userId` | Account lifetime | Moderation history/reason |
| `scenarioDrafts` | `ScenarioDraft` | `id`; `ownerUserId` | Until owner deletes scenario/account | Draft title/description |
| `scenarioRevisions` | `ScenarioRevision` | `id`; `ownerUserId` | Until owner deletes scenario/account | Draft or public scenario content |
| `scenarioLikes` | `ScenarioLike` | `id`; `userId` | Until unlike, scenario deletion, or account deletion | Social preference |
| `userFollows` | `UserFollow` | `id`; both users participate | Until unfollow or either account deletion | Social graph |
| `friendships` | `Friendship` | `id`; both users participate | Until removal or either account deletion | Social graph and pending requests |
| `shareLinks` | `ShareLink` | `id`; `ownerUserId` | Until disabled, target deletion, or account deletion | Share token hash |
| `usageLogs` | `UsageLog` | `id`; `userId` | 365 days | Per-user model usage/cost metadata |
| `performanceTraces` | `PerformanceTraceRecord` | `id`; optional `userId` | 30 days and max 2,000 rows | Pseudonymous diagnostics; server errors are sanitized and client error text is discarded |
| `adminActions` | `AdminAction` | `id`; optional `adminUserId` | 730 days | Administrator audit trail |
| `platformSettings` | `PlatformSettingsRecord` | `id` / singleton key `platform` | Until replaced | Non-secret platform configuration |

Hosted cleanup runs at startup and every six hours. Local JSON mode applies the
same age rules when lifecycle cleanup runs. The maximum-row limits are separate
from age retention: performance traces retain at most 2,000 rows and snapshots
retain at most 100 rows per adventure.

## Collection field dictionaries

### Identity, authentication, and profile collections

`users` (`BackendUser`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | User id. |
| `email` | string | Normalized login email; sensitive. |
| `displayName` | string | Account display name. |
| `role?` | `user \| admin` | Stored role. Configured admin email reconciliation may override it. |
| `status` | `pending_verification \| active \| disabled` | Account lifecycle state. |
| `emailVerified` | boolean | Verification state. |
| `createdAt`, `updatedAt` | ISO strings | Domain timestamps. |

`profiles` (`UserProfile`)

| Field | Type | Meaning |
|---|---|---|
| `userId` | string | User id and physical record id. |
| `displayName` | string | Public profile name. |
| `bio` | string | User-authored public biography. |
| `socialVisibility?` | object | `{followers:boolean, following:boolean, friends:boolean}`; missing values normalize to visible. |
| `createdAt`, `updatedAt` | ISO strings | Domain timestamps. |

`authIdentities` (`AuthIdentity`): `id`, `userId`, `provider` (`password` or
`google`), `providerSubject`, `email`, `createdAt`. `providerSubject` is the
provider's stable account id and is sensitive.

`passwordCredentials` (`PasswordCredential`): `userId`, `passwordHash`, `salt`,
optional `algorithm` (`scrypt`), `parameterVersion`, `scryptN`, `scryptR`,
`scryptP`, plus `createdAt`, `updatedAt`. Every value except timestamps and
algorithm parameters is critical authentication material. Passwords are never
stored.

`inviteLinks` (`InviteLink`): `id`, `tokenHash`, `createdAt`, optional
`expiresAt`, `maxUses`, `useCount`, optional `createdByUserId`, optional `note`,
optional `disabledAt`.

`signupIntents` (`SignupIntent`): `id`, `inviteId`, `email`, `provider`,
`status` (`pending`, `completed`, `failed`), `createdAt`, optional `completedAt`.

`sessions` (`SessionRecord`): `id`, `userId`, `tokenHash`, `createdAt`,
`expiresAt`, optional `revokedAt`. Hosted sessions send the unhashed token only
in an HttpOnly secure cookie; the database holds only the hash.

`verificationTokens` (`VerificationToken`): `id`, `userId`, `tokenHash`,
`purpose` (`emailVerification` or `passwordReset`), `createdAt`, `expiresAt`,
optional `usedAt`.

`oauthStates` (`OAuthStateRecord`): `id`, fixed `provider:google`, `tokenHash`,
optional `inviteId`, optional `returnTo`, `createdAt`, `expiresAt`, optional
`usedAt`. `returnTo` is URL-like operational data and must not be logged blindly.

`oauthExchangeCodes` (`OAuthExchangeRecord`): `id`, `codeHash`, `userId`,
optional `returnTo`, `createdAt`, `expiresAt`, optional `consumedAt`.

### Story and context collections

`adventures` (`BackendAdventureRecord`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Adventure id and physical record id. |
| `ownerUserId` | string | Account owner. |
| `adventure` | `Adventure` | Full normalized playable save; detailed below. |
| `createdAt`, `updatedAt` | ISO strings | Backend record timestamps. |
| `revision` | number | Optimistic-concurrency revision. |

The nested `Adventure` object contains: `id`, `title`, `openingScene`,
`createdAt`, `updatedAt`, free-form `metadata`, autosave settings
(`autoSaveEnabled`, `autoSaveEveryNTurns`, optional `autoSaveEveryNMinutes`),
`components[]`, `storyCards[]`, `brains[]`, `triggerRules[]`, `rollingSummary`,
optional `sceneState`, complete `messages[]`, `activeState`,
`tokenBudgetSettings`, sanitized `modelConfig`, `semanticEvaluationSettings`,
`memoryAutoApprove`, `memoryDetectionSettings`, and `systemTriggers`.

Important nested shapes:

- `messages[]`: `id`, `role`, `content`, optional `inputMode`, optional token
  `usage`, `createdAt`. This is the private full transcript.
- `components[]`: ids, titles/types/content, Arc Director fields, context
  priority/inclusion flags, state, token/update settings, history, timestamps.
- `storyCards[]`: ids/title/keys/content/type, trigger matching, memory mode,
  compact-memory facts/status, context flags, update settings/history, timestamps.
- `brains[]`: character name/triggers and private evolving character state,
  thoughts, relationships, update controls, context flags, timestamps.
- `triggerRules[]`: condition source/mode/patterns, structured conditions/actions,
  priority/cooldown, timestamps.
- `activeState`: turn number, forced-inclusion list, trigger/evaluation logs,
  memory proposals, pending updates, undo/redo stacks, next-turn note, raw imports,
  state flags, response-length setting, background token totals, challenge flag,
  and last-run turn markers.
- `modelConfig.apiKey` and `modelConfig.sessionId` are runtime-only and removed
  by `sanitizeAdventureForPersistence`.

For every nested field and union value, `src/types/adventure.ts` is canonical.

`adventureSnapshots` (`AdventureSnapshotRecord`): `id`, `adventureId`, `userId`,
`source` (`import`, `turn`, `manualSave`, `restore`), full `adventure`, and
`createdAt`. Snapshots duplicate all sensitive Adventure content.

`contextBuildEvents` (`ContextBuildEvent`): `id`, `userId`, `adventureId`, `gate`
(`preview` or `turn`), `context`, `createdAt`. `context` is a
`ContextBuildResult` containing exact provider `messages[]`, named `sections[]`
and their items/content/token estimates, `totalEstimatedTokens`, excluded items,
build decisions, triggered thread ids, and pending memory proposals. This is
high-sensitivity model-context data even though retention is only 30 days.

### Safety and account-control collections

`policyDecisions` (`PolicyDecisionRecord`): `id`, optional `userId`, optional
`subjectType`, optional `subjectId`, `gate` (`input`, `context`, `output`,
`memoryWrite`, `import`, `share`, `profile`), `action` (`allow`, `review_only`,
`redact`, `quarantine`, `block`), `matchedRuleIds[]`, `categories[]`, numeric
`severity`, `manualReviewRequired`, `rationale`, and `createdAt`.

`accountSafetyEvents` (`AccountSafetyEvent`): `id`, `userId`,
`policyDecisionId`, `category`, numeric `severity`, `gate`, `status` (`open`,
`reviewed`, `dismissed`), `createdAt`.

`accountRestrictions` (`AccountRestriction`): `id`, `userId`, `level` (`none`,
`watched`, `restricted`, `generation_hold`, `banned`), `reason`,
`sharingDisabled`, `generationDisabled`, optional `contextTokenCap`, `createdAt`,
optional `reviewedAt`.

`accountStatusHistory` (`AccountStatusHistory`): `id`, `userId`, `fromLevel`,
`toLevel`, `reason`, `createdAt`.

### Scenario and social collections

`scenarioDrafts` (`ScenarioDraft`): `id`, `ownerUserId`, `title`, `description`,
optional `sourceAdventureId`, `createdAt`, `updatedAt`.

`scenarioRevisions` (`ScenarioRevision`): `id`, `scenarioId`, `ownerUserId`,
integer `version`, `title`, `description`, `content`, `status` (`draft`,
`published`, `quarantined`), `createdAt`, optional `publishedAt`.

`content` is accepted as JSON but playable revisions are interpreted as a
scenario setup object. Recognized fields are `openingScene`, `metadata`, optional
`thumbnailImage`, `components[]`, `storyCards[]`, `brains[]`, and
`triggerRules[]`. Unrecognized fields remain stored. Published content is public
product content; drafts are private until publication.

`scenarioLikes` (`ScenarioLike`): `id`, `scenarioId`, `userId`, `createdAt`.
One user/scenario pair is intended to be unique.

`userFollows` (`UserFollow`): `id`, `followerUserId`, `followedUserId`,
`createdAt`. Self-follow is rejected; one directed pair is intended to be unique.

`friendships` (`Friendship`): `id`, `requesterUserId`, `addresseeUserId`,
`status` (`pending` or `accepted`), `createdAt`, `updatedAt`, optional
`acceptedAt`. The pair is undirected for uniqueness and removal even though the
request direction is retained.

`shareLinks` (`ShareLink`): `id`, `ownerUserId`, `targetType`
(`scenarioRevision` or `adventure`), `targetId`, `tokenHash`, optional
`publicSlug`, `createdAt`, optional `disabledAt`. The share token itself is never
stored.

### Usage, performance, audit, and configuration collections

`usageLogs` (`UsageLog`): `id`, `userId`, `adventureId`, `providerName`, `model`,
optional `usage`, optional `durationMs`, optional `traceId`, `createdAt`. `usage`
contains `promptTokens`, `completionTokens`, `totalTokens`, optional
`cacheReadTokens`, optional `cacheCreationTokens`. No prompt or response text is
stored in this collection.

`performanceTraces` (`PerformanceTraceRecord`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Trace-event record id. |
| `traceId` | string | Correlation id shared across client/server/database/model phases. |
| `parentTraceId?` | string | Optional parent correlation id. |
| `source` | enum | `device`, `server`, `database`, `ai`, `policy`, or `sync`. |
| `phase` | string | Controlled operation phase. Client ingest accepts only `http_round_trip`, `page_load`, `ui_navigation`, `largest_contentful_paint`, `interaction_latency`, or `long_task_window`; server-owned traces also use provider/policy/database/save phases. |
| `route?`, `method?` | string | Client API paths are converted to allowlisted templates such as `/adventures/:adventureId/turn`; UI routes and destinations use a fixed allowlist. Client methods are limited to the known HTTP verbs or `UI`. Story titles, ids, query strings, and arbitrary clicked text are not stored in these fields. |
| `userId?`, `adventureId?` | string | Pseudonymous subject ids where applicable. Client-submitted `userId` is ignored; the server supplies it from the authenticated session. |
| `providerName?`, `model?` | string | Provider/model attribution. |
| `status` | `ok \| error` | Phase result. |
| `statusCode?` | number | HTTP/provider status when applicable. |
| `durationMs` | number | Rounded nonnegative elapsed milliseconds. |
| `requestBytes?`, `responseBytes?` | number | Payload sizes, not payload content. |
| token fields | number | Optional `promptTokens`, `completionTokens`, `totalTokens`, `cacheReadTokens`, `cacheCreationTokens`. |
| `throttleWaitMs?`, `retryCount?` | number | Provider queue/retry evidence. |
| `errorCategory?` | string | Controlled category. Client ingest accepts only `network`, `aborted`, `auth`, `server`, `client`, or `unknown`; server-owned traces may use additional provider/policy categories. |
| `errorMessage?` | string | Present only on server-owned traces, where the capped message is sanitized and secrets, database URLs, and SQL are redacted. Client-provided error text is discarded rather than persisted. |
| `metadata?` | primitive map | Fixed server-allowlisted keys and bounded values on client ingest. Enumerated fields such as connection class, visibility, navigation type/destination, app version, and `causeHint` also require known values; arbitrary labels, keys, and story content are discarded. |
| `createdAt` | ISO string | Event time. |

Client telemetry requires authentication, is capped at 16 KB per request, has a
separate 60-request/minute/user rate bucket, and the server owns `userId`. An
unknown client phase is rejected; optional labels that are not on the relevant
allowlist are omitted before persistence.
Administrative Operations shows p50/p95, errors, slow traces, a coarse likely
bottleneck, and individual trace ids. Cause hints are diagnostic hypotheses;
correlated phase timings are the evidence.

`adminActions` (`AdminAction`): `id`, optional `adminUserId`, `action`,
`targetType`, `targetId`, optional `reason`, `createdAt`. This is a sensitive
audit trail and intentionally outlives ordinary diagnostics.

`platformSettings` (`PlatformSettingsRecord`): `id`, fixed key `platform`,
`value`, `updatedAt`, optional `updatedByUserId`. `value` contains non-secret:

- `provider`: `name`, `baseUrl`, `model`, `temperature`, `maxOutputTokens`,
  optional `topP`, `presencePenalty`, `frequencyPenalty`, `promptCaching`,
  `openRouterProviderSort`, `openRouterDataCollection`;
- `background`: semantic-evaluation and memory-detection enable/frequency fields;
- `features`: `scenarioPublishingEnabled`, `developerToolsVisibleToAdmins`;
- optional update attribution timestamps/user id.

Provider API keys are deliberately absent.

## Ownership and deletion notes

- Account deletion removes the user's identity/profile/auth rows; owned
  adventures, snapshots, context, safety/restriction history, scenarios and
  dependent likes/share links; usage/performance rows; and every follow or
  friendship involving the user.
- Invite links created by a deleted administrator and historical admin audit
  actions are not currently rewritten; their user ids may remain pseudonymous
  until normal/admin retention handling.
- Scenario deletion removes its revisions, scenario likes, and revision share
  links. Adventure deletion removes its snapshots.
- Physical referential integrity is application-enforced. Direct SQL repairs
  must update all dependent collections deliberately.

## Safe operational queries

These examples return aggregates or identifiers, never story/context JSON.

```sql
-- Slow phases by p95 in the retained telemetry window.
SELECT
  data->>'source' AS source,
  data->>'phase' AS phase,
  count(*) AS traces,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (data->>'durationMs')::numeric
  ) AS p95_ms,
  count(*) FILTER (WHERE data->>'status' = 'error') AS errors
FROM aist_records
WHERE collection = 'performanceTraces'
  AND (data->>'createdAt')::timestamptz >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY p95_ms DESC;

-- Follow one request through client, server, database, policy, and model phases.
SELECT
  data->>'createdAt' AS created_at,
  data->>'source' AS source,
  data->>'phase' AS phase,
  data->>'durationMs' AS duration_ms,
  data->>'status' AS status,
  data->>'errorCategory' AS error_category
FROM aist_records
WHERE collection = 'performanceTraces'
  AND data->>'traceId' = $1
ORDER BY data->>'createdAt', id;
```

Do not select `data` wholesale from `adventures`, `adventureSnapshots`, or
`contextBuildEvents` for routine diagnostics. Those collections contain private
story text and exact model context.
