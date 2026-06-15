import { useState } from "react";
import type { Adventure, AdventureAction, ArcPace, ArcPhase, ArcTriggerMode, ComponentEntry, ComponentType, ContextInclusionPolicy } from "../types/adventure";
import { makeComponent, makeStoryCard } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, Highlight, NumberInput, contentSnippet } from "./shared";

const ARC_PACE_LABELS: Record<ArcPace, string> = {
  short: "Short — breaks quickly",
  medium: "Medium",
  long: "Long",
  epic: "Epic — a slow, season-long burn",
};

/**
 * Arc Director — set the antagonist ("the Baddie"), the pace ("the Timer"), the cost,
 * and who springs the climax. Pacing is deterministic; the break instruction is withheld
 * from the AI's context until the arc actually reaches the break phase.
 */
function ArcDirector({
  adventure,
  component,
  dispatch,
  onGenerateArc,
  loading,
}: {
  adventure: Adventure;
  component: ComponentEntry;
  dispatch: (action: AdventureAction) => void;
  onGenerateArc?: (componentId: string, concept: string) => Promise<void>;
  loading?: boolean;
}) {
  const [concept, setConcept] = useState("");
  const arc = component.arcState ?? { phase: "simmer" as ArcPhase, tier: 0, threadEngagement: {}, pendingBreak: false };
  const threadKeys = component.arcThreadKeys ?? [];
  const threadSet = new Set(threadKeys);
  const turn = adventure.activeState.turn;
  const configured = threadKeys.length > 0;
  const totalEngagement = threadKeys.reduce((sum, key) => sum + (arc.threadEngagement[key] ?? 0), 0);

  const candidates = [
    ...adventure.storyCards.map((card) => ({ id: card.id, label: card.title, kind: "Card" })),
    ...adventure.brains.map((brain) => ({ id: brain.id, label: brain.characterName, kind: "Brain" })),
  ];

  const patch = (next: Partial<ComponentEntry>) =>
    dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: next });
  const setPhase = (phase: ArcPhase) =>
    dispatch({ type: "SET_ARC_PHASE", componentId: component.id, phase, turn });
  const toggleThread = (id: string, on: boolean) =>
    patch({ arcThreadKeys: on ? [...threadKeys, id] : threadKeys.filter((key) => key !== id) });

  return (
    <div className="editor-card" style={{ borderLeft: "3px solid #b9770e", marginBottom: "0.75rem" }}>
      <strong>🎬 Arc Director</strong>
      <p className="muted" style={{ fontSize: "0.85em", marginTop: "0.25rem" }}>
        Make the antagonist's arc climb out of the loop and actually break. Pacing is automatic and
        deterministic — the cost instruction is withheld from the AI until the arc is ripe, so it can't
        land the climax early. See <code>docs/adventure-design.md</code>.
      </p>

      {onGenerateArc && (
        <Field label="✨ Generate this arc from a concept">
          <div className="row" style={{ gap: "0.5rem", alignItems: "stretch" }}>
            <input
              style={{ flex: 1 }}
              placeholder="e.g. a gang leader who killed my father runs the city's underworld"
              value={concept}
              onChange={(event) => setConcept(event.target.value)}
            />
            <button
              type="button"
              disabled={loading || !concept.trim()}
              onClick={() => void onGenerateArc(component.id, concept.trim()).then(() => setConcept(""))}
              title="Write the premise, simmer behavior, cost, pace, and trigger mode following best practices. You still pick the threads below."
            >
              {loading ? "Generating…" : "Generate Arc"}
            </button>
          </div>
        </Field>
      )}

      <div className="row" style={{ alignItems: "center", gap: "0.75rem", margin: "0.5rem 0" }}>
        <span className="badge badge-priority">{arc.phase.toUpperCase()}</span>
        <span className="muted">Tier {arc.tier}/5 · engagement {totalEngagement}</span>
        {arc.pendingBreak && <span className="badge badge-protected">Ready to break</span>}
      </div>

      {arc.pendingBreak && (
        <div className="row" style={{ gap: "0.5rem", margin: "0.5rem 0", alignItems: "center" }}>
          <span>The arc is ripe — let it break?</span>
          <button type="button" className="danger" onClick={() => setPhase("break")}>Let it break</button>
          <button type="button" onClick={() => patch({ arcState: { ...arc, pendingBreak: false } })}>Not yet</button>
        </div>
      )}

      {arc.phase === "aftermath" && (component.arcContinuationOptions?.length ?? 0) > 0 && (
        <div className="editor-card" style={{ borderLeft: "3px solid #2e7d32", margin: "0.5rem 0" }}>
          <strong>This arc resolved — where does it go next?</strong>
          <p className="muted" style={{ fontSize: "0.85em", margin: "0.25rem 0" }}>
            Picking one banks the finished arc as a Story Card and starts the next arc fresh (simmering). Or write your own below.
          </p>
          {component.arcContinuationOptions!.map((opt, index) => (
            <div key={index} style={{ marginTop: "0.4rem" }}>
              <button
                type="button"
                onClick={() => dispatch({ type: "APPLY_ARC_CONTINUATION", componentId: component.id, option: opt })}
                title={opt.premise}
              >
                {opt.label}
              </button>
              <span className="muted" style={{ fontSize: "0.85em", marginLeft: "0.5rem" }}>{opt.premise}</span>
            </div>
          ))}
        </div>
      )}

      <Field label="The Baddie — which Story Cards / Brains is this arc about?">
        <div style={{ maxHeight: "9rem", overflowY: "auto", border: "1px solid #444", borderRadius: "4px", padding: "0.4rem" }}>
          {candidates.length === 0 && <p className="muted" style={{ margin: 0 }}>Create Story Cards or Brains first.</p>}
          {candidates.map((candidate) => (
            <label key={candidate.id} style={{ display: "block", fontSize: "0.9em" }}>
              <input type="checkbox" checked={threadSet.has(candidate.id)} onChange={(event) => toggleThread(candidate.id, event.target.checked)} />{" "}
              {candidate.label} <span className="muted">({candidate.kind})</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid two">
        <Field label="The Timer — how long should it simmer?">
          <select value={component.arcPace ?? "medium"} onChange={(event) => patch({ arcPace: event.target.value as ArcPace })}>
            {(["short", "medium", "long", "epic"] as ArcPace[]).map((pace) => (
              <option key={pace} value={pace}>{ARC_PACE_LABELS[pace]}</option>
            ))}
          </select>
        </Field>
        <Field label="Who springs the break?">
          <select value={component.arcTriggerMode ?? "ask"} onChange={(event) => patch({ arcTriggerMode: event.target.value as ArcTriggerMode })}>
            <option value="ask">Ask me first (leash)</option>
            <option value="auto">Let the AI spring it (auto)</option>
          </select>
        </Field>
      </div>

      <CheckboxField
        label="Auto-continue the next arc (surprise me — no chooser, no spoiler)"
        checked={component.arcAutoContinue === true}
        onChange={(arcAutoContinue) => patch({ arcAutoContinue })}
      />
      <p className="muted" style={{ fontSize: "0.8em", margin: "0 0 0.5rem" }}>
        When this arc resolves, the Director silently picks the most convergent next arc and seeds it
        simmering — you meet the new threat in the story, not a menu. Off = you pick from drafted directions.
      </p>

      <Field label="How the baddie behaves while building (simmer)">
        <textarea
          rows={3}
          placeholder="Recur through traps, hostage plays, near-misses. Stay off-screen — glimpses, not monologues. Always connected to the larger plan."
          value={component.arcSimmerInstruction ?? ""}
          onChange={(event) => patch({ arcSimmerInstruction: event.target.value })}
        />
      </Field>
      <Field label="How the confrontation lands — the cost (only injected at break)">
        <textarea
          rows={3}
          placeholder="The antagonist forces a confrontation that can't be deferred. It is allowed to cost the cast — named allies can die, ground can be lost. The player stays the strongest; the win is just expensive."
          value={component.arcBreakInstruction ?? ""}
          onChange={(event) => patch({ arcBreakInstruction: event.target.value })}
        />
      </Field>

      {configured && (
        <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
          <button type="button" onClick={() => setPhase("break")} title="Force the climax now, regardless of pacing.">Spring it now</button>
          <button type="button" onClick={() => setPhase("aftermath")} title="Mark the arc resolved.">Resolve arc</button>
          <button type="button" onClick={() => setPhase("simmer")} title="Reset pacing and start a fresh climb.">Reset to simmer</button>
        </div>
      )}
    </div>
  );
}

const SINGLETON_TYPES = new Set<ComponentType>(["narrationRules", "aiInstructions", "plotEssentials", "currentArc", "authorNote"]);

const activeComponentTypes: ComponentType[] = ["narrationRules", "aiInstructions", "plotEssentials", "currentArc", "authorNote", "custom"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

const TYPE_LABELS: Record<ComponentType, string> = {
  narrationRules: "Narration Rules",
  aiInstructions: "AI Instructions",
  plotEssentials: "Plot Essentials",
  currentArc: "Current Story Arc",
  activePressure: "Active Pressure",
  immediateMomentum: "Immediate Momentum",
  authorNote: "Author's Note",
  memory: "Lore Block (legacy)",
  custom: "Custom",
};

const TYPE_DESCRIPTIONS: Record<ComponentType, string> = {
  narrationRules: "The primary per-adventure behavior contract — POV, format, player agency, continuity, tone, and hard writing rules. Loaded first with the system shell. It is valid to keep all stable generation rules here and use no AI Instructions block.",
  aiInstructions: "Optional scenario-specific rules separated for organization. Use this only when you want a distinct drift-prevention or genre contract outside Narration Rules. Do not duplicate rules already present in Narration Rules; both blocks load every turn.",
  plotEssentials: "Durable story shape — core conflict, major forces, what the story is about. Human-edited only. Warning: the model writes toward what this says the story is about. If it contains only relationship content, you get a relationship story. Always keep at least one external threat, unresolved problem, or active arc visible here.",
  currentArc: "A running log of the active story arc — auto-updated as arc-relevant events occur. Seed it with a one-line Arc Premise that defines what this arc is about. The AI only appends entries when something genuinely advances or complicates that premise. When the arc is complete, graduate it to a Story Card and start fresh.",
  activePressure: "The external threat, obligation, or force currently bearing on the player character. Auto-generated, approved via Memory Inbox. Must stay anchored to external stakes — a danger, a deadline, a pursuit, a debt. If this drifts to describing an emotional state or internal need, regenerate it. The model reads this as 'what the scene is about' and writes toward it.",
  immediateMomentum: "The concrete next action or decision immediately in front of the player character. Auto-generated, approved via Memory Inbox. Keep the character initiating, not waiting. 'Nix waits for Seth to answer' is a passive momentum — it writes a passive character. 'Nix needs to source the next component before the Registry traces the portal' writes an active one.",
  authorNote: "Near-context narrative direction — inserted just before Recent Messages for maximum influence on the next response. One per adventure. Most powerful mid-session correction tool: if a character is drifting too passive, too emotional, or too reactive, add a directive here before the next turn. 'Nix should have a project she is actively working on right now' resets the register immediately.",
  memory: "Legacy lore block. Move content to a Story Card with type Lore for triggered inclusion.",
  custom: "A general-purpose context block. Configure inclusion policy, priority, and protection manually.",
};

function ComponentSummary({ component, query }: { component: ComponentEntry; query: string }) {
  const snippet = contentSnippet(component.content, query);
  return (
    <span className="story-card-summary">
      <span className="story-card-title"><Highlight text={TYPE_LABELS[component.type]} query={query} /></span>
      <span className="story-card-badges">
        {!component.active && <span className="badge badge-inactive">Inactive</span>}
        {component.pinned && <span className="badge badge-pinned">Pinned</span>}
        {component.protected && <span className="badge badge-protected">Protected</span>}
        {component.priority > 0 && <span className="badge badge-priority">p{component.priority}</span>}
      </span>
      {snippet && <span className="search-snippet"><Highlight text={snippet} query={query} /></span>}
    </span>
  );
}

interface ComponentsPageProps extends AdventurePageProps {
  loading?: boolean;
  onSuggestPlotUpdates?: () => Promise<void>;
  onRegeneratePlotEssentials?: (componentId: string) => Promise<string>;
  onUpdatePEComponentNow?: (componentId: string) => Promise<void>;
  /** Generate fresh content for Narration Rules / AI Instructions / Author's Note. Returns a string for review. */
  onGenerateComponent?: (componentId: string) => Promise<string>;
  /** Generate an Arc Director setup from a concept and apply it to the Current Arc component. */
  onGenerateArc?: (componentId: string, concept: string) => Promise<void>;
}

const GENERATABLE_COMPONENT_TYPES = new Set<ComponentType>(["narrationRules", "aiInstructions", "authorNote"]);

export function ComponentsPage({ adventure, dispatch, loading, onSuggestPlotUpdates, onRegeneratePlotEssentials, onUpdatePEComponentNow, onGenerateComponent, onGenerateArc }: ComponentsPageProps) {
  const [search, setSearch] = useState("");
  const [pePreview, setPePreview] = useState<Record<string, string>>({});
  const [peRegenerating, setPeRegenerating] = useState<string | null>(null);
  const [graduateConfirm, setGraduateConfirm] = useState<string | null>(null);

  function handleGraduateArc(component: ComponentEntry) {
    if (graduateConfirm !== component.id) {
      setGraduateConfirm(component.id);
      return;
    }
    // Create a story card from the arc content
    const cardTitle = component.arcPremise?.trim() || component.title;
    const cardContent = [
      component.arcPremise?.trim() ? `Arc: ${component.arcPremise.trim()}\n` : "",
      component.content.trim(),
    ].filter(Boolean).join("\n");
    dispatch({ type: "UPSERT_STORY_CARD", storyCard: makeStoryCard({ title: cardTitle, content: cardContent, type: "plot", active: true }) });
    // Clear the arc for the next story arc
    dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { content: "", arcPremise: "" } });
    setGraduateConfirm(null);
  }

  async function handleRegeneratePE(componentId: string) {
    if (!onRegeneratePlotEssentials || peRegenerating) return;
    setPeRegenerating(componentId);
    try {
      const result = await onRegeneratePlotEssentials(componentId);
      setPePreview((prev) => ({ ...prev, [componentId]: result }));
    } catch {
      // silent — user can retry
    } finally {
      setPeRegenerating(null);
    }
  }

  async function handleGenerateComponent(componentId: string) {
    if (!onGenerateComponent || peRegenerating) return;
    setPeRegenerating(componentId);
    try {
      const result = await onGenerateComponent(componentId);
      setPePreview((prev) => ({ ...prev, [componentId]: result }));
    } catch {
      // silent — user can retry
    } finally {
      setPeRegenerating(null);
    }
  }
  const existingTypes = new Set(adventure.components.map((c) => c.type));
  const hasActivePlotEssentials = adventure.components.some((c) => c.type === "plotEssentials" && c.active);

  const availableTypes = activeComponentTypes.filter(
    (t) => !SINGLETON_TYPES.has(t) || !existingTypes.has(t),
  );

  const searchLower = search.toLowerCase().trim();
  const visibleComponents = [...adventure.components]
    .sort((a, b) => b.priority - a.priority)
    .filter((c) => !searchLower ||
      TYPE_LABELS[c.type].toLowerCase().includes(searchLower) ||
      c.content.toLowerCase().includes(searchLower)
    );

  return (
    <section className="page">
      <p className="muted" style={{ margin: 0 }}>
        World Blocks are <strong>always-on context</strong> — they load every turn regardless of the story.
        Use them for narration rules, plot state, and author direction.
        For characters, places, and lore that should only load <em>when relevant</em>, use <strong>Story Cards</strong> — they're more token-efficient.
        <strong> Narration Rules, AI Instructions, Plot Essentials,</strong> and <strong>Author's Note</strong> are singletons.
        AI Instructions are optional; Narration Rules can hold the complete stable behavior contract by themselves.
      </p>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search blocks…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, minWidth: "8rem", maxWidth: "20rem" }}
        />
        {availableTypes.filter((t) => SINGLETON_TYPES.has(t)).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => dispatch({ type: "UPSERT_COMPONENT", component: makeComponent({ title: TYPE_LABELS[type], content: "", type }) })}
          >
            Add {TYPE_LABELS[type]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: "UPSERT_COMPONENT", component: makeComponent({ title: "New Block", content: "", type: "custom" }) })}
        >
          Add Custom Block
        </button>
        {onSuggestPlotUpdates && (
          <button
            type="button"
            disabled={loading || !hasActivePlotEssentials}
            onClick={onSuggestPlotUpdates}
            title="Ask the AI to review recent story turns and suggest updates to Plot Essentials. Results appear in Memory Suggestions."
          >
            {loading ? "Generating…" : "Suggest Updates"}
          </button>
        )}
      </div>

      <div className="list">
        {visibleComponents.map((component) => (
          <details key={component.id} className="card story-card-item">
            <summary><ComponentSummary component={component} query={searchLower} /></summary>

            <div className="editor-card">
              <div className="grid two">
                <Field label="Type">
                  <select
                    value={component.type}
                    onChange={(event) => {
                      const newType = event.target.value as ComponentType;
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { type: newType, title: TYPE_LABELS[newType] } });
                    }}
                  >
                    {[component.type, ...activeComponentTypes.filter((t) => t !== component.type && (!SINGLETON_TYPES.has(t) || !existingTypes.has(t)))].map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="muted component-type-hint">{TYPE_DESCRIPTIONS[component.type]}</p>
              {component.type === "currentArc" && (
                <Field label="Arc Premise" style={{ marginBottom: "0.5rem" }}>
                  <textarea
                    rows={2}
                    placeholder="One-line premise — what is this arc building toward? e.g. 'Kira is building toward deserting the Fire Nation'"
                    value={component.arcPremise ?? ""}
                    onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { arcPremise: event.target.value } })}
                  />
                  <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.85em" }}>
                    The AI auto-appends arc entries only when events meaningfully advance <em>this specific premise</em>. Without a premise, auto-update is disabled.
                  </p>
                </Field>
              )}
              {component.type === "currentArc" && (
                <ArcDirector adventure={adventure} component={component} dispatch={dispatch} onGenerateArc={onGenerateArc} loading={loading} />
              )}
              <Field label={component.type === "currentArc" ? "Arc Log" : "Content"}>
                <textarea
                  rows={6}
                  value={component.content}
                  onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { content: event.target.value } })}
                />
              </Field>
              {pePreview[component.id] !== undefined && (
                <Field label="Regenerated (review before applying)">
                  <textarea
                    rows={6}
                    value={pePreview[component.id]}
                    onChange={(event) => setPePreview((prev) => ({ ...prev, [component.id]: event.target.value }))}
                  />
                </Field>
              )}
              {(component.type === "plotEssentials" || component.type === "activePressure" || component.type === "immediateMomentum" || component.type === "currentArc") && (
                <div className="grid two">
                  {component.type === "plotEssentials" && (
                    <CheckboxField
                      label="Auto-suggest (append new arc beats automatically)"
                      checked={component.autoUpdate === true}
                      onChange={(autoUpdate) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { autoUpdate } })}
                    />
                  )}
                  <Field label="Auto-update cooldown (turns)">
                    <NumberInput
                      value={component.autoUpdateCooldownTurns ?? (component.type === "currentArc" ? 4 : 3)}
                      min={0}
                      onChange={(value) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { autoUpdateCooldownTurns: value } })}
                    />
                  </Field>
                  <Field label="Last updated (turn)">
                    <input value={component.lastAutoUpdateTurn ?? "Never"} readOnly />
                  </Field>
                </div>
              )}
              <div className="grid four">
                <Field label="Priority (higher loads first)">
                  <NumberInput
                    value={component.priority}
                    onChange={(value) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { priority: value } })}
                  />
                </Field>
                <Field label="Token Budget (0 = no limit)">
                  <NumberInput
                    value={component.tokenBudget ?? 0}
                    min={0}
                    onChange={(value) =>
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { tokenBudget: value || undefined } })
                    }
                  />
                </Field>
                <CheckboxField
                  label="Active"
                  checked={component.active}
                  onChange={(checked) =>
                    dispatch({ type: checked ? "ACTIVATE_COMPONENT" : "DEACTIVATE_COMPONENT", componentId: component.id })
                  }
                />
                <CheckboxField
                  label="Pinned (loads before triggered items)"
                  checked={component.pinned}
                  onChange={(checked) => dispatch({ type: checked ? "PIN_COMPONENT" : "UNPIN_COMPONENT", componentId: component.id })}
                />
              </div>
              <CheckboxField
                label="Always on (ignore inclusion policy — load every turn)"
                checked={component.alwaysOn}
                onChange={(checked) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { alwaysOn: checked } })}
              />
              <div className="grid two">
                <CheckboxField
                  label="Protected (cannot be dropped by token truncation)"
                  checked={component.protected}
                  onChange={(checked) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { protected: checked } })}
                />
                <Field label="Inclusion Policy">
                  <select
                    value={component.inclusionPolicy}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { inclusionPolicy: event.target.value as ContextInclusionPolicy } })
                    }
                  >
                    {inclusionPolicies.map((policy) => (
                      <option key={policy} value={policy}>
                        {policy}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="State (runtime note visible to automation conditions)">
                <input
                  value={component.state}
                  onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { state: event.target.value } })}
                />
              </Field>
              <div className="row">
                <button type="button" onClick={() => dispatch({ type: "REORDER_COMPONENT", componentId: component.id, direction: "up" })}>
                  Move Up
                </button>
                <button type="button" onClick={() => dispatch({ type: "REORDER_COMPONENT", componentId: component.id, direction: "down" })}>
                  Move Down
                </button>
                {(component.type === "plotEssentials" || component.type === "activePressure" || component.type === "immediateMomentum" || component.type === "currentArc") && onUpdatePEComponentNow && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onUpdatePEComponentNow(component.id)}
                    title="Ask the AI to review recent story turns and generate an updated version. Result goes to Memory Suggestions for review."
                  >
                    {loading ? "Generating…" : "Update Now"}
                  </button>
                )}
                {component.type === "currentArc" && (
                  <button
                    type="button"
                    className={graduateConfirm === component.id ? "danger" : ""}
                    title="Graduate the completed arc to a permanent Story Card and reset the arc log."
                    onClick={() => handleGraduateArc(component)}
                  >
                    {graduateConfirm === component.id ? "Confirm — Graduate Arc" : "Complete Arc → Story Card"}
                  </button>
                )}
                {graduateConfirm === component.id && (
                  <button type="button" onClick={() => setGraduateConfirm(null)}>Cancel</button>
                )}
                {component.type === "plotEssentials" && onRegeneratePlotEssentials && (
                  <button
                    type="button"
                    disabled={!!peRegenerating}
                    onClick={() => handleRegeneratePE(component.id)}
                    title="Ask the AI to consolidate and rewrite Plot Essentials, removing resolved events and keeping active state."
                  >
                    {peRegenerating === component.id ? "Generating…" : "Regenerate"}
                  </button>
                )}
                {GENERATABLE_COMPONENT_TYPES.has(component.type) && onGenerateComponent && (
                  <button
                    type="button"
                    disabled={!!peRegenerating}
                    onClick={() => handleGenerateComponent(component.id)}
                    title="Ask the AI to write this block from the adventure's premise and cast, following best practices. Review before applying."
                  >
                    {peRegenerating === component.id ? "Generating…" : (component.content.trim() ? "✨ Regenerate" : "✨ Generate")}
                  </button>
                )}
                {pePreview[component.id] !== undefined && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { content: pePreview[component.id] } });
                        setPePreview((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== component.id)));
                      }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setPePreview((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== component.id)))}
                    >
                      Discard
                    </button>
                  </>
                )}
                <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_COMPONENT", componentId: component.id })}>
                  Delete
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
