import { useMemo, useState, type ReactNode } from "react";

interface DocTopic {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
  body: ReactNode;
}

const topics: DocTopic[] = [
  {
    id: "overview",
    title: "Overview",
    category: "Getting Started",
    summary: "Local-first architecture, provider keys, persistence model, and the main operating loop.",
    tags: ["local-first", "indexeddb", "provider", "browser"],
    body: (
      <>
        <p>
          AI Story Teller is a browser-only interactive fiction system. Adventure data is stored in
          IndexedDB. Tiny runtime preferences, including the provider API key, live in localStorage.
          There is no backend service.
        </p>
        <pre>{`npm.cmd test
npm.cmd run build
npm.cmd run test:live   # optional, uses .env.test.local`}</pre>
        <p>
          The application is designed around inspectable context. If text consumes model tokens, it must
          appear in Context Preview with item IDs, title, reason, priority, pinned/protected state, and
          generated-by source.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-library",
    title: "Library",
    category: "Side Menu",
    summary: "Create, open, duplicate, and delete local adventures.",
    tags: ["adventures", "library", "create", "open", "delete"],
    body: (
      <>
        <p>
          Library is the adventure picker. Use it to create a fresh adventure, reopen a saved IndexedDB
          adventure, duplicate an existing adventure, or delete one from local storage.
        </p>
        <p>
          New Adventure includes optional setup before play: an opening scene, starter World Blocks, manual
          Story Cards, and Story Cards parsed from uploaded or pasted JSON.
        </p>
        <p>
          Library also contains Personal Cloud Sync. For a private single-user setup, it can push and pull
          all adventures through a private GitHub repo so a phone and computer can continue the same story.
        </p>
        <p>
          API keys are not stored in adventure records, so exporting, duplicating, or deleting an adventure
          does not move provider secrets around.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-dashboard",
    title: "Dashboard",
    category: "Side Menu",
    summary: "The main cockpit for playing while keeping key adventure state visible.",
    tags: ["dashboard", "cockpit", "play", "overview"],
    body: (
      <>
        <p>
          Dashboard is the default home screen for an open adventure. It shows the current scene, active
          objective, context budget, character state, Memory Inbox status, and latest evaluation log.
        </p>
        <p>
          It also includes the AID-style turn controls, so you can play from the cockpit without opening
          editor pages.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-play",
    title: "Play",
    category: "Side Menu",
    summary: "The focused story screen for taking turns and editing the transcript.",
    tags: ["play", "turn", "continue", "retry", "undo", "redo"],
    body: (
      <>
        <p>
          Play is the focused story surface. Use Story, Do, and Author modes to submit turns, continue,
          retry the last model response, erase the latest section, and undo or redo story text edits.
        </p>
        <p>
          Transcript entries are editable inline. Changes go through the reducer and persist with the
          adventure.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-chronicle",
    title: "Chronicle",
    category: "Side Menu",
    summary: "The complete local transcript of the adventure.",
    tags: ["chronicle", "transcript", "history", "messages"],
    body: (
      <>
        <p>
          Chronicle is the full user-readable story and message history. It is stored persistently and is
          not compressed.
        </p>
        <p>
          Chronicle is source material for summaries and memory proposals, but it does not automatically
          flood the model context. Recent Messages and Rolling Summary are the model-facing versions.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-inbox",
    title: "Inbox",
    category: "Side Menu",
    summary: "Review pending AI-suggested memories before they become active context.",
    tags: ["inbox", "memory inbox", "proposals", "approve", "reject"],
    body: (
      <>
        <p>
          Inbox is the Memory Inbox. AI-suggested durable memories appear here as proposals with source
          text, proposed type, rationale, confidence, and suggested triggers.
        </p>
        <p>
          Pending proposals are not active context. Approving a proposal routes it to a Story Card, Brain
          update, Plot Essentials update, or Rolling Summary update through reducer-backed paths.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-story-cards",
    title: "Story Cards",
    category: "Side Menu",
    summary: "Durable triggered facts that enter context only when relevant or pinned.",
    tags: ["story cards", "memory", "triggers", "durable facts"],
    body: (
      <>
        <p>
          Story Cards store durable facts: names, promises, secrets, recurring places, rules, relationships,
          and important objects.
        </p>
        <p>
          Active cards enter context when their triggers match the current input, latest output, or recent
          history. Pinned cards are prioritized; protected cards cannot be dropped by token truncation.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-characters",
    title: "Characters",
    category: "Side Menu",
    summary: "Opt-in Brain entries for major character inner state.",
    tags: ["characters", "brains", "brain entries", "inner state"],
    body: (
      <>
        <p>
          Characters manages Brain entries. Brains are opt-in and intended for major characters whose
          internal state, emotional interpretation, relationship pressure, or recent developments should
          evolve.
        </p>
        <p>
          The system does not automatically create Brains for random characters. AI may update only
          BrainEntries that already exist, unless the user approves creating one from a proposal.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-summary",
    title: "Summary",
    category: "Side Menu",
    summary: "The editable rolling summary that compresses the Chronicle for model context.",
    tags: ["summary", "rolling summary", "compression", "context"],
    body: (
      <>
        <p>
          Summary edits the Rolling Summary. This is the compressed model-facing continuity layer that
          appears after priority memory and before Recent Messages.
        </p>
        <p>
          Updating the summary must not overwrite Story Cards, Brains, quest state, or raw imported
          source text.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-world-blocks",
    title: "World Blocks",
    category: "Side Menu",
    summary: "Manage AI Instructions, Plot Essentials, Author's Note, and custom components.",
    tags: ["world blocks", "components", "plot essentials", "author note", "ai instructions"],
    body: (
      <>
        <p>
          World Blocks are context components. AI Instructions, Plot Essentials, and Author's Note are
          protected by default. Custom components can be active, pinned, protected, prioritized, or manual.
        </p>
        <p>
          AI-generated updates may only touch component content when the component type is Plot Essentials,
          and only through approved mutation paths.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-quests",
    title: "Quests",
    category: "Side Menu",
    summary: "Track quest lifecycle, current objectives, and step completion conditions.",
    tags: ["quests", "objectives", "steps", "progression"],
    body: (
      <>
        <p>
          Quests stores explicit quest definitions and step state. Active quest steps contribute objective
          text to context and display in the Play and Dashboard screens.
        </p>
        <p>
          Quest progression happens through reducer actions. Semantic completion conditions can complete
          the current step and activate the next step.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-auto-cards",
    title: "Auto-Cards",
    category: "Side Menu",
    summary: "Configure generated card proposals and the Auto-Card review queue.",
    tags: ["auto-cards", "generated", "review queue", "semantic trigger"],
    body: (
      <>
        <p>
          Auto-Cards are generated memory candidates. Semantic detection can create review-queue cards,
          and the user decides whether to approve, edit, or discard them.
        </p>
        <p>
          Generated Auto-Cards should not become active Story Cards until they are reviewed and approved.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-context-preview",
    title: "Context Preview",
    category: "Side Menu",
    summary: "Inspect exactly what text will be sent to the provider and why.",
    tags: ["context preview", "provider payload", "tokens", "inspect"],
    body: (
      <>
        <p>
          Context Preview shows every context section, included item, excluded item, token estimate,
          priority decision, pinned/protected state, and generated-by source.
        </p>
        <p>
          The provider payload preview must match the actual messages sent to the model. There should be
          no hidden adventure-memory bucket.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-automations",
    title: "Automations",
    category: "Side Menu",
    summary: "Edit trigger rules and inspect keyword, regex, and semantic evaluation logs.",
    tags: ["automations", "triggers", "semantic", "logs"],
    body: (
      <>
        <p>
          Automations manages trigger rules. Keyword and regex triggers run synchronously around the turn.
          Semantic triggers run asynchronously after the model response and log their evaluation results.
        </p>
        <p>
          Trigger actions must dispatch typed reducer actions. They should not mutate adventure state
          directly.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-import-export",
    title: "Import / Export",
    category: "Side Menu",
    summary: "Move adventure JSON and AI Dungeon exports in or out of the browser.",
    tags: ["import", "export", "ai dungeon", "backup"],
    body: (
      <>
        <p>
          Import / Export handles full adventure JSON and AI Dungeon import flows. AI Dungeon story text
          can become transcript messages; Story Card JSON can become Story Cards or Brain candidates.
        </p>
        <p>
          Invalid or ambiguous imported data should be preserved as raw text instead of silently discarded.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-settings",
    title: "Settings",
    category: "Side Menu",
    summary: "Configure provider, model, UI, semantic evaluation, and token budget behavior.",
    tags: ["settings", "provider", "model", "dark mode", "budget"],
    body: (
      <>
        <p>
          Settings stores tiny app preferences in localStorage, including provider API key, selected model,
          and dark mode. Adventure-specific settings control token budgets, semantic evaluation, and
          Auto-Card behavior.
        </p>
        <p>
          The Provider section includes an API throttle. Enable it to enforce a minimum delay between
          provider calls and an optional maximum number of calls per minute across turns, summaries,
          Remember This, semantic evaluation, and generated memory updates.
        </p>
        <p>
          Provider keys must never be written into adventure JSON or IndexedDB records.
        </p>
      </>
    ),
  },
  {
    id: "side-menu-documentation",
    title: "Documentation",
    category: "Side Menu",
    summary: "The searchable technical reference for the system.",
    tags: ["documentation", "help", "reference", "topics"],
    body: (
      <>
        <p>
          Documentation is this page. It is organized like a small technical manual: searchable topics,
          sidebar entries, architecture contracts, memory rules, and testing commands.
        </p>
        <p>
          When a new sidebar surface is added, it should get a matching Documentation topic so users can
          inspect what it is for.
        </p>
      </>
    ),
  },
  {
    id: "turn-pipeline",
    title: "Turn Pipeline",
    category: "Runtime",
    summary: "The reducer-driven path from submitted input to provider payload, model response, memory, and save.",
    tags: ["turn", "pipeline", "provider", "reducer"],
    body: (
      <>
        <ol>
          <li>Flush queued semantic updates.</li>
          <li>Add the user message through <code>adventureReducer</code>.</li>
          <li>Run keyword and regex automations synchronously.</li>
          <li>Build deterministic context with <code>buildContext</code>.</li>
          <li>Send <code>ContextBuildResult.messages</code> to the provider.</li>
          <li>Add assistant output through the reducer.</li>
          <li>Create Memory Inbox proposals when classifier output is significant.</li>
          <li>Run output-side keyword and regex automations.</li>
          <li>Increment the turn, persist, and start async semantic evaluation.</li>
        </ol>
        <p>
          The smoke tests in <code>src/state/turnPipeline.smoke.test.ts</code> exercise this path with a
          mocked provider.
        </p>
      </>
    ),
  },
  {
    id: "context-contract",
    title: "Context Contract",
    category: "Context",
    summary: "The exact named sections and provider payload matching rules.",
    tags: ["context", "payload", "preview", "tokens"],
    body: (
      <>
        <p>Context is assembled in this fixed section order:</p>
        <ol>
          <li>System Shell</li>
          <li>AI Instructions</li>
          <li>Plot Essentials</li>
          <li>Author's Note</li>
          <li>Components</li>
          <li>Story Cards</li>
          <li>Brains</li>
          <li>Quest State</li>
          <li>Rolling Summary</li>
          <li>Next Output Bias</li>
          <li>Recent Messages</li>
        </ol>
        <p>
          Context Preview must match the provider payload. Non-message sections are joined into the first
          system message. Recent messages are shown newest-first in preview but sent chronologically in
          the chat payload.
        </p>
        <p>
          There is no hidden "adventure memory" bucket. Memory Proposals are visible in preview, but they
          are not sent to the model until approved into an active memory surface.
        </p>
      </>
    ),
  },
  {
    id: "priority-budget",
    title: "Priority and Budgeting",
    category: "Context",
    summary: "Protected, pinned, priority, inclusion policy, and memory priority modes.",
    tags: ["budget", "priority", "protected", "pinned"],
    body: (
      <>
        <dl>
          <dt>protected</dt>
          <dd>Cannot be dropped by token truncation.</dd>
          <dt>pinned</dt>
          <dd>Loaded before ordinary triggered memory and dropped later, but not automatically protected.</dd>
          <dt>priority</dt>
          <dd>Relative ordering within a context tier.</dd>
          <dt>inclusionPolicy</dt>
          <dd>Controls whether the item is always loaded, trigger-gated, manually included, or system-suggested.</dd>
        </dl>
        <p>
          Only the system shell and user-marked protected context are absolutely non-droppable. AI
          Instructions, Plot Essentials, and Author's Note are protected by default, but the model is
          intentionally explicit so protection can be inspected and tested.
        </p>
      </>
    ),
  },
  {
    id: "memory-surfaces",
    title: "Memory Surfaces",
    category: "Memory",
    summary: "Chronicle, Rolling Summary, Next Output Bias, Story Cards, Brains, Plot Essentials, and Memory Inbox roles.",
    tags: ["memory", "chronicle", "summary", "next output bias", "story cards", "brains"],
    body: (
      <>
        <dl>
          <dt>Adventure Chronicle</dt>
          <dd>The complete transcript. Stored locally, not compressed, not automatically dumped into context.</dd>
          <dt>Rolling Summary</dt>
          <dd>Compressed model-facing continuity, editable by the user.</dd>
          <dt>Next Output Bias</dt>
          <dd>Short-term user-written steering for the next generation. It is visible, token-counted, and expires by default.</dd>
          <dt>Story Cards</dt>
          <dd>Approved durable facts triggered by keywords, phrases, or regex configuration.</dd>
          <dt>Brains</dt>
          <dd>Opt-in state for major characters only. AI may update a Brain only if it already exists.</dd>
          <dt>Plot Essentials</dt>
          <dd>Tiny always-on current-state constraints.</dd>
          <dt>Memory Inbox</dt>
          <dd>Pending proposals. Nothing in the inbox becomes active context until approved.</dd>
        </dl>
      </>
    ),
  },
  {
    id: "memory-routing",
    title: "Memory Routing Policy",
    category: "Memory",
    summary: "Where new facts should go and when details should be ignored.",
    tags: ["classification", "routing", "policy"],
    body: (
      <>
        <p>Default routing rules:</p>
        <ul>
          <li>Durable recurring facts go to Story Cards.</li>
          <li>Character-specific evolving internal state goes to Brains only for existing BrainEntries.</li>
          <li>Tiny always-on current constraints go to Plot Essentials.</li>
          <li>Broad continuity goes to Rolling Summary.</li>
          <li>Ephemeral scenery, one-off room layouts, movement, and throwaway details are ignored.</li>
        </ul>
        <pre>{`"Margo calls Seth hedge prince" -> storyCard
"Margo feels jealous but hides it" -> brainUpdate only if Margo Brain exists
"The couch is against the west wall" -> ignore
"Magic cannot cross the warded threshold" -> storyCard
"The Beast is actively hunting Seth tonight" -> plotEssentialsUpdate`}</pre>
      </>
    ),
  },
  {
    id: "ai-mutation-boundaries",
    title: "AI Mutation Boundaries",
    category: "Safety",
    summary: "The hard write boundaries for AI-generated updates.",
    tags: ["ai update", "mutation", "reducer", "safety"],
    body: (
      <>
        <p>
          AI-generated updates must flow through <code>applyAIMemoryUpdate</code> or a reducer-backed
          approval path. Direct mutation is not allowed.
        </p>
        <p>Allowed AI writes:</p>
        <ul>
          <li>BrainEntry fields for existing BrainEntries.</li>
          <li>StoryCard content, triggers, and state.</li>
          <li>Component content only when the component type is <code>plotEssentials</code>.</li>
        </ul>
        <p>Rejected AI writes include AI Instructions, Author's Note, provider config, trigger definitions, raw imports, quest definitions, and the system shell.</p>
      </>
    ),
  },
  {
    id: "semantic-triggers",
    title: "Semantic Triggers",
    category: "Automations",
    summary: "LLM-evaluated conditions, generated updates, cooldowns, and logs.",
    tags: ["semantic", "triggers", "evaluation", "automation"],
    body: (
      <>
        <p>
          Semantic triggers are natural-language conditions evaluated after the turn completes. They do
          not block the player's UI. If the player submits again before async updates finish, updates are
          queued and flushed before the next context assembly.
        </p>
        <p>
          Keyword and regex triggers still run synchronously before and after provider generation. Semantic
          trigger logs are visible in Automations.
        </p>
        <p>
          Generated content actions include brain updates, Story Card updates, Plot Essentials updates,
          and Auto-Card review queue creation.
        </p>
      </>
    ),
  },
  {
    id: "provider",
    title: "Provider Configuration",
    category: "Runtime",
    summary: "OpenAI-compatible provider settings and local test keys.",
    tags: ["provider", "groq", "deepseek", "api key"],
    body: (
      <>
        <p>
          Runtime providers use OpenAI-compatible chat completions. API keys are stored in localStorage
          by the app and are not written into adventure JSON.
        </p>
        <pre>{`Base URL: https://api.groq.com/openai/v1
Model:    llama-3.3-70b-versatile`}</pre>
        <p>
          Live tests read <code>.env.test.local</code>. That file is ignored and should contain only
          throwaway test keys.
        </p>
      </>
    ),
  },
  {
    id: "import-export",
    title: "Import and Export",
    category: "Data",
    summary: "Adventure JSON, AI Dungeon story imports, and raw fallback behavior.",
    tags: ["import", "export", "ai dungeon", "json"],
    body: (
      <>
        <p>
          Adventure JSON should round-trip through the Import / Export page. AI Dungeon imports accept
          story text, Story Card JSON, or both. Invalid or ambiguous data should be preserved as raw text
          rather than silently discarded.
        </p>
        <p>
          AI Dungeon story text is parsed into messages. Story cards map title, keys, entry/value/content,
          and type fields into internal StoryCard or Brain candidate shapes.
        </p>
      </>
    ),
  },
  {
    id: "tests",
    title: "Testing Commands",
    category: "Development",
    summary: "Deterministic unit tests, live provider checks, and production build.",
    tags: ["testing", "vitest", "build", "live"],
    body: (
      <>
        <pre>{`npm.cmd test
npm.cmd run build
npm.cmd run test:live`}</pre>
        <p>
          Normal tests are deterministic and do not require a live API. Live tests are opt-in and cover
          provider, semantic trigger, manual brain update, Auto-Card review queue, and Remember This flows.
        </p>
      </>
    ),
  },
];

function searchableText(topic: DocTopic): string {
  return [topic.title, topic.category, topic.summary, ...topic.tags].join(" ").toLocaleLowerCase();
}

export function HelpPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTopics = useMemo(
    () => topics.filter((topic) => !normalizedQuery || searchableText(topic).includes(normalizedQuery)),
    [normalizedQuery],
  );
  const categories = Array.from(new Set(filteredTopics.map((topic) => topic.category)));

  return (
    <section className="page docs-page">
      <header className="docs-header">
        <div>
          <p className="eyebrow">Reference</p>
          <h2>AI Story Teller Documentation</h2>
          <p className="muted">Technical reference for context, memory, triggers, persistence, and testing.</p>
        </div>
        <label className="docs-search">
          <span>Search docs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="context, brain, provider, trigger..."
          />
        </label>
      </header>

      <div className="docs-layout">
        <aside className="docs-toc panel">
          <strong>Topics</strong>
          {filteredTopics.length === 0 ? (
            <p className="muted">No matches.</p>
          ) : (
            <nav>
              {categories.map((category) => (
                <div key={category} className="docs-toc-group">
                  <span>{category}</span>
                  {filteredTopics
                    .filter((topic) => topic.category === category)
                    .map((topic) => (
                      <a key={topic.id} href={`#${topic.id}`}>
                        {topic.title}
                      </a>
                    ))}
                </div>
              ))}
            </nav>
          )}
        </aside>

        <div className="docs-content">
          {filteredTopics.map((topic) => (
            <article key={topic.id} id={topic.id} className="panel docs-topic">
              <div className="docs-topic-heading">
                <div>
                  <span className="docs-category">{topic.category}</span>
                  <h3>{topic.title}</h3>
                </div>
                <div className="docs-tags">
                  {topic.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <p className="muted">{topic.summary}</p>
              <div className="docs-body">{topic.body}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
