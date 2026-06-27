import { useMemo, useState } from "react";
import type { Adventure, BrainEntry, ComponentEntry, ContextBuildResult, MemoryProposal, StoryCard } from "../types/adventure";

type EditTarget = "components" | "storyCards" | "brains" | "memoryInbox" | "context";

interface PlayPeekProps {
  adventure: Adventure;
  contextResult?: ContextBuildResult;
  onEditFully: (target: EditTarget) => void;
  onBuildContext?: () => void;
}

function clamp(text: string, limit = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trim()}...`;
}

function splitLines(text: string, max = 4) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, max);
}

function thoughtEntries(brain: BrainEntry, max = 2) {
  return Object.entries(brain.thoughts).slice(0, max);
}

function componentLabel(component: ComponentEntry) {
  switch (component.type) {
    case "plotEssentials":
      return "Current truth";
    case "activePressure":
      return "Pressure";
    case "currentArc":
      return "Story arc";
    case "authorNote":
      return "Tone note";
    case "aiInstructions":
      return "AI rules";
    case "narrationRules":
      return "Narration";
    default:
      return "Context";
  }
}

function Shell({
  title,
  subtitle,
  target,
  onEditFully,
  children,
}: {
  title: string;
  subtitle: string;
  target: EditTarget;
  onEditFully: (target: EditTarget) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="play-peek">
      <div className="play-peek-header">
        <div>
          <p className="eyebrow">quick peek</p>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
        <button type="button" onClick={() => onEditFully(target)}>Edit fully</button>
      </div>
      {children}
    </section>
  );
}

function EmptyPeek({ children }: { children: React.ReactNode }) {
  return <p className="muted play-peek-empty">{children}</p>;
}

export function PlayPlotPeek({ adventure, onEditFully }: PlayPeekProps) {
  const plotOrder = new Map([
    ["activePressure", 0],
    ["plotEssentials", 1],
    ["currentArc", 2],
    ["authorNote", 3],
  ]);
  const plotItems = adventure.components
    .filter((component) => component.active && plotOrder.has(component.type))
    .sort((a, b) => (plotOrder.get(a.type) ?? 99) - (plotOrder.get(b.type) ?? 99));

  return (
    <Shell
      title="Plot"
      subtitle="Only the current stakes and steering notes. Full component editing lives in Edit."
      target="components"
      onEditFully={onEditFully}
    >
      <div className="play-peek-list">
        {plotItems.length === 0 && <EmptyPeek>No active plot notes yet.</EmptyPeek>}
        {plotItems.map((component) => (
          <article key={component.id} className="play-peek-item">
            <div className="play-peek-item-head">
              <span>{componentLabel(component)}</span>
              {component.type === "currentArc" && component.arcState && <small>{component.arcState.phase}</small>}
            </div>
            <strong>{component.title}</strong>
            {component.type === "currentArc" && component.arcPremise && (
              <p>{clamp(component.arcPremise, 180)}</p>
            )}
            {splitLines(component.content, component.type === "plotEssentials" ? 5 : 3).map((line, index) => (
              <p key={`${component.id}-${index}`}>{clamp(line, 240)}</p>
            ))}
          </article>
        ))}
      </div>
    </Shell>
  );
}

export function PlayCardsPeek({ adventure, onEditFully }: PlayPeekProps) {
  const cards = [...adventure.storyCards]
    .filter((card) => card.active)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, 8);

  return (
    <Shell
      title="Story Cards"
      subtitle="Triggered facts likely to matter soon. Use the full editor for rules, imports, and audits."
      target="storyCards"
      onEditFully={onEditFully}
    >
      <div className="play-peek-statline">
        <span>{adventure.storyCards.filter((card) => card.active).length} active</span>
        <span>{adventure.storyCards.filter((card) => card.pinned).length} pinned</span>
      </div>
      <div className="play-peek-list">
        {cards.length === 0 && <EmptyPeek>No active cards yet.</EmptyPeek>}
        {cards.map((card) => (
          <CardPeekItem key={card.id} card={card} />
        ))}
      </div>
    </Shell>
  );
}

function CardPeekItem({ card }: { card: StoryCard }) {
  return (
    <article className="play-peek-item">
      <div className="play-peek-item-head">
        <span>{card.title || "Untitled card"}</span>
        <small>{card.memoryMode}</small>
      </div>
      {card.keys.length > 0 && <p className="play-peek-tags">{card.keys.slice(0, 5).join(", ")}</p>}
      <p>{clamp(card.content || card.state || "No live memory written yet.", 260)}</p>
    </article>
  );
}

export function PlayCharactersPeek({ adventure, onEditFully }: PlayPeekProps) {
  const brains = [...adventure.brains]
    .filter((brain) => brain.active)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || a.characterName.localeCompare(b.characterName))
    .slice(0, 8);

  return (
    <Shell
      title="Characters"
      subtitle="Read-only character state for play. Heavy settings stay out of the story surface."
      target="brains"
      onEditFully={onEditFully}
    >
      <div className="play-peek-statline">
        <span>{adventure.brains.filter((brain) => brain.active).length} active</span>
        <span>{adventure.brains.reduce((sum, brain) => sum + Object.keys(brain.thoughts).length, 0)} thoughts</span>
      </div>
      <div className="play-peek-list">
        {brains.length === 0 && <EmptyPeek>No character thoughts yet.</EmptyPeek>}
        {brains.map((brain) => (
          <article key={brain.id} className="play-peek-item">
            <div className="play-peek-item-head">
              <span>{brain.characterName || "Unnamed"}</span>
              <small>p{brain.priority}</small>
            </div>
            {brain.triggers.length > 0 && <p className="play-peek-tags">{brain.triggers.slice(0, 4).join(", ")}</p>}
            {thoughtEntries(brain).length === 0 && <p className="muted">No current thoughts.</p>}
            {thoughtEntries(brain).map(([key, value]) => (
              <p key={key}><strong>{key}</strong>: {clamp(value, 190)}</p>
            ))}
          </article>
        ))}
      </div>
    </Shell>
  );
}

type SearchHit = {
  id: string;
  kind: string;
  title: string;
  body: string;
};

export function PlayMemoryPeek({ adventure, onEditFully }: PlayPeekProps) {
  const [query, setQuery] = useState("");
  const pending = adventure.activeState.memoryProposals.filter((proposal) => proposal.status === "pending");
  const hits = useMemo(() => buildSearchHits(adventure, query), [adventure, query]);

  return (
    <Shell
      title="Memory"
      subtitle="Search story memory across cards, characters, plot, and pending suggestions."
      target="memoryInbox"
      onEditFully={onEditFully}
    >
      <input
        className="play-peek-search"
        type="search"
        placeholder="Find a fact, person, card, or thought..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!query.trim() && (
        <>
          <div className="play-peek-statline">
            <span>{pending.length} pending</span>
            <span>{adventure.storyCards.length} cards</span>
            <span>{adventure.brains.length} characters</span>
          </div>
          <div className="play-peek-list">
            {pending.length === 0 && <EmptyPeek>No pending memory suggestions.</EmptyPeek>}
            {pending.slice(0, 6).map((proposal) => (
              <ProposalPeekItem key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </>
      )}
      {query.trim() && (
        <div className="play-peek-list">
          {hits.length === 0 && <EmptyPeek>No matching story memory.</EmptyPeek>}
          {hits.map((hit) => (
            <article key={hit.id} className="play-peek-item">
              <div className="play-peek-item-head">
                <span>{hit.title}</span>
                <small>{hit.kind}</small>
              </div>
              <p>{clamp(hit.body, 260)}</p>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}

function ProposalPeekItem({ proposal }: { proposal: MemoryProposal }) {
  return (
    <article className="play-peek-item">
      <div className="play-peek-item-head">
        <span>{proposal.title || "Untitled suggestion"}</span>
        <small>{proposal.proposedType}</small>
      </div>
      <p>{clamp(proposal.content || proposal.sourceText, 260)}</p>
    </article>
  );
}

function buildSearchHits(adventure: Adventure, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const hits: SearchHit[] = [];
  for (const card of adventure.storyCards) {
    const body = [card.keys.join(", "), card.content, card.state, card.archivedFacts].filter(Boolean).join("\n");
    if (`${card.title}\n${body}`.toLowerCase().includes(needle)) {
      hits.push({ id: `card-${card.id}`, kind: "Card", title: card.title || "Untitled card", body });
    }
  }

  for (const brain of adventure.brains) {
    const thoughts = Object.entries(brain.thoughts).map(([key, value]) => `${key}: ${value}`).join("\n");
    const archived = Object.entries(brain.archivedThoughts).map(([key, value]) => `${key}: ${value}`).join("\n");
    const body = [brain.triggers.join(", "), brain.currentState, thoughts, archived, brain.notes].filter(Boolean).join("\n");
    if (`${brain.characterName}\n${body}`.toLowerCase().includes(needle)) {
      hits.push({ id: `brain-${brain.id}`, kind: "Character", title: brain.characterName || "Unnamed", body });
    }
  }

  for (const component of adventure.components) {
    const body = [component.arcPremise, component.content, component.state].filter(Boolean).join("\n");
    if (`${component.title}\n${body}`.toLowerCase().includes(needle)) {
      hits.push({ id: `component-${component.id}`, kind: componentLabel(component), title: component.title || "Untitled plot note", body });
    }
  }

  for (const proposal of adventure.activeState.memoryProposals) {
    const body = [proposal.content, proposal.sourceText, proposal.rationale].filter(Boolean).join("\n");
    if (`${proposal.title}\n${body}`.toLowerCase().includes(needle)) {
      hits.push({ id: `proposal-${proposal.id}`, kind: "Suggestion", title: proposal.title || "Untitled suggestion", body });
    }
  }

  return hits.slice(0, 12);
}

export function PlayContextPeek({ adventure, contextResult, onBuildContext, onEditFully }: PlayPeekProps) {
  const dropped = contextResult?.excludedItems.filter((item) => item.reason === "budget_exceeded") ?? [];
  const sections = contextResult?.sections.filter((section) => section.items.length > 0 || section.tokenEstimate > 0) ?? [];

  return (
    <Shell
      title="Context"
      subtitle="A compact health check for what the model sees. Full payload inspection stays separate."
      target="context"
      onEditFully={onEditFully}
    >
      <div className="play-peek-actions">
        <button type="button" onClick={onBuildContext}>Refresh context</button>
      </div>
      {!contextResult && <EmptyPeek>Build the preview to see context sections and token pressure.</EmptyPeek>}
      {contextResult && (
        <>
          <div className="play-peek-statline">
            <span>{contextResult.totalEstimatedTokens.toLocaleString()} tokens</span>
            <span>{sections.length} sections</span>
            {dropped.length > 0 && <span>{dropped.length} dropped</span>}
          </div>
          <div className="play-peek-list">
            {sections.slice(0, 8).map((section) => (
              <article key={section.id} className="play-peek-item">
                <div className="play-peek-item-head">
                  <span>{section.label}</span>
                  <small>{section.tokenEstimate.toLocaleString()} tokens</small>
                </div>
                <p>{section.items.length} item{section.items.length === 1 ? "" : "s"}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
