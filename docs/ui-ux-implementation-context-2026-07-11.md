# Story Mode AI UI/UX Implementation Context — 2026-07-11

Read this file before changing the application shell, page layout, Story Studio,
Play, Settings, Help, or responsive behavior.

## Status

**Decision record complete; implementation evidence pending.**

This document records the defects observed on 2026-07-11 and the desktop and
mobile treatment selected for each product surface. It does **not** claim that
the treatments have been implemented or verified. A page is complete only when
the evidence matrix at the end of this file contains passing automated tests,
desktop and mobile screenshots, and the deployed build hash that was tested.

The current status vocabulary is:

- **Decision recorded:** the intended treatment is defined here.
- **Implemented:** code exists locally, but may not be verified.
- **Verified locally:** targeted tests, full tests, build, and visual checks pass.
- **Verified deployed:** the tested frontend hash is live and the same flows pass
  against the hosted application.

At creation time, every implementation and verification entry in this document
is **pending**.

## Scope and authority

This document supplements, and does not replace:

- `docs/ui-implementation-context.md`, which defines the established product
  language, information architecture, and refinement principles R1–R10 and
  P1–P9.
- `docs/ui-ux-story-mode-ai-ux-ui-research-blueprint.md`, which defines the
  broader human-centered design, accessibility, human-AI, responsive, and
  measurement basis.
- `AGENTS.md`, which remains authoritative for Story Mode AI architecture,
  reducer boundaries, model context visibility, and release workflow.

The UI may simplify presentation, but it must not hide or merge distinct model
context types into an opaque bucket. World Blocks, Reference Cards, Characters,
Memory Suggestions, Automation, and Context Inspector must remain individually
inspectable.

## Audit inputs

The baseline includes the application source and these user-supplied desktop
captures from 2026-07-11:

1. Play with the default Story companion open.
2. Home with a missing-cover fallback initial placed at the corner of a large
   blank cover area.
3. A public creator profile with no published Scenarios and an irrelevant
   Scenario-start warning.
4. Story Studio — Story & Direction collapsed rows.
5. Story Studio — an open Narration Rules editor.
6. Automation inside the full Story Studio shell with a redundant “Back to
   Story Studio” banner.
7. Settings exposing raw pixel values and equally weighted account actions.
8. Help / Documentation with a content axis that feels disconnected from the
   application header and substantial unused visual space.

The audit also reviewed the relevant React components and the cascade across
`src/styles.css`, `src/studio-refinement.css`,
`src/play-docs-refinement.css`, and
`src/design-system-normalization.css`.

## Research and standards basis

The implementation must cite and apply the following practices, rather than use
“looks cleaner” as its rationale.

| Practice | Application in Story Mode AI | Authoritative source |
|---|---|---|
| Match the system to the real world | Lead with Story, character, place, memory, and user task language; keep priority, regex, raw JSON, token policy, and internal modes secondary. | [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| Recognition over recall | Collapsed Studio rows show meaningful content previews and consequences, not only type/status badges. Selected navigation and modes remain visibly selected. | [Nielsen Norman Group: recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/) |
| Aesthetic and minimalist design | Remove repeated page identity, duplicate save state, empty persistent panes, and controls unrelated to the current task. Preserve advanced capability behind disclosure. | [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| Progressive disclosure | Common actions and required fields appear first. Advanced context, automation, import formats, raw values, and maintenance tools remain discoverable but collapsed. | [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) |
| User needs before implementation structure | Navigation and page headings describe what people are trying to do. | [GOV.UK Service Manual: Start by learning user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) |
| One coherent decision at a time | Long setup and restore workflows are staged instead of presented as one intimidating form. | [GOV.UK Design System: question pages](https://design-system.service.gov.uk/patterns/question-pages/) |
| Consistent layout and spacing | Pages use shared container widths and spacing tokens; alignment does not change arbitrarily by route. | [GOV.UK Design System: layout](https://design-system.service.gov.uk/styles/layout/) and [spacing](https://design-system.service.gov.uk/styles/spacing/) |
| Short, progressive forms | Ask only for information needed at the current step; put optional and expert fields after the main task. | [U.S. Web Design System: Form guidance](https://designsystem.digital.gov/components/form/) |
| Reflow | Core content and controls reflow at a 320 CSS-pixel equivalent without loss of information or a page-level horizontal scrollbar. | [WCAG 2.2 Understanding SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Target size | Meet the WCAG 2.2 AA 24 by 24 CSS-pixel minimum or spacing exception; target approximately 44 by 44 for frequent mobile controls and icon-only actions. | [WCAG 2.2 Understanding SC 2.5.8: Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Reading measure and user control | Keep long-form prose to a comfortable measure and preserve user control over text size, line width, alignment, and spacing. | [WCAG Understanding SC 1.4.8: Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) |
| Accessible structure and status | Use landmarks, real headings, labelled controls, keyboard-visible focus, and persistent status at the point of action. | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/) |

The WCAG visual-presentation reference is enhanced guidance, not a claim that
SC 1.4.8 is an AA requirement. The target-size minimum and the practical mobile
target are also distinct: 24 by 24 is the AA floor, while approximately 44 by
44 is the product target for frequent touch interaction.

## Baseline defects

### 1. The visual system is normalized in name, not consistently in use

The current cascade still contains many independent font sizes, control
heights, radii, gaps, and page widths. Specific page styles frequently override
the shared normalization layer. The result is visible drift between headings,
metadata, buttons, cards, form fields, and empty states.

Observed implementation symptoms include:

- page containers at unrelated explicit widths, including approximately 1180,
  1240, 1280, and 1400 pixels;
- operational copy ranging across many unrelated 10–18 pixel values;
- compact, standard, and primary controls created by selector specificity rather
  than explicit component variants;
- panel radii and padding chosen per page;
- inline styles inside complex Studio and Settings surfaces;
- full-width panels that contain only a label or two compact controls.

### 2. Header and body alignment use different axes

The application header begins at the working viewport edge while page bodies
center themselves using different maximum widths. Even when an individual page
is mathematically centered, its title, body, search controls, and cards may not
share a visible alignment line. This is the main cause of the recurring “not
centered” impression.

### 3. Application state leaks into unrelated pages

The shell can show an open Story’s save state and title while the user is on a
public creator profile, Help, or Admin. “Saved” on someone else’s profile does
not describe the current page and competes with useful page status.

### 4. Story Studio exposes engine structure before authoring intent

Collapsed rows emphasize Pinned, Protected, priority, type, update time, trigger
count, or memory mode. Meaningful content may remain invisible until the user
searches or opens the item. Expanded editors retain the entire list and wrap a
form inside several nested bordered surfaces.

### 5. Persistent panes and repeated chrome do not earn their space

The default Play companion remains open even when no tool is active. Story
Studio repeats its identity, Story title, save state, tabs, advanced strip, and
sometimes a banner before the editing task begins. History and Backups inherit
Studio chrome despite being their own destinations.

### 6. Settings presents implementation values as normal preferences

Raw pixel widths, a raw color input, and account-management operations receive
similar weight. The page resembles configuration for developers rather than
preferences organized around reading, appearance, security, and data.

### 7. The existing visual audit is too shallow for the claim being made

The existing harness checks a useful but narrow set of mechanical failures. It
does not prove information hierarchy, task flow, meaningful alignment,
terminology, selected states, or the quality of an opened editor. Its current
coverage does not include New Story, open Studio items, advanced Story tools,
Admin, public-profile variants, or a representative state matrix.

# General adjustments

## G1. Establish one semantic visual contract

Replace route-specific magic values with named roles. Exact final values may be
adjusted after screenshot comparison, but the role set must remain small and
explicit.

### Typography roles

- **Caption / metadata:** restrained supporting information; never the only
  carrier of a required instruction.
- **Control label:** form labels, navigation labels, and compact action text.
- **Body:** normal product copy at a legible 15–16 pixel equivalent.
- **Section heading:** consistent hierarchy within a page.
- **Page heading:** consistent route-level identity.
- **Story prose:** separate user-adjustable literary typography, normally around
  60–72 characters per line and never forced to the full desktop width.

Serif typography is reserved for Story prose, Story/Scenario titles, and
intentional editorial moments. Navigation, settings, labels, status, Help, and
operational headings use the application sans-serif.

### Spacing and surface roles

- Use a small shared spacing sequence based on 4, 8, 12, 16, 24, 32, and 48
  pixel equivalents.
- Use one control radius, one standard panel/card radius, and one larger feature
  or dialog radius.
- Use borders to define an actual boundary, not as the default way to separate
  every nested section.
- Prefer section headings, surface tone, and whitespace before adding another
  border.

### Control roles

- **Compact:** secondary desktop-only controls where spacing preserves the
  target-size exception.
- **Standard:** normal form and navigation controls.
- **Primary:** the dominant task, with a minimum practical target near 40–44
  pixels and approximately 44 pixels on touch layouts.
- **Danger:** separated from routine actions and named for the consequence.

## G2. Use shared page-container roles

Define and reuse these layout intents:

- **Reading:** narrow measure for documentation and prose.
- **Standard:** Home, Explore, Profile, Settings, History, and Backups.
- **Wide:** Admin dashboards and dense collections where width carries useful
  information.
- **Workspace:** fluid Play and Story Studio editing surfaces.

The shell header and page body must align to the same active container role.
Centered content must remain centered relative to the space after the desktop
navigation rail, not the physical monitor.

## G3. Make page identity singular

- Do not repeat an exact route title in the shell and again as a large content
  heading without adding new meaning.
- Show the open Story title and save state only on Story-scoped surfaces.
- Keep the build hash in the shell as quiet metadata.
- Put save, error, generation, and import status at the point where the user can
  act on it; do not repeat the same state in several panes.

## G4. Put content before configuration

Studio collection rows show a title, a meaningful content preview, and the most
important user consequence. Normal metadata remains secondary. Raw priority,
token budget, match policy, cooldown, regex, internal IDs, and JSON live under
labelled Advanced disclosures.

Opening an item creates a focused editor rather than expanding a large form
inside the collection list. On wide desktop this may be a master-detail layout;
at narrow widths it becomes list → full editor → advanced details.

## G5. Reserve space only for an active task

Persistent panes support three explicit states from
`ui-implementation-context.md` R1:

1. **Closed:** the primary task receives the space.
2. **Summary:** a narrow strip shows immediately useful status.
3. **Working:** the pane expands after a tool is selected and exposes a clear
   close/collapse action.

## G6. Adapt mobile workflows instead of shrinking desktop layouts

- Stack fields in task order rather than squeeze desktop grids.
- Keep primary actions reachable without horizontal scrolling.
- Use drawers or sheets for navigation and secondary tools, with labelled Close
  actions and focus restoration.
- Convert dense tables to purposeful cards/lists when tabular comparison is not
  essential.
- Keep all essential capability available; mobile parity does not mean identical
  geometry.
- Test 320 CSS-pixel equivalent reflow and 400 percent zoom where applicable.

## G7. Treat empty, loading, error, and permission states as designed states

Each surface must define:

- a concise empty-state explanation;
- one appropriate next action when the viewer can act;
- a loading state that preserves layout and names the operation;
- an error that explains cause, data safety, and recovery;
- a permission state that names what access is required.

Do not show instructions for unavailable content, such as Scenario-start
guidance when a creator has no published Scenarios.

## G8. Require evidence, not visual confidence

Every changed page receives:

- targeted behavior tests;
- computed-style or geometry assertions for the shared system where practical;
- desktop and mobile screenshots after the interaction state is reached;
- overflow, overlap, clipping, focus, and target-size checks;
- manual task-flow review against the decision log below.

# Page-by-page decision log

Each entry describes the selected treatment. **Implementation evidence remains
pending until the final matrix is filled.**

## Home

### Baseline

- A Story without cover art reserves a large visual column but renders only a
  tiny initial in its top-left corner.
- Home’s shell title, eyebrow, and body heading repeat orientation.
- Save state for the open Story can appear even though the user is browsing the
  library rather than editing that Story.

### Desktop decision

- Use the standard shared content container and align its header and library.
- When cover art exists, retain the editorial two-column Continue Story hero.
- When it does not exist, either collapse to one content column or render an
  intentional full-height fallback with a centered, proportionate monogram and
  designed background. Never leave a large blank pseudo-cover.
- Keep Continue Story dominant; Open Story Studio remains secondary.
- Use one route-orientation heading, then the personalized welcome copy.
- Story cards share consistent cover aspect, title, metadata, and action
  placement.

### Mobile decision

- Stack the hero in reading order. A fallback cover is compact and cannot push
  Continue Story below an unnecessary viewport of empty art.
- Make the primary Continue action a comfortable touch target; stack secondary
  actions when labels would wrap awkwardly.
- Library cards become one column with no clipped title or metadata.

### Principle mapping

R1, R4, R7; P3, P4, P6, P7; NN/g consistency and aesthetic minimalism; WCAG
reflow.

### Implementation evidence

**Pending.**

## Explore

### Baseline

- Explore is one of the strongest normal-user surfaces, but shell and page title
  hierarchy can repeat.
- Filters and mixed creator/Scenario results require explicit narrow-width
  behavior.

### Desktop decision

- Use one clear page heading and task-oriented introduction.
- Keep search primary. Separate source, tag, and sorting controls into a
  consistent filter group with visible selected states.
- Present creator matches and Scenario matches as labelled result groups.
- Preserve focus movement to selected Scenario details and keep Start Story as
  the dominant detail action.
- Long creator names, Scenario titles, and tags wrap without colliding with
  actions.

### Mobile decision

- Search remains visible. Secondary filters move into a labelled filter
  disclosure or sheet that reports the number of active filters.
- Detail content stacks cover → identity → description → actions.
- Cards use one column; Start/View controls meet practical touch targets.

### Principle mapping

P1, P4, P5, P6, P7; recognition rather than recall; WCAG target size and
reflow.

### Implementation evidence

**Pending.**

## Public profile

### Baseline

- Scenario-start guidance floats in an otherwise empty Scenarios section even
  when the creator has published none.
- Follow, Add Friend, and Your Profile are presented as peer actions even though
  Your Profile is navigation.
- Summary badges occupy a detached right-aligned row.
- Save state from the viewer’s open Story may appear on another creator’s page.

### Desktop decision

- Keep creator identity, joined date, social actions, and relevant public counts
  in one coherent header.
- Treat return to the viewer’s profile as breadcrumb/back navigation, not a peer
  social action.
- Place Scenario count at the Scenarios heading or identity summary.
- Show Scenario-start guidance only when at least one Scenario can be started.
- Use a compact, intentional no-published-Scenarios state without irrelevant
  warnings.
- Connection cards size to their content and show privacy-hidden states plainly.

### Mobile decision

- Stack identity, counts, and actions without a detached toolbar.
- Follow/Friend controls wrap to full readable labels and remain distinct from
  navigation.
- Connection groups may become disclosures when lists are long; public privacy
  state remains visible.

### Principle mapping

P1, P3, P4, P6, P7; R6; NN/g match to real-world expectations and
recognition over recall.

### Implementation evidence

**Pending.**

## Play

### Baseline

- The default Story companion consumes reading width before the user chooses a
  tool.
- Six equal cards duplicate Story Studio navigation, break labels across several
  lines, and show very small descriptions.
- The pane contains large unused space when no tool is active.
- Save state is repeated in the shell and companion.
- An empty Next Turn Note can reserve persistent footer space.

### Desktop decision

- Make story prose and the composer the primary workspace.
- Default the companion to Closed or a narrow Summary state. Expand to Working
  only after the user selects a task.
- Group companion entry points by player job. Limit the visible default group to
  the most common quick tasks; make Open Story Studio a tertiary route rather
  than a sixth peer card.
- Use a vertical list or two-column task grid with readable labels at the
  available width. Do not use five narrow columns.
- Show save state once. Keep Turn and actionable context health in a compact
  summary.
- Keep Next Turn Note collapsed without reserving a large empty region.
- Preserve the coherent composer hierarchy defined by R9: input and send first;
  Continue/retry/undo/remember as secondary or recovery actions.

### Mobile decision

- Do not render a desktop side pane. Use one Story companion trigger opening a
  bottom sheet or full-height drawer.
- Sheet navigation uses single-column, approximately 44-pixel targets and closes
  predictably with focus returned to the trigger.
- Opening a tool replaces the sheet list with the selected tool and a labelled
  Back/Close path.
- Composer remains above the mobile navigation/safe area and never obscures the
  focused field or latest passage.

### Principle mapping

R1, R2, R6, R9; P1–P5, P7–P9; NN/g progressive disclosure and aesthetic
minimalism; WCAG target size, focus, and reflow.

### Implementation evidence

**Pending.**

## Story Studio shell

### Baseline

- The app header already identifies Story Studio and the open Story, but the
  persistent Studio header repeats Story Studio, an editable title, subtitle,
  cover controls, and save status.
- Four primary tabs, a full-width Advanced Story Tools band, and an optional
  banner consume much of the viewport before editing begins.
- History and Backups inherit Studio chrome even though the primary rail treats
  them as separate destinations.

### Desktop decision

- Keep one compact Story Studio identity in the shell.
- Move Story title and cover editing into a Story details disclosure or the
  Story & Direction workspace; do not repeat it above every tab.
- Keep the four primary tabs in one compact, readable navigation row with clear
  selected state.
- Put Automation and Context Inspector under one compact Advanced Story Tools
  disclosure/menu. When selected, the tool title in the app header is enough;
  no “Back to Story Studio” status banner is needed.
- Render History and Backups as standalone tool pages without Studio title,
  tabs, or advanced-tool chrome.
- Reset or deliberately preserve workspace scroll on tab changes; never land a
  new tab halfway through content without an orientation cue.

### Mobile decision

- Primary tabs become a two-by-two control, segmented switch, or labelled
  workspace selector that does not horizontally scroll or truncate.
- Story details and Advanced tools become compact disclosures.
- The workspace uses document scroll; the selected item editor receives the
  width instead of retaining an off-screen desktop list.

### Principle mapping

R2, R3, R5, R8; P1–P4, P6–P8; NN/g consistency, user control, and minimalist
design.

### Implementation evidence

**Pending.**

## Story Studio — Story & Direction

### Baseline

- Collapsed World Block rows show type plus Pinned, Protected, and Updated
  badges. Their actual content is hidden unless a search query creates a
  snippet.
- Internal status has greater visual weight than authoring meaning.

### Desktop decision

- Keep the existing groups — Core Story Contract, Current Story State, and
  optional extra blocks — because they match authoring intent.
- Every collapsed row shows the plain-language block name and a one- or two-line
  content preview even when search is empty.
- Show exception states such as Inactive or Needs attention. Move ordinary
  pinned/protected/priority/update metadata to Advanced details.
- Provide one clear Add World Block action and keep AI generation/maintenance
  tools under labelled disclosures.

### Mobile decision

- Groups and rows stack to one column. Preview copy wraps naturally.
- Opening a row navigates to the full editor rather than expanding a desktop form
  inline.

### Principle mapping

R8; P1–P4, P6, P7; NN/g recognition rather than recall and progressive
disclosure.

### Implementation evidence

**Pending.**

## Story Studio — World & Lore

### Baseline

- Reference Card summaries lead with many badges: type, living/compact state,
  pinned/protected, trigger counts, archive counts, and timestamps.
- The editor exposes trigger and model-context mechanics before the core memory
  is comfortably readable.

### Desktop decision

- Collapsed rows show title, one meaningful memory preview, and a concise trigger
  summary.
- Show Living or Inactive when it changes the user’s decision. Keep compact
  kind, priority, token budget, protection, regex, and archival mechanics under
  Advanced.
- In the selected editor, order content as Identity → Memory the storyteller
  receives → When it appears → History → Advanced automation/context.
- Preserve separate Reference Card and World Block concepts.

### Mobile decision

- Search and Create remain first. Filters collapse into one disclosure showing
  active-filter count.
- The selected card becomes a full-width editor with a persistent labelled way
  back to the filtered list.

### Principle mapping

R7, R8; P1–P4, P6–P8; recognition over recall; WCAG reflow.

### Implementation evidence

**Pending.**

## Story Studio — Characters

### Baseline

- Navigation says Characters while controls and messages use Character Self,
  Brain, and character brain.
- The default editing path can expose serialized `key: turnN` thought text.
- Cadence, priority, prompt override, and context settings compete with the
  character’s current state.

### Desktop decision

- Use Characters consistently in normal UI. Explain internal memory only in
  Advanced help.
- The list shows character name, useful aliases, and the latest current thought
  or state preview.
- The selected editor leads with name/aliases and a readable thought timeline.
  Provide Add thought and per-thought edit/archive actions instead of requiring
  raw key/value serialization.
- Place capture cadence, priority, prompt override, linked-card mechanics, and
  context settings in Advanced.

### Mobile decision

- Character list becomes one-column cards with readable current-state preview.
- Thought editing uses individual fields/cards and a full-width editor. Raw
  serialization remains optional expert functionality only.

### Principle mapping

P1, P2, P3, P6, P7; R8; NN/g real-world language and recognition rather than
recall.

### Implementation evidence

**Pending.**

## Story Studio — Suggestions

### Baseline

- Rules and auto-approve, Check Recent Entries, and Manual Suggestion can appear
  before the actual pending suggestions.
- The page orientation does not use the same heading pattern as the stronger
  Studio tabs.
- An empty suggestion inbox can still be dominated by configuration controls.

### Desktop decision

- Lead with pending suggestions and their risk/consequence.
- Use a consistent page heading, summary, and pending/resolved counts.
- Combine Rules/auto-approve, recent-entry reconciliation, and manual creation
  under one Suggestion tools/settings disclosure below the primary inbox.
- Empty state states that there is nothing to review and offers only an
  appropriate next action.
- Proposal cards show source, target, proposed change, consequence, and clear
  Approve/Edit/Reject/Defer actions.

### Mobile decision

- Proposal content and decision controls stack in reading order.
- Do not put incompatible batch decisions into a compressed row.
- Resolved history is collapsed and separate from the pending queue.

### Principle mapping

P1–P6, P7; human-AI feedback/control guidance in the research blueprint; R8.

### Implementation evidence

**Pending.**

## Story Studio — open editor pattern

### Baseline

- The open Narration Rules example presents several technical labels before the
  editable text: active/always, repeated title, pinned/protected/priority,
  context block, text sent to model, content, and line count.
- A fixed-row textarea turns long authored guidance into a small scrolling
  console.
- Regenerate and Delete sit together as top-level peers, while type and technical
  behavior remain in the normal flow.

### Desktop decision

- Use a shared focused-editor layout for World Blocks, Reference Cards, and
  Characters.
- Give the editor a human task heading such as “How the narrator should write”
  or “Memory the storyteller receives.”
- Make the primary content field an editorial canvas with comfortable measure,
  generous minimum height, natural/autosizing behavior where practical, and a
  meaningful count or save state.
- Regenerate is secondary. Delete belongs in a separated overflow or danger
  section and names the object/consequence.
- Move Type, inclusion policy, priority, pinned, protected, cooldown, token
  budget, and raw actions into Advanced.
- Do not retain a full expanded collection around the editor. Use master-detail
  only when both panes remain useful.

### Mobile decision

- The editor occupies the full page width and follows one-column task order.
- Advanced disclosures remain reachable but closed by default.
- Sticky actions must not obscure the focused field; focus remains visible at
  high zoom.

### Principle mapping

R8; P1–P5, P7, P8; USWDS progressive form guidance; WCAG reflow and focus.

### Implementation evidence

**Pending.**

## Automation

### Baseline

- Automation appears inside all Story Studio chrome and includes a redundant
  “Back to Story Studio” banner.
- System memory triggers are open by default and dominate the page.
- Quiet entity-only and Balanced story memory are action buttons without a
  persistent selected state.
- Rule rows emphasize evaluation mode and action counts before a readable
  when/then explanation.

### Desktop decision

- Render Automation as a focused advanced Story tool without redundant Studio
  chrome or return banner.
- Rename the default section Automatic memory. Present Quiet, Balanced, and
  Custom as a true radio/segmented choice with visible selected state and
  `aria-pressed`/radio semantics as appropriate.
- Reveal category checkboxes only for Custom or a labelled Customize action.
- Rename Create Trigger to New automation in normal UI.
- Rule summaries lead with “When … then …” in plain language. Technical
  evaluation mode and logs remain Advanced.

### Mobile decision

- Mode choice stacks or wraps without truncation.
- Rule list and selected rule use list → full editor navigation.
- Complex action builders become staged sections, not squeezed four-column
  forms.

### Principle mapping

P1–P6, P7, P8; R2, R3, R8; NN/g visibility of system status and consistency.

### Implementation evidence

**Pending.**

## Context Inspector

### Baseline

- Context Inspector is intentionally technical, but can inherit excessive Studio
  chrome and present raw rows before an understandable summary.

### Desktop decision

- Keep it inside Advanced Story Tools and preserve every named context section.
- Lead with total context health, included/omitted counts, and the exact payload
  relationship.
- Provide section filters and disclosure before raw item detail.
- Keep section, priority, policy, flags, tokens, and reasons inspectable; do not
  merge them into an opaque score.

### Mobile decision

- Replace wide table presentation with section cards or a deliberately labelled
  horizontal table region only when comparison requires it.
- Expanded item detail is full width and retains source/reason/token information.

### Principle mapping

P2, P5, P6, P7, P8; R3, R8; WCAG reflow exception applied only to genuinely
two-dimensional comparison.

### Implementation evidence

**Pending.**

## History

### Baseline

- History can inherit the Story Studio title, tabs, Advanced tools, and return
  banner even though it is a separate navigation destination.
- “Stored locally” is not universally correct in hosted mode.
- Adventure/Chronicle terminology differs from the product’s Story language.

### Desktop decision

- Render History as a standalone standard-container page with a singular heading
  and current Story context.
- Use Story History in normal UI. Describe storage according to the active mode
  or avoid an inaccurate universal storage claim.
- Keep search first, then a readable timeline. Story passages may use literary
  typography; role/status/action metadata remains sans-serif.
- Keep Edit secondary and require a deliberate selection before destructive
  deletion.

### Mobile decision

- Timeline entries use full width with actions that do not collide with prose.
- Editing becomes a focused full-width state with explicit Done and Delete.
- Search remains reachable without a sticky element obscuring focused content.

### Principle mapping

P1, P3–P8; R3, R4; WCAG reflow and focus.

### Implementation evidence

**Pending.**

## Backups & Transfer

### Baseline

- The page can inherit redundant Story Studio chrome.
- User-facing copy alternates among Story, adventure, AIST, import/export, and
  raw JSON terminology.
- Partial exports and technical formats can compete with the main backup task.

### Desktop decision

- Render as a standalone standard-container page.
- Use Back up this Story and Restore a Story backup as the normal tasks.
- Keep Back Up and Restore as a clear two-state task switch with one dominant
  action in each state.
- Put reusable partial exports, JSON detail, runtime reset, and admin storage
  controls in labelled Advanced/administrative sections.
- A restore flow parses first, shows a clear preview and warnings, confirms the
  affected Story, and reports whether data changed.

### Mobile decision

- Back Up/Restore switch remains readable and at least standard touch height.
- Preview facts stack as a definition list or cards.
- File selection, preview, and final restore follow task order without side-by-
  side forms.

### Principle mapping

P1–P5, P7, P8; R3; GOV.UK one-thing-per-page and USWDS form guidance.

### Implementation evidence

**Pending.**

## Settings

### Baseline

- Interface exposes Story text size in pixels, Story box width in pixels, maximum
  content width in pixels, raw position, and raw dark-mode text color.
- The maximum-content-width setting conflicts with route-specific hard-coded
  page widths.
- Log out, Sessions, Sign out everywhere, Export account, and Delete account
  receive similar visual treatment.
- Summary badges repeat values already visible in the form.

### Desktop decision

- Organize into Appearance, Reading, Account & security, Data, and Advanced.
- Replace raw numeric layout fields with understandable presets or labelled
  sliders: Small/Default/Large text and Narrow/Comfortable/Wide reading measure.
  Preserve an Advanced path for exact supported values if required.
- Show a live reading preview when it materially helps the decision.
- Use theme choices and an accessible color reset; do not make a raw color input
  the first normal-user control.
- Rename Sessions to Manage devices/sessions.
- Separate Sign out, Manage devices, and Export from a clearly labelled Danger
  Zone containing account deletion.
- Model source remains a labelled section; platform secrets never enter this
  page.
- Remove summary badges that merely restate current field values.

### Mobile decision

- Categories stack as sections or a category list followed by focused content.
- Fields are one column. Preview follows the controls it explains.
- Account actions remain full-label buttons; destructive actions are isolated
  and cannot be mistaken for ordinary navigation.

### Principle mapping

P1–P6, P7, P8; R2, R4; NN/g real-world language and error prevention; WCAG
visual presentation.

### Implementation evidence

**Pending.**

## Help / Documentation

### Baseline

- The content is numerically centered but appears off-axis because the app
  header and documentation canvas do not share alignment.
- A topic rail plus constrained article measure creates visually unused right
  space.
- All matching guides are rendered as full articles, producing an extremely long
  feed and giving implementation topics equal first-level weight.

### Desktop decision

- Align Help’s shell header and documentation canvas to one shared container.
- Keep prose to a deliberate readable measure; do not solve whitespace by
  stretching paragraphs across the viewport.
- Use a sticky topic navigation with one selected article in the reading pane.
- Search returns topic results; choosing a result opens that article.
- Add previous/next topic navigation and preserve a clear task-oriented category
  hierarchy.
- Keep technical reference after common workflows.

### Mobile decision

- Topic navigation becomes a labelled drawer or disclosure.
- Show one article at a time. The search field remains above results and does not
  force a two-column layout.
- Code, tables, and long identifiers wrap or use deliberate labelled scroll
  regions without causing page-level overflow.

### Principle mapping

R4, R10; P1–P3, P6–P8; WCAG visual presentation and reflow; GOV.UK user-needs
organization.

### Implementation evidence

**Pending.**

## New Story

### Baseline

- The creation surface combines Storyteller profile, premise, four generation
  preferences, title, thumbnail, opening scene, World Blocks, priority,
  pinned/protected controls, Reference Cards, upload, pasted JSON, and Create in
  one long form.
- Raw engine concepts and imports compete with the normal task of starting a
  Story.
- The current visual audit does not open or validate this workflow.

### Desktop decision

- Use a short staged flow:
  1. **Idea:** premise and optional Storyteller/setup guidance.
  2. **Review:** title, opening, generated cast/world summary, and boundaries.
  3. **Create:** confirm the Story and start or continue editing.
- Offer Start blank and Import as explicit alternative paths, not competing
  forms inside the primary path.
- Put exact World Block/Card configuration, priority, pinned/protected, JSON,
  and provider mechanics under Customize/Advanced after the generated review.
- Keep one clear primary action per step and preserve entered information when
  moving backward or after generation failure.

### Mobile decision

- One step and one main decision per screen.
- Storyteller choices become one-column cards with contained copy.
- Sticky step actions respect safe areas and never obscure the focused field.
- Generated review uses collapsible sections; raw JSON is not a normal mobile
  creation requirement.

### Principle mapping

P1–P8; GOV.UK one-thing-per-page; USWDS simple/progressive form guidance; R7.

### Implementation evidence

**Pending.**

## Admin Console

### Baseline

- Technical density is appropriate to the authorized role, but Admin in the
  shell and Admin Console in the body repeat page identity.
- Overview can stack invites, provider configuration, user administration, and
  operations into a long mixed-purpose form.
- Wide tables need an intentional narrow-width alternative.

### Desktop decision

- Keep one route heading and a concise signed-in administrator identity.
- Separate Overview, Invites, Provider, People & roles, Safety, and Operations
  into clear task views rather than a single configuration feed.
- Use metric cards only for actionable system signals. Every metric links or
  filters to the underlying evidence where appropriate.
- Provider health and save actions show persistent, specific result status.
- Isolate role/status/destructive administration from platform defaults.

### Mobile decision

- Metric cards reduce to a one- or two-column summary.
- Admin tabs become an accessible selector or horizontally safe tab pattern.
- Tables become task-specific cards when comparison is not essential; genuinely
  tabular data uses an explicitly labelled scroll region.
- High-risk actions name the user/object and consequence.

### Principle mapping

P1–P8; R2, R4, R6; WCAG reflow and target size; NN/g error prevention and
visibility of status.

### Implementation evidence

**Pending.**

# Validation and evidence matrix

No row may be marked complete based only on a screenshot or a passing unit test.
Behavior, geometry, responsive layout, and the deployed hash must agree.

| Surface / decision | Targeted automated evidence | Desktop screenshot evidence | Mobile screenshot evidence | Manual task evidence | Status |
|---|---|---|---|---|---|
| Shared type/spacing/control/container contract | Pending: computed-style and component tests | Pending: representative shell/page | Pending: representative shell/page | Pending: compare page axes and hierarchy | Pending |
| Header Story context is route-scoped | Pending | Pending: public profile or Help without Story status | Pending | Pending: navigate with an open Story | Pending |
| Home missing-cover fallback | Pending | Pending: Home at 1440 and 1920 | Pending: 390 and 320-equivalent | Pending: continue/edit actions | Pending |
| Explore filters, long names, and details | Pending | Pending | Pending | Pending: search creator and start Scenario | Pending |
| Public profile empty/published states | Pending | Pending: zero and one+ Scenario | Pending | Pending: Follow/Friend/navigation | Pending |
| Play companion Closed/Summary/Working | Pending | Pending: each state | Pending: sheet list and selected tool | Pending: open/close/focus restore | Pending |
| Play composer and recovery controls | Pending | Pending | Pending: keyboard open/closed | Pending: submit, error, retry, undo | Pending |
| Story Studio compact shell | Pending | Pending: each primary tab | Pending: workspace selector | Pending: tab switching and scroll orientation | Pending |
| Story & Direction content previews | Pending | Pending: collapsed and selected | Pending | Pending: find/edit block without search | Pending |
| World & Lore focused editor | Pending | Pending | Pending | Pending: search/filter/edit/return | Pending |
| Characters focused thought editor | Pending | Pending | Pending | Pending: add/edit/archive thought | Pending |
| Suggestions primary queue | Pending | Pending: empty and pending | Pending | Pending: approve/edit/reject | Pending |
| Shared open-editor treatment | Pending | Pending: long Narration Rules | Pending: long item at 320-equivalent | Pending: advanced/danger actions | Pending |
| Automation selected mode and rule editor | Pending | Pending | Pending | Pending: Quiet/Balanced/Custom and create rule | Pending |
| Context Inspector summary and item detail | Pending | Pending | Pending: reflow/card detail | Pending: explain included/omitted item | Pending |
| History standalone layout | Pending | Pending: long Story | Pending | Pending: search/edit/delete | Pending |
| Backups standalone staged tasks | Pending | Pending: Back Up and Restore | Pending | Pending: download/preview/cancel restore | Pending |
| Settings categories and reading controls | Pending | Pending | Pending | Pending: change/reset/read preview/manage sessions | Pending |
| Help selected-topic reading layout | Pending | Pending: article and search results | Pending: topic drawer/article | Pending: search/select/previous/next | Pending |
| New Story staged flow | Pending | Pending: each step | Pending: each step | Pending: generate failure/back/create | Pending |
| Admin task views | Pending | Pending: Overview/Provider/People/Operations | Pending | Pending: provider test and safe role action | Pending |

## Required viewport and state matrix

At minimum, capture and inspect:

- 1280 by 720 desktop;
- 1440 by 900 desktop;
- 1920 by 1080 desktop;
- 390 by 844 mobile;
- 320 CSS-pixel equivalent reflow;
- 200 percent zoom/reflow pressure on the primary workflows;
- 400 percent zoom for core single-column task completion where applicable.

State coverage must include:

- no open Story and open Story;
- missing and present cover art;
- zero, one, and many results/items;
- long titles, names, labels, and prose;
- empty, loading, success, error, and permission states;
- collapsed and expanded navigation;
- closed, summary, and working companion states;
- closed collection and selected long Studio editor;
- mobile virtual keyboard/composer state;
- selected Automation mode;
- restore preview before mutation.

## Required validation commands

Record exact results after implementation:

```text
npm.cmd test
Result: PENDING

npm.cmd run build
Result: PENDING

npm.cmd run smoke:prod
Result: PENDING

node scripts/full-ui-visual-audit.mjs <tested-url>
Result: PENDING
Audit report: PENDING
Screenshot directory or committed evidence path: PENDING
```

Add targeted commands and results for the changed surfaces:

```text
Targeted UI test command(s): PENDING
Targeted accessibility/geometry test command(s): PENDING
Authenticated hosted Play verification: PENDING
```

## Screenshot evidence manifest

Use stable filenames containing viewport, page, and state. Do not submit only a
single “after” screenshot for a multi-state component.

```text
Evidence root: PENDING

desktop-1280-home-no-cover.png: PENDING
mobile-390-home-no-cover.png: PENDING
desktop-1440-explore-results.png: PENDING
mobile-390-explore-filters.png: PENDING
desktop-1440-public-profile-empty.png: PENDING
mobile-390-public-profile-empty.png: PENDING
desktop-1440-play-companion-closed.png: PENDING
desktop-1440-play-companion-working.png: PENDING
mobile-390-play-companion-sheet.png: PENDING
desktop-1440-studio-story-direction.png: PENDING
desktop-1440-studio-world-lore.png: PENDING
desktop-1440-studio-characters.png: PENDING
desktop-1440-studio-suggestions.png: PENDING
desktop-1440-studio-open-editor-long.png: PENDING
mobile-390-studio-open-editor-long.png: PENDING
desktop-1440-automation.png: PENDING
mobile-390-automation.png: PENDING
desktop-1440-context-inspector.png: PENDING
mobile-390-context-inspector.png: PENDING
desktop-1440-history.png: PENDING
mobile-390-history.png: PENDING
desktop-1440-backups.png: PENDING
mobile-390-backups.png: PENDING
desktop-1440-settings.png: PENDING
mobile-390-settings.png: PENDING
desktop-1440-help-selected-topic.png: PENDING
mobile-390-help-selected-topic.png: PENDING
desktop-1440-new-story-review.png: PENDING
mobile-390-new-story-review.png: PENDING
desktop-1440-admin-operations.png: PENDING
mobile-390-admin-operations.png: PENDING
```

## Release evidence

Fill only after the tested release is live:

```text
Implementation branch: PENDING
Local commit hash: PENDING
Pushed remote commit hash: PENDING
Frontend build hash shown in UI: PENDING
Hosted API SHA: PENDING
Deployment provider/status: PENDING
Deployment URL: PENDING
CI run URL/status: PENDING
Authenticated test account/role (no secrets): PENDING
Provider health result: PENDING
Play action produced and persisted an AI response: PENDING
Deployment verified at: PENDING
Verified by: PENDING
```

## Completion rule

This context is complete as a decision record. The UI implementation is **not**
complete until:

1. every named surface has desktop and mobile evidence;
2. the targeted and full validation commands pass;
3. the implementation matches the page decisions rather than only removing
   overflow;
4. the tested frontend hash is the hash visible in the deployed UI;
5. hosted Story generation is proven with an authenticated action and persisted
   assistant response;
6. remaining deviations are explicitly recorded as open work, not described as
   complete.

---

# Authoritative implementation addendum — 2026-07-11

> **Supersession notice:** This addendum supersedes the earlier “implementation
> evidence pending” statements for the local implementation described here. It
> does not mark release-only fields complete until the final commit is deployed
> and the same hash is verified live.

## Here are the general adjustments

- Standardized route containers so shell headers and page bodies share one
  visual axis instead of appearing independently centered.
- Normalized typography, spacing, panel sizing, control hierarchy, and the
  distinction between literary Story text and operational interface text.
- Replaced implementation-first language with task language: Story,
  Characters, Story history, Restore a Story, and Guide the next response.
- Applied progressive disclosure to advanced settings, destructive actions,
  diagnostics, Automation categories, and Memory Suggestion tools.
- Changed Story Studio collections from metadata-heavy developer rows into
  meaningful previews and focused list-to-editor flows.
- Prevented an open editor from competing with its collection. Sibling rows
  and unrelated groups yield while the selected item owns the canvas.
- Raised narrow-screen controls to a practical 44-pixel target baseline and
  converted navigation, Studio tabs, action groups, and forms into genuine
  narrow-screen layouts.
- Expanded the visual audit to include collapsed/open Play companion states,
  a selected mobile companion tool, an open Studio editor, every Studio
  workspace, Automation, Context Inspector, More navigation, History,
  Backups, Settings, and Help.
- Preserved the architecture rule that distinct context types remain
  individually inspectable. Simplifying the presentation did not merge World
  Blocks, Reference Cards, Characters, Memory Suggestions, Automation, or
  Context Inspector into an opaque bucket.

## The eight reported problems

| # | Implemented treatment | Evidence |
|---|---|---|
| 1. Play companion was not user friendly | The companion now defaults closed when no preference exists, separates quick Story edits from deeper controls, removes the duplicate visible Saved label, and exposes the one-turn note as “Guide the next response.” Mobile uses a destination sheet followed by one selected tool rather than a permanent second column beside the Story. | `final/022–024`, `final/077–079` |
| 2. Character rows were misaligned | Shared collapsed editor rows now use stable desktop geometry, meaningful content snippets, and restrained exception badges. Technical status, update timestamps, priorities, and trigger keys no longer determine row geometry. | `final/029`, `final/047`, `final/084` |
| 3. Scenario guidance floated on an empty public profile | Scenario-start guidance is conditional on at least one published Scenario. A creator with none receives a compact empty state. “Your profile” is return navigation, separated from Follow/Friend actions. | `src/pages/ProfilePage.tsx`; authenticated live evidence required below |
| 4. Story Studio resembled a developer menu | Primary workspaces are Story & Direction, World & Lore, Characters, and Suggestions. Collapsed rows lead with meaning, not engine state. Title/cover and Advanced Story Tools are disclosures rather than permanent chrome. | `final/025`, `final/027–032`, `final/080`, `final/082–087` |
| 5. Studio edit boxes were poor | Opening an item creates a focused editing canvas with a real Back-to-list affordance, task-specific headings and field copy, fewer nested borders, hidden sibling rows, and destructive actions under More. | `final/026`, `final/044`; live mobile capture required below |
| 6. Redundant Back to Story Studio and inherited Studio chrome consumed space | Automation and Context Inspector render as focused tool-only workspaces. Selecting either closes the Advanced tools menu. History and Backups remain standalone destinations without Studio title/tab/banner duplication. | `final/031–034`, `final/086–090` |
| 7. Settings looked like a developer menu | Settings is organized around reading comfort, runtime/account identity, models, sessions, and advanced controls. Normal users receive understandable presets; exact values and technical controls remain disclosed. “Sessions” is “Manage sessions,” and dangerous account actions remain separated. | `final/035`, `final/053`, `final/091` |
| 8. Documentation felt off-center and wasted space | Help shares a deliberate route axis with its shell header, preserves a readable article measure, shows one selected article, supports hash-addressable topics and browser history, moves focus to the selected article, and converts topic navigation to a mobile disclosure. | `final/036`, `final/054`, `final/092` |

## This is what I did on each page

| Page | Desktop | Mobile | Local screenshot evidence |
|---|---|---|---|
| Home | Aligned the welcome, Continue Story hero, and library to one standard container. Missing cover art renders as an intentional fallback instead of a tiny corner initial. | Stacked the hero in reading order and kept Continue Story and library cards within one column. | `019`, `037`; `055`, `074` |
| New Story | Uses a New Story shell title, removes the Home welcome block and duplicate top-level Create action, balances the setup-guide grid 3+2, and places the final Create Story decision after review. Removed floating absolute-position Expand controls. | Suppresses unrelated Home/library content while creation is active; fields and the final decision stack without horizontal loss. | `020`, `038`; `056`, `075` |
| Explore | Uses a coherent page axis, readable result cards, and stable search/detail geometry. | Cards and actions stack; selected-detail space is reserved above mobile navigation and notices no longer collide with it. | `021`, `039`; `057`, `076` |
| Public creator profile | Separates return navigation from social actions and renders Scenario guidance only when a Scenario exists. Empty-state cards size to their content. | Social actions wrap instead of becoming a clipped toolbar. | Authenticated live evidence required |
| Play | Defaults the companion closed, maintains a literary reading measure, groups quick edits separately from deeper controls, and shows one optional guidance editor only when requested. | Companion destinations and the selected tool use a full-width sheet above bottom navigation; the Story remains a single-column reading surface. | `022–024`, `040–042`; `058–060`, `077–079` |
| Story Studio shell | Uses one compact workspace identity, four stable primary workspaces, disclosed Story details, and disclosed advanced tools. | Primary workspaces form a 2×2 selector with no horizontal tab strip; a mobile Scenario-save action is available when the Story can save a revision. | `025`, `043`; `061`, `080` |
| Story & Direction | Rows emphasize Story meaning and content previews rather than pinned/protected/update metadata. | Cards become one readable list with full-width controls. | `027`, `045`; `063`, `082` |
| World & Lore | Search, create, collection review, and editing use one coherent task flow. | Search and Add World Block stack; the editor occupies the full width. | `028`, `046`; `064`, `083` |
| Characters | Shared row geometry removes badge-driven misalignment; deletion is under More. | Character list and editor follow list-to-focused-editor navigation. | `029`, `047`; `065`, `084` |
| Suggestions | Suggestion settings, manual review tools, and scanning are under one disclosure. Proposal rows use user-facing memory labels and Needs review instead of raw confidence/type keys. | Proposals remain closed until chosen and preserve full-width review actions. | `030`, `048`; `066`, `085` |
| Open Studio editor | Hides competing siblings, uses Back to list, task-specific headings, a larger content canvas, and More for destructive operations. | Uses the available width without side-by-side inspectors. | `026`, `044`; authenticated live evidence supplements the local capture |
| Automation | Replaces “Enable system triggers” with “Create memory suggestions automatically.” Quiet, Balanced, and Custom are visible modes; detailed categories appear only for Custom. Rule rows lead with their meaningful condition, and the zero-rule state explains what to do next. History and diagnostics are disclosed. | Mode controls and forms stack, and the redundant Back to Story Studio banner is gone. | `031`, `049`; `067`, `086` |
| Context Inspector | Preserves named context sections while replacing shorthand labels with Size, Order, Status, and Inclusion. Duplicate review uses plain language and detailed usage accounting is collapsed. | Controls and details reflow without page-level horizontal scrolling. | `032`, `050`; `068`, `087` |
| History | Uses Story-language descriptions, Search story history, and Edit story entry. The zero-entry state explains when history appears and links back to Play. It is a standalone destination. | Timeline, empty state, and search remain one column with full-width editing states. | `033`, `051`; `070`, `089` |
| Backups & Transfer | Replaces adventure/Brains/JSON-first language with Story, Characters, backup file, and Restore a Story. | Backup facts, file selection, preview, and actions stack in task order. | `034`, `052`; `071`, `090` |
| Settings | Organizes choices around Appearance, account access, Models, sessions, and advanced settings; local execution mode/API URL are behind Connection settings, and routine/destructive actions no longer have equal emphasis. | Categories and fields stack, with full-label actions and practical touch targets. | `035`, `053`; `072`, `091` |
| Help | Aligns the documentation canvas to the shell, keeps prose readable, selects one topic, supports topic hashes/history, and focuses the new article heading after navigation. | Topics become a disclosure and one article owns the reading surface. | `036`, `054`; `073`, `092` |
| More navigation | Keeps secondary destinations available without crowding the five-item primary navigation. | Full labels and 44-pixel interaction targets are preserved. | `069`, `088` |
| Admin | Retains wide/compact route roles and a task-oriented console structure. | Metrics use a compact horizontal region and primary tabs use a safe grid. | Authenticated live evidence required |

## Research applied

| Principle | How it governed the implementation | Source |
|---|---|---|
| Match the system to the real world | Replaced engine-first language with Story, Characters, Story history, and task-based editor headings. | [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| Recognition rather than recall | Collapsed Studio rows expose meaningful previews; selected workspaces and modes remain visibly selected. | [Nielsen Norman Group: Recognition vs. Recall](https://www.nngroup.com/articles/recognition-and-recall/) |
| Aesthetic and minimalist design | Removed duplicate Saved text, empty persistent panes, redundant return banners, repeated Studio chrome, and irrelevant profile guidance. | [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| Progressive disclosure | Advanced Story tools, exact reading values, diagnostics, destructive actions, and custom Automation categories remain available without dominating ordinary tasks. | [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) |
| Start with user needs | Navigation and editor headings describe what people are trying to accomplish rather than mirroring implementation modules. | [GOV.UK Service Manual: Start by learning user needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) |
| One coherent decision at a time | New Story, restore, selected companion tools, and focused Studio editors reduce competing decisions. | [GOV.UK Design System: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) |
| Consistent alignment and spacing | Shared route containers, spacing roles, and control roles replace route-specific visual axes. | [GOV.UK Layout](https://design-system.service.gov.uk/styles/layout/) and [Spacing](https://design-system.service.gov.uk/styles/spacing/) |
| Short, progressive forms | Normal fields precede advanced configuration; the focused item owns the editing surface. | [U.S. Web Design System: Form guidance](https://designsystem.digital.gov/components/form/) |
| Reflow | Core pages were inspected at 320 and 390 CSS-pixel widths with no page-level overflow. | [WCAG 2.2 Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Target size | Frequent mobile controls use a practical 44-pixel target; the desktop audit retains the WCAG 24-pixel floor. | [WCAG 2.2 Understanding Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Reading measure and user control | Story prose and Help retain deliberate reading measures instead of stretching merely to occupy desktop space. | [WCAG: Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) |
| Accessible labels and focus | Open/return controls have meaningful accessible names, and Help moves focus to a newly selected topic. | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI Form Labels](https://www.w3.org/WAI/tutorials/forms/labels/) |

## Exact local evidence

Command:

```text
node scripts/full-ui-visual-audit.mjs --base-url http://127.0.0.1:4178/ --output docs/ui-ux-audit-2026-07-11/final
```

Reports:

- `docs/ui-ux-audit-2026-07-11/final/report.json` (light)
- `docs/ui-ux-audit-2026-07-11/final-dark/report.json` (dark)

Final light result generated at `2026-07-11T21:56:51.958Z`; final dark
result generated at `2026-07-11T21:57:50.634Z`:

- 5 viewports.
- 184 screenshots: 92 light and 92 dark.
- 22 named interaction/page states.
- 18 captures each at 1280×720, 1440×900, and 1920×1080.
- 19 captures each at 320×568 and 390×844.
- 0 document-overflow failures.
- 0 viewport protrusions.
- 0 clipped-text findings.
- 0 controls below the configured 24-pixel desktop or 44-pixel mobile thresholds.
- 0 overlapping-control findings.
- 0 oversized empty-card findings.
- 0 failed screenshots in either theme.

Durable screenshot roots:

- `docs/ui-ux-audit-2026-07-11/final/`
- `docs/ui-ux-audit-2026-07-11/final-dark/`

Representative manifest:

```text
Desktop Home/New Story/Explore:        final/019, final/020, final/021
Desktop Play closed/open/editor:       final/022, final/023, final/024
Desktop Story Studio shell/editor:     final/025, final/026
Desktop Studio workspaces:             final/027 through final/032
Desktop History/Backups:               final/033, final/034
Desktop Settings/Help:                 final/035, final/036

Mobile Home/New Story/Explore:         final/074, final/075, final/076
Mobile Play base/destinations/tool:     final/077, final/078, final/079
Mobile Studio shell:                   final/080
Mobile Studio workspaces:              final/082 through final/087
Mobile More/History/Backups:            final/088, final/089, final/090
Mobile Settings/Help:                  final/091, final/092
```

## Final local validation

```text
npm.cmd test
PASS — 69 test files passed, 1 skipped; 490 tests passed, 7 skipped.

npm.cmd run build
PASS — TypeScript and Vite production build completed; 113 modules transformed.
Non-blocking warning: the main JavaScript chunk is above Vite's 500 kB advisory.

npm.cmd run smoke:prod
PASS — 2 production assets loaded from the temporary production server.

Focused UI regression suites
PASS — 36/36 Play, Help, Profile, and App tests.
PASS — 24/24 accessibility-foundation and side-menu tests.
PASS — 54/54 App, New Story, Settings, side-menu, and Context tests.

Light-theme visual audit
PASS — 92 screenshots, 5 viewports, 0 failed screens.

Dark-theme visual audit
PASS — 92 screenshots, 5 viewports, 0 failed screens.
```

## Verification limitations that must remain explicit

The local report proves the selected geometry and interaction states above; it
does not by itself prove subjective usability or every authenticated production
state. Before marking the release Verified deployed, add:

- authenticated desktop and mobile public-profile screenshots;
- authenticated desktop and mobile Admin screenshots;
- production frontend hash matching the final pushed commit;
- final `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run smoke:prod` results;
- live 200%/400% reflow evidence if claiming those zoom states;
- mobile virtual-keyboard evidence if claiming keyboard-safe composer behavior;
- any separately required authenticated hosted Play/provider verification.

The `3393966` hash visible in these local screenshots identifies the commit from
which the local Vite fixture was started. It is not the final release hash and
must not be recorded as the deployed implementation commit unless the final
pushed commit is actually that hash.
