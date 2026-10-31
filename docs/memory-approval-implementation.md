# Memory approval implementation

## Verified target

- Repository: `press-lab/AI-Story-Teller` (`C:/Users/sethp/Documents/GitHub/AI Story Teller`).
- Branch: `main`; starting HEAD: `e39e079c0d12407ab0ada7f115e2ef69a74c5085`.
- `git pull --ff-only origin main` reported already up to date before editing.
- Starting tracked working tree was clean. Four unrelated untracked paths were preserved: `.codex-pages-worktree/`, `.user_entered_tasks.md`, `docs/.User_saved_database-data-dictionary.md`, and `docs/ui-ux-audit-2026-07-11/live-4bd5a6b/`.
- The sibling Pages implementation and synchronized save repository were not changed.

## Behavior

All generated memory writes now enter `ADD_MEMORY_PROPOSAL`. One central policy maps the actual destination to one category toggle. ON applies valid changes; OFF keeps them pending. Detection cadence is independent. The retired global review field is ignored and removed during persisted-settings normalization.

Character, Lore, and Other Story Cards have independent approval categories. Existing cards always retain their stored type. New cards with no valid subtype remain pending and require a type before approval. Static/living/historical memory modes retain their existing behavior.

Brain proposals preserve their explicit append/replace operation; old proposals retain append behavior. Inline thoughts use Character Self approval. Missing-Brain fallbacks, generated companion card notes, replaced Brain/Plot Essentials history, and previous-arc history use their own actual Story Card categories. A Brain toggle cannot authorize a card write. Context protection retains its existing budget semantics and does not become another approval override.

Automatic and manual approval share sanitization and application. Failed/missing-target, malformed, unchanged, or duplicate append operations cannot be recorded as successful approvals. Fresh content for a target is allowed even if another suggestion for it is pending or dismissed. Existing pending suggestions are never replayed when settings change. Successful Active Pressure suggestions are recorded as approved history rather than silently removed.

Legacy `storyCard` preferences migrate independently with `newCategory ?? old.storyCard ?? false`. Other choices are preserved; legacy momentum stays disabled. Global localStorage preferences migrate without overwriting adventure choices or removing local background-provider credentials.

## Changed files and functions

| File | Functions or definitions | Change and reason |
| --- | --- | --- |
| `src/memory/approvalPolicy.ts` | `ApprovalCategory`, `storyCardApprovalCategory`, `getApprovalCategory`, `shouldAutoApprove` | New sole category decision, using stored destination types and actual missing-Brain fallback categories. |
| `src/types/adventure.ts` | `SemanticEvaluationSettings`, `MemoryAutoApproveSettings`, `MemoryProposal` | Retire the global decision; split card settings; carry explicit Brain mode. |
| `src/state/defaults.ts` | approval/semantic defaults, `normalizeMemoryAutoApproveSettings`, `persistedSemanticEvaluationSettings`, `normalizeAdventure` | Preserve old preferences while migrating three card categories and dropping the retired override. |
| `src/state/adventureReducer.ts` | `containsMemoryContent`, `sanitizeProposal`, `routedProposal`, `outgoingPlotEssentialsProposalsForReplacement`, `outgoingBrainFieldProposalsForReplacement`, `applyApprovedMemoryProposal`, `outgoingMemoryProposals`, `memoryWriteChanged`, `applyCompanionMemoryProposals`; `ADD_MEMORY_PROPOSAL`, `APPROVE_MEMORY_PROPOSAL`, `SET_MEMORY_AUTO_APPROVE` cases | Central policy on every approval path, actual destination types, shared validation/application, explicit Brain modes, independent companion approval, content-aware deduplication, and atomic success recording. |
| `src/triggers/semanticEngine.ts` | `makeProposal`, `generatedActionsFor`, `runManualPlotEssentialsUpdate`, `runManualStoryCardsUpdate`, `runStoryCardAIBuilder`, `runMemoryReconcile`, `runRememberThis`, `runManualPEComponentUpdate`, `runMemoryCycle` | Generate proposals consistently, remove force-propose/global bypasses and pending-target generation suppression, preserve Brain modes/condensation and companion notes, carry validated/stored card types, reject forbidden component targets. |
| `src/state/turnPipeline.ts` | `applyProviderResponse` | Inline thoughts become Brain proposals; inline card proposals carry a subtype. |
| `src/memory/applyAIMemoryUpdate.ts` | `proposalAction`, `applyAIMemoryUpdate` | The existing AI mutation boundary now emits proposals instead of direct write actions. Its result metadata describes generated actions; the reducer decides application. |
| `src/memory/classificationPolicy.ts` | classification input/output types, `matchingStoryCard`, `classifyMemory` | Carry stored card types and explicit types for deterministic new-card classifications. |
| `src/memory/resolveMemoryTarget.ts` | target draft/resolution types, `resolveMemoryTarget` | Preserve the actual card subtype through routing. |
| `src/pages/MemoryInboxPage.tsx` | `MemoryInboxPage`, `createProposal`, `setAutoApprove`, `ProposalCard` | Single nine-category approval menu; accurate stored subtype display; existing card types cannot be changed by a suggestion. |
| `src/pages/SettingsPage.tsx` | `SettingsPage` | Remove global review and duplicate approval UI; retain detection controls and link users to Memory Suggestions. |
| `src/pages/pageTypes.ts` | `GlobalAdventureSettings` defaults, `normalizeGlobalAdventureSettings` | Migrate local global defaults without changing adventure preferences or provider credentials. |
| `src/hooks/useLocalStorage.ts` | `useLocalStorage` | Optional initialization normalizer for persisted global story settings. Existing callers retain their behavior. |
| `src/App.tsx` | `App` global-settings hook initialization | Apply the global approval preference migration at load. |
| `src/test/memoryApproval.ts` | `approvalCategories`, `approvalAdventure`, `approvalProposal`, `memoryData`, `existingApprovalCard` | Shared explicit category fixtures for browser/reducer/hosted parity tests. |
| `src/test/goldenAdventure.ts` | `makeMemoryProposal` | Explicit valid card subtype and Brain mode in legacy test fixtures. |
| `src/memory/approvalPolicy.test.ts` | category and migration suites | Every category ON/OFF; stored/unknown subtype; fallback; toggle changes; pending preservation; modes; duplicates; invalid targets; save migration. |
| `src/memory/approvalWrites.integration.test.ts` | AI write-path suite | Manual tools, semantic triggers, Remember This, builders, reconciliation, inline thoughts, context exclusion, and independently approved history/companion notes. |
| `apps/api/memoryApproval.test.ts` | hosted/browser parity suite | Every category ON/OFF through the actual hosted adventure store and shared reducer; real generator paths with mocked provider responses for Brain and card builder operations. |
| `src/pages/MemoryApproval.ui.test.tsx` | approval UI/localStorage tests | Exactly one independent switch per category, detection independence, stored-type display, global migration/reopening, preservation of local provider credentials. |
| `src/db/adventureDb.test.ts` | IndexedDB persistence suite | Save/reopen category choices and retain pending status. |
| `src/state/adventureReducer.test.ts` | reducer approval/history cases | Update card category fixtures, fresh-content deduplication expectations, approved pressure history, and independent previous-arc history review. |
| `src/triggers/semanticEngine.test.ts` | semantic/manual/builder cases and `baseAdventure` callers | Assert proposal generation instead of direct writes; explicit category fixtures; type-safe legacy settings fixtures. |
| `src/state/turnPipeline.smoke.test.ts` | inline thought smoke fixtures | Explicitly enable Character Self for tests expecting automatic thought application. |
| `src/memory/applyAIMemoryUpdate.test.ts` | AI boundary suite | Assert proposal actions and review/application through the reducer, preserving existing aliases. |
| `src/memory/memoryArchitecture.integration.test.ts` | architecture smoke path | Explicitly approve a pending Brain suggestion before it becomes active context. |
| `src/pages/SettingsPage.ui.test.tsx` | Settings UI suite | Confirm review/approval switches are absent and detection remains available. |
| `src/pages/SideMenuPages.ui.test.tsx` | Memory Inbox creation/approval case | Fill in valid card content before expecting a successful approval. |
| `src/live/groqProvider.live.ts` | live fixtures, targeted Brain expectation | Use category toggles and proposal actions in optional paid-provider tests. Live calls were not run. |
| `AGENTS.md` | AI mutation rule and semantic/proposal architecture decision | Replace obsolete dual approval architecture with the single-policy contract. |
| `FEATURES.md` | proposal table and memory flow | Document category approval, explicit modes, proposal-only inline thoughts, approved history, and separate arc-history approval. |
| `docs/advanced-settings.md` | memory approval documentation | Remove the retired global override and explain the one approval menu. |
| `docs/memory-approval-implementation.md` | this report | File/function inventory, verification evidence, and remaining verification limits. |

## Verification

- Target repository suite: **606 passed, 7 skipped**, across 73 passing files and one skipped file.
- Command: `npm.cmd test -- --exclude '.codex-pages-worktree/**' --reporter=dot`.
- An initial unqualified `npm.cmd test` also discovered tests from the pre-existing, untracked nested Pages checkout and failed. The final command excludes only that unrelated checkout; no tracked tests are excluded by the argument. Scoped regressions encountered during implementation were fixed before final validation.
- `npm.cmd run build`: passed (TypeScript and Vite). Vite reports the existing large-bundle advisory.
- `npm.cmd run api:build`: passed (hosted API TypeScript compilation and distribution preparation).
- `npm.cmd run smoke:prod`: passed (production index and bundled assets served successfully).
- `git diff --check`: passed.

## Remaining verification limits

The seven skipped tests belong to the optional real-Postgres integration suite, which requires its database connection setting. Hosted approval behavior was exercised through the real shared reducer and backend adventure store with deterministic provider responses; no production Neon database or paid live model calls were used. The optional live-provider fixtures were updated but not executed. Legacy pending cards without a valid subtype need a type selected during manual review; they are never automatically guessed or replayed.
