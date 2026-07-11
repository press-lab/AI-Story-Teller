# UI Product Redesign Implementation Context

Read this document before changing application navigation, page hierarchy, editor surfaces, responsive behavior, or player-facing terminology.

This document is the durable implementation handoff for redesigning AI Story Teller so it feels like a storytelling product first and an inspectable story engine second.

It is based on a desktop and mobile page-by-page audit and a gameplay pass through the existing **Arcane: After the Rocket** scenario. The central finding is that the current application exposes its implementation model as its primary information architecture. Plot components, Reference Cards, Brains, Memory, Automation, Context, imports, token information, sync state, and maintenance actions receive similar visual weight even though most players only want to find a story, continue it, play, and make occasional story edits.

The redesign must not remove the engine's power or inspectability. It must stage that complexity behind clear user goals, human language, and progressive disclosure.

Companion documents:

- `docs/ui-ux-story-mode-ai-ux-ui-research-blueprint.md`: UX research basis, task-success criteria, accessibility guidance, and interaction-cost recommendations.
- `docs/current-nonfunctional-implementation-context.md`: current acceptance status and release-verification evidence.
- `docs/edit-surface-ui-treatment.md`: existing dense-list and selected-editor treatment to retain inside Story Studio and Advanced tools.
- `docs/new-user-guide.md`: current user journey; update it as the navigation changes land.
- `docs/advanced-settings.md`: current advanced setting definitions and behavior.
- `docs/agent-legal-risk-context.md`: supported import boundaries and required public terminology.
- `docs/adventure-design.md`: story-system behavior that the UI must continue to represent accurately.
- `docs/production-architecture-context.md`: production transparency, entitlement, and inspectability requirements.
- `FEATURES.md`: authoritative feature and context-section behavior reference. Use `AGENTS.md` and the hosted-production documents for current runtime/topology authority because older architecture summaries in `FEATURES.md` may lag the deployed modes.

## Status And Authority

This file defines the target product experience and implementation sequence. It is not a claim that the target UI already exists.

When implementing this redesign:

- Preserve reducer-driven adventure mutation and the existing story-engine boundaries.
- Preserve individual visibility for World Blocks, Reference Cards, Characters/Brains, context sections, memory proposals, and automation rules.
- Use **World & Lore** only as a grouping. Keep **World Blocks** and **Reference Cards** visibly distinct child concepts in public UI and documentation.
- Change how those systems are grouped, named, prioritized, and reached; do not collapse them into an opaque data bucket.
- Treat user-facing renames as presentation changes. Do not rename serialized fields, reducer actions, context section kinds, or save schemas without a separate migration.
- Keep Hosted Production, Owner/UAT Rollback, and Browser Local behavior working.
- In Browser Local mode, the storytelling shell and local stories must remain usable without backend authentication. Account-only surfaces may explain that sign-in is required; they must not block local play.
- Keep Admin role-gated and separate from the normal player experience.
- Treat UI visibility as presentation, not authorization. Backend role, entitlement, and policy checks remain authoritative.
- Preserve the supported import boundary: AIST adventure JSON, GitHub save JSON, Reference Card JSON, and World Block JSON. Do not reintroduce third-party backup imports.
- Preserve material usage and billing transparency. Replace raw cost/token data with human summaries by default, but keep exact details available when they affect a decision or charge.
- Audit and explicitly resolve each setting's current scope. A visual move between Settings groups must not silently convert a per-adventure setting into an account or app default, or preserve accidental global/per-story ambiguity without a decision.
- Treat desktop and mobile as equal product surfaces. Responsive work may change presentation, but it must not silently remove essential capability.
- Prefer incremental migration with compatibility adapters over a large rewrite of state or story-engine code.

## Product Diagnosis

The current developer-console feeling is primarily an information-architecture problem, not a palette or border-radius problem.

### Root causes

1. **The navigation mirrors internal entities instead of user jobs.** The editor exposes Plot, Reference Cards, Characters, Memory, Chronicle, Automation, Context, and Import / Export as peer destinations.
2. **Rare and diagnostic information competes with common actions.** Token counts, priority policies, sync details, generator tools, maintenance actions, and raw configuration are often visible before the story content they support.
3. **Creation, configuration, repair, and play are mixed together.** Screens frequently offer several different workflows at equal visual strength.
4. **Mobile compresses or hides desktop behavior instead of adapting it.** The current mobile Play layout hides both the sidebar and adventure tool row, and mobile transcript actions rely on a state that their hidden controls are meant to initiate.
5. **System vocabulary leaks into normal use.** Terms such as Brain, Context, priority, policy, pinned, protected, token budget, and raw JSON are meaningful to expert authors and developers but are not normal player language.
6. **Status is either too technical or too quiet.** Generation, save conflicts, context pressure, and sync state need visible, plain-language feedback with a next action.

### What will not solve the problem

- A color refresh by itself.
- Merely reducing font sizes or card padding.
- A blanket "zen mode" that hides every control.
- Moving the existing crowded navigation into a hamburger without regrouping it.
- Deleting advanced features instead of placing them in an intentional expert layer.

## Post-Redesign Refinement Principles

The July 10, 2026 desktop review confirmed that the story-first shell is a substantial improvement, while also exposing a second-order class of problems: persistent empty panes, cramped button groups, mismatched type roles, and tools that visually belong to one workspace but are launched from another. Apply these principles in future UI work.

### R1. Persistent space must earn its footprint

A pane that permanently consumes reading width must contain an active task, a useful summary, or a clear next action. Do not reserve a large blank inspector merely because it can display a tool later. Use three explicit states for companion panes:

1. **Closed:** the story receives the space.
2. **Summary:** a narrow status strip shows only information needed during play.
3. **Working:** the pane expands after the user selects a tool and provides an obvious close/collapse action.

This follows progressive disclosure (P2), aesthetic minimalism (P3), and focused play without context loss (P9).

### R2. A control group needs breathing room and readable labels

Peer buttons must not visually merge. Use a consistent 8-12px gap, approximately 40-44px minimum control height for important actions, and reflow to a grid or stacked layout before labels truncate. When more than five peer actions remain, group secondary actions under a labelled disclosure or overflow menu. Never rely on a row of clipped labels as navigation.

This follows one-clear-primary-action hierarchy (P4), consistency (P6), and accessible touch targets (P8).

### R3. Put tools where their mental model lives

Automation and Context Inspector operate on the open Story, so their discovery path belongs inside **Story Studio > Advanced Story Tools**. They should not look like app-level destinations in the primary rail. Admin remains an account-role destination; History and Backups remain current-Story utilities.

This follows user-goal information architecture (P1), recognition over recall (P6), and progressive disclosure (P2).

### R4. Typography communicates mode

Use the application sans-serif for navigation, page titles, settings, labels, status, and operational screens. Reserve the serif story typeface for story prose, story/scenario titles, and editorial moments where a literary voice is intentional. A utility heading such as **Backups & Transfer** should not look like story prose.

This follows consistency and standards (P6) and aesthetic hierarchy (P3).

### R5. User-controlled layout changes must be reversible and durable

A collapsible desktop rail needs a visible labelled control, a useful icon-only state, accessible names/tooltips, keyboard operation, and a persisted preference. Collapsing navigation must increase working space without removing any destination or changing mobile navigation.

This follows user control and freedom (P5), adaptive navigation (P7), and semantic interaction (P8).

### R6. Show one actionable status, not repeated raw failures

Do not repeat the same authentication or save failure in the header, tool pane, and page body. Show a concise status at the shell level and put the explanation plus recovery action at the point where the user can resolve it. Errors must identify whether the problem is session state, permission, connectivity, or data conflict.

This follows visibility of system status and error recovery (P5).

### R7. Choice cards must reflow before their copy collides

A choice card is a self-contained decision, not a fixed-width label holder. Its title, description, and supporting copy must stay inside its own bounds at every supported width. Use `min-width: 0` on grid/flex children, allow natural wrapping, and move from a multi-column row to fewer columns before truncating meaningful text. Ellipsis is acceptable for a known identifier; it is not acceptable for the consequence of a choice.

This follows responsive adaptation (P7), readable labels and touch targets (P8), and recognition over recall (P6).

### R8. Authoring density needs hierarchy, not smaller controls

Deep Story Studio screens may remain powerful, but the default view should make the current editing task obvious: a short orientation, one search/filter command bar, the selected item, and clearly labelled maintenance or generation disclosures. Use whitespace, surface tone, and section headings before adding another border. Keep trigger policy, context policy, raw metadata, and bulk maintenance collapsed until requested.

This follows progressive disclosure (P2), aesthetic minimalism (P3), one-primary-action hierarchy (P4), and user-goal information architecture (P1).

### R9. The Play composer is one coherent action area

Treat input mode, response length, the text field, send, and recovery actions as one composer. The text field and send action receive the strongest visual relationship. Continue/retry/undo/remember remain available but must read as secondary or recovery controls, reflow cleanly, and never resemble a flat row of equally important developer buttons. Preserve a comfortable prose measure and visibly separate story content from operational metadata.

This follows focused play (P9), one clear primary action (P4), consistency (P6), and accessible interaction (P8).

### R10. Documentation is part of the product experience

Docs should use the same shell typography, spacing scale, surface treatment, search behavior, and responsive navigation as the rest of the app. Lead with task-oriented topics and plain-language summaries; put implementation reference after common workflows. Keep body text to a readable measure, make the topic navigation collapsible or drawer-based on mobile, and avoid presenting every internal system as an equal first-level destination.

This follows user-needs organization (P1), progressive disclosure (P2), aesthetic hierarchy (P3), and mobile parity (P7).

### Deferred Play side-panel recommendation

The reviewed Play screenshot shows a wide right pane with a compact status block, a crowded row of tool buttons, and a large unused area. Do not patch that symptom with decoration. A future focused pass should test a narrow summary rail that expands only after a tool is selected, preserve Story tools parity, and compare reading width and task-completion time at common desktop sizes. This recommendation is intentionally documented rather than implemented as part of the July 10 follow-up request.

## Research And Design Basis

Every major recommendation in this document is grounded in the following practices.

### P1. User-goal information architecture and real-world language

Organize the interface around what users are trying to accomplish, using words they would naturally use. Do not make users translate the application's implementation model before acting.

Sources:

- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) - especially match between the system and the real world.
- [GOV.UK Service Manual: Start by learning user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs).
- [ONS Service Manual: Writing for user needs](https://service-manual.ons.gov.uk/content/writing-for-users/user-needs).

### P2. Progressive disclosure

Show the common and important controls first. Defer advanced, rare, diagnostic, and destructive controls until requested. Progressive disclosure must not make frequent actions hard to find; the path to Advanced must be obvious and consistently labelled.

Source:

- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

### P3. Aesthetic minimalism and hierarchy

Every panel, badge, metric, border, and action competes with the primary task. Use headings, spacing, typography, and grouping to communicate priority. Keep conceptually distinct systems inspectable without giving all of them equal visual volume.

Sources:

- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) - especially aesthetic and minimalist design.
- [W3C WAI: Designing for Web Accessibility](https://www.w3.org/WAI/tips/designing/).

### P4. One clear primary action

Each screen or step should have one visually dominant next action. Secondary actions remain available but should not compete with it.

Source:

- [ONS Design System: Button](https://service-manual.ons.gov.uk/design-system/components/button).

### P5. Visibility, control, and recovery

The app must show what is happening, provide cancel or undo where appropriate, and explain errors in plain language with a constructive next step.

Source:

- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) - especially visibility of system status, user control and freedom, error prevention, and error recovery.

### P6. Recognition over recall and consistency

State, options, and consequences should be visible or easily retrievable. The same concept must use the same name and interaction pattern everywhere.

Source:

- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) - especially consistency and standards, and recognition rather than recall.

### P7. Adaptive navigation and mobile parity

Navigation should change form at compact widths. A desktop rail may become bottom navigation and a More sheet, but essential tasks cannot disappear at a breakpoint.

Sources:

- [Android Developers: Build responsive navigation](https://developer.android.com/develop/ui/views/layout/build-responsive-navigation?hl=en).
- [W3C: Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/).

### P8. Semantic and accessible interaction

Controls need visible names, keyboard behavior, predictable focus, adequate contrast, usable touch targets, and correct dialog and status semantics.

Sources:

- [W3C WAI: Form labels](https://www.w3.org/WAI/tutorials/forms/labels/).
- [WAI-ARIA Authoring Practices: Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- [W3C: Understanding status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html).
- [W3C WAI: Tables tutorial](https://www.w3.org/WAI/tutorials/tables/).
- [Apple: UI design tips](https://developer.apple.com/design/tips/) - use approximately 44 by 44 CSS pixels as the practical mobile touch-target goal where layout permits.

### P9. Focused play without context loss

Play should be immersive, but hiding all navigation and contextual controls can increase interaction cost. Keep the story visually dominant while retaining a clear path to status and story tools.

Source:

- [Nielsen Norman Group: Zen Mode](https://www.nngroup.com/articles/zen-mode/).

## Target User Layers

The UI should serve three layers without forcing them onto the same screen.

### Layer 1: Player

Primary needs:

- Continue a story.
- Find a Scenario and start a private Story from it.
- Read and take a turn.
- Understand whether the story saved and whether generation is still running.
- Recover from a clear error.

This is the default experience.

### Layer 2: Story creator

Primary needs:

- Change the premise, opening, direction, characters, and world.
- Review suggested story-memory changes.
- Publish or reuse a scenario.
- Back up or transfer a story.

These tools live in Story Studio and other task-oriented screens.

### Layer 3: Advanced creator or operator

Primary needs:

- Configure trigger rules and memory policy.
- Inspect provider-facing context and token decisions.
- Use raw import/export and diagnostic controls.
- Operate platform administration when authorized.

These tools live in a clearly labelled Advanced workspace. Admin remains a separate role-gated product area.

Power users may pin Advanced destinations or opt into denser displays. Those preferences must not change the default experience for new users.

## Target Information Architecture

```text
Home
Explore
Current Story
|-- Play
`-- Story Studio
    |-- Story & Direction
    |-- Characters
    |-- World & Lore
    |-- Suggestions
    `-- Advanced Story Tools
        |-- Automation
        `-- Context Inspector

More
|-- History
|-- Backups & Transfer
|-- Settings
`-- Help

Admin - separate, role-gated workspace
```

### Desktop navigation

Use a stable left rail or persistent drawer for:

- Home
- Explore
- Play, when a story is open
- Studio, when a story is open

Place Settings, Help, Advanced, account actions, and authorized Admin access at the bottom or inside the account/More area. Keep the current story title and a concise save state visible without making them additional navigation rows.

The desktop header should contain only the current page/story identity, relevant status, and at most one contextual primary action.

### Mobile navigation

Use a fixed bottom navigation bar with no more than five destinations:

- Home
- Explore
- Play
- Studio
- More

More opens a sheet or page containing History, Backups & Transfer, Settings, Help, Advanced, and account actions. Admin is included only for authorized users and remains visibly separate.

The mobile shell must respect safe areas, avoid horizontal page scrolling, and keep current location obvious. Do not reproduce the desktop header as a horizontally clipped strip.

### URL and history behavior

The current application primarily changes React tab state and writes tab data into `history.state`. The target navigation should provide stable, route-backed locations so browser Back/Forward, refresh, bookmarks, and support instructions reproduce the user's location.

Suggested route shape:

```text
/home
/explore
/profiles/:userId
/stories/:adventureId/play
/stories/:adventureId/studio/story
/stories/:adventureId/studio/characters
/stories/:adventureId/studio/world
/stories/:adventureId/studio/suggestions
/stories/:adventureId/history
/stories/:adventureId/backups
/scenarios/:scenarioId/revisions/:revisionId/edit
/scenarios/:scenarioId/manage
/advanced/automation/:adventureId
/advanced/context/:adventureId
/settings
/help
/admin/...
```

The exact routing library is an implementation choice. Stable URLs and correct browser-history behavior are the acceptance target.

Scenario revision editing must be visibly distinct from private Story editing. Saving or publishing a Scenario revision must never imply that the private Chronicle will be included.

Route migration has data-loss and hosting implications:

- A direct Story URL must load and verify the requested Story before autosave can begin. It must never briefly bind the previously open Story to the new route and save it under the wrong ID.
- Switching Story IDs must clear or re-key transcript scroll, draft input, context preview, and pending tool/editor state.
- Preserve email verification, password-reset, and OAuth callback processing; remove callback tokens from the URL promptly and return only to a validated safe destination.
- Support nested-route refresh and asset resolution on Cloudflare Pages root hosting and GitHub Pages/subpath compatibility hosting.
- Provide explicit loading, not-found, unauthorized, and offline route states.

## User-Facing Terminology

Internal types and persisted field names do not need to change merely to support clearer labels.

| Current or internal term | Default user-facing location or label | Advanced label or detail |
| --- | --- | --- |
| Profile as library/home | Home; Account under account menu | Profile details |
| Adventure | Story, except where saved playthrough distinction matters | Adventure ID and metadata |
| Edit | Story Studio | Full editor |
| Plot / Components | Story & Direction; World & Lore > World Blocks | Component type and source metadata |
| Current Arc | Current story direction | Arc Director |
| Active Pressure | What is pushing the story forward | Active Pressure component |
| AI Instructions | How the narrator should write | AI Instructions component |
| Author's Note | Tone and emphasis | Author's Note component |
| Reference Cards | World & Lore > Reference Cards | Reference Card triggers and context policy |
| Brains | Characters > Private character state | Brain entries and update policy |
| Memory | Suggestions | Memory Inbox and memory policy |
| Chronicle | History | Adventure Chronicle |
| Automation | Automation, under Advanced | Trigger rules and action payloads |
| Context | Context health; Details | Context Inspector |
| Import / Export | Backups & Transfer | Raw Data Tools |
| Token counts and priorities | Context healthy / near limit / needs attention | Exact tokens, sections, priorities, decisions |

Use **Story** as the normal player-facing name for a playable private save and **Adventure** when the implementation/API distinction matters. Use **Scenario** only for the reusable template/revision that creates a Story. Canonical default labels in this document are **New Story**, **Suggestions**, and **Automation**. Preserve the product distinction that starting a Scenario forks its revision into a private Adventure presented to the player as their Story.

The group label **World & Lore** must not erase the public distinction between **World Blocks** and **Reference Cards**. A normal creator should be able to see which kind of object they are editing even when advanced trigger and context-policy fields are collapsed.

## Global Interaction And Visual Requirements

### Primary-action hierarchy

- Each page, dialog, or wizard step has one primary action.
- Use verb-led labels that describe the result: **Continue story**, **Start story**, **Save character**, **Restore backup**.
- Do not style several unrelated actions as primary.
- Destructive actions use a danger treatment and are not placed beside the primary action without separation.

Basis: P3 and P4.

### Progressive disclosure rules

Default surfaces show only information required to understand the item and complete the common task.

Place these behind **Advanced**, **Details**, or an expert editor unless they are the current task:

- Token counts and token estimates.
- Priority scores and memory-dropping policy.
- Pinned/protected/generated-by metadata.
- Trigger expressions and cooldowns.
- Raw JSON and source IDs.
- Provider payload and context decision logs.
- Maintenance and bulk-repair actions.
- Platform routing, cost, and diagnostic controls.

Advanced disclosures must be consistently named and discoverable. Do not hide a frequent action merely because it is technically complex.

Basis: P2, P3, and P6.

### Status language

Default status should answer three questions: what is happening, whether the user's work is safe, and what to do next.

Examples:

| Technical or weak status | Default status | Optional detail |
| --- | --- | --- |
| `in 25260 out 354` | Context is healthy, near its limit, or omitted optional material according to the deterministic context-health rules below | Exact input/output tokens |
| background provider call | Writing the next scene... | Provider/model and request details |
| `Load failed`, recoverable device draft confirmed | We could not reconnect. A recoverable draft is saved on this device. | Transport error, draft timestamp, and retry log |
| `Load failed`, persistence unconfirmed | We could not confirm that this story was saved. Keep this page open and try again. | Last confirmed save, transport error, and retry log |
| save conflict payload | Two versions of this story changed. Choose which one to keep. | Timestamps, IDs, and raw comparison |
| budget truncation badge | Some optional story context was left out. | Omitted sections and policy decisions |

Use an `aria-live` status region for non-blocking updates and `role="alert"` only for urgent errors.

Never claim that work is safe unless the active persistence adapter confirms a recoverable server version, IndexedDB copy, or local draft. Hosted Production, Owner/UAT, and Browser Local can have different evidence and therefore different copy.

#### Deterministic context-health rules

Context health must be derived from `ContextBuildResult`, the configured input budget, and recorded build decisions; it must not be inferred from a raw token total in isolation.

- **Healthy:** the assembled payload is within budget, uses less than 85 percent of the configured input budget, and has no truncation or `budget_exceeded` decision.
- **Near limit:** the payload is valid and uses at least 85 percent of the configured input budget, with no omitted/truncated optional item.
- **Optional context omitted:** the result contains a truncation or `budget_exceeded` exclusion but still produced a valid payload.
- **Needs attention:** protected content cannot fit, a valid payload cannot be produced, or another blocking context-build error exists.

Keep the threshold in one named policy/helper, not repeated in components. Cover each status with deterministic tests using build-result fixtures.

#### Save-conflict preservation

When local and server versions diverge, preserve both versions until the user explicitly chooses a resolution. Do not silently prefer the server, discard local progress, or overwrite either version before resolution. The conflict UI must identify the last confirmed save for each version, explain the consequence of each choice, and provide a safe cancel/decide-later path when supported.

Basis: P5 and P8.

### Layout and visual hierarchy

- Preserve the warm visual identity and story typography.
- Use fewer nested bordered containers.
- Use whitespace, section headings, and alignment before adding another card.
- Reserve the strongest accent for the primary action and current navigation state.
- Reserve status colors for semantic status.
- Keep story prose in a comfortable reading column; do not use the full desktop width for long-form text.
- Default to comfortable density. Compact density is an expert preference.
- Avoid presenting more than three to five peer actions without grouping or overflow.

Basis: P3 and P4.

### Forms

- Give every control a persistent visible label; placeholders are examples or hints only.
- Put labels above fields unless a well-tested compact control requires another arrangement.
- Group related controls with `fieldset` and `legend` or equivalent accessible structure.
- Ask only for information required at the current step.
- Put consequences and recovery guidance beside risky settings.
- Preserve entered data across wizard steps and recoverable navigation.

Basis: P2, P5, and P8.

### Dialogs and sheets

- Move focus into a dialog when it opens.
- Trap focus inside a modal dialog.
- Support Escape when closing is safe.
- Return focus to the invoking control when the dialog closes.
- Make background content inert to pointer, keyboard, and assistive technology interaction.
- Use a visible heading and labelled actions.
- Do not make backdrop click the only way to dismiss.
- Use bottom sheets for compact mobile task menus when the content is short; use a full-screen task page for complex editing.

Basis: P5 and P8.

### Mobile interaction

- Target approximately 44 by 44 CSS pixels for primary touch controls.
- Never require hover, double-click, or invisible click regions.
- Keep important actions visible or under a labelled overflow control.
- Do not hide essential desktop capabilities at `860px` or `640px`; reformat them.
- Avoid horizontal scrolling for primary navigation and forms.
- If a data table cannot reflow, provide a purposeful card/list representation or a clearly labelled scroll region.

Basis: P7 and P8.

## Page-By-Page Implementation Requirements

### Welcome And Authentication

**Purpose:** Let a person understand the product and enter it without learning deployment or provider architecture.

Desktop:

- Lead with a short product promise and one primary path forward.
- Keep sign-in, sign-up, verification, reset, and local/account explanations task-specific instead of presenting them simultaneously.
- Explain local versus account-backed behavior in one short sentence with implementation/privacy details under **Learn more**.

Mobile:

- Use a single-column flow with persistent labels and full-width primary actions.
- Keep account alternatives and help subordinate to the current form.
- Ensure the keyboard does not obscure the active field or submit action.

Acceptance criteria:

- A first-time user can explain what the product does and identify the next action without scrolling through technical material.
- Every field has a programmatic and visible label.
- Error text identifies the problem and recovery action.

Basis: P1, P2, P4, P5, and P8.

Primary source: `src/pages/WelcomePage.tsx`.

### Home And Account/Profile

**Purpose:** Answer "What should I do next?" Account identity is secondary.

Desktop:

1. Lead with **Continue [story title]** when a recent story exists.
2. Show recent stories ordered by a clearly defined activity timestamp.
3. Offer Explore and Create.
4. Show account/profile management through the account area, not as the page's dominant content.
5. Separate reusable Scenarios from private Stories while explaining the distinction in plain language.

Mobile:

- Stack Continue, Recent, Explore, and Create in that order.
- Keep card actions to the main action plus one labelled overflow menu.
- Do not show all edit, duplicate, publish, delete, and diagnostic controls at once.

Acceptance criteria:

- A returning user can resume the most recent story with one obvious action.
- **Recent** means last modified unless a separate `lastPlayedAt` field is deliberately added and maintained on successful play; do not label ordinary `updatedAt` changes as "last played."
- Profile/account settings are reachable but do not dominate the library.
- Scenario publishing never implies that the private transcript will be shared.

Basis: P1, P3, P4, and P6.

Primary sources: `src/pages/ProfilePage.tsx`, `src/pages/AdventuresPage.tsx`.

### New Story

**Purpose:** Start a playable story without requiring expert configuration.

Desktop target flow:

1. Choose a scenario or start blank.
2. Name and describe the premise.
3. Set the opening situation.
4. Review and start.

Use a two-column layout only when the second column provides a useful live preview. Put AI assistance, imports, provider/model choices, advanced story controls, and raw setup options behind clearly labelled optional paths.

Mobile:

- Use one step per screen with persistent Back and Next/Start actions.
- Autosave the draft.
- Avoid dense multi-column forms and nested accordions.

Acceptance criteria:

- A normal user can create a playable story without opening Advanced.
- Import and manual creation are understandable alternative paths, not competing forms on one screen.
- Leaving and returning does not silently discard entered setup.

Basis: P1, P2, P4, P5, and P8.

Primary source: new-adventure creation inside `src/pages/AdventuresPage.tsx` and related `src/App.tsx` handlers.

### Explore

**Purpose:** Help users recognize a scenario they want before creating a private story from it.

Desktop:

- Add search and a small, understandable filter set.
- Show premise, genre/tone, creator, source type, and expected play style on each card.
- Open a scenario detail preview before starting it.
- Give **Start story** primary emphasis only inside the selected Scenario's detail context. Helper text should state that this creates a private Story from the reusable Scenario and does not modify the published template.
- Reuse authored thumbnail images when available instead of replacing them with letter placeholders.

Mobile:

- Use a readable vertical list with meaningful imagery and premise text.
- Put filters in a labelled sheet.
- Keep the detail preview in a dedicated screen or full-height sheet.

Acceptance criteria:

- Users can compare scenarios without accidentally starting one.
- Generic placeholders do not dominate scenario identity when actual art or descriptive fallbacks are available.
- Empty and offline states explain what is still usable.
- Search/filter facets operate only on authored, persisted metadata. The current backend summary does not provide all proposed genre/tone/play-style fields, so add those fields to Scenario edit/publish/API contracts before filtering on them; do not guess them client-side. A first release may limit filters to existing metadata.

Basis: P1, P5, and P6.

Primary source: `src/pages/ExplorePage.tsx`.

### Current Story Overview

**Purpose:** Provide a concise story checkpoint, not another control center between Home and Play.

Preferred outcome: fold most of Dashboard into Home and the current-story context. If Dashboard remains, rename it **Story Overview** and keep it intentionally small.

Desktop:

- Lead with **Continue story**.
- Show a short recap, last activity time, and one important issue requiring attention.
- Make displayed metrics actionable or remove them from the prominent view.
- Keep Edit/Studio and History secondary.

Mobile:

- Show Continue, recap, and at most two secondary actions before details.
- Do not require Dashboard as a mandatory stop before Play.

Acceptance criteria:

- The screen has one obvious primary action.
- Non-interactive statistics do not occupy primary space.
- Sync conflicts use human choices rather than raw status text.

Basis: P3, P4, and P5.

Primary source: `src/pages/DashboardPage.tsx`.

### Play

**Purpose:** Deliver the immersive core experience while keeping essential status and story tools reachable.

Desktop:

- Center the transcript in a comfortable reading column.
- Keep the composer visually anchored to the story.
- Place Story & Direction, Characters, World & Lore, Suggestions, and Context Details in an on-demand side drawer.
- Show only the most frequent composer actions directly. Put the remainder in a labelled More menu.
- Add the submitted user message to the transcript immediately while generation runs.
- Show **Writing the next scene...** near the composer.
- Provide Stop where supported, and Retry after failure.
- Replace raw token totals with a context-health summary and a **Details** path.
- Convert save/sync conflicts into a short comparison and explicit decision dialog.

Mobile:

- Provide a visible **Story tools** control that opens all essential tools in a sheet or full-screen drawer.
- Do not hide Plot/Story, World, Characters, Suggestions, Context, or full editing capability at a breakpoint.
- Replace the horizontally scrolling action strip with a few visible frequent actions and a labelled More sheet.
- Keep the composer fixed without covering transcript content.
- Use words for input modes; glyphs may supplement labels but cannot replace them.
- Give each message a visible overflow button for Edit and Delete.
- Do not require hover or double-click.
- Keep the story visible behind short menus; use a full-screen task only for real editing.

Acceptance criteria:

- At 390 by 844, every essential story tool remains reachable.
- A player can submit, observe generation, stop/recover where supported, and retry without guessing.
- The submitted player action appears immediately.
- Edit and Delete are reachable by keyboard and touch on every editable message.
- Raw token details are absent from the default play surface.
- Opening navigation or story tools never makes the composer or current state impossible to recover.

Basis: P3, P5, P7, P8, and P9.

Primary sources: `src/pages/PlayPage.tsx`, Play-related blocks in `src/styles.css`, `src/App.tsx` play-panel composition.

### Story Studio Shell

**Purpose:** Group authoring around human concepts while retaining the underlying inspectable systems.

Desktop:

- Use a secondary Studio navigation for Story & Direction, Characters, World & Lore, and Suggestions.
- Preserve the dense directory plus selected-editor treatment from `docs/edit-surface-ui-treatment.md`.
- Show page summary, search, primary creation action, item list, and one selected editor.
- Keep Advanced entry consistent across Studio sections.

Mobile:

- Use a Studio landing page with four large destinations instead of compressing many peer tabs.
- Open editors as focused full-screen tasks with explicit Save/Done and Back behavior.

Acceptance criteria:

- A normal creator does not encounter Automation, raw Context, or Import/Export as equal Studio tabs.
- Existing underlying entries remain individually visible and editable.
- Studio navigation preserves the selected story and returns users to the prior position.

Basis: P1, P2, P3, and P6.

Primary current source: inline editor-tab composition in `src/App.tsx`, plus `docs/edit-surface-ui-treatment.md`. `src/components/Tabs.tsx` and `src/components/Sidebar.tsx` are dormant candidates that require accessible/adaptive redesign before reuse.

### Story & Direction

**Purpose:** Let creators understand and steer the current story before seeing generation and maintenance machinery.

Desktop:

- Lead with authored story content.
- Group premise/contract separately from current direction/state.
- Collapse AI generation, maintenance, and Arc Director configuration until requested.
- Use the default-facing labels from the terminology table.
- Keep general World Blocks out of this section; they belong under World & Lore even though both currently use `ComponentEntry` storage.

Mobile:

- Show one content block at a time with a useful summary when collapsed.
- Use a sticky Save action and focused Advanced disclosures.

Acceptance criteria:

- The story content appears before AI tools and maintenance actions.
- The Arc Director break-cost invariant remains unchanged.
- Component types stay individually represented in state and context.

Basis: P1, P2, and P3.

Primary source: `src/pages/ComponentsPage.tsx`.

### World & Lore

**Purpose:** Let creators manage durable world facts without administering token policy by default.

World & Lore is a navigation group, not a combined persistence type. It contains two visibly distinct child surfaces.

#### World Blocks

World Blocks are always-on or explicitly configured context components for setting rules, factions, locations, objects, and other durable world material.

Desktop:

- Show a compact World Block directory with title, category, and one useful preview line.
- Use a split list-and-editor layout where width permits.
- Put component source metadata, exact priority/policy, token estimates, and maintenance actions in Advanced details.

Mobile:

- Use a searchable World Block list and a dedicated full-screen editor.
- Keep Add World Block visible without displaying every advanced field in the creation step.

World Block acceptance criteria:

- **World Blocks** remains a visible public label.
- A normal creator can add a setting rule or durable world fact without choosing token policy.
- Each World Block remains an individual `ComponentEntry` and named context item.

Primary source: World Block groups in `src/pages/ComponentsPage.tsx`.

#### Reference Cards

Reference Cards are durable recurring facts that can be pinned or activated by trigger matching.

Desktop:

- Preserve the compact list as a strong foundation.
- Default rows show name, category, important fact, and when it matters.
- Use a split list-and-editor layout where width permits.
- Put triggers, priority, protected/pinned state, token estimates, IDs, update cooldowns, and generated-by metadata in Advanced details.

Mobile:

- Use a searchable list followed by a dedicated detail editor.
- Give filter groups persistent labels.
- Keep creation available without showing every filter and maintenance action simultaneously.

Reference Card acceptance criteria:

- **Reference Cards** remains a visible public label.
- A normal creator can add a person/place/object/faction fact without understanding context policy.
- Trigger and policy behavior remains available in Advanced.
- Each Reference Card remains an individual `StoryCard` and named context item.

Group acceptance criteria:

- World Blocks and Reference Cards remain visibly distinct in the UI and separate inspectable sources internally.
- Moving between the two child surfaces preserves the user's current query and return location where practical.

Basis: P1, P2, and P6.

Primary source for Reference Cards: `src/pages/StoryCardsPage.tsx`.

### Characters

**Purpose:** Present characters as people in the story, with internal memory machinery available to experts.

Desktop:

- Lead with description, story role, relationships, current concerns, and recent important changes.
- Use **Character** consistently.
- Present Brain entries as **Private character state** in the default explanation and retain the exact internal term in Advanced details.
- Compose the character profile at the presentation layer from a character Reference Card and an optional matching Brain entry when both exist. Link the records; do not merge their serialized storage or mutation paths.
- Keep maintenance and policy controls subordinate.

Mobile:

- Use readable profile cards and a focused character editor.
- Keep thought history and policy metadata under Details.

Acceptance criteria:

- Creating or editing a character does not require understanding Brain update policy.
- Existing BrainEntry restrictions and mutation boundaries remain enforced.
- Updating a public character fact dispatches to the Reference Card path; updating private state dispatches to the Brain path.
- Character facts do not silently merge with unrelated world lore.

Basis: P1, P2, and P6.

Primary sources: `src/pages/BrainsPage.tsx`, character Reference Cards in `src/pages/StoryCardsPage.tsx`.

### Suggestions

**Purpose:** Let users review proposed story changes with confidence.

Desktop:

- Rename the default destination **Suggestions**.
- Show pending proposals first.
- Show what changed, why it was suggested, source turn, and before/after content where relevant.
- Offer Approve, Edit and approve, Reject, and Ignore. Keep Reject and Ignore distinct because they are separate persisted proposal states and reducer actions; do not map both to an ambiguous Dismiss action.
- Move auto-approval and classification settings to Settings or Advanced.

Mobile:

- Review one suggestion at a time with large unambiguous actions.
- Show the remaining pending count and preserve progress.

Acceptance criteria:

- Pending proposals are never represented as already-active context.
- Approve, edit, reject, and ignore behavior continues through reducer actions.
- Resolved items cannot accidentally show an active Approve action.

Basis: P1, P5, and P6.

Primary source: `src/pages/MemoryInboxPage.tsx`.

### History

**Purpose:** Make the complete persisted transcript easy to browse and manage.

Desktop:

- Rename the default destination **History**.
- Provide search, useful filters, and **Jump to latest**.
- Make edit/delete actions explicit buttons or menus.
- Do not make a generic article or row an invisible editing control.

Mobile:

- Use a readable chronological feed with a visible overflow button per entry.
- Preserve scroll position after editing.
- Make newest content easy to reach.

Acceptance criteria:

- Every interactive transcript entry is operable by keyboard.
- The complete Chronicle remains persisted and paginated without implying that only the first loaded subset exists.
- Users can return to the latest entry with one action.

Basis: P5, P6, and P8.

Primary source: `src/pages/ChroniclePage.tsx`.

### Automation (Advanced)

**Purpose:** Give expert creators deterministic rule control without exposing raw payload construction to everyone.

Desktop:

- Place the feature under Advanced.
- Default to a visual **When / Then / Target** builder.
- Provide templates, inline validation, preview, and test behavior.
- Keep raw JSON in an explicitly labelled expert editor.

Mobile:

- Support viewing, enabling/disabling, and focused full-screen editing.
- Reformat the rule builder; do not squeeze the desktop grid into a card.

Acceptance criteria:

- Normal players never need to pass through Automation to play or edit ordinary story content.
- Existing typed rule/action behavior remains unchanged.
- Invalid conditions/actions are explained before save.

Basis: P2, P5, and P6.

Primary source: `src/pages/TriggersPage.tsx`.

### Context Health And Context Inspector

**Purpose:** Keep provider-facing context transparent without making token administration part of ordinary play.

Default UI:

- Surface a compact health statement: healthy, near limit, optional material omitted, or needs attention.
- Link **Details** to the full inspector.

Desktop Advanced inspector:

- Preserve section order, included/excluded items, tokens, policies, decisions, source links, and pending proposals.
- Use semantic controls inside rows instead of making the entire table row a click target.

Mobile Advanced inspector:

- Show summary cards and an expandable section-by-section breakdown.
- Do not hide section, priority, flags, and policy data; reformat it behind disclosure.

Acceptance criteria:

- Context Preview continues to match the payload produced by `buildContext`.
- Empty sections remain represented in the build result as required by the engine contract.
- All inspector actions are keyboard accessible.
- Compact layout retains access to every diagnostic field.

Basis: P2, P5, P7, and P8.

Primary source: `src/pages/ContextPreviewPage.tsx`.

### Backups & Transfer

**Purpose:** Organize data movement by the result the user wants.

Desktop:

- Group tasks as Back up this story, Restore a backup, Move to another device, Import story material, and Advanced raw export.
- Explain what each operation includes and whether it adds, replaces, or merges data.
- Preview destructive imports and restores before applying them.

Mobile:

- Use guided task flows rather than showing every scope and format at once.
- Keep long raw text/file previews in dedicated screens.

Acceptance criteria:

- Users can predict whether transcript/runtime state will be included.
- Restore and replacement operations require an explicit confirmation with recovery guidance.
- Browser Local, backend, and authorized device-only routing remain accurate and visibly scoped.

Basis: P1, P2, and P5.

Primary current sources: creation/import/backup views in `src/pages/AdventuresPage.tsx`, `src/pages/ImportExportPage.tsx`, `src/hooks/useAdventureLibrary.ts`, `src/hooks/useGitHubSaves.ts`, `src/hooks/useGitHubSaveLoad.ts`, and `src/runtime/adventureStore.ts`. `src/pages/CloudSavesPage.tsx` is currently unreachable and requires an ownership/retirement decision before reuse.

### Settings

**Purpose:** Let users change predictable scopes without mixing account, story, provider, and diagnostic configuration.

Desktop sections:

- Account.
- Appearance.
- App defaults.
- Current story.
- Personal AI provider, when available.
- Advanced.
- Danger zone.

Always show whether a setting affects all future stories, the currently open Story, this device, or the account.

Run a setting-by-setting ownership audit before regrouping this page. `docs/advanced-settings.md` describes its controls as per-adventure, but the current runtime is not fully consistent: several budget/evaluation/auto-approve controls dispatch to the open Adventure while Memory Detection updates global adventure settings. Treat this as a scope discrepancy to resolve explicitly, not as permission to preserve accidental ambiguity. Moving a control visually does not change its ownership. New app-default or account-level equivalents require explicit data-model, normalization, migration, and test work.

Mobile:

- Use a searchable settings index with focused detail pages.
- Keep destructive actions in a separate final section.

Acceptance criteria:

- No setting silently switches between global and current-story scope.
- Every migrated setting has a documented source of truth, persistence location, inheritance rule, and active-scope label.
- Normal backend users do not see platform provider secrets, platform routing, developer adventures, or admin evaluation controls.
- Advanced user tools require an intentional disclosure and any applicable entitlement. Admin tools additionally require backend-authoritative role checks.

Basis: P2, P5, and P6.

Primary sources: `src/pages/SettingsPage.tsx`, UI/default setting types in `src/pages/pageTypes.ts`.

### Billing And Usage (Conditional Production Surface)

**Purpose:** Explain plan access, renewal, usage, and payment state without exposing provider accounting internals.

This surface is required when subscriptions or metered limits ship. Until then, do not render a nonfunctional placeholder or imply that billing is active.

Desktop:

- Show current plan, renewal/cancellation state, included usage or credits, model access, and a clear billing-portal action.
- Explain payment failure, grace period, restricted access, and recovery in plain language.
- Put exact ledger/provider details behind **Usage details** when they materially explain a charge or limit.

Mobile:

- Lead with plan status and the one action currently required.
- Use a chronological, readable usage summary rather than a compressed accounting table.
- Keep billing-portal and payment-recovery actions easy to identify.

Acceptance criteria:

- Displayed entitlements come from backend-authoritative data.
- Cancellation, renewal, payment failure, and grace-period states have distinct copy and actions.
- Human summaries never hide a material charge, limit, or loss of access.
- Normal users never see platform provider secrets or internal platform cost controls.

Basis: P1, P5, and P6.

Primary future sources: account/subscription page and backend entitlement/usage APIs defined by the production architecture.

### Help And Documentation

**Purpose:** Provide task-focused help at the point of need, with deeper reference available by audience.

Desktop:

- Organize by Playing stories, Creating stories, Managing stories, Advanced authoring, and Technical reference.
- Put contextual help links beside difficult controls.
- Search article bodies, not only titles or headings.

Mobile:

- Use task-oriented navigation and readable articles.
- Avoid a dense table of contents that competes with the article.

Acceptance criteria:

- Users can find help using the words shown in the UI.
- Player help does not begin with developer architecture.
- Changed labels and paths are updated in `docs/new-user-guide.md`, `docs/backend-architecture.md`, README navigation descriptions, in-app Help, and affected UI tests in the same implementation phase.

Basis: P1, P5, and P6.

Primary source: `src/pages/HelpPage.tsx` and user-facing Markdown documentation.

### Admin

**Purpose:** Provide operational workflows without shaping the normal storytelling experience.

Desktop:

- Use a separate role-gated shell with Overview, Users, Scenarios, Safety/Reports, and System Health.
- Build purpose-specific views rather than one long mixed console.
- Use labelled tables, filters, pagination, confirmation, and audit-friendly feedback.

Mobile:

- Convert records to accessible cards where appropriate or provide deliberate labelled table scrolling.
- Keep destructive operations behind confirmation and show their scope.

Acceptance criteria:

- Admin navigation never appears to non-admin users.
- Admin vocabulary and platform controls do not leak into normal Settings or Home.
- Role and restriction changes provide visible completion or recovery status.

Basis: P2, P5, P7, and P8.

Primary source: `src/pages/AdminConsolePage.tsx`.

## Current Code Map And Refactoring Seams

The implementation should begin by separating product navigation from page content without changing story-engine contracts.

### Application shell and navigation

- `src/App.tsx`
  - Owns `activeTab`, editor tabs, modal tabs, browser-history state, header navigation, play panel composition, and page selection.
  - Current `editorTabs` directly expose internal surfaces as peers.
  - Current desktop/mobile header navigation should be replaced or wrapped by the target shell.
  - Extract route/navigation configuration before rewriting individual pages so page work can land incrementally.
- `src/components/Sidebar.tsx` and `src/components/Tabs.tsx`
  - Both are currently dormant refactoring candidates, not live Story Studio dependencies.
  - Do not adopt them unchanged: the target navigation must adapt between rail and bottom navigation, and any tabs pattern must implement the appropriate ARIA behavior.
- `src/styles.css`
  - Contains application shell, editor treatment, Play layout, responsive behavior, and mobile breakpoints.
- `vite.config.ts` and hosting configuration
  - Route work must preserve `VITE_BASE_PATH`, Cloudflare Pages fallback behavior, and GitHub Pages/subpath compatibility.

Recommended seam:

1. Define route metadata by audience layer and current-story requirement.
2. Create shared `AppShell`, desktop navigation, mobile bottom navigation, and More/Advanced navigation.
3. Map legacy tab IDs to routes during migration.
4. Move page-specific navigation out of the global header.
5. Retire legacy tab/modal paths only after route parity tests pass.
6. Hydrate the requested Story and verify access before enabling autosave on a direct route.
7. Preserve authentication callback processing and safe return destinations during route migration.

### Shared feedback and overlays

- `src/components/ActionFeedback.tsx`
- `src/components/GitHubSaveConflictDialog.tsx`
- Tool modal markup in `src/App.tsx`

Create or adopt one accessible dialog primitive and one status/toast primitive. Migrate confirmation, conflict, and tool overlays to the shared primitives before proliferating more overlay patterns.

### Core player journey

- `src/pages/WelcomePage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/AdventuresPage.tsx`
- `src/pages/ExplorePage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/PlayPage.tsx`

Play feedback and optimistic submission also cross these nonvisual seams:

- `src/hooks/useAdventureRuntime.ts`
- `src/state/turnPipeline.ts`
- `src/providers/openAICompatible.ts`
- backend turn execution through `src/runtime/adventureStore.ts`

An optimistic player message must reconcile with the persisted turn result so exactly one user message is stored. On failure, preserve a recoverable draft and prevent Retry from duplicating it.

New Story draft persistence is new behavior, not a CSS change. Define its storage location, account/device scope, expiration/deletion, multiple-draft behavior, secret exclusion, and exact conversion point into an Adventure before implementation.

### Story Studio

- `src/pages/ComponentsPage.tsx`
- `src/pages/StoryCardsPage.tsx`
- `src/pages/BrainsPage.tsx`
- `src/pages/MemoryInboxPage.tsx`
- Shared editor styles in `src/styles.css`

### History, advanced tools, and support

- `src/pages/ChroniclePage.tsx`
- `src/pages/TriggersPage.tsx`
- `src/pages/ContextPreviewPage.tsx`
- `src/pages/ImportExportPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/HelpPage.tsx`
- `src/pages/AdminConsolePage.tsx`

`src/pages/SummaryPage.tsx`, `src/pages/CloudSavesPage.tsx`, and any generic modal-only paths are legacy or currently unreachable and should be audited for ownership before reuse. Every surviving page needs one clear user job and one documented entry path.

### Persistence, sync, and conflict resolution

- `src/hooks/useAdventureLibrary.ts`
- `src/hooks/useAdventureAutosave.ts`
- `src/hooks/useCloudSyncController.ts`
- `src/hooks/useGitHubSaveLoad.ts`
- `src/runtime/adventureStore.ts`
- `src/utils/syncConflict.ts`
- `src/db/accountAdventureBackupDb.ts`

Shell and route simplification must not weaken conflict preservation. A route transition cannot enable autosave against a stale or wrong Story, and divergent local/server versions must remain recoverable until explicit resolution.

### Pure UI/domain helpers to introduce

- A context-health classifier derived from `ContextBuildResult`, the configured context budget, exclusions, and decisions. Play, Home/Story Overview, and Context Inspector must use the same pure result.
- Separate form primitives for a single labelled control and a grouped control set. The current `Field` helper in `src/pages/shared.tsx` can wrap composite children in a single `label`, which is not a safe universal pattern.
- A lossless Automation editor adapter. Visual When/Then/Target editing must round-trip every supported `TriggerCondition` and `TriggerAction`; unknown/future fields remain intact through the raw fallback.
- UI preference normalization for any new navigation, pinning, or density preferences so existing saved preferences continue to load.

### Test and audit ownership

- Update the matching `*.ui.test.tsx` file for every changed page.
- Add task-level shell tests for Home, Explore, Play, Studio, More, Advanced, public Profile, and Scenario revision routes.
- Update `scripts/full-ui-visual-audit.mjs` with the same navigation change; a harness that still follows legacy labels is not valid visual coverage.
- Mobile tests must assert that each named Play destination is reachable, not merely that a generic Story tools button renders.
- Dialog tests must cover initial focus, Tab and Shift+Tab containment, Escape, focus return, and promise settlement exactly once.

### State and architecture boundaries to preserve

- Do not mutate adventures directly from components.
- Continue dispatching typed reducer actions.
- Do not merge named context sections into a hidden aggregate.
- Do not change Memory Inbox proposals into silent active context.
- Do not weaken Arc Director phase gating.
- Do not put provider keys in adventure state or IndexedDB.
- Preserve Browser Local behavior while changing account-backed navigation.
- Browser Local must be enterable without a backend session when that runtime mode is selected, even though the current authenticated-shell gate has drifted from that architecture contract.

## Implementation Sequence

### Phase 0: Baseline and behavior contracts

- Record current desktop and mobile screenshots for every page.
- Add navigation and interaction tests around the main user journeys.
- Add regression coverage for the known mobile Play reachability failures.
- Define the terminology map in shared navigation/copy constants where practical.
- Decide and document the route migration approach.

Exit gate:

- Existing behavior is captured well enough that shell work cannot silently remove a feature.

### Phase 1: Critical mobile and accessibility repairs

- Restore mobile access to every Play story tool.
- Make message Edit/Delete reachable without hover or pre-existing edit state.
- Replace generic clickable Chronicle articles and Context table rows with semantic controls.
- Implement shared accessible dialog behavior.
- Correct dark-mode contrast and visible focus issues.
- Ensure status feedback is announced appropriately.

Exit gate:

- The complete gameplay path is operable at 390 by 844 with touch and keyboard emulation.

### Phase 2: Product shell and target navigation

- Add route-backed Home, Explore, public Profile, Play, Studio, Scenario revision management, More, Advanced, Settings, Help, and Admin locations.
- Implement desktop rail/persistent drawer.
- Implement mobile bottom navigation and More sheet/page.
- Move current story identity and simple save status into the shell.
- Keep a legacy route/tab adapter during migration.

Exit gate:

- Back/Forward, refresh, and direct links preserve location.
- No normal navigation exposes the full internal editor tab list.

### Phase 3: Core player journey

- Build the new Home hierarchy.
- Simplify or fold Dashboard into Home/current-story context.
- Stage New Story creation.
- Add Explore search, filters, and detail preview.
- Redesign Play feedback, composer actions, and mobile tools.

Exit gate:

- A first-time user can sign in, choose an existing scenario, start a private story, play one turn, and confirm it saved without opening Help or Advanced.

### Phase 4: Story Studio

- Create the Studio shell.
- Rehouse Components under Story & Direction and World & Lore without merging internal types.
- Rehouse Reference Cards and Characters under human-facing destinations.
- Redesign Memory Inbox as Suggestions.
- Preserve and reuse the dense list/selected editor treatment.

Exit gate:

- A normal creator can change a premise, character fact, and world fact without encountering raw context policy.

### Phase 5: Advanced, data, settings, billing, help, and admin

- Build Advanced navigation.
- Redesign Automation as a structured rule builder with expert JSON fallback.
- Separate context health from Context Inspector.
- Reorganize Backups & Transfer and Settings by task/scope.
- Rework Help by audience and task.
- Separate Admin into its own role-gated shell.

Exit gate:

- Every existing expert feature has a documented destination and no expert feature leaks into normal navigation merely because it exists.

### Phase 6: Visual consolidation and usability validation

- Remove redundant nested panels and borders after the new hierarchy is stable.
- Consolidate spacing, typography, button, status, field, card/list, dialog, sheet, and navigation tokens.
- Run task-based usability sessions with people unfamiliar with the implementation.
- Correct labels and hierarchy based on observed failures, not preference alone.

Exit gate:

- The success criteria below are met on desktop and mobile.

## Cross-Page Acceptance Criteria

### Main task tests

A person unfamiliar with the implementation can:

1. Continue the most recent story.
2. Find and preview an existing scenario.
3. Start that scenario as a private story.
4. Submit the first gameplay action.
5. Understand when generation is running and when the story is saved.
6. Edit a character fact.
7. Add a world/lore fact.
8. Review a suggested story update.
9. Recover from a save conflict.
10. Find exact context/token details when explicitly asked to do so.

### Product success conditions

- Normal users can complete the main journey without learning Brain, token priority, trigger payload, or context-section terminology.
- Advanced users can still inspect every named context source and rule.
- Every important Play capability is available on mobile.
- Each page has one clear primary action or explicitly has no action because it is a reading-only view.
- No page requires horizontal scrolling at 390 CSS pixels except an intentionally labelled data region with an accessible alternative.
- Navigation location remains correct after browser Back, Forward, refresh, and direct entry.
- Direct entry loads exactly the requested Story before autosave begins; loading, not-found, unauthorized, and offline states cannot overwrite another Story.
- Switching Story IDs cannot leak transcript, context preview, composer draft, scroll position, or pending tool state between Stories.
- Verification, reset, and OAuth callbacks work on nested routes, remove tokens promptly, and restore only a validated safe destination.
- Cloudflare root hosting and GitHub Pages/subpath compatibility both pass nested-route refresh tests.
- Empty, loading, success, offline, conflict, and error states are designed for every network-backed page.
- Browser Local can be entered and used without backend authentication when that runtime mode is selected.
- Scenario revision editing is visibly distinct from private Story editing, and publishing never includes the private Chronicle.
- Explore filters use authored/persisted metadata that can also be edited and published; they never depend on guessed client-only categories.
- Character editing identifies which values belong to the linked Reference Card and which belong to the optional Brain, and keeps their reducer/context paths separate.
- Optimistic Play submission produces exactly one persisted user message; failure preserves a recoverable draft and Retry does not duplicate it.
- New Story drafts survive recoverable navigation/reload, contain no credentials, and are predictably deleted or converted after creation.
- One context build produces one shared health classification across Play, Home/Story Overview, and Context Inspector.
- Every Automation rule survives visual-to-raw-to-visual editing without semantic or field loss.
- Reject and Ignore remain distinct Suggestions outcomes.
- All interactive elements are keyboard reachable and have visible focus.
- Modal focus, Escape, and focus return follow the ARIA dialog pattern.
- Status messages are announced without unexpectedly moving focus.
- Dark and light themes meet WCAG AA contrast for text and meaningful controls.

### Suggested product metrics

Track these without treating analytics as a substitute for user research:

- Time from sign-in to first completed turn.
- First-turn completion rate.
- Scenario preview-to-start conversion.
- Abandonment during New Story creation.
- Rate of generation retries and unrecovered errors.
- Save-conflict successful resolution rate.
- Mobile versus desktop completion of the same core tasks.
- Frequency with which normal users enter Advanced unintentionally.
- Help searches that return no useful result.

This list does not authorize new telemetry. Instrumentation requires separate product/privacy approval, data minimization, appropriate disclosure, retention limits, and a review of whether existing lawful operational data can answer the question first.

## Validation Workflow For Each Implementation Phase

At minimum:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke:prod
```

For UI phases, also run the visual audit harness when its environment is available:

```powershell
node scripts\full-ui-visual-audit.mjs
```

Manual viewport verification matrix:

| Surface | Desktop | Tablet/compact | Mobile |
| --- | --- | --- | --- |
| Viewport | 1440 by 900 | 768 by 1024 | 390 by 844 |
| Input | Mouse and keyboard | Touch and keyboard where available | Touch emulation and mobile keyboard |
| Theme | Light and dark | Light and dark | Light and dark |
| Scenario | Existing Scenario through first completed turn | Same Scenario through first completed turn | Same Scenario through first completed turn |

Runtime-mode verification matrix:

| Mode | Required checks |
| --- | --- |
| Hosted Production | Account gates, backend-authoritative saves, generation, entitlements, conflicts, and plain-language outage states |
| Owner/UAT Rollback | Owner API capability gates, reconnect/offline behavior, save safety evidence, and no production-topology assumptions |
| Browser Local | IndexedDB persistence, user-supplied provider configuration, local import/export, and accurate unavailable-backend messaging |

For every phase:

- Test Back/Forward and refresh.
- Test empty, loading, offline, success, conflict, and failure states.
- Test with keyboard only.
- Test at 200 percent zoom or equivalent reflow pressure.
- Check that no normal-user page accidentally reveals admin/provider secrets.
- Confirm state mutations still flow through reducer/API boundaries.
- Update relevant UI tests and user-facing documentation with the same change.

## Definition Of Done

The redesign is not done when the application merely looks cleaner. It is done when:

- The default information architecture reflects player and creator goals.
- Play is visually dominant and fully functional on desktop and mobile.
- Story Studio uses human concepts while retaining inspectable engine surfaces.
- Advanced and Admin capabilities are deliberate destinations rather than the app's default personality.
- Technical status is translated into useful user status with details available on demand.
- Accessibility and mobile behavior are part of each page's implementation, not a later patch.
- The complete core journey has been played and verified using an existing scenario on both desktop and mobile.
