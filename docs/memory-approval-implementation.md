# Adventure-only approval and retired memory compatibility


Auto-approval belongs to each adventure. New adventures start with all seven switches OFF: Plot Essentials, Active Pressure, Current Arc, Arc Proposals, Character Self, Story Cards — Lore, and Story Cards — Everything Else. The permanent panel appears at the top of Memory Suggestions, including when its queue is empty. Settings has no approval controls, and global localStorage approval properties are discarded.

The shared policy reads only `adventure.memoryAutoApprove`. Existing cards use their stored type. Lore uses `loreStoryCard`; character, location, legacy plot, and custom use `otherStoryCard`. Unknown new card types wait for classification. Missing-Brain card fallbacks use the card category. Existing pending proposals are never replayed when a switch changes. Evidence, duplicate, destination, protection, chronology, and companion-proposal checks remain in the reducer pipeline.

Migration preserves boolean active settings. Lore falls back to the old broad Story Card preference only when its own preference is absent. Both split Character and Other preferences must be true to enable the combined category; an isolated split preference is ambiguous and leaves it OFF. A saved broad Story Card preference covers all cards. Invalid and missing preferences are false.

Older adventure JSON files containing Rolling Summary or Scene State are supported for import. These fields are ignored and are not saved in the current format.

## Implementation

| File | Changed functions / contract |
| --- | --- |
| `src/types/adventure.ts` | Seven-category `MemoryAutoApproveSettings`; remove retired adventure, action, context, budget, scheduling and proposal members. |
| `src/state/defaults.ts` | `defaultMemoryAutoApproveSettings`, `normalizeMemoryAutoApproveSettings`, `createDefaultAdventure`, `normalizeAdventure`, `sanitizeAdventureForPersistence`, active token presets and default Narration Rules. |
| `src/state/legacyAdventureInput.ts` | Input-only `LegacyAdventureInput`, `stripRetiredAdventureFields`, token-setting and queued-action cleaning. |
| `src/memory/approvalPolicy.ts` | `storyCardApprovalCategory`, `getApprovalCategory`, `shouldAutoApprove`. |
| `src/state/adventureReducer.ts` | `touchAdventure`, proposal sanitization/routing/application, companion approval, insertion/merge/scan/final automatic approval; remove retired actions and reset behavior. Preserve story-clock reconciliation. |
| `src/pages/MemoryInboxPage.tsx` | Permanent seven-switch panel; `setAutoApprove`; active proposal destinations. |
| `src/pages/pageTypes.ts`, `src/App.tsx`, `src/hooks/useLocalStorage.ts`, `src/pages/SettingsPage.tsx` | Normalize global settings without approval preferences; remove duplicate/global approval and retired feature controls; preserve background provider configuration. |
| `src/utils/json.ts`, `src/sync/githubSaves.ts`, `src/sync/githubSync.ts` | Import/export and GitHub saves use the shared sanitizer. IndexedDB and copy paths already call it. |
| `src/triggers/semanticEngine.ts`, `src/memory/onePassMemory.ts` | Generated Brain changes become proposals and use the same approval policy, preserving append/replace mode. No retired generation. |
| `src/memory/brainAudit.ts`, `src/memory/componentAudit.ts`, `src/memory/storyCardAudit.ts` | Remove retired feature text from all provider prompts. |
| `src/pages/ContextPreviewPage.tsx`, `src/pages/PlayPage.tsx`, `src/pages/TriggersPage.tsx` | Remove retired context labels, editing/truncation behavior and trigger references. |
| `src/state/rollingSummary.ts`, `src/state/rollingSummary.test.ts`, `src/pages/SummaryPage.tsx` | Deleted retired modules and feature-only tests after caller audit. |

## Validation and deployment

Production frontend verified before changes: `press-lab/AI-Story-Teller-Pages`, `main`, revision `862d7145258c8c5c29d55c67da81da19cfa1e116`, served at `https://press-lab.github.io/AI-Story-Teller-Pages/`. This is the browser-local app and has no hosted backend runtime. The separate hosted repository is `press-lab/AI-Story-Teller`; its documented backend branch is `backend-local-implementation`. Its documented public API returned Cloudflare 1033 during this work. Deployment verification results are recorded after validation; source changes alone are not evidence of a live release.

## Verified hosted validation

- Full repository suite: 73 files passed, 1 skipped; 604 tests passed and 7 optional Postgres tests skipped.
- The separate real Postgres suite then passed all 7 tests against an isolated localhost database.
- Frontend and API TypeScript/builds passed.
- Frontend production smoke passed.
- Compiled hosted API smoke passed, including authenticated legacy import, direct save, current export and account export.
- Render deployment parity passed against disposable Postgres, including pruned production dependencies and migration failure gates.
- Production Neon was not accessed and no paid providers were called.

## Final hosted validation

74 files passed; all 611 tests passed with real localhost Postgres enabled. Frontend build, API build, compiled hosted HTTP smoke and frontend production smoke passed. Deployment parity passed, including pruned dependencies, migrations, readiness and failure gates.

## Hosted persistence functions

`apps/api/adventureStore.ts`: `getOwnedAdventureRecord` normalizes old records without rewriting them; existing `saveBackendAdventure` and `importAdventureAsCopy` use the shared sanitizer. `apps/api/server.ts`: adventure GET, adventure export and account export normalize or sanitize all responses. `src/runtime/adventureStore.ts`: `rememberRevision` normalizes loaded data and backend saves sanitize request bodies. `src/db/accountAdventureBackupDb.ts` already sanitizes account backups; dedicated regression coverage verifies raw old inputs.

## Exact changed files relative to hosted deployment source

- `AGENTS.md`
- `FEATURES.md`
- `README.md`
- `apps/api/adventureStore.ts`
- `apps/api/legacyAdventure.test.ts`
- `apps/api/memoryApproval.test.ts`
- `apps/api/server.ts`
- `docs/advanced-settings.md`
- `docs/memory-approval-implementation.md`
- `scripts/api-production-smoke.mjs`
- `src/App.tsx`
- `src/contextBuilder/contextBuilder.test.ts`
- `src/db/accountAdventureBackupDb.test.ts`
- `src/db/adventureDb.test.ts`
- `src/dev/arcaneAfterRocketAdventure.ts`
- `src/dev/developmentAdventure.ts`
- `src/dev/dispatchAdventure.ts`
- `src/dev/rookeryAdventure.ts`
- `src/hooks/useLocalStorage.ts`
- `src/live/groqProvider.live.ts`
- `src/memory/applyAIMemoryUpdate.test.ts`
- `src/memory/applyAIMemoryUpdate.ts`
- `src/memory/approvalPolicy.test.ts`
- `src/memory/approvalPolicy.ts`
- `src/memory/approvalWrites.integration.test.ts`
- `src/memory/brainAudit.ts`
- `src/memory/classificationPolicy.ts`
- `src/memory/componentAudit.ts`
- `src/memory/memoryArchitecture.integration.test.ts`
- `src/memory/resolveMemoryTarget.ts`
- `src/memory/storyCardAudit.ts`
- `src/pages/ContextPreviewPage.tsx`
- `src/pages/HelpPage.tsx`
- `src/pages/MemoryApproval.ui.test.tsx`
- `src/pages/MemoryInboxPage.tsx`
- `src/pages/PlayPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/SettingsPage.ui.test.tsx`
- `src/pages/SideMenuPages.ui.test.tsx`
- `src/pages/SummaryPage.tsx`
- `src/pages/pageTypes.ts`
- `src/runtime/adventureStore.ts`
- `src/state/adventureReducer.test.ts`
- `src/state/adventureReducer.ts`
- `src/state/defaults.ts`
- `src/state/legacyAdventureInput.ts`
- `src/state/rollingSummary.test.ts`
- `src/state/rollingSummary.ts`
- `src/state/turnPipeline.smoke.test.ts`
- `src/state/turnPipeline.ts`
- `src/sync/githubSaves.ts`
- `src/sync/githubSync.ts`
- `src/test/goldenAdventure.ts`
- `src/test/legacyAdventure.ts`
- `src/test/memoryApproval.ts`
- `src/triggers/semanticEngine.test.ts`
- `src/triggers/semanticEngine.ts`
- `src/triggers/triggerEngine.ts`
- `src/types/adventure.ts`
- `src/utils/json.ts`
- `src/utils/legacyAdventure.test.ts`
