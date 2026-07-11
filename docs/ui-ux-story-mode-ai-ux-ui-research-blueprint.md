# UX/UI Research and Application Blueprint for Story Mode AI

**Research date:** July 11, 2026  
**Product:** Local-first, browser-based AI interactive-fiction web application  
**Stack assumed:** React, TypeScript, Vite, IndexedDB, static hosting, user-supplied AI provider credentials  
**Document type:** Research synthesis, product-design direction, interaction specification, and implementation roadmap

---

## Executive summary

The central UX challenge is not simply “make the interface cleaner.” It is to reconcile three very different kinds of work inside one product:

1. **Immersive play:** read the story, decide what happens, and stay in narrative flow.
2. **World authoring:** configure lore, cards, character state, quests, prompts, and automation rules precisely.
3. **System stewardship:** understand what the AI changed, review suggestions, diagnose context, recover from failures, and protect local data.

Those activities should share one design system, but they should **not share one interaction density**. The recommended product model is therefore:

- **Play** — calm, reading-first, one dominant action.
- **Studio** — dense, inspectable, keyboard-efficient authoring.
- **Review** — a focused inbox for AI-proposed state changes and automation activity.

The highest-leverage recommendations are:

1. **Protect story flow.** Keep the main reading and input surface visually quiet. Move system mechanics, memory updates, and diagnostics to the periphery unless they require action.
2. **Make AI behavior legible, correctable, and reversible.** Every generated change to story state should have provenance, an explanation, a diff, and an undo path.
3. **Make “local-first” visible rather than implicit.** Use precise language such as “Saved on this device,” provide backup and restore as first-class workflows, expose storage health, and distinguish local persistence from cloud sync.
4. **Use progressive disclosure.** Basic authoring should be approachable; priority weights, raw JSON, prompt templates, regex, cooldowns, and debugging should remain available in clearly labeled advanced sections.
5. **Build accessibility into the component system.** Target WCAG 2.2 AA, keyboard-complete workflows, strong focus treatment, reflow at narrow widths, reduced motion, and accessible live status for generation.
6. **Separate automatic maintenance from creative authorship.** AI is well suited to repetitive context upkeep; the player should retain authority over story direction and consequential world-state changes.
7. **Use a small semantic design-token layer.** The existing charcoal-and-mint direction can be distinctive, readable, and consistent without turning every element green or relying on glow effects.
8. **Measure task success and trust, not feature count.** Useful indicators include successful first generation, recovery from provider errors, false trigger rate, automation acceptance/reversal, import completion, backup freshness, and perceived story continuity.

This report is a **design blueprint rather than a pixel-level audit**. It is based on the supplied project handoff and branding context, not a live inspection of every current screen. Recommendations should therefore be validated against the running app and actual user behavior.

---

## Table of contents

1. [Product context and UX definition](#1-product-context-and-ux-definition)
2. [UX/UI schools of thought and how to use them](#2-uxui-schools-of-thought-and-how-to-use-them)
3. [Recommended product experience principles](#3-recommended-product-experience-principles)
4. [User jobs, modes, and mental models](#4-user-jobs-modes-and-mental-models)
5. [Information architecture and navigation](#5-information-architecture-and-navigation)
6. [Detailed workflow and screen recommendations](#6-detailed-workflow-and-screen-recommendations)
7. [Human–AI interaction model](#7-humanai-interaction-model)
8. [Local-first UX, privacy, security, and data safety](#8-local-first-ux-privacy-security-and-data-safety)
9. [Accessibility and inclusive design specification](#9-accessibility-and-inclusive-design-specification)
10. [Visual design system](#10-visual-design-system)
11. [Content design and microcopy](#11-content-design-and-microcopy)
12. [Responsive behavior and performance](#12-responsive-behavior-and-performance)
13. [React implementation guidance](#13-react-implementation-guidance)
14. [Research and usability-testing plan](#14-research-and-usability-testing-plan)
15. [Measurement framework](#15-measurement-framework)
16. [Prioritized roadmap](#16-prioritized-roadmap)
17. [Definition of done](#17-definition-of-done)
18. [Anti-patterns to avoid](#18-anti-patterns-to-avoid)
19. [Research sources](#19-research-sources)

---

# 1. Product context and UX definition

## 1.1 Product profile used for this analysis

The application is understood to be a personal, browser-based interactive-fiction platform with these characteristics:

- It is a local-first alternative to hosted AI story platforms.
- Adventures, messages, cards, brains, quests, settings, and imported content persist in IndexedDB.
- It has no conventional backend and can be deployed as a static web app.
- The user supplies an API key for a compatible AI provider.
- Context is assembled deterministically from fixed rules, pinned material, triggered story cards, character brains, quests, rolling summary, and recent messages.
- Semantic conditions can trigger card updates, brain updates, quest progression, and automatic card proposals.
- Some maintenance tasks occur after a story turn and should not unnecessarily block reading.
- Imports may contain large stories and many world-state objects, so review and conflict resolution matter.
- The visual direction is dark charcoal with mint or seafoam accents, restrained glow, and minimalist storytelling imagery.

That combination makes the product closer to a **creative professional tool plus a narrative game** than to a generic chatbot.

## 1.2 What “good UX” means here

ISO’s human-centred design standard frames design around understanding users, their tasks, and their environments throughout the system lifecycle.[^iso-hcd] Applied here, “good UX” should be judged by whether the app supports the following outcomes:

| Quality | Desired outcome in this app | Failure signal |
|---|---|---|
| Narrative flow | The player can read, decide, and act without managing system machinery every turn. | The player repeatedly leaves Play to manage cards or dismiss status noise. |
| Agency | The player can edit, retry, branch, dismiss, or undo AI behavior. | AI changes feel permanent or inexplicable. |
| Comprehension | Inclusion rules, triggers, priorities, and automation consequences are understandable. | The user must remember internal terminology or inspect raw JSON to know what will happen. |
| Trust calibration | The app is honest about uncertainty, provider failures, storage scope, and background changes. | Generic “success” messages, unexplained automation, or misleading cloud-like save icons. |
| Efficiency | Frequent actions are fast and keyboard-friendly. | Repeated modal navigation, excessive confirmation, or scanning long forms for one field. |
| Error recovery | Drafts and data survive errors; users have a clear next action. | A failed request clears input, imports partially mutate data, or destructive changes lack undo. |
| Accessibility | Core workflows are usable by keyboard, zoom, screen reader, touch, and reduced-motion users. | Focus is hidden, status is visual-only, controls are too small, or panes fail to reflow. |
| Data ownership | Local storage, backups, exports, and credentials are understandable and controllable. | “Saved” is ambiguous, the user has no recent backup, or credentials leak into exports. |

## 1.3 The primary product promise

The product promise can be expressed as:

> **Stay inside the story while the system keeps the world coherent—and retain control whenever it does not.**

This is more useful than positioning the app merely as an “AI storyteller.” It captures the differentiated value of deterministic context, evolving character memory, automatic world maintenance, and local ownership.

---

# 2. UX/UI schools of thought and how to use them

No single design methodology is sufficient for this product. The best approach is a stack: use one method to identify the right problem, another to structure discovery, another to iterate, and standards or heuristics to evaluate quality.

## 2.1 Human-centred design

**Core idea:** Design around users, tasks, and context of use; evaluate and iterate throughout the lifecycle.[^iso-hcd]

**Use it for this app:**

- Observe complete sessions, not isolated clicks. Story flow, authoring, reviewing automation, and recovering from errors are contextual activities.
- Treat “the user” as different operating modes of the same person: player, worldbuilder, curator, migrator, and troubleshooter.
- Test with real imported adventures and long histories. Empty demo data will hide scale and continuity problems.
- Revisit requirements after observing actual behavior; do not treat the handoff specification as permanent truth.

**Risk if misused:** “User-centred” becomes a label added after implementation instead of evidence that shapes prioritization.

## 2.2 Double Diamond / design thinking

The Design Council’s Double Diamond separates work into **Discover, Define, Develop, and Deliver**, alternating divergent and convergent thinking.[^double-diamond]

**Use it for this app:**

- **Discover:** Watch how players currently use AI Dungeon, scripts, card editors, and manual notes. Record interruptions, workarounds, and moments of mistrust.
- **Define:** Frame problems as outcomes, such as “players cannot tell why a card entered context,” rather than predetermined solutions such as “build a context modal.”
- **Develop:** Prototype several ways to expose context: inline chips, a side inspector, a timeline, and a prompt preview.
- **Deliver:** Implement the smallest coherent version, measure it, and repeat.

**Risk if misused:** A linear “four stage project plan” with no iteration. The model is a thinking structure, not a one-way gate.

## 2.3 Jobs to Be Done (JTBD)

JTBD focuses on the progress people are trying to make in particular circumstances, including functional, emotional, and social dimensions.[^jtbd]

**Use it for this app:** Organize product decisions around jobs such as:

- “Help me continue a story without repeatedly repairing continuity.”
- “Help me create a nuanced world without learning an internal data model first.”
- “Help me understand and correct what the AI remembered.”
- “Help me move an existing adventure without risking the source or losing structure.”
- “Help me recover from provider or browser failures without losing my writing.”

**Risk if misused:** Turning jobs into generic feature requests. A job should describe progress and circumstance, not “I need a cards tab.”

## 2.4 Lean UX

Lean UX emphasizes outcomes, hypotheses, cross-functional learning, prototypes, and short validation cycles rather than maximizing documentation or feature output.[^lean-ux]

**Use it for this app:**

- Write design bets explicitly: “We believe a review inbox with source evidence will reduce accidental automation reversals.”
- Define the evidence before building: lower reversal rate, faster review time, and higher confidence ratings.
- Prototype hard interactions—import conflicts, background task status, context explanations—before perfecting visual styling.
- Instrument development builds or conduct observed tests rather than shipping invasive analytics by default.

**Risk if misused:** “Move fast” without research, accessibility, or recovery design. Lean means reducing waste, not reducing quality.

## 2.5 Usability engineering and heuristic evaluation

Nielsen’s usability heuristics cover system status, real-world language, user control, consistency, error prevention, recognition over recall, efficiency, minimalist presentation, error recovery, and help.[^heuristics]

They map unusually well to this app:

| Heuristic | Direct application |
|---|---|
| Visibility of system status | Distinguish generating, streaming, evaluating triggers, updating memory, saved locally, and failed. |
| Match with the real world | Use “Always include” before “inclusionPolicy: fixed”; use “Last updated” before internal timestamps. |
| User control and freedom | Stop generation, restore draft, undo turn, revert brain update, reject card, roll back import. |
| Consistency and standards | One save-status pattern, one destructive-dialog pattern, one badge grammar, standard keyboard behavior. |
| Error prevention | Validate imports before mutation, test triggers before activation, warn before clearing local data. |
| Recognition rather than recall | Show rule summaries, active context, recent entities, examples, and field descriptions in place. |
| Flexibility and efficiency | Keyboard shortcuts, bulk review, command palette, remembered panel sizes, templates. |
| Aesthetic and minimalist design | Quiet Play mode; advanced technical controls only when requested. |
| Error recovery | Specific cause, preserved work, next action, retry, diagnostics, and fallback. |
| Help and documentation | Contextual help, examples, glossary, provider troubleshooting, import reports. |

Heuristics are a review tool, not proof that the interface works. A heuristic evaluation should be followed by task-based tests.[^heuristic-evaluation]

## 2.6 Progressive disclosure

Progressive disclosure presents the most important or common controls first and reveals secondary or advanced options when needed. It can improve learnability, efficiency, and error prevention.[^progressive-disclosure]

**Use it for this app:**

- Put title, content, active state, and plain-language behavior at the top of a card editor.
- Put semantic conditions, priority, cooldown, prompt overrides, raw state, and IDs under Advanced.
- Keep the Play toolbar minimal; reveal response actions on focus or a clear “More” control.
- Let experts set “Always show advanced fields” as a remembered preference.

**Important distinction:** Progressive disclosure must not make frequent expert actions hard to find. Observe which “advanced” controls are actually common.

## 2.7 Service design and content design

Government service-design guidance emphasizes starting with user needs, designing with data, making hard things simple, iterating, understanding context, and building a coherent service rather than disconnected pages.[^gov-design-principles]

**Use it for this app:**

- Treat “import an adventure” as an end-to-end service: choose, parse, map, review, commit, verify, and recover.
- Treat “configure a provider” as a service: enter credentials, test, explain scope, select model, diagnose failure, and rotate key.
- Use one primary question or decision per import step rather than a single intimidating form.[^one-question]
- Design error and help content as part of the workflow, not as a documentation afterthought.

## 2.8 Inclusive design and accessibility

Microsoft’s inclusive-design principles emphasize recognizing exclusion, learning from diversity, and using solutions for specific needs to benefit more people.[^inclusive-design] WCAG 2.2 provides testable accessibility requirements organized around perceivable, operable, understandable, and robust content.[^wcag-overview]

**Use it for this app:**

- Design keyboard and screen-reader behavior when defining components, not after visual completion.
- Let users adjust narrative font, size, width, and spacing.
- Avoid color-only badges for active, triggered, error, or protected states.
- Make dense Studio layouts transform into coherent single-pane workflows at high zoom.
- Provide non-drag alternatives for reordering.
- Respect reduced-motion settings and avoid decorative parallax or constant pulsing.

## 2.9 Human–AI interaction design

Microsoft’s 18 human–AI guidelines group behavior into initial interaction, regular interaction, error recovery, and adaptation over time.[^microsoft-hai] Google’s People + AI Guidebook similarly stresses user needs, mental models, explainability, feedback, control, and graceful failure.[^pair-guidebook]

**Use it for this app:**

- Explain what automation does and how often it can be wrong.
- Support efficient invocation, dismissal, and correction.
- Show why a condition fired using the relevant rule and story evidence.
- Adapt cautiously; do not silently change prompts or auto-approval behavior.
- Let users globally control what is monitored and what can update automatically.
- Keep a manual path when AI evaluation fails.

This is not optional polish. Probabilistic behavior changes the fundamental interaction contract.

## 2.10 Calm technology

Calm technology argues that systems should require as little attention as necessary, move information between the periphery and center appropriately, and remain useful when parts fail.[^calm-tech]

**Use it for this app:**

- Keep background trigger checks and memory updates in a compact peripheral indicator.
- Escalate only failures or decisions that affect the next turn.
- Use a review badge instead of interrupting the story for every proposed card.
- Let the user type the next action while maintenance runs.
- If semantic evaluation fails, retain keyword/manual behavior and expose the failure later.

## 2.11 Local-first design

Local-first software prioritizes ownership, offline capability, longevity, privacy, and user control over data.[^local-first]

**Use it for this app:**

- Make local storage an explicit product concept, not an invisible implementation detail.
- Provide versioned export, validated restore, and migration paths.
- Show whether browser storage is best-effort or persistent.
- Keep the app shell and authoring tools usable offline; label generation as network-dependent.
- Avoid third-party scripts that undermine the privacy promise.

## 2.12 Design systems and atomic thinking

Atomic Design describes interfaces as a hierarchy of atoms, molecules, organisms, templates, and pages.[^atomic-design] Design tokens capture repeatable decisions such as color, spacing, typography, and motion in named values.[^design-tokens]

**Use it for this app:**

- Build semantic primitives once: buttons, fields, status, badges, dialogs, drawers, lists, editors, diffs, and async task indicators.
- Compose them into domain patterns: Story Turn, Card Row, Review Item, Trigger Tester, Provider Card, and Import Summary.
- Test patterns in all states before assembling pages.
- Name tokens by purpose (`--text-muted`, `--status-warning`) rather than appearance (`--gray-500`).

## 2.13 Recommended synthesis

Use the schools together in this order:

1. **JTBD** identifies meaningful progress.
2. **Human-centred research** provides context and evidence.
3. **Double Diamond** structures exploration and convergence.
4. **Lean UX** turns uncertain ideas into testable bets.
5. **Usability heuristics and content design** improve interaction quality.
6. **Human–AI, calm-tech, and local-first principles** address the app’s unusual risks.
7. **Inclusive design and WCAG** set the accessibility baseline.
8. **Design systems** make the intended quality repeatable in code.

---

# 3. Recommended product experience principles

These principles should guide product decisions, interaction reviews, and implementation acceptance criteria.

## Principle 1: Story first; system second

The primary task in Play is reading and deciding. Cards, token budgets, trigger evaluations, and model details should stay out of the main reading path unless the user asks or intervention is required.

**Design consequence:** A centered narrative column and composer dominate. Context, quest, and automation details live in a side inspector, bottom sheet, or peripheral status area.

## Principle 2: One dominant task per mode

Play should not feel like an editor, and Studio should not pretend to be a minimalist reading experience.

**Design consequence:** Use separate route-level layouts and densities for Play, Studio, and Review, while preserving a shared adventure identity and easy mode switching.

## Principle 3: Reveal complexity in layers

Power should remain available without confronting every user with every implementation detail.

**Design consequence:** Basic, Behavior, Automation, and Debug sections; remembered disclosure preferences; plain-language summaries above technical controls.

## Principle 4: Every consequential AI action is inspectable

The user should be able to answer:

- What changed?
- Why did it change?
- What story evidence was used?
- What future behavior will this affect?
- Can I edit, reject, or undo it?

## Principle 5: Reversible by default

A creative tool should encourage exploration. Undo reduces fear and supports learning.[^user-control]

**Design consequence:** Turn snapshots, version history for state objects, reversible archive, import rollback, and clear boundaries around truly irreversible actions.

## Principle 6: Status must be accurate and specific

“Loading,” “Success,” and a generic spinner are insufficient for a multi-stage AI pipeline.

**Design consequence:** Name the active stage and scope: “Writing the next passage,” “Checking 12 conditions,” “Updating 2 character notes,” and “Saved on this device.”

## Principle 7: Background work remains peripheral until action is required

Automation should reduce work, not create a stream of interruptions.

**Design consequence:** Background task center, unobtrusive progress, review badge, and escalation rules based on severity.

## Principle 8: Use evidence instead of false precision

A raw confidence score can look scientific without being meaningful. For semantic triggers, the most useful explanation is often the matched rule plus the specific turn excerpt.

**Design consequence:** “Matched because the last passage says…” is preferable to “Confidence: 83%” unless the score is calibrated and actionable.

## Principle 9: Local ownership must be legible

The interface should never visually imply cloud durability when data exists only in browser storage.

**Design consequence:** “Saved on this device,” backup freshness, persistent-storage status, export location, and clear warnings around site-data deletion.

## Principle 10: Strong defaults; explicit override

Default settings should support a coherent story without configuration. Advanced users should be able to override prompts, priorities, matching, and automation globally or per object.

## Principle 11: Recognition before memorization

The interface should display the facts users need at the moment of action.[^recognition]

**Design consequence:** Visible inclusion summaries, recent values, examples, trigger test results, last-update provenance, and contextual help.

## Principle 12: Accessibility is a component property

Accessibility cannot depend on each page author remembering every rule.

**Design consequence:** The Button owns focus treatment; Dialog owns focus trapping and restoration; Field owns label/error wiring; Status owns announcement behavior; tabs, menus, and comboboxes follow established ARIA patterns.[^aria-apg]

---

# 4. User jobs, modes, and mental models

## 4.1 Mode-based personas

Because this is currently a personal tool, conventional demographic personas would add little. Mode-based personas are more actionable.

### The player in flow

**Goal:** Continue a compelling story with minimal friction.  
**Needs:** Readability, rapid input, clear generation state, edit/retry/undo, confidence that memory is working.  
**Stressors:** Waiting, continuity errors, technical interruptions, lost text, surprise automation.

### The worldbuilder

**Goal:** Encode stable world knowledge and narrative constraints.  
**Needs:** Structured editing, examples, search, bulk operations, trigger testing, reusable templates.  
**Stressors:** Unclear priority, long forms, raw formats, accidental overwrites.

### The curator

**Goal:** Keep automated memory useful without micromanaging every turn.  
**Needs:** Review queue, diffs, provenance, batch handling, version history, global policies.  
**Stressors:** Notification overload, false positives, repetitive low-value changes.

### The migrator

**Goal:** Move a valuable existing adventure safely.  
**Needs:** Parsing transparency, mapping, duplicate detection, warnings, preview, rollback, import report.  
**Stressors:** Partial mutation, silent data loss, unclear unsupported fields.

### The troubleshooter

**Goal:** Understand why output or state is wrong and recover quickly.  
**Needs:** Context inspector, provider diagnostics, preserved drafts, request IDs, copyable error details, fallback paths.  
**Stressors:** Generic errors, hidden prompts, no reproduction information.

## 4.2 Core jobs-to-be-done

| Situation | Job | Desired emotional outcome |
|---|---|---|
| I return after days away | Help me remember what is happening and continue quickly. | Oriented, eager, not burdened. |
| I submit an action | Help the story respond while preserving my intent and prior context. | Agency and momentum. |
| The model contradicts the world | Help me see what it knew and correct the result without rebuilding state. | Control rather than frustration. |
| A new person or place appears | Help document it without interrupting the scene. | Confidence that the world is maintained. |
| A character’s internal state evolves | Help track that change, but let me inspect and override it. | Narrative depth without loss of authorship. |
| I create an automation rule | Help me understand when it fires and test it safely. | Competence and predictability. |
| I import an old adventure | Help preserve meaning and structure with a reviewable conversion. | Safety and relief. |
| The provider fails | Keep my work, explain the failure, and give me the fastest recovery path. | Reassurance. |
| I clear browser data or change devices | Help me understand the consequence and maintain a usable backup. | Ownership rather than surprise. |

## 4.3 The mental model the interface should teach

A concise product model could be:

1. **The story** is the visible conversation and narrative history.
2. **The world** is reusable context: rules, facts, characters, and quests.
3. **The engine** decides which parts of the world are included for a turn.
4. **Automation** proposes or applies changes after events.
5. **Review and history** let the user inspect and reverse those changes.
6. **Everything is stored on this device unless exported.**

This model should appear consistently in onboarding, navigation, help, and terminology.

---

# 5. Information architecture and navigation

## 5.1 Recommended top-level structure

```text
Adventures
└── Adventure
    ├── Play
    ├── Studio
    │   ├── Overview
    │   ├── World
    │   │   ├── Story cards
    │   │   ├── Characters / brains
    │   │   ├── Quests
    │   │   └── Components / rules
    │   ├── Automation
    │   │   ├── Rules
    │   │   ├── Prompts
    │   │   └── Activity
    │   └── Diagnostics
    │       ├── Context inspector
    │       ├── Trigger tester
    │       └── Provider log
    ├── Review
    └── Adventure settings

Global
├── Provider settings
├── Data and backups
├── Appearance and reading
└── Help
```

## 5.2 Why this structure

- It groups content by the user’s model—story, world, automation, diagnostics—rather than exposing every internal object as an equal top-level tab.
- It keeps Play one click away while preventing authoring controls from crowding the narrative.
- It gives Review a prominent home because review work crosses cards, brains, and quests.
- It separates global provider/data settings from adventure-specific rules.
- It gives technical inspection a discoverable location without placing it in the default flow.

## 5.3 Navigation rules

1. **Preserve adventure context.** The adventure title and Play/Studio/Review switch remain stable across its routes.
2. **Use labels with icons, not icons alone, for primary navigation.**
3. **Do not use horizontal tabs for more than one hierarchy level.** Nested tabs become difficult to scan and poor on mobile.
4. **Deep-link meaningful views.** A review item, card, character, quest step, and context snapshot should have a stable URL where practical.
5. **Preserve list state.** Returning from an editor should restore search, filters, sort, selection, and scroll position.
6. **Make unsaved or invalid draft state explicit before navigation.** Autosave is preferable; otherwise preserve a local draft.
7. **Use breadcrumbs only in Studio where hierarchy is meaningful.** Play does not need a breadcrumb trail.

## 5.4 Suggested route pattern

```text
/adventures
/adventures/:adventureId/play
/adventures/:adventureId/studio
/adventures/:adventureId/studio/world/cards
/adventures/:adventureId/studio/world/cards/:cardId
/adventures/:adventureId/studio/world/characters/:brainId
/adventures/:adventureId/studio/world/quests/:questId
/adventures/:adventureId/studio/automation
/adventures/:adventureId/studio/diagnostics/context
/adventures/:adventureId/review
/adventures/:adventureId/review/:reviewId
/adventures/:adventureId/settings
/settings/providers
/settings/data
/settings/appearance
/help
```

The exact route names are less important than stable, predictable hierarchy.

---

# 6. Detailed workflow and screen recommendations

## 6.1 Adventure library

### Primary goals

- Resume the current story quickly.
- Create or import an adventure.
- Understand local save and backup state.
- Manage many adventures without accidental deletion.

### Recommended layout

Use a **scannable list on desktop by default**, with an optional grid if cover art becomes meaningful. A list better supports metadata, search, sort, and large collections.

Each row should show:

- Adventure title.
- One-line premise or latest-summary excerpt.
- Last played date.
- Turn count or approximate story length.
- Pending review count.
- Backup status when stale or missing.
- Provider/model only when unusual or unavailable.
- Primary action: **Resume**.
- Secondary action: **Open Studio**.
- Overflow: duplicate, export, archive, delete.

### Empty state

Provide three clear paths:

1. **Create an adventure**
2. **Import an existing adventure**
3. **Open a local sample**

The sample should work far enough without an API request to demonstrate reading, cards, review, and context inspection.

### Destructive actions

- Prefer **Archive** over immediate delete.
- Offer undo after archive.
- Delete should name the adventure and state that local history and world data will be removed.
- Provide “Export before deleting” from the confirmation.
- Do not use a generic “Are you sure?” dialog.

### Search and sorting

Support search by title and premise, plus sorting by last played, created, title, and pending reviews. Avoid filter UI until enough adventures exist to justify it.

---

## 6.2 Play mode

### Design intent

Play should feel like a focused reading and writing environment, not an administrative dashboard or generic customer-support chat.

### Desktop composition

```text
┌───────────────────────────────────────────────────────────────┐
│ Adventure title     Play | Studio | Review (2)       • Saved │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                Narrative column: 60–72ch                      │
│                Previous passage                               │
│                Player action                                  │
│                Current passage                                │
│                                                               │
│                         [Jump to latest]                       │
├───────────────────────────────────────────────────────────────┤
│ Do / Say / Story / Continue                                   │
│ [Describe what you do…                                  ]     │
│ Attach context?     ⌘/Ctrl+Enter to send       [Generate]     │
└───────────────────────────────────────────────────────────────┘
                       optional inspector →
```

### Narrative presentation

- Use long-form typography, not large rounded chat bubbles around every passage.
- Distinguish player input with a subtle left rule, label, or background change.
- Keep prose selectable and copyable.
- Preserve paragraph structure and Markdown semantics.
- Default to approximately **60–72 characters per line**, with a user-adjustable reading width. WCAG’s enhanced visual-presentation guidance uses no more than 80 characters or glyphs as an available presentation option.[^visual-presentation]
- Do not auto-scroll if the reader has moved away from the latest output. Show a “Jump to latest” control instead.
- When streaming, keep the current paragraph stable enough to read; avoid repeated layout shifts.

### Composer

The composer is the primary interaction and should:

- Retain text through request, provider, parsing, or navigation failures.
- Expand up to a sensible maximum, then scroll internally.
- Support keyboard submission and an explicit button.
- Make action mode visible: Do, Say, Story, Continue, or the product’s chosen vocabulary.
- Remember the last selected mode unless “Continue” is intentionally transient.
- Disable only the action that cannot proceed; do not disable editing while generation runs.
- Offer **Stop** while a request is streaming.
- After stopping, preserve partial output with options to keep, retry, or discard.

### Response actions

For the latest generated passage, provide:

- Retry.
- Edit.
- Branch from here.
- Copy.
- More: inspect context, report issue, delete turn.

Keep them visually subordinate. On desktop they can appear on hover **and keyboard focus**; on touch they need a persistent or discoverable control.

### Undo and branching

- **Undo last turn** should restore both messages and all dependent state updates as one transaction or snapshot.
- **Retry** should clarify whether it replaces the current branch or creates an alternative.
- **Branch** should name or timestamp the branch and preserve the original.
- If full branching is not implemented, use “Restore snapshot” rather than implying a branch graph exists.

### Active-story context

A collapsed side rail or inspector can show:

- Current objective.
- Active characters.
- Recently triggered cards.
- Background task status.
- Context budget.

Default it to closed or compact. Opening it should not permanently shrink the reading column below a comfortable width.

### Context inspector: “Why did the AI know this?”

This is one of the most valuable differentiators for the app.

For a selected turn, show the context in assembly order:

1. Global rules.
2. Always-on components.
3. Pinned components.
4. Triggered story cards.
5. Active character brains.
6. Quest state.
7. Rolling summary.
8. Recent messages.

For each item show:

- Title and type.
- Inclusion reason.
- Trigger rule or fixed status.
- Approximate size.
- Truncation or omission status.
- Link to edit.

Use a plain-language summary first:

> “This turn included 3 fixed rules, 2 pinned cards, 4 triggered cards, Margo’s character state, the current quest step, the rolling summary, and the 18 most recent messages.”

Advanced users can expand raw prompt text or token estimates.

### Generation and post-turn status

Use a visible state model rather than one spinner:

```text
Drafting → Queued → Sending → Generating → Story ready
                                      └→ Post-turn checks
                                          ├→ No changes
                                          ├→ Applied updates
                                          ├→ Review suggestions
                                          └→ Failed checks
```

Recommended status language:

- “Sending to DeepSeek-compatible provider…”
- “Writing the next passage…”
- “Checking 12 story conditions…”
- “Updating 2 character notes…”
- “2 world updates need review.”
- “Saved on this device at 2:41 PM.”

Background checks should not block reading. If the next generation requires their completed state, allow the user to type and then explain that send is queued briefly: “Finishing 2 world updates before the next passage.”

### Latency behavior

Classic response-time guidance distinguishes roughly instantaneous response, uninterrupted flow, and attention-breaking waits.[^response-times] For AI generation:

- Acknowledge the click immediately.
- Show a named state within approximately one second.
- For longer requests, expose Stop and maintain meaningful activity feedback.
- Avoid unreliable countdowns or exact ETAs.
- Stream output when it improves perceived progress, but offer a reduced-motion or “show when complete” preference.
- Never use animation as a substitute for accurate status.

### Error recovery

A provider failure should include:

1. What failed in plain language.
2. Whether the request reached the provider when known.
3. Confirmation that the player’s input remains available.
4. The next likely actions: retry, test provider, switch model, copy diagnostics.
5. Expandable technical details: status code, provider message, timestamp, request ID where available.

Example:

> **The provider rejected the API key.** Your action is still in the composer. Replace or test the key in Provider settings, then retry this turn.

Avoid “Something went wrong.”

---

## 6.3 Studio shell

### Desktop pattern: master–detail–inspector

```text
┌─────────────┬─────────────────────────────┬──────────────────┐
│ Section nav │ Entity list / search        │ Optional inspector│
│             │ or editor                   │ context, history  │
│ World       │                             │ validation, diff  │
│ Automation  │                             │                   │
│ Diagnostics │                             │                   │
└─────────────┴─────────────────────────────┴──────────────────┘
```

Use at most three panes, and ensure each can collapse. Persist user-set widths locally.

### Studio-wide behavior

- Autosave drafts with clear status.
- Provide undo/redo for field edits and version history for saved objects.
- Search and filter lists.
- Support bulk activate/deactivate, tag, export, and archive where safe.
- Preserve selection and list position.
- Allow keyboard navigation through lists without hijacking standard browser shortcuts.
- Keep technical IDs copyable but out of the primary layout.
- Use a command palette only after core navigation is sound.

### Form organization

Use consistent sections:

1. **Basics** — title, type, content, active state.
2. **Behavior** — when included, priority, triggers, protection.
3. **Automation** — update condition, generation prompt, cooldown, review policy.
4. **History** — last changed, source, versions, revert.
5. **Debug** — IDs, raw state, serialized data.

A one-sentence behavior summary should update live:

> “Active card. Included when the story mentions Margo or Lady Margo. Priority 70. AI updates require review.”

That summary reduces the need to mentally combine several fields.

---

## 6.4 Story cards

### List design

Each row should show:

- Title.
- Type.
- Plain-language inclusion badge: **Always**, **Pinned**, **Triggered**, **Inactive**.
- Trigger summary.
- Priority when relevant.
- Protected state.
- Last updated/source.
- Warning indicator for invalid or never-matched rules.

Do not rely on color alone. Pair badges with text and, where useful, icons.

### Editor design

The content field should dominate. Supporting controls should explain consequences:

- **Always include:** “Sent with every generation. Use for core rules and facts.”
- **Pinned:** “Included while manually pinned for this adventure.”
- **Triggered:** “Included only when a matching rule fires.”
- **Priority:** “Higher-priority items are kept before lower-priority items when context is limited.”

### Trigger builder and tester

Provide both a simple and advanced route:

**Simple:** Natural-language condition or keyword list.  
**Advanced:** match type, phrases, regex, case behavior, semantic evaluation, cooldown.

A test panel should accept or prefill story text and show:

- Fired / not fired.
- Matching phrase or semantic evidence.
- Rule evaluated.
- Any fallback used.
- Approximate context consequence.

Allow testing against the current story without activating the rule.

### Context-cost feedback

Show approximate size and possible impact, but do not imply exact token precision when provider tokenization is unknown.

Example:

> “Approximately 540 tokens. This is a high-priority always-on card and will reduce room for recent messages.”

### Duplicate and conflict support

Warn about likely duplicate titles, overlapping triggers, and contradictory always-on content. These should be warnings with evidence, not automatic deletion.

---

## 6.5 Character brains

### Mental-model caution

“Brain” can remain the product’s domain term, but supporting copy should make clear that it is **editable AI-generated character state**, not a claim of sentience or a hidden permanent mind.

### Recommended structure

- Character identity and aliases.
- Stable traits or constraints.
- Current beliefs, emotions, goals, and relationships.
- Update condition.
- Update prompt override.
- Inclusion behavior and context limit.
- Last update and source turn.
- Change history.

### Human-readable first, raw representation second

Do not require users to edit raw JSON for normal operation. Use structured fields or a human-readable document view; put JSON under Debug with validation and a safe formatter.

### Update provenance

For each automatic update show:

- Before/after diff.
- Condition that fired.
- Story excerpt used.
- Model/provider.
- Timestamp and turn.
- Applied automatically or approved manually.
- Revert control.

### Locks and protection

Allow the user to lock a field or mark a fact as protected from automatic update. A protected fact should still be visible to the model, but automation cannot alter it without explicit review.

### Timeline

A character-state timeline can be useful if it remains readable. Group low-value maintenance operations and emphasize meaningful changes rather than displaying every internal rewrite equally.

---

## 6.6 Quests

### Quest structure

- Title and summary.
- Current state: not started, active, completed, failed, archived.
- Ordered or branching steps.
- Current objective.
- Completion condition per step.
- On-complete effects.
- History and source evidence.

### Completion testing

Like card triggers, quest conditions need a tester against selected story excerpts. Show whether the condition would complete and why.

### Player-facing presentation

In Play, show only the current objective by default. Do not expose implementation conditions unless the user opens the inspector.

### Automatic advancement

Quest advancement is consequential. Default it to review until a rule has demonstrated reliability or the user explicitly changes the policy. Every advancement needs undo and source evidence.

---

## 6.7 Automation and review inbox

### Why a central inbox matters

Automatic card creation, card updates, brain updates, and quest progression create one cross-cutting job: **decide whether a proposed state change belongs in the world**. A central inbox is more coherent than scattering review controls across several tabs.

### Review item anatomy

Each item should include:

- Change type and target.
- Short reason.
- Source turn and highlighted evidence.
- Before/after diff or proposed new content.
- Expected future effect.
- Confidence or ambiguity only if meaningful and calibrated.
- Actions: Approve, Edit and approve, Reject, Defer, Open target.
- Optional policy action: “Always require review for this rule” or “Auto-approve this exact rule in future.”

### Queue organization

Group by:

- Needs decision.
- Failed and needs attention.
- Recently applied.
- Dismissed/history.

Filters can include type, adventure, rule, character, and age.

### Batch actions

Allow batch approval only for homogeneous, low-risk items with clear preview. Avoid a single “Approve all” that mixes new cards, character-state changes, and quest completion.

### Review burden controls

- Deduplicate similar proposals.
- Combine multiple edits to the same object into one review item when safe.
- Let users tune rule-specific review policy.
- Show the estimated effect of a global auto-approve policy.
- Surface stale backlog without interrupting every play turn.

### Activity log vs. inbox

Keep them separate:

- **Inbox:** decisions still required.
- **Activity:** immutable audit trail of evaluated, applied, rejected, failed, and reverted actions.

---

## 6.8 Import workflow

The existing four-stage concept is sound. Make each stage answer one major question.[^one-question]

### Step 1: Choose source

- Select story export and optional card export.
- Explain accepted formats and privacy: parsing occurs locally.
- Show file names and sizes.
- Do not begin mutation.

### Step 2: Parse and validate

Show determinate progress where possible and summarize:

- Turns found.
- Cards found.
- Brain-like entries detected.
- Quests or settings detected.
- Warnings.
- Unsupported fields.
- Parse failures with line/item references.

Allow downloading or copying an import report.

### Step 3: Map and resolve

- Map source types to app types.
- Review detected brains.
- Resolve duplicates by keep both, replace, merge, or skip.
- Show default decisions with rationale.
- Allow bulk choices with item-level override.

### Step 4: Review and import

- Preview the resulting adventure.
- Show exact counts and warnings.
- Default to creating a new adventure rather than merging.
- If merging, create a pre-import snapshot automatically.
- Name the destination clearly.
- Commit as one transaction where possible.

### Completion

Use a meaningful summary:

> **Import complete.** Created 184 turns, 57 story cards, 4 character brains, and 3 quests. Two cards were skipped as duplicates. A rollback snapshot is available.

Provide:

- Open in Play.
- Open review items.
- View import report.
- Undo import or restore snapshot.

### Failure behavior

If parsing or commit fails:

- Keep the source and mapping draft.
- State whether any data changed.
- Roll back partial writes.
- Offer retry and technical details.

---

## 6.9 Provider settings and API credentials

### Provider card

Each configured provider should show:

- Provider name.
- Base URL when editable.
- Model.
- Credential status: session only, remembered on this device, missing.
- Last successful test.
- Test connection.
- Edit, duplicate, remove.

### Credential entry

Use a password-style field with:

- Show/hide.
- Paste support.
- Clear/replace.
- Explicit storage choice.
- Provider-specific test.
- Never display the full key after save.

Recommended default:

- **Use for this session only**
- Optional: **Remember on this device** with a concise risk explanation.

Example copy:

> Remembering the key stores it in this browser so JavaScript running on this app’s origin can use it. It will not be included in adventure exports. A browser-only app cannot protect a remembered key like a server-side secret.

### Test results

Distinguish:

- Network/DNS failure.
- Authentication failure.
- Permission or quota failure.
- Model not found.
- Invalid response format.
- Success with provider/model named.

Do not mark a key “valid” merely because it is non-empty.

### Advanced provider settings

Hide by default:

- Base URL.
- Request headers.
- Timeout.
- temperature/top-p or model generation parameters.
- context limits.
- compatibility mode.

Provide reset-to-provider-defaults.

---

## 6.10 Data and backup settings

A dedicated data page should show:

- “Your data is stored on this device.”
- Current browser/origin.
- Storage used and estimated quota when available.
- Persistence status: best-effort or persistent.
- Last successful autosave.
- Last full export/backup.
- Export all data.
- Import/restore backup.
- Validate backup without restoring.
- Clear adventure or clear all data.

Request persistent storage using `navigator.storage.persist()` after the app has demonstrated value—such as after the first adventure or import—not during the first seconds of onboarding. Browsers may otherwise keep data in best-effort storage that can be evicted under certain conditions.[^storage-persist][^storage-quotas]

### Backup reminders

A reminder can appear when:

- The user has significant changes and no export.
- The latest backup is old relative to recent activity.
- Storage is not persistent.
- The browser or origin appears to have changed.

Keep reminders dismissible and do not imply that an export is automatic.

---

## 6.11 Onboarding and help

### First-run sequence

1. State the product promise and local-storage model.
2. Offer Create, Import, or Open sample.
3. Configure a provider only when generation is needed.
4. Start a guided first turn.

Avoid a long product tour. Users do not yet have context for every tab.

### Contextual teaching

- Empty states include examples and next actions.
- Complex fields include a short description and a tested example.
- The first automatic proposal explains the review model in place.
- The first context-inspector visit explains inclusion order.
- Help links open the relevant topic, not the top of a manual.

### Help structure

- Getting started.
- Playing and branching.
- How context works.
- Cards and triggers.
- Character brains.
- Quests.
- Automation and review.
- Importing.
- Providers and credentials.
- Data, backups, and recovery.
- Troubleshooting.
- Keyboard shortcuts.
- Glossary.


---

# 7. Human–AI interaction model

## 7.1 The correct division of labor

Google’s People + AI guidance distinguishes between **automation** and **augmentation**: automate work that is repetitive, unpleasant, or has a reasonably agreed correct outcome; augment work that people enjoy, value, or reasonably disagree about.[^pair-user-needs]

For this product:

| Work | Recommended role for AI | Human authority |
|---|---|---|
| Draft the next passage | Augment creative play | Player chooses action, can edit/retry/branch. |
| Identify potentially relevant lore | Automate retrieval | User can inspect and pin/unpin. |
| Summarize older story | Automate with inspection | User can edit or restore prior summary. |
| Detect new named entities | Automate detection; propose creation | User approves, edits, or rejects by default. |
| Update character internal state | Propose or cautiously automate | User can protect fields, review diff, and revert. |
| Complete a quest step | Detect and propose, or rule-specific auto-apply | User can undo and change policy. |
| Decide the story’s meaning or preferred direction | Augment, never silently finalize | Player remains creative authority. |
| Repair malformed imported data | Suggest mappings | User confirms consequential merges or drops. |

The goal is not maximal automation. It is **minimal administrative burden with retained authorship**.

## 7.2 An explicit interaction contract

The product should teach these promises:

1. AI output can be wrong.
2. The app will show which information influenced a turn when asked.
3. The app will preserve the player’s input when requests fail.
4. Automatic changes will follow visible policies.
5. Consequential changes can be reviewed or reversed.
6. The model/provider may change behavior; the app will not silently claim identical results.
7. Data and credentials have clearly stated storage and transmission boundaries.

This contract is more trustworthy than vague language about “smart,” “learning,” or “perfect memory.”

## 7.3 Applying Microsoft’s human–AI guidelines

Microsoft’s guidelines are grouped around initial interaction, regular interaction, failure, and change over time.[^microsoft-hai] The most important applications are:

| Guideline | Product behavior |
|---|---|
| Make clear what the system can do | Onboarding explains generation, context selection, memory proposals, imports, and what remains manual. |
| Make clear how well it can do it | Explain that semantic triggers and generated state are probabilistic and may require correction. |
| Time services based on context | Run maintenance after output and keep it peripheral; interrupt only when the next turn is affected. |
| Show contextually relevant information | In Play, show current objective and relevant status; leave raw settings in Studio. |
| Support efficient invocation | Generate, test trigger, update brain, rerun import parse, and inspect context are easy to start. |
| Support efficient dismissal | Stop generation, reject proposal, dismiss help, skip mapping, disable a rule. |
| Support efficient correction | Edit output, refine prompt, change trigger, modify proposal, revert state. |
| Scope services when uncertain | Ask for review, present alternatives, or use a fallback instead of making a high-impact silent change. |
| Make clear why the system acted | Show rule, evidence, source turn, target, and context consequence. |
| Remember recent interactions | Preserve recent story and recent editor selections, but give users control over what memory means. |
| Update and adapt cautiously | Do not silently change automation policies or prompts based on inferred behavior. |
| Encourage granular feedback | Let the user correct a passage, a single field, a trigger match, or one proposal rather than rating an entire session. |
| Convey consequences | Explain that pinning or always-including a card consumes context every turn; explain what auto-approve will permit. |
| Provide global controls | Adventure-wide toggles for semantic evaluation, Auto Cards, brain updates, quest updates, and review policy. |
| Notify users about changes | Release notes and in-product notices for changes to context assembly, import behavior, or automation defaults. |

## 7.4 Explainability: answer the user’s actual question

“Explainability” should be task-specific. The user may ask:

- **Why did the passage mention this fact?** Show context items and source snippets.
- **Why did this card trigger?** Show the condition and matching evidence.
- **Why was this character updated?** Show condition, source turn, and diff.
- **Why did the quest advance?** Show completion condition and evidence.
- **Why was recent story omitted?** Show budget allocation and truncation order.
- **Why did the provider fail?** Show response category and diagnostics.

Google’s guidance recommends optimizing explanations for understanding and calibrated trust rather than presenting complexity for its own sake.[^pair-explainability]

### Explanation layers

1. **Summary:** One sentence in domain language.
2. **Evidence:** Relevant story excerpt and rule.
3. **Impact:** What changed or entered context.
4. **Technical detail:** Raw request, IDs, approximate tokens, provider output.

Do not make raw prompt text the only explanation.

## 7.5 Uncertainty and review policy

Use risk-based defaults:

| Change type | Default policy | Rationale |
|---|---|---|
| Suggested new story card | Review | New persistent world fact. |
| Minor formatting/normalization | Auto-apply with history | Low creative impact. |
| Brain field update | Review initially; per-rule auto-apply after trust | Can alter characterization. |
| Quest step completion | Review initially | Consequential narrative state. |
| Rolling summary refresh | Auto-apply with version history | Frequent maintenance; must remain editable. |
| Trigger match for current context | Apply for the turn; explain afterward | Reversible at turn retry; central engine behavior. |
| Deletion or merge | Always confirm/review | Potential data loss. |

Users should be able to promote a reliable rule from review to auto-apply and demote it again. The setting should show scope: **this rule**, **this object type**, or **this adventure**.

## 7.6 Feedback should map to a real effect

Google recommends aligning feedback with model or product improvement, explaining its value, and balancing control with automation.[^pair-feedback]

In a local personal app, avoid decorative thumbs-up/down controls that do nothing. Useful feedback actions are concrete:

- Edit passage and optionally save the difference as a style preference.
- Mark a trigger as false positive and adjust its rule.
- Correct one brain field and protect it.
- Reject a card and optionally suppress similar proposals for a period.
- Mark a quest completion premature and reopen the step.
- Choose between two mappings during import.

Whenever feedback changes future behavior, state exactly how:

> “Future proposals from this rule will require review.”

or

> “This correction updates the adventure’s style guidance; it does not retrain the provider model.”

## 7.7 Graceful failure

AI failures should not create dead ends. Google’s guidance specifically recommends a non-AI path where possible.[^pair-errors][^pair-mental-models]

Fallbacks for this app:

- Semantic trigger unavailable → use configured keyword/regex fallback or defer review.
- Brain update fails → keep prior state; log failure; do not block story display.
- Auto-card generation fails → retain detected entity as a review stub.
- Summary refresh fails → retain previous summary and include recent messages according to deterministic rules.
- Provider unavailable → preserve composer, allow provider switch, copy prompt, or continue authoring offline.
- Import classification fails → let the user map the item manually.

A failed subsystem should degrade to a usable state rather than corrupting or freezing the whole experience.

## 7.8 Status and notification hierarchy

Use the least disruptive channel that fits the need:

| Channel | Use for | Do not use for |
|---|---|---|
| Inline field message | Validation, format, local consequence | Global provider outage |
| Inline page status | Save state, import progress, generation stage | Unrelated historical notices |
| Peripheral status pill | Background checks and maintenance | Required user decision |
| Review badge/inbox | Deferred consequential proposals | Immediate fatal error |
| Toast | Brief confirmation with no follow-up, ideally undo | Persistent failure or multi-step progress |
| Banner | Page- or app-wide condition requiring awareness | Every successful save |
| Dialog | Destructive/irreversible action or focused decision | Routine information or background status |

Avoid a stack of toasts for each card, brain, and quest update. One aggregate message is calmer and more informative.

## 7.9 Streaming and assistive technology

Streaming every token into an ARIA live region can overwhelm screen-reader users. Recommended behavior:

- Keep the visual stream available.
- Announce a concise status when generation starts.
- Announce completion or failure once.
- Provide an option to read the completed passage from its heading or landmark.
- Do not mark the entire narrative container as continuously live.
- Preserve focus in the composer unless the user deliberately moves it.

---

# 8. Local-first UX, privacy, security, and data safety

## 8.1 Local-first is a user experience, not only an architecture

The app should answer four questions at all times:

1. **Where is my data?**
2. **Is it saved?**
3. **Could the browser remove it?**
4. **How do I move or restore it?**

A local-first product that does not answer those questions may feel less trustworthy than a cloud product, even if its architecture is more private.

## 8.2 Save vocabulary

Use precise states:

- “Saving…”
- “Saved on this device.”
- “Saved on this device at 2:41 PM.”
- “Could not save. Your unsaved changes are still open.”
- “Browser storage is best-effort. Export a backup or enable persistent storage.”
- “Backup exported July 10, 2026.”

Avoid a cloud icon or “Synced” unless actual multi-device synchronization exists.

## 8.3 Autosave design

- Debounce routine field saves, but write critical turn transactions promptly.
- Save atomic state transitions where possible.
- Preserve unsaved editor drafts separately from canonical objects.
- On startup after an interrupted write, detect and offer draft recovery.
- Keep save status near the object or global shell, not only in a disappearing toast.
- Do not show “Saved” until the IndexedDB transaction succeeds.

## 8.4 Storage persistence and quota

The browser Storage API can report estimated usage and request persistent storage. Without persistence, data is generally best-effort and may be evicted under browser storage pressure; persistent data is ordinarily removed only by explicit user action.[^storage-persist][^storage-quotas]

Recommended UI:

```text
Storage on this device
Used: 128 MB of an estimated 4.2 GB
Protection: Best-effort
[Protect local data]  [Export backup]
```

After a persistence request:

- Granted: “This browser has marked the app’s storage as persistent.”
- Denied/unavailable: “The browser did not grant persistent storage. Your data remains saved, but regular exports are recommended.”

Do not claim persistence guarantees against profile deletion, browser reset, device loss, or manual site-data clearing.

## 8.5 Export and restore

### Export format

Use a versioned container with:

- Schema version.
- Export timestamp.
- App version.
- Adventure metadata.
- Messages and snapshots.
- Cards, brains, quests, components, prompts, and settings.
- Checksums or internal validation data.
- Explicit exclusion of API keys and transient logs.

### Restore flow

1. Select backup.
2. Validate structure and version locally.
3. Show contents and warnings.
4. Choose replace, merge, or restore as copy.
5. Create a pre-restore snapshot where possible.
6. Commit transaction.
7. Verify counts and references.
8. Provide restore report and rollback.

### Compatibility

- Migrate older schema versions with explicit migration functions.
- Reject future unsupported versions safely.
- Never silently discard unknown fields; report them.
- Provide “Validate backup” without changing data.

## 8.6 Backup reminders without nagging

Base reminders on risk, not a fixed daily notification:

- No backup exists after substantial work.
- Many changes occurred since the last backup.
- Persistent storage is unavailable.
- An import or destructive migration is about to run.
- The app version introduces a schema migration.

A reminder should offer **Export now**, **Remind me after more changes**, and **Do not remind for this adventure** where appropriate.

## 8.7 API-key security reality

OWASP recommends avoiding persistent browser storage for sensitive information and notes that JavaScript-accessible storage is exposed to cross-site scripting risk.[^owasp-html5] A static browser app cannot make a user-supplied API key equivalent to a server-held secret, because the browser must access the key to send requests.

Therefore:

- Default to session-only credential use.
- Make persistent storage opt-in and explain the tradeoff.
- Never include credentials in exports, logs, URLs, analytics, error messages, clipboard diagnostics, or source maps.
- Redact credentials in network/error displays.
- Use a strict Content Security Policy and avoid inline/eval-style script execution.
- Minimize third-party JavaScript, especially analytics, chat, and ad scripts.
- Pin or review dependencies and treat user-imported content as untrusted.
- Sanitize rendered Markdown/HTML; do not allow imported story content to execute scripts.
- Avoid rendering provider responses with unsafe HTML.
- Provide an immediate “Forget key” action.
- Recommend scoped, revocable provider keys and provider-side limits when available, without assuming every provider supports them.

### Storage choice copy

```text
Use for this session only (recommended)
The key is forgotten when this tab/session ends.

Remember on this device
The key is stored in this browser for convenience. Anyone or any script
with access to this browser profile and app origin may be able to use it.
```

### Future optional architecture

If the product later serves multiple users, an optional server-side proxy can keep provider credentials off the client. That would change the current no-backend privacy and deployment model and should be treated as a separate product decision, not a hidden implementation tweak.

## 8.8 Offline behavior

Separate three states:

- **App available:** cached shell, local adventures, Studio editing.
- **Provider unavailable:** generation and semantic calls unavailable.
- **Storage unavailable/failing:** critical local-data warning.

When offline:

- Permit reading and authoring.
- Queue nothing automatically unless queue behavior is explicit and cancellable.
- Preserve the composer.
- Show “Generation requires a network connection.”
- Allow export and local diagnostics.

## 8.9 Privacy language

Use narrow, verifiable claims:

Good:

> “Adventure data is stored in this browser. When you generate, the assembled prompt is sent to the provider you configured.”

Avoid:

> “Everything is completely private.”

The latter ignores provider transmission, browser extensions, local device access, imported files, and persistent credentials.

---

# 9. Accessibility and inclusive design specification

## 9.1 Target

Use **WCAG 2.2 Level AA** as the baseline, with selected AAA enhancements for reading comfort and motion.[^wcag-standard]

Accessibility should cover complete workflows, not only static pages:

- Create/import an adventure.
- Configure and test a provider.
- Play, stop, retry, edit, and undo.
- Open and operate the context inspector.
- Create/test a card.
- Review and revert an AI update.
- Export and restore data.

## 9.2 Semantic structure

- Use one descriptive `<h1>` per route and logical heading levels beneath it.
- Use landmarks: header, navigation, main, complementary inspector, and footer where present.
- Use actual `<button>`, `<a>`, `<input>`, `<textarea>`, `<select>`, `<details>`, and list elements before custom ARIA widgets.
- Give icon-only controls accessible names.
- Associate field help and errors using `aria-describedby`.
- Mark required fields in text and programmatically.
- Use tables only for genuinely tabular data.

## 9.3 Keyboard operation

Every core action must work without a pointer:

- Logical tab order.
- Visible focus.
- Escape closes dismissible overlays.
- Dialog focus enters the dialog and returns to the invoking control.
- Arrow-key behavior follows the relevant APG pattern for tabs, menus, listboxes, and comboboxes.[^aria-apg]
- Keyboard shortcuts do not override browser or assistive-technology conventions.
- Provide a shortcut reference and allow shortcuts to be disabled or changed when they use character keys.
- Reordering supports move up/down controls, not drag only.

## 9.4 Focus visibility and sticky UI

WCAG 2.2 requires focused components not to be entirely hidden by author-created content; sticky headers and footers are common causes.[^focus-not-obscured]

For the sticky Play composer:

- Add sufficient `scroll-padding-bottom`.
- When validation focuses a field, ensure the whole field and message are visible.
- Do not let side drawers cover the focused control.
- Use a focus indicator with at least 3:1 contrast against adjacent colors where author-styled.[^non-text-contrast]
- Prefer a 2–3 px outline plus offset rather than glow alone.

## 9.5 Contrast and color

At Level AA:

- Normal text needs at least 4.5:1 contrast.
- Large text needs at least 3:1.[^contrast-minimum]
- Visual information needed to identify controls, states, and meaningful graphics needs at least 3:1 against adjacent colors.[^non-text-contrast]

Additional rules:

- Never encode card state, validation, quest status, or review severity only by hue.
- Underline links in prose or provide another persistent non-color cue.
- Test disabled states for legibility even though some contrast criteria exempt inactive controls.
- Avoid very thin mint lines and icons; anti-aliasing can make nominally passing colors appear weaker.

## 9.6 Target size and touch

WCAG 2.2 AA sets a 24 × 24 CSS pixel minimum target or spacing exceptions.[^target-size] For this app:

- Aim for **44 × 44 CSS pixels** for primary touch controls and icon buttons.
- Keep small inline prose links as natural text links, but avoid clusters of tiny adjacent icon actions.
- Make the full label area clickable for checkbox/radio controls.
- Give composer mode controls enough separation for one-handed mobile use.

## 9.7 Reflow and zoom

WCAG 2.2 requires content to reflow at a width equivalent to 320 CSS pixels without loss of information or functionality, with exceptions for genuinely two-dimensional tools.[^reflow]

- Play becomes one column.
- Studio multi-pane layouts become list → full-screen editor → inspector rather than squeezed panes.
- Data tables can scroll within their region, but controls and cell content remain usable.
- Test at 200% text resize and 400% browser zoom.
- Avoid fixed-height editor regions that clip enlarged text.
- Do not require horizontal page scrolling for prose or forms.

## 9.8 Reading presentation

WCAG’s enhanced visual-presentation guidance supports user control over colors, line width, spacing, alignment, and text resizing.[^visual-presentation]

Provide a Reading settings panel with:

- Font size.
- Serif/sans/system font choice.
- Narrow/standard/wide line width.
- Compact/comfortable/spacious line height.
- Paragraph spacing.
- Theme.
- Streaming on/off.
- Reduced decorative motion.

Defaults should already be comfortable; settings are not a substitute for good typography.

## 9.9 Motion

W3C guidance recommends eliminating unnecessary motion and respecting user motion preferences; interaction-triggered nonessential animation should be disableable at the enhanced level.[^animation]

- Honor `prefers-reduced-motion`.
- Avoid parallax, page flips, animated background particles, and constant glowing/pulsing status.
- Use motion only to explain spatial change or state transition.
- Under reduced motion, replace movement with instant changes or opacity-only transitions where safe.
- Do not animate scrolling without user control.

## 9.10 Generation and live regions

- Announce “Generation started,” “Generation complete,” and failure as concise status changes.
- Avoid token-by-token announcements.
- Use `aria-busy` carefully on the specific region, not the entire app.
- The Stop button must remain focusable and enabled.
- Loading skeletons need accessible labels or should be hidden from accessibility APIs if decorative.
- Progress bars expose determinate values only when real progress exists.

## 9.11 Dialogs, drawers, and bottom sheets

- Use a modal dialog only when interaction outside must be blocked.
- Drawers that allow background reference may be non-modal, but focus order and close controls must remain clear.
- Give every dialog a visible title.
- Put the least destructive action first in tab order unless platform conventions strongly indicate otherwise.
- Do not nest modal dialogs.
- On mobile, bottom sheets need a close button; drag-to-dismiss cannot be the only method.

## 9.12 Forms and errors

Error messages should identify the problem and the recovery action.[^error-messages]

- Validate after a reasonable interaction point, not while the user is still entering a valid format.
- Keep entered values.
- Put the message next to the field and summarize multiple errors at the top with links.
- Do not use placeholder text as the only label.
- Use examples for semantic conditions, regex, and provider URLs.
- Indicate successful validation only when useful for complex fields, such as a tested provider key.

## 9.13 Diff and provenance accessibility

- Do not communicate insertions/deletions only with green/red.
- Label “Added,” “Removed,” and “Unchanged.”
- Provide a unified text alternative to side-by-side diffs.
- Let screen-reader users navigate change headings.
- Source excerpts should identify turn number/speaker and have a link to the story location.

## 9.14 Accessibility test matrix

| Test | Minimum coverage |
|---|---|
| Keyboard only | All core workflows, dialogs, panes, list actions, composer, review. |
| Screen reader | VoiceOver/Safari and NVDA/Firefox or Chrome for key flows. |
| Zoom/reflow | 200% text, 400% zoom, 320 CSS px equivalent. |
| Contrast | Text, icons, control boundaries, focus, badges, charts/diffs. |
| Reduced motion | OS preference and in-app setting. |
| Touch | Small phone viewport, portrait, one-handed composer actions. |
| Forced colors/high contrast | Core controls, focus, selected states, icons. |
| Automated checks | axe or equivalent in component and end-to-end tests; Lighthouse as a supplement. |

Automated checks catch only part of accessibility; manual and real-user testing remain necessary.[^web-accessibility-testing]

---

# 10. Visual design system

## 10.1 Visual direction

The charcoal-and-mint branding direction fits the product: mysterious, calm, modern, and distinct from generic blue/purple AI interfaces. The main risk is turning the entire UI into low-contrast green-on-black glow.

Recommended visual hierarchy:

- Charcoal canvas.
- Slightly lighter neutral surfaces.
- Warm or pale neutral primary text.
- Mint reserved for primary action, focus, selected state, and meaningful highlights.
- Amber for caution and queued review.
- Soft red for errors/destructive actions.
- Minimal glow, used as decorative depth rather than the only boundary or focus cue.

## 10.2 Example semantic color tokens

The following is a **starting palette**, not a final brand mandate. Contrast ratios were calculated using the WCAG relative-luminance formula and should be rechecked in automated tests.

### Dark theme

| Token | Value | Intended use | Example contrast |
|---|---:|---|---:|
| `--canvas` | `#0B0F0E` | App background | — |
| `--surface` | `#111816` | Panels, composer, cards | — |
| `--surface-raised` | `#17211E` | Dialogs, selected layers | — |
| `--text-primary` | `#EDF7F2` | Main text | 16.45:1 on `--surface` |
| `--text-secondary` | `#AFC2B9` | Supporting text | 9.64:1 on `--surface` |
| `--text-muted` | `#879A91` | Metadata; not placeholders only | 6.06:1 on `--surface` |
| `--accent` | `#7DE2B8` | Links, focus, selected, primary accents | 11.53:1 on `--surface` |
| `--on-accent` | `#062117` | Text/icons on mint buttons | 10.86:1 on `--accent` |
| `--border-control` | `#5C7067` | Required control boundaries | 3.40:1 on `--surface` |
| `--danger` | `#FF8F8F` | Error text/icons | 8.21:1 on `--surface` |
| `--warning` | `#F7C96B` | Warnings, pending review | 11.60:1 on `--surface` |
| `--success` | `#79D6A5` | Verified/saved success | 10.27:1 on `--surface` |

Use a darker, lower-contrast border only when it is decorative and not required to identify a control.

### Light theme

| Token | Value | Intended use | Example contrast |
|---|---:|---|---:|
| `--canvas` | `#F4F7F5` | App background | — |
| `--surface` | `#FFFFFF` | Panels and forms | — |
| `--text-primary` | `#14201C` | Main text | 16.76:1 on white |
| `--text-secondary` | `#46564F` | Supporting text | 7.77:1 on white |
| `--text-muted` | `#65746D` | Metadata | 4.92:1 on white |
| `--accent` | `#176C4D` | Links and primary controls | 6.39:1 on white |
| `--on-accent` | `#FFFFFF` | Text/icons on accent | 6.39:1 on accent |
| `--border-control` | `#718078` | Control boundaries | 4.15:1 on white |
| `--danger` | `#A72424` | Errors/destructive actions | 7.19:1 on white |
| `--warning` | `#765400` | Warning text/icons | 6.91:1 on white |

## 10.3 Color semantics

- **Mint:** active, selected, focus, primary action, linked context—not every decorative label.
- **Amber:** needs attention, pending review, partial import, quota warning.
- **Red:** failed, destructive, invalid—not simply inactive.
- **Neutral:** ordinary saved state, metadata, disabled, archived.
- **Blue or violet, optional:** informational diagnostics if a fourth semantic family is needed.

Pair all semantic color with text or shape.

## 10.4 Typography

### UI typography

Use a local/system sans stack for performance and privacy:

```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

### Narrative typography

Offer a serif option for long-form reading without requiring a web-font download:

```css
font-family: ui-serif, Charter, "Bitstream Charter", Georgia, serif;
```

### Suggested scale

| Role | Size | Line height | Notes |
|---|---:|---:|---|
| Narrative body | 17–19 px | 1.55–1.75 | User-adjustable. |
| UI body | 15–16 px | 1.45–1.6 | Do not shrink dense forms below legibility. |
| Metadata | 13–14 px | 1.4–1.5 | Must still meet contrast. |
| Page title | 24–32 px | 1.15–1.25 | Responsive `clamp()`. |
| Section title | 18–22 px | 1.25–1.35 | Strong hierarchy. |
| Label | 14–15 px | 1.3–1.45 | Sentence case. |

Avoid all-caps paragraphs or widespread letter spacing. All caps can remain a restrained brand accent for very short eyebrow labels.

## 10.5 Spacing and density

Use a 4 px base scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Recommended density modes:

- **Comfortable:** default Play and first-time Studio.
- **Compact:** optional Studio lists and tables.

Density should change padding and row height, not font size below a usable baseline.

## 10.6 Shape and elevation

- 8–12 px radius for panels and controls.
- Smaller 6–8 px radius for compact tags and inputs.
- Avoid a rounded card around every paragraph or list row.
- Use border and surface contrast before heavy shadow.
- Reserve a stronger shadow for dialogs, menus, and floating inspectors.
- Glow should never replace a boundary, focus ring, or contrast requirement.

## 10.7 Component hierarchy

### Buttons

- **Primary:** one per local decision area.
- **Secondary:** alternative actions.
- **Quiet/tertiary:** low-emphasis actions.
- **Destructive:** red semantics and explicit text.
- **Icon button:** tooltip plus accessible name; 44 px target for primary touch use.

Do not have multiple mint-filled buttons competing in one panel.

### Badges

Badges communicate state, not actions. Use short text:

- Always
- Pinned
- Triggered
- Protected
- Review
- Failed
- Archived

Avoid more than two or three simultaneous badges in a row; move detail to a summary line.

### Fields

- Persistent label.
- Optional description above or below.
- Visible boundary with sufficient contrast.
- Focus ring.
- Inline validation.
- Character/token guidance only where it helps a decision.

### Cards and list rows

Use a card when content is a self-contained object. Use list rows for dense collections. Avoid “card soup,” where every label, status, and paragraph sits in another rounded rectangle.

## 10.8 Motion system

Suggested durations:

- 80–120 ms: pressed/hover response.
- 120–200 ms: small disclosure, menu, tooltip.
- 180–260 ms: panel or route-level continuity transition.

Use standard easing and reduce or eliminate movement under `prefers-reduced-motion`. Do not animate every streamed token, badge, or save event.

## 10.9 Design-token example

```css
:root {
  color-scheme: dark;

  --color-canvas: #0b0f0e;
  --color-surface: #111816;
  --color-surface-raised: #17211e;
  --color-text-primary: #edf7f2;
  --color-text-secondary: #afc2b9;
  --color-text-muted: #879a91;
  --color-accent: #7de2b8;
  --color-on-accent: #062117;
  --color-border-control: #5c7067;
  --color-danger: #ff8f8f;
  --color-warning: #f7c96b;
  --color-success: #79d6a5;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius-control: 0.5rem;
  --radius-panel: 0.75rem;

  --duration-fast: 100ms;
  --duration-standard: 180ms;

  --measure-story: 68ch;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

Treat the reduced-motion reset carefully around essential progress or media; test rather than copying it blindly.

---

# 11. Content design and microcopy

## 11.1 Voice

The product voice should be:

- Clear, direct, and calm.
- Slightly literary in empty states or branding, but operational in controls and errors.
- Honest about AI and storage.
- Never scolding.
- Specific about consequences.

Avoid excessive fantasy language in settings and diagnostics. The story can be magical; the interface should remain understandable.

## 11.2 Terminology map

| Internal term | User-facing default | Advanced detail |
|---|---|---|
| Context assembly | What the AI knows for this turn | Context assembly order |
| Fixed priority component | Always-included rule | Fixed priority |
| Trigger evaluation | Check story conditions | Semantic/keyword evaluation |
| Brain entry | Character state | Brain entry / structured state |
| Rolling summary | Story so far | Rolling summary |
| Context budget | Available memory for this turn | Approximate token budget |
| Auto Card | Suggested story card | Automatic entity/card generation |
| onComplete action | When this step completes | Completion action |
| Reducer transaction | Saved change | State transaction / debug only |

## 11.3 Status examples

Good:

- “Saved on this device.”
- “Writing the next passage…”
- “Checking story conditions…”
- “No world updates were needed.”
- “Two updates need review.”
- “Provider connected: model X is available.”
- “Import parsed with 3 warnings.”

Weak:

- “Processing…”
- “Done.”
- “Success!”
- “AI thinking…”
- “Memory updated” with no scope.

## 11.4 Error formula

Use:

> **What happened.** What remains safe. What to do next. Optional technical detail.

Examples:

> **The request timed out before the provider returned a passage.** Your action is still in the composer. Retry, choose another model, or open provider diagnostics.

> **This trigger condition could not be evaluated.** The card was not added to this turn. Keyword fallback was used. Review the activity log for details.

> **The backup uses a newer schema version.** No data was changed. Open it with a newer app version or keep it for later.

## 11.5 Confirmation formula

Confirm only when consequence is meaningful:

> **Delete “Brakebills Faculty”?** This removes the card from future context and its history from this adventure. This cannot be undone after the current session.  
> [Cancel] [Export card] [Delete card]

Prefer undo over confirmation for reversible low-risk actions such as archive or deactivate.

## 11.6 Automation explanations

Good:

> “Suggested a new card for **The Neitherlands** because the last passage introduced it as a named location and no matching card exists.”

> “Proposed changing **Margo → Current goal** from ‘reach Fillory’ to ‘find Eliot’ based on turn 184.”

Weak:

> “AI found something important.”

## 11.7 Field help

Help text should explain consequence, not restate the label.

Label: **Priority**  
Weak help: “Set the priority.”  
Useful help: “Higher-priority items are kept before lower-priority items when the context limit is reached.”

Label: **Remember on this device**  
Useful help: “Stores the key in this browser for future sessions. It is never included in adventure exports.”

## 11.8 Empty-state pattern

An empty state should contain:

1. What belongs here.
2. Why it is useful.
3. One primary next action.
4. Optional example or import path.

Example:

> **No review items.** Automatic world changes that need your decision will appear here. You can keep playing; background checks will continue according to this adventure’s rules.

---

# 12. Responsive behavior and performance

## 12.1 Design by layout capability, not device labels

Use breakpoints when content no longer works, not arbitrary “tablet” assumptions.

### Play

- Wide: centered narrative plus optional inspector.
- Medium: narrative full width; inspector overlays or pushes only when opened.
- Narrow: one column; composer respects safe-area inset; context becomes a full-height sheet.

### Studio

- Wide: navigation + list/editor + inspector.
- Medium: navigation rail + editor; inspector drawer.
- Narrow/high zoom: route-based drilldown. List and editor do not remain side by side.

### Review

- Wide: queue list + detail.
- Narrow: queue route → detail route with persistent back label and preserved position.

## 12.2 Mobile Play specifics

- Put Generate within thumb reach.
- Keep action mode labels understandable; do not reduce them to ambiguous icons.
- Avoid covering the latest story with the software keyboard.
- Use `env(safe-area-inset-bottom)` where relevant.
- Preserve draft when the browser suspends the page.
- The “Jump to latest” control should sit above the composer, not under it.
- Avoid fixed viewport units that break when mobile browser chrome changes; prefer modern dynamic viewport units with fallbacks.

## 12.3 Long-story rendering

Large adventures can make the DOM expensive.

Options:

- Paginate or window older turns while keeping stable anchors.
- Load a recent range by default and allow “Load earlier.”
- Preserve browser find expectations where practical; provide in-story search if virtualizing.
- Do not unmount the currently focused or selected turn.
- Cache rendered Markdown safely.
- Keep turn IDs stable so context evidence can link back accurately.

Accessibility and selection behavior must be tested before aggressive virtualization.

## 12.4 Large entity collections

For hundreds or thousands of cards:

- Debounced local search.
- Indexed fields for title, tags, aliases, active state, and type.
- Incremental rendering or virtualization for simple rows.
- Faceted filters only for fields users actually use.
- Bulk actions with selection count and clear scope.
- Avoid rendering full card content in every list row.

## 12.5 Performance goals

Current Core Web Vitals guidance uses these “good” thresholds at the 75th percentile: LCP within 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1.[^web-vitals]

For this local-first app, add product-specific goals:

- Composer keystrokes remain responsive during streaming and background evaluation.
- Opening an existing adventure shows usable recent content quickly without loading every historical object first.
- IndexedDB writes do not block typing or animation.
- Background tasks are cancellable and bounded.
- Layout does not shift when status text, badges, or streamed content appears.
- Route bundles for Studio diagnostics and import are lazy-loaded if large.

## 12.6 Perceived performance

- Show cached/local content immediately.
- Reserve stable space for status and composer controls.
- Use optimistic UI only when rollback is safe and visible.
- Prefer meaningful text to indeterminate skeletons in a text-focused product.
- Do not block the entire screen for a single background task.
- During import, use real item counts and phases rather than a fake smooth percentage.

## 12.7 Network behavior

- Distinguish time-to-first-token from total generation time in diagnostics.
- Abort fetch/stream on Stop.
- Handle partial streams and malformed provider chunks.
- Retry only idempotent or explicitly confirmed operations.
- Do not silently send the same paid request multiple times after an ambiguous network failure.
- Show whether a retry may create another provider charge when that is plausible.

---

# 13. React implementation guidance

## 13.1 Component layers

### Primitives

- `Button`
- `IconButton`
- `TextField`
- `TextArea`
- `Select` / `Combobox`
- `Checkbox`
- `RadioGroup`
- `Switch` only for immediate binary settings
- `Badge`
- `Tooltip`
- `Dialog`
- `Drawer`
- `Disclosure`
- `Tabs`
- `Menu`
- `StatusMessage`
- `Progress`
- `Skeleton`

### Domain patterns

- `AdventureListItem`
- `StoryTurn`
- `StoryComposer`
- `GenerationStatus`
- `ContextItem`
- `CardListItem`
- `RuleSummary`
- `TriggerTester`
- `BrainStateDiff`
- `QuestStep`
- `ReviewItem`
- `ImportIssue`
- `ProviderCard`
- `SaveStatus`
- `BackupStatus`

Build and test the domain patterns with realistic long data, failures, and empty states.

## 13.2 State models

Avoid booleans such as `isLoading`, `hasError`, `isDone` that can enter contradictory combinations. Use explicit state machines or discriminated unions.

```ts
type AsyncPhase =
  | { status: 'idle' }
  | { status: 'queued'; queuedAt: number }
  | { status: 'running'; startedAt: number; step?: string }
  | { status: 'succeeded'; completedAt: number }
  | { status: 'failed'; failedAt: number; error: AppError }
  | { status: 'cancelled'; cancelledAt: number };
```

For a story turn, separate:

- Passage generation.
- Streaming/parse.
- Persistence.
- Post-turn evaluation.
- Proposed updates.

That allows accurate status without blocking one stage on another.

## 13.3 Transaction boundaries

User-facing undo depends on technical boundaries. Treat these as atomic units where possible:

- Add player action + generated passage.
- Apply passage edit.
- Retry/replace branch.
- Post-turn state update batch.
- Import commit.
- Restore backup.

Store an operation ID linking story turn, automation results, and history. Undo can then reverse the coherent operation rather than individually guessing dependencies.

## 13.4 Focus management

- Route changes move focus to the page heading or preserved logical target.
- Opening an editor from a list focuses the editor heading, not the first arbitrary field.
- Closing returns focus to the triggering row/action.
- Validation focuses the first invalid field only after submit.
- Background completion never steals focus.
- New review badges and save statuses do not become keyboard stops unless actionable.

## 13.5 ARIA and native behavior

Follow the WAI-ARIA Authoring Practices for custom widgets, but prefer native HTML.[^aria-apg]

Common traps:

- A visual “tab” implemented as buttons without tab roles/keyboard behavior.
- Clickable `<div>` rows without keyboard activation.
- Tooltip content needed to understand a field.
- Menus used for ordinary navigation links.
- Switches used for settings that require Save.
- Dialogs without focus restoration.
- Virtualized lists that misreport set size or lose focus.

## 13.6 Design-system test coverage

For each interactive component test:

- Default, hover, active, focus-visible, selected, disabled, loading, error.
- Light and dark themes.
- Compact and comfortable density.
- Long labels and localization expansion.
- Keyboard behavior.
- Accessible name/description.
- Reduced motion.
- 200% text size.
- High contrast/forced colors where practical.

A component workshop such as Storybook can help, but the important part is isolated, repeatable state coverage—not the particular tool.

## 13.7 Accessibility automation

- Run axe-based tests on representative component states.
- Add end-to-end tests for keyboard workflows.
- Run Lighthouse as a regression signal, not a certification.
- Add contrast checks for token pairs.
- Use lint rules for interactive semantics and labels.
- Keep a manual audit checklist in pull requests for new patterns.

## 13.8 Storage integration

Provide a storage service that exposes user-facing state:

```ts
type StorageHealth = {
  available: boolean;
  persistent: boolean | 'unknown';
  usageBytes?: number;
  quotaBytes?: number;
  lastSuccessfulWrite?: number;
  lastError?: StorageError;
};
```

Do not scatter direct IndexedDB calls throughout UI components. Centralized error handling makes accurate save status and recovery possible.

## 13.9 Security implementation notes

- Escape text by default.
- Sanitize any supported HTML subset with a reviewed allowlist.
- Use CSP headers/meta appropriate to static hosting; avoid `unsafe-eval` and minimize `unsafe-inline`.
- Restrict provider origins through `connect-src` when feasible; account for user-configurable providers deliberately.
- Do not store API keys in Redux devtools, action logs, query strings, or persisted generic settings objects.
- Redact secrets before error serialization.
- Treat imported JSON as untrusted and validate against a schema.
- Set file-size and item-count limits with user-friendly failure messages.

## 13.10 Observability without violating local-first expectations

For a personal tool, diagnostics can remain local:

- Request timeline.
- Context snapshot.
- Trigger evaluation result.
- Provider response metadata.
- Storage errors.
- Import report.

Provide **Copy redacted diagnostics**. Strip story text and credentials by default; let the user explicitly include selected content when needed.

---

# 14. Research and usability-testing plan

## 14.1 Research questions

1. What most often breaks narrative flow?
2. Which world-maintenance tasks are genuinely tedious versus creatively meaningful?
3. When do users want an AI update auto-applied, reviewed, or ignored?
4. What evidence makes a trigger or update explanation feel sufficient?
5. Can users predict what “Always,” “Pinned,” “Triggered,” and priority will do?
6. Do users understand where data and credentials are stored and sent?
7. Can users recover from provider, import, and storage failures without losing work?
8. Can the same information architecture support quick play and deep authoring?
9. Which advanced fields are actually frequent enough to remain visible?
10. Does the dark visual system remain readable during long sessions?

## 14.2 Discovery methods

### Contextual observation

Observe complete story sessions and authoring sessions. Capture:

- Screen transitions.
- Time spent waiting.
- Manual notes or external tools.
- Corrections and retries.
- Moments users inspect or distrust memory.
- Words users naturally use for cards, state, triggers, and context.

### Artifact review

Review real adventures:

- Number and size of cards.
- Common brain fields.
- Quest complexity.
- Import irregularities.
- Context budget pressure.
- Repeated correction patterns.

### Critical-incident interview

Ask for specific recent moments:

- A continuity failure.
- A surprisingly good memory event.
- A harmful automatic update.
- A failed import.
- A time the provider or browser lost work.

Specific incidents are more actionable than general preferences.

## 14.3 Prototype sequence

Prototype the riskiest concepts before visual polish:

1. Play status and background-task behavior.
2. Context inspector and trigger explanation.
3. Review item with diff/provenance.
4. Progressive card/brain editor.
5. Import resolution and rollback.
6. Data/credential settings language.
7. Responsive Studio drilldown.

Use realistic content lengths and ambiguous examples.

## 14.4 Task-based usability script

Representative tasks:

1. Open an existing adventure and continue it.
2. Stop a generation, revise the action, and retry.
3. Discover why a fact appeared in a passage.
4. Create a card that triggers when a character returns and test it.
5. Review a proposed character-state change, edit one field, and approve it.
6. Reject an incorrect quest completion and change its policy.
7. Import an adventure with duplicates and one malformed item.
8. Diagnose an invalid provider key without losing the story draft.
9. Export a backup and validate that it can be restored.
10. Complete a core task at 400% zoom and with keyboard only.

Record success, errors, time, hesitation, backtracking, and confidence—not only verbal preference.

## 14.5 Heuristic review

Run an independent heuristic review against:

- Nielsen’s 10 heuristics.[^heuristics]
- Microsoft human–AI guidelines.[^microsoft-hai]
- WCAG 2.2 AA.[^wcag-standard]
- Local-first trust and data-recovery criteria in this report.

Severity scoring:

- **0:** Not a problem.
- **1:** Cosmetic or minor friction.
- **2:** Meaningful friction; workaround exists.
- **3:** Serious failure or repeated confusion.
- **4:** Blocks task, risks data, or removes agency.

Prioritize by severity × frequency × affected core job.

## 14.6 Accessibility evaluation

Combine:

- Automated component and route checks.
- Keyboard-only task completion.
- Screen-reader walkthrough.
- Zoom/reflow.
- Contrast and forced colors.
- Reduced motion.
- Touch target and mobile keyboard behavior.

Include at least one test using a long adventure and one using a dense editor.

## 14.7 Iteration hypotheses

Example:

> **Hypothesis:** Showing a one-sentence inclusion summary above card controls will let users correctly predict card behavior without opening help.  
> **Signal:** Correct prediction in a card-sorting/test scenario.  
> **Success criterion:** Most participants explain the behavior accurately and complete the edit without inspecting raw settings.

> **Hypothesis:** A nonblocking post-turn status plus review badge will preserve flow better than modal automation results.  
> **Signal:** Fewer interrupted turns and lower reported distraction.  
> **Guardrail:** Review backlog does not become invisible or unmanageable.

---

# 15. Measurement framework

## 15.1 Adapted HEART framework

Google’s HEART framework organizes metrics into Happiness, Engagement, Adoption, Retention, and Task Success.[^heart]

Because this app is local-first and may be personal, metrics should be collected in observed studies, development builds, or explicit on-device opt-in—not through hidden remote telemetry.

| HEART area | Goal | Possible signal | Possible metric |
|---|---|---|---|
| Happiness | The app feels trustworthy, readable, and creatively empowering. | Post-session survey, SUS, qualitative comments. | SUS score; “I felt in control” rating; reading comfort. |
| Engagement | Users spend time creating/playing rather than maintaining the tool. | Turns, editing sessions, review completion. | Ratio of play time to administrative time; completed turns/session. |
| Adoption | A new user reaches meaningful value. | Provider configured, sample played, first adventure created/imported. | First successful generation; import completion; time to first turn. |
| Retention | Users return to active stories and can resume quickly. | Adventure reopened, summary used, story continued. | Return-to-story rate; time from open to next action. |
| Task success | Core jobs complete accurately and recoverably. | Success, errors, backtracking, help use. | Provider setup success; trigger test success; restore success; recovery time. |

## 15.2 Story-quality and AI-control measures

Do not reduce narrative quality to one metric. Use a balanced set:

- Regeneration rate per 100 turns.
- Manual edit rate and edit magnitude.
- Continuity correction incidents.
- “Why did it know this?” inspection rate after a bad output.
- False-positive and false-negative trigger reports.
- Brain update approval, edit, rejection, and later reversal rates.
- Quest advancement reversal rate.
- Auto-card duplicate/rejection rate.
- Review backlog size and age.
- Percentage of failures recovered without leaving Play.
- Time to first token and total response time.
- Context truncation frequency by layer.

Interpret carefully. For example, a high edit rate might indicate poor output—or a healthy co-writing workflow.

## 15.3 Data-safety measures

- Save failure rate.
- Successful recovery of interrupted drafts.
- Percentage of active adventures with a recent validated backup.
- Restore test success.
- Import rollback success.
- Persistent-storage grant/status visibility.
- Credential leakage test failures: exports, logs, URLs, diagnostics.

## 15.4 Accessibility measures

- Keyboard task completion rate.
- Automated violation count by severity.
- Manual WCAG issue count.
- 400% zoom task completion.
- Screen-reader task completion.
- Focus-loss or focus-obscured incidents.
- Touch misactivation in dense controls.

## 15.5 Guardrails

Do not optimize:

- Turn count at the expense of story quality.
- Automation acceptance rate at the expense of user scrutiny.
- Review-badge dismissal at the expense of meaningful review.
- Minimal clicks when additional confirmation protects data.
- Fast visual completion while background state silently lags.
- Engagement by adding notifications or variable rewards.

The product should respect attention and creative autonomy.

---

# 16. Prioritized roadmap

Effort is a relative estimate for planning, not a delivery commitment.

## P0 — Trust, data safety, and uninterrupted play

| Item | Impact | Effort | Why first | Acceptance signal |
|---|---|---:|---|---|
| Accurate save status and storage health | Very high | M | Local-first trust depends on it. | “Saved on this device” reflects completed writes; failures recover drafts. |
| Full export, validation, restore, and rollback | Very high | L | Protects irreplaceable stories. | A backup can be validated and restored without silent loss. |
| Generation state model, Stop, preserved input, retry | Very high | M | Core loop reliability. | Provider failure never clears the player action. |
| Turn/state snapshots and undo | Very high | L | Enables safe creative exploration and automation reversal. | One action restores a coherent pre-turn state. |
| Review inbox with diff and provenance | Very high | L | Makes automation trustworthy. | Every consequential proposal shows source, reason, impact, and decision. |
| API-key session default and redaction | Very high | M | Browser-only credential risk. | Keys never enter exports/logs; persistence is explicit. |
| Keyboard/focus/semantic component baseline | Very high | M | Prevents accessibility debt across all screens. | Core flows complete by keyboard with visible, unobscured focus. |
| Specific error recovery patterns | High | M | AI/network/storage failures are inevitable. | Errors state cause, safety, next action, and details. |

## P1 — Product structure and comprehension

| Item | Impact | Effort | Rationale | Acceptance signal |
|---|---|---:|---|---|
| Separate Play, Studio, and Review layouts | Very high | L | Resolves conflicting density needs. | Users identify mode and primary task without confusion. |
| Context inspector | Very high | L | Expresses the core differentiator and supports troubleshooting. | Users can explain why content entered a turn. |
| Progressive card/brain/quest editors | High | M | Reduces novice load while preserving power. | Core fields are usable without opening Debug. |
| Trigger and quest-condition tester | High | M | Prevents configuration mistakes. | Rules can be evaluated safely before activation. |
| Four-step import with report and rollback | High | L | Imports are high-risk and high-value. | No partial mutation; warnings and mappings are reviewable. |
| Adventure-library resume and backup signals | High | M | Improves return-to-story experience. | Resume is dominant; stale backup is understandable. |
| Responsive Studio drilldown | High | L | Multi-pane UI otherwise fails at zoom/mobile. | No core function is lost at 320 CSS px equivalent. |
| Semantic design tokens and component states | High | M | Makes visual/accessibility quality repeatable. | Theme and component state audits pass defined token pairs. |

## P2 — Efficiency, personalization, and polish

| Item | Impact | Effort | Rationale |
|---|---|---:|---|
| Reading preferences | Medium–high | M | Long sessions benefit from personalized typography. |
| Command palette and shortcut system | Medium | M | Helps experienced users after navigation is stable. |
| Compact Studio density | Medium | S–M | Supports large collections without shrinking text. |
| Review policy learning by explicit rule | Medium | M | Reduces backlog while preserving control. |
| In-story search and stable history anchors | Medium | M–L | Important for long adventures and evidence links. |
| Offline app shell / installability | Medium | M | Reinforces local-first behavior; generation remains online. |
| Local diagnostic dashboard | Medium | M | Improves troubleshooting without remote telemetry. |
| Optional on-device research metrics | Medium | M | Supports evidence-based iteration while respecting privacy. |
| Refined motion and brand illustration | Low–medium | S–M | Polish after trust, flow, and accessibility are sound. |

## Recommended implementation order within P0

1. Define operation/async states and save vocabulary.
2. Build storage health, draft recovery, and redaction foundations.
3. Implement generation Stop/retry/input preservation.
4. Add operation-linked snapshots/version history.
5. Build Review item and activity-log data model.
6. Standardize accessible primitives and error patterns.
7. Add export/restore and credential UX.

This order creates technical foundations that later screens can reuse.

---

# 17. Definition of done

## 17.1 Cross-app

- [ ] Page has a clear heading and landmark structure.
- [ ] Primary action is visually unambiguous.
- [ ] Loading, success, empty, error, offline, and permission states exist.
- [ ] Keyboard order is logical and focus is visible.
- [ ] Focus is restored after overlays.
- [ ] Text and controls pass contrast requirements.
- [ ] Layout works at 320 CSS px equivalent and 400% zoom where applicable.
- [ ] Reduced-motion behavior is defined.
- [ ] Destructive actions name the object and consequence.
- [ ] Autosave status reflects a real successful write.
- [ ] No credential or sensitive story content appears in generic logs.

## 17.2 Play turn

- [ ] Composer retains input through all failure paths.
- [ ] Generate acknowledges immediately and names the active stage.
- [ ] Stop aborts the request where technically possible.
- [ ] Partial output has keep/retry/discard behavior.
- [ ] The latest output can be edited, retried, copied, inspected, and undone.
- [ ] Background maintenance does not steal focus.
- [ ] Background changes are aggregated and discoverable.
- [ ] A context snapshot can explain included items.
- [ ] Screen readers receive start/completion/failure status without token spam.
- [ ] Sticky composer does not obscure focused content.

## 17.3 Studio object editor

- [ ] Basic behavior is understandable without raw JSON.
- [ ] A plain-language summary describes the current rule.
- [ ] Advanced fields are discoverable and remembered.
- [ ] Invalid data identifies the field and recovery action.
- [ ] Version history and source are visible.
- [ ] Automatic changes can be protected or reverted.
- [ ] List search/filter state survives navigation.
- [ ] Editor works as single-pane at narrow width/high zoom.

## 17.4 Review item

- [ ] Target and change type are named.
- [ ] Source evidence is linked.
- [ ] Before/after or proposed content is accessible.
- [ ] Future consequence is explained.
- [ ] Approve, edit, reject, defer, and open-target behavior is clear.
- [ ] Batch actions cannot accidentally mix incompatible risk types.
- [ ] Decision is recorded in activity history.
- [ ] Applied change can be reverted.

## 17.5 Import

- [ ] Source parsing happens before mutation.
- [ ] Counts, warnings, unsupported items, and duplicates are summarized.
- [ ] Mapping decisions are reviewable.
- [ ] Merge creates a pre-import snapshot.
- [ ] Commit is transactional or rolls back safely.
- [ ] Completion report matches persisted data.
- [ ] Failure states say whether data changed.
- [ ] Source files are never modified.

## 17.6 Data and credentials

- [ ] Storage location and persistence are accurately described.
- [ ] Export excludes credentials.
- [ ] Backup validation can run without restore.
- [ ] Restore previews impact and supports rollback.
- [ ] Session-only credential use is available and default.
- [ ] Persistent credential storage is opt-in with risk copy.
- [ ] Test connection distinguishes failure categories.
- [ ] Copy diagnostics is redacted by default.

---

# 18. Anti-patterns to avoid

1. **Copying a generic chatbot UI.** Long-form interactive fiction needs reading rhythm, story navigation, and state inspection beyond message bubbles.
2. **One giant navigation bar for every object type.** It exposes implementation structure instead of user tasks.
3. **Showing all advanced fields by default.** Power becomes visual noise and increases mistakes.
4. **Hiding important expert actions permanently.** Progressive disclosure should not become feature burial.
5. **Using a spinner for the whole AI pipeline.** Users cannot tell whether writing, checking, saving, or updating is happening.
6. **Blocking story display until every post-turn task completes.** Display the passage first and keep maintenance peripheral unless consistency requires a brief queued send.
7. **Automatically applying every semantic inference.** Persistent world-state changes need risk-based review, history, and undo.
8. **Explaining AI with a confidence percentage only.** Show rule and evidence; avoid false precision.
9. **Raw JSON as the normal editor.** Keep it available for debugging, not as the primary experience.
10. **Toast-driven state.** Save, import, review, and failure status must remain discoverable after a toast disappears.
11. **Ambiguous “Saved” or cloud imagery.** Say where data is saved and whether it is backed up.
12. **Remembering API keys silently.** Persistence must be explicit, redacted, and excluded from exports.
13. **Green-on-black everywhere.** Mint loses meaning and readability when used for all text, borders, and decoration.
14. **Color-only states.** Always pair color with label, icon, shape, or position.
15. **Invisible hover-only controls.** They fail on touch and can be missed by keyboard users unless focus behavior is equivalent.
16. **Nested modal dialogs.** Use pages, drawers, or staged flows instead.
17. **Confirmation for every reversible action.** Prefer undo; reserve dialogs for meaningful risk.
18. **Destructive actions in generic overflow without clear wording.** Name the object and consequence.
19. **Aggressive list virtualization without accessibility testing.** It can break focus, selection, search, and screen-reader understanding.
20. **Hidden telemetry in a local-first product.** Use explicit opt-in, on-device metrics, or observed testing.
21. **Decorative AI language that overstates capability.** Avoid “understands perfectly,” “thinks,” or “remembers forever.”
22. **Optimizing engagement by interruption.** The product should protect attention, not manufacture notification pressure.
23. **Treating WCAG as a final audit.** Accessibility belongs in components, content, workflows, and testing from the start.
24. **Polishing the logo before fixing recovery and data safety.** Brand quality cannot compensate for lost work or opaque automation.

---

# 19. Research sources

## Standards and foundational process

[^iso-hcd]: ISO, [ISO 9241-210:2019 — Ergonomics of human-system interaction: Human-centred design for interactive systems](https://www.iso.org/standard/77520.html).

[^double-diamond]: Design Council, [The Double Diamond](https://www.designcouncil.org.uk/resources/the-double-diamond/) and [history of the Double Diamond](https://www.designcouncil.org.uk/resources/the-double-diamond/history-of-the-double-diamond/).

[^jtbd]: Christensen Institute, [Jobs to Be Done Theory](https://www.christenseninstitute.org/theory/jobs-to-be-done/).

[^lean-ux]: O’Reilly, [The 3 Foundations of Lean UX](https://www.oreilly.com/content/the-3-foundations-of-lean-ux/). See especially the distinction between outcomes and outputs.

[^gov-design-principles]: UK Government Digital Service, [Government Design Principles](https://www.gov.uk/guidance/government-design-principles).

[^one-question]: GOV.UK Design System, [Question pages: one thing per page](https://design-system.service.gov.uk/patterns/question-pages/).

## Usability and interaction design

[^heuristics]: Nielsen Norman Group, [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/).

[^heuristic-evaluation]: Nielsen Norman Group, [How to Conduct a Heuristic Evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/).

[^progressive-disclosure]: Nielsen Norman Group, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

[^user-control]: Nielsen Norman Group, [User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/).

[^recognition]: Nielsen Norman Group, [Memory Recognition and Recall in User Interfaces](https://www.nngroup.com/articles/recognition-and-recall/).

[^response-times]: Nielsen Norman Group, [Response Time Limits: 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/).

[^error-messages]: Nielsen Norman Group, [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) and [form error guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/).

## Inclusive design and accessibility

[^inclusive-design]: Microsoft, [Inclusive Design](https://www.microsoft.com/design/inclusive/) and [Inclusive Design principles and resources](https://inclusive.microsoft.design/).

[^wcag-overview]: W3C Web Accessibility Initiative, [WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/).

[^wcag-standard]: W3C, [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).

[^contrast-minimum]: W3C, [Understanding SC 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

[^non-text-contrast]: W3C, [Understanding SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

[^target-size]: W3C, [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

[^focus-not-obscured]: W3C, [Understanding SC 2.4.11: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).

[^reflow]: W3C, [Understanding SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

[^visual-presentation]: W3C, [Understanding SC 1.4.8: Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html). This is Level AAA guidance and is used here as an enhanced reading target, not misrepresented as an AA default requirement.

[^animation]: W3C, [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

[^aria-apg]: W3C, [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) and [patterns](https://www.w3.org/WAI/ARIA/apg/patterns/).

[^web-accessibility-testing]: web.dev, [How to review for accessibility](https://web.dev/articles/how-to-review) and [accessibility tips for developers](https://web.dev/articles/a11y-tips-for-web-dev).

## Human–AI design

[^microsoft-hai]: Microsoft Research, [Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/) and [the detailed 18-guideline summary](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/). The guidelines were developed and validated for the CHI 2019 paper.

[^pair-guidebook]: Google PAIR, [People + AI Guidebook](https://pair.withgoogle.com/guidebook/).

[^pair-user-needs]: Google PAIR, [User Needs + Defining Success](https://pair.withgoogle.com/chapter/user-needs/).

[^pair-feedback]: Google PAIR, [Feedback + Control](https://pair.withgoogle.com/chapter/feedback-controls/).

[^pair-errors]: Google PAIR, [Errors + Graceful Failure](https://pair.withgoogle.com/chapter/errors-failing/).

[^pair-explainability]: Google PAIR, [Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/).

[^pair-mental-models]: Google PAIR, [Mental Models](https://pair.withgoogle.com/chapter/mental-models/).

## Attention, local-first design, and security

[^calm-tech]: Calm Technology, [Principles of Calm Technology](https://calmtech.com/).

[^local-first]: Ink & Switch, [Local-first software: You own your data, in spite of the cloud](https://www.inkandswitch.com/essay/local-first/).

[^storage-persist]: MDN, [`StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

[^storage-quotas]: MDN, [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

[^owasp-html5]: OWASP Cheat Sheet Series, [HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), plus [Cross-Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

## Design systems and measurement

[^atomic-design]: Brad Frost, [Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/).

[^design-tokens]: Atlassian Design System, [Design tokens](https://atlassian.design/tokens/design-tokens) and [accessibility foundations](https://atlassian.design/foundations/accessibility).

[^web-vitals]: web.dev, [Web Vitals](https://web.dev/articles/vitals). As of the research date, the current Core Web Vitals are LCP, INP, and CLS with the thresholds listed in the performance section.

[^heart]: Kerry Rodden, Hilary Hutchinson, and Xin Fu, [Measuring the User Experience on a Large Scale: User-Centered Metrics for Web Applications](https://research.google.com/pubs/archive/36299.pdf), CHI 2010.

Additional useful measurement reference: John Brooke, [SUS: A Quick and Dirty Usability Scale](https://digital.ahrq.gov/sites/default/files/docs/survey/systemusabilityscale%2528sus%2529_comp%255B1%255D.pdf).

---

## Closing design thesis

The best version of Story Mode AI is not the interface with the most visible AI. It is the interface in which:

- the story remains central,
- the world stays coherent,
- automation behaves quietly,
- state changes can be understood and reversed,
- local ownership is honest and durable,
- and advanced control is available exactly when the user reaches for it.

That combination—**immersion, legibility, reversibility, and ownership**—should be the product’s design signature.
