# AI Story Teller

A browser-only MVP for building and playing local AI adventure sessions. It uses React, TypeScript, Vite, IndexedDB persistence, and an OpenAI-compatible provider call. Users supply their own API key in Settings.

## Setup

```sh
npm.cmd install
npm.cmd run dev
```

Build for production:

```sh
npm.cmd run build
```

Preview the production build:

```sh
npm.cmd run preview
```

## GitHub Pages Deploy

The Vite config uses `base: "./"` so the built app can be served from a GitHub Pages project path.

1. Run `npm.cmd run build`.
2. Publish the `dist/` folder with your preferred Pages workflow.
3. No backend or server configuration is required.

## Architecture

All adventure state mutations go through `src/state/adventureReducer.ts` using the full `AdventureAction` union from `src/types/adventure.ts`.

IndexedDB stores adventures in `src/db/adventureDb.ts`. localStorage stores only small runtime settings, including API key and provider preferences. Exported adventure JSON strips API keys.

## Context Assembly Contract

`src/contextBuilder/contextBuilder.ts` builds the exact provider payload shown in Context Preview. The first payload message is the assembled model-facing context, and the following payload messages are the included recent transcript messages.

**There is no opaque "Adventure & Memories" bucket.** Every token in the model context belongs to a named, inspectable section. Empty sections are omitted from the payload but always appear in `ContextBuildResult.sections` so the user can verify what is and is not loaded.

Context sections, in fixed order:

| ID | Label | Contents |
|---|---|---|
| `system` | A. System Shell | Global generation rules — always protected |
| `aiInstructions` | B. AI Instructions | Components with `type === "aiInstructions"` |
| `plotEssentials` | C. Plot Essentials | Components with `type === "plotEssentials"` |
| `authorNote` | D. Author's Note | Components with `type === "authorNote"` |
| `components` | E. Components | General always-on or pinned custom components |
| `storyCards` | F. Story Cards | Triggered / pinned Story Cards and Auto-Cards |
| `brains` | G. Brains | Active Brain entries for triggered characters |
| `questState` | H. Quest State | Active quests and current step objectives |
| `rollingSummary` | I. Rolling Summary | Compressed story summary, user-editable |
| `recentMessages` | J. Recent Messages | Short-term transcript window |

Memory Proposals (`activeState.memoryProposals`) are shown in Context Preview under "Memory Proposals / Pending Updates" but are never included in the model payload until approved. `ContextBuildResult.pendingProposals` carries the pending set.

Every `ContextItem` exposes:
- `tokenEstimate` — approximate token cost
- `id` / `title` — item identity
- `content` — exact text sent
- `priority` — ordering within its section
- `protected` — cannot be dropped by token truncation
- `pinned` — prioritized but droppable if budget requires
- `inclusionPolicy` — `always | triggered | manual | systemSuggested`
- `generatedBy` — `"user" | "system" | "ai"`

`ContextBuildResult.decisions` records every inclusion, exclusion, truncation, and ordering decision with a human-readable reason string. `ContextBuildResult.excludedItems` lists every item omitted, with reason `budget_exceeded`, `inactive`, `cooldown`, or `not_triggered`.

Budget cuts are deterministic but configurable:

- Only the system shell and user-marked `protected` context are absolutely non-droppable.
- `pinned` means strongly prioritized, not automatically non-droppable.
- `memoryPriorityMode` controls the drop order: `userLocked` (drop old messages first), `systemSuggested` (drop lowest-scored item first), `hybrid` (drop system-suggested context before user-locked context).
- `allowSystemToDropUnpinnedTriggeredCards`, `allowSystemToTruncateSummary`, `allowSystemToPrioritizeMemory` gate additional budget behaviors.

The Context Preview page shows:
1. **Ordered Sections** — each section with per-item token estimate, priority, protected/pinned flags, inclusion policy, and generatedBy.
2. **Memory Proposals / Pending Updates** — pending proposals with source text, type, rationale, confidence; not model context.
3. **Provider Payload Preview** — the exact JSON sent to the model. Must match the Ordered Sections content exactly.

## Memory Architecture

- **Adventure Chronicle**: `adventure.messages`, the full persisted transcript. Inspectable in the Chronicle tab. Never automatically compressed or flooded into model context.
- **Rolling Summary**: `adventure.rollingSummary`, user-editable compression of the Chronicle. Appears in section I after durable memory and before recent messages. Separate from the Chronicle.
- **Story Cards**: durable recurring facts, promises, secrets, nicknames, named objects, relationship facts, locations, and rules. Trigger-matched or pinned into section F.
- **Brains**: opt-in character-internal state for major characters only. AI may update a Brain only when a `BrainEntry` already exists. Do not create Brains for random NPCs.
- **Plot Essentials**: tiny always-on current-state constraints, e.g. "The Beast is hunting Seth tonight." Section C.
- **AI Instructions**: persistent narrative generation rules. Section B. AI must not modify these.
- **Author's Note**: author-layer mood or tonal constraints. Section D. AI must not modify these.
- **Memory Inbox / Proposals**: `activeState.memoryProposals`, where AI-suggested durable memories wait for user approval. Pending proposals appear in Context Preview but are not model context. Approving converts them to Story Cards, Brain updates, Plot Essentials edits, or Summary updates through reducer actions.
- **Protected**: non-droppable during token truncation. `aiInstructions`, `plotEssentials`, and `authorNote` components are protected by default.
- **Pinned**: prioritized for inclusion and ordering, but droppable if budget is exhausted and the item is not also protected.

Use `src/memory/classificationPolicy.ts` for deterministic memory routing. Use `src/memory/applyAIMemoryUpdate.ts` for AI-generated memory updates.

## AI Mutation Boundaries

AI-generated memory updates may only become reducer actions through `applyAIMemoryUpdate`.

Allowed AI update targets:

- BrainEntry fields
- StoryCard content, triggers, and state
- ComponentEntry content only when `component.type === "plotEssentials"`

Rejected AI update targets:

- AI Instructions and Author's Note components
- provider/model config
- trigger rule definitions
- quest definitions, except explicit quest progression reducer actions
- raw imported source text
- system shell/global generation rules

If an entity has no BrainEntry, AI-driven memory routing must not create or update a Brain by default. Durable character facts should route to an existing Story Card when possible, otherwise to a pending Story Card proposal in Memory Inbox. Random NPCs, one-scene characters, locations, factions, and objects should not receive BrainEntries by default.

The play loop is implemented in `src/App.tsx`:

1. Save user message through the reducer.
2. Evaluate keyword/regex triggers synchronously.
3. Build deterministic context.
4. Call the OpenAI-compatible story provider and save the model output.
5. Persist story state.
6. Run semantic trigger evaluation and generated updates in the background.
7. Apply generated updates through the reducer and persist again.

The context builder in `src/contextBuilder/contextBuilder.ts` follows the required deterministic section order and returns the final provider payload, ordered sections, section token estimates, total estimate, and excluded items.

## Implemented MVP Surfaces

- Adventure create, open, duplicate, delete, export, import, and runtime reset.
- IndexedDB persistence.
- Play UI with submit, continue, regenerate, last-message editing, save status, token display, context preview, and quest objective.
- Components, Story Cards, Brains, Auto-Cards, Triggers, Quests, Summary, Settings, and Import/Export tabs.
- Chronicle and Memory Inbox tabs for inspecting transcript history and proposed durable memories.
- Trigger matching for keyword, phrase, and regex; deterministic priority order; cooldowns; trigger log.
- LLM semantic trigger evaluation with generated updates for brains, story cards, components, Auto-Cards, and quest steps.
- Full trigger action suite wired through the reducer.
- Quest lifecycle and trigger-driven quest start/progress/complete action wiring.
- Semantic Auto-Cards with configurable detection, generation prompt, cooldown, and review queue.
- Manual rolling summary editing and model-generated summary button.
- AI Dungeon import flow for transcript/action JSON, metadata setup, story cards, and Inner Self brain cards.
- Approximate token estimator in `src/tokenizer/approximateTokenCount.ts`.

## Architecture Decision: Semantic Engine and Memory Proposals

The semantic post-turn evaluator applies brain, story card, and Plot Essentials updates directly (not via Memory Inbox) because those trigger actions were explicitly configured by the user — they are not freeform AI suggestions. Auto-Cards DO go through a review queue before becoming live.

Memory Inbox / Memory Proposals is the path for unstructured AI-suggested new memory (the `classifyMemory` flow), where the AI is making a novel durable-memory suggestion the user has not pre-authorized.

`generateSummary` in `App.tsx` also applies the Rolling Summary directly. This is intentional because the user clicked the button, which is itself approval.

See `AGENTS.md` for implementation guidance if you want to change this behavior.

## Known Limitations

- Token counts are approximate by design. The estimator is named `approximateTokenCount` so a real tokenizer can replace it later.
- Provider integration starts with OpenAI-compatible chat completion APIs. DeepSeek works through the default base URL/model, and other compatible providers can be configured in Settings.
- Trigger and quest action editing uses JSON textareas for inspectability in this MVP.

## Stub Inventory

No active product stubs are currently present. The legacy `src/autoCards/entityDetection.ts` adapter remains only so older imports do not break; active Auto-Card detection runs through the semantic LLM evaluator.

## Testing

```sh
npm.cmd test
npm.cmd run build
```

The deterministic test suite covers context order/inclusion/exclusion, story-card triggering and truncation, trigger matching/action mapping, reducer actions, AI memory mutation boundaries, memory classification, Memory Inbox approval/rejection, AI Dungeon import parsing, golden memory architecture, and a multi-turn play smoke path.

Live provider checks are opt-in and use `.env.test.local`:

```sh
npm.cmd run test:live
```

The live suite verifies the OpenAI-compatible Groq provider call, semantic trigger evaluation, manual brain update, Auto-Card review queue creation, and Remember This proposals. Do not commit `.env.test.local`; it is ignored and should contain only throwaway test keys.

## Adding Memory Surfaces Safely

1. Add explicit TypeScript types in `src/types/adventure.ts`.
2. Add default and normalization handling in `src/state/defaults.ts`.
3. Add reducer actions; do not mutate adventure state outside `adventureReducer`.
4. Decide where the surface appears in context and update context contract tests.
5. If AI can write to it, route through `applyAIMemoryUpdate` or add a tested approval/proposal path.
6. Make the surface visible in UI before treating it as product behavior.
