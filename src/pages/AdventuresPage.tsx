import { useEffect, useState, type ChangeEvent } from "react";
import type {
  Adventure,
  AdventureThumbnailImage,
  ComponentEntry,
  ComponentType,
  GitHubSaveSlot,
  NewAdventureSetup,
  StoryCard,
  StoryCardType,
} from "../types/adventure";
import { AidImportWizard } from "../components/AidImportWizard";
import type { AdventureSummary } from "../db/adventureDb";
import { defaultNarrationRulesContent, makeComponent, makeStoryCard } from "../state/defaults";
import { parseAidStoryCards } from "../importers/aidCardParser";
import { createId } from "../utils/id";
import { CheckboxField, Field, NumberInput, fromCommaList } from "./shared";
import { AdventureThumbnailFrame, AdventureThumbnailPicker } from "../components/AdventureThumbnail";

interface AdventuresPageProps {
  adventures: AdventureSummary[];
  currentAdventure?: Adventure;
  onCreate: (setup: NewAdventureSetup) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onOpenEdit?: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateAdventureFromImport?: (adventure: Adventure) => Promise<void>;
  saveSlots?: GitHubSaveSlot[];
  savesStatus?: string;
  onListSaves?: () => void;
  onLoadSave?: (slot: GitHubSaveSlot) => void;
}

interface ComponentDraft {
  id: string;
  title: string;
  type: ComponentType;
  content: string;
  priority: number;
  alwaysOn: boolean;
  pinned: boolean;
  protected: boolean;
}

interface StoryCardDraft {
  id: string;
  title: string;
  keysText: string;
  content: string;
  type: StoryCardType;
  priority: number;
  pinned: boolean;
}

const componentTypes: ComponentType[] = ["narrationRules", "aiInstructions", "plotEssentials", "authorNote", "custom"];

const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  narrationRules: "Narration Rules",
  aiInstructions: "AI Instructions",
  plotEssentials: "Plot Essentials",
  authorNote: "Author's Note",
  memory: "Lore Block (legacy)",
  custom: "Custom",
};
const storyCardTypes: StoryCardType[] = ["character", "location", "lore", "plot", "custom"];

function isFixedComponentType(type: ComponentType): boolean {
  return type === "narrationRules" || type === "aiInstructions" || type === "plotEssentials" || type === "authorNote";
}

function defaultComponentPriority(type: ComponentType): number {
  if (type === "narrationRules") return 100;
  if (type === "aiInstructions") return 90;
  if (type === "plotEssentials") return 80;
  if (type === "authorNote") return 70;
  return 0;
}

function blankComponentDraft(type: ComponentType = "plotEssentials"): ComponentDraft {
  const fixed = isFixedComponentType(type);
  return {
    id: createId("componentDraft"),
    title: type === "plotEssentials" ? "Plot Essentials" : "New Component",
    type,
    content: "",
    priority: defaultComponentPriority(type),
    alwaysOn: fixed,
    pinned: fixed,
    protected: fixed,
  };
}

function blankStoryCardDraft(): StoryCardDraft {
  return {
    id: createId("storyDraft"),
    title: "New Story Card",
    keysText: "",
    content: "",
    type: "custom",
    priority: 0,
    pinned: false,
  };
}

function componentFromDraft(draft: ComponentDraft): ComponentEntry | undefined {
  const title = draft.title.trim();
  const content = draft.content.trim();
  if (!title && !content) return undefined;
  return makeComponent({
    title: title || "Untitled Component",
    type: draft.type,
    content,
    priority: draft.priority,
    alwaysOn: draft.alwaysOn,
    active: true,
    pinned: draft.pinned,
    protected: draft.protected,
  });
}

function storyCardFromDraft(draft: StoryCardDraft): StoryCard | undefined {
  const title = draft.title.trim();
  const content = draft.content.trim();
  if (!title && !content) return undefined;
  return makeStoryCard({
    title: title || "Untitled Story Card",
    keys: fromCommaList(draft.keysText),
    content,
    type: draft.type,
    priority: draft.priority,
    active: true,
    pinned: draft.pinned,
  });
}

function formatUtc(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d{3}Z$/, " UTC").replace(/Z$/, " UTC");
}

export function AdventuresPage({
  adventures,
  currentAdventure,
  onCreate,
  onOpen,
  onOpenEdit,
  onDuplicate,
  onDelete,
  onCreateAdventureFromImport,
  saveSlots,
  savesStatus,
  onListSaves,
  onLoadSave,
}: AdventuresPageProps) {
  const [view, setView] = useState<"list" | "create" | "aidImport" | "github">("list");

  useEffect(() => {
    if (view === "github") onListSaves?.();
    // intentional: only fire when entering the github view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const [title, setTitle] = useState("New Adventure");
  const [openingScene, setOpeningScene] = useState("");
  const [thumbnailImage, setThumbnailImage] = useState<AdventureThumbnailImage | undefined>();
  const [componentDrafts, setComponentDrafts] = useState<ComponentDraft[]>([{
    id: createId("componentDraft"),
    title: "Global Generation Rules",
    type: "narrationRules",
    content: defaultNarrationRulesContent,
    priority: 100,
    alwaysOn: true,
    pinned: true,
    protected: true,
  }]);
  const [manualStoryCardDrafts, setManualStoryCardDrafts] = useState<StoryCardDraft[]>([]);
  const [storyCardJsonText, setStoryCardJsonText] = useState("");
  const [jsonStoryCards, setJsonStoryCards] = useState<StoryCard[]>([]);
  const [jsonImportError, setJsonImportError] = useState<string | undefined>();
  const [jsonImportMessages, setJsonImportMessages] = useState<string[]>([]);

  const starterComponents = componentDrafts.map(componentFromDraft).filter((component): component is ComponentEntry => Boolean(component));
  const manualStoryCards = manualStoryCardDrafts.map(storyCardFromDraft).filter((card): card is StoryCard => Boolean(card));
  const totalStoryCardCount = manualStoryCards.length + jsonStoryCards.length;

  function updateComponentDraft(id: string, patch: Partial<ComponentDraft>) {
    setComponentDrafts((drafts) =>
      drafts.map((draft) => {
        if (draft.id !== id) return draft;
        const next = { ...draft, ...patch };
        if (patch.type) {
          const fixed = isFixedComponentType(patch.type);
          next.priority = defaultComponentPriority(patch.type);
          next.alwaysOn = fixed || next.alwaysOn;
          next.pinned = fixed || next.pinned;
          next.protected = fixed;
        }
        return next;
      }),
    );
  }

  function updateStoryCardDraft(id: string, patch: Partial<StoryCardDraft>) {
    setManualStoryCardDrafts((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function parseStoryCardJson(text = storyCardJsonText) {
    const result = parseAidStoryCards(text);
    if (result.error) {
      setJsonStoryCards([]);
      setJsonImportError(result.error);
      setJsonImportMessages(result.warnings);
      return;
    }
    setJsonStoryCards(result.cards.map((card) => card.storyCard));
    setJsonImportError(undefined);
    setJsonImportMessages([
      ...result.warnings,
      ...(result.skipped.length ? [`Skipped ${result.skipped.length} invalid card(s).`] : []),
    ]);
  }

  async function readStoryCardFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setStoryCardJsonText(text);
    parseStoryCardJson(text);
  }

  async function createAdventure() {
    await onCreate({
      title: title.trim() || "New Adventure",
      openingScene: openingScene.trim(),
      components: starterComponents,
      storyCards: [...manualStoryCards, ...jsonStoryCards],
      thumbnailImage,
    });
  }

  if (view === "create") {
    return (
      <section className="page">
        <article className="panel new-adventure-setup">
          <div className="panel-heading">
            <div>
              <button type="button" onClick={() => setView("list")}>
                ← Library
              </button>
              <p className="eyebrow">New Adventure</p>
              <h3>Set up before playing</h3>
              <p className="muted">
                Add starter context and Story Cards now, or leave everything blank and build it later.
              </p>
            </div>
            <div className="toolbar">
              <button type="button" onClick={() => setView("aidImport")}>
                Import from AI Dungeon
              </button>
              <button type="button" className="primary-action" onClick={createAdventure}>
                Create Adventure
              </button>
            </div>
          </div>

          <Field label="Adventure title">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <details className="setup-panel" open={!!thumbnailImage}>
            <summary>Thumbnail Image</summary>
            <AdventureThumbnailPicker
              thumbnail={thumbnailImage}
              title={title}
              onChange={setThumbnailImage}
            />
          </details>

          <details className="setup-panel" open={!!openingScene}>
            <summary>Opening Scene</summary>
            <p className="muted">
              Sets the initial story text before the first turn. Shown to you in the play view and included
              in the model context as the first assistant message.
            </p>
            <textarea
              rows={6}
              value={openingScene}
              onChange={(event) => setOpeningScene(event.target.value)}
              placeholder="The scene opens on… (optional — you can always start playing with a blank canvas)"
            />
          </details>

          <details className="setup-panel">
            <summary>Starter Components ({starterComponents.length})</summary>
            <p className="muted">
              Components become World Blocks. Use Plot Essentials for tiny always-on premise/current-state context.
            </p>
            <div className="toolbar">
              <button type="button" onClick={() => setComponentDrafts((drafts) => [...drafts, blankComponentDraft("aiInstructions")])}>
                Add AI Instructions
              </button>
              <button type="button" onClick={() => setComponentDrafts((drafts) => [...drafts, blankComponentDraft("plotEssentials")])}>
                Add Plot Essentials
              </button>
              <button type="button" onClick={() => setComponentDrafts((drafts) => [...drafts, blankComponentDraft("authorNote")])}>
                Add Author's Note
              </button>
              <button type="button" onClick={() => setComponentDrafts((drafts) => [...drafts, blankComponentDraft("custom")])}>
                Add Custom Component
              </button>
            </div>
            {componentDrafts.length === 0 ? (
              <p className="muted">No starter components selected.</p>
            ) : (
              <div className="list">
                {componentDrafts.map((draft) => (
                  <article key={draft.id} className="card editor-card">
                    <div className="grid three">
                      <Field label="Title">
                        <input value={draft.title} onChange={(event) => updateComponentDraft(draft.id, { title: event.target.value })} />
                      </Field>
                      <Field label="Type">
                        <select
                          value={draft.type}
                          onChange={(event) => updateComponentDraft(draft.id, { type: event.target.value as ComponentType })}
                        >
                          {componentTypes.map((type) => (
                            <option key={type} value={type}>
                              {COMPONENT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Priority">
                        <NumberInput value={draft.priority} onChange={(priority) => updateComponentDraft(draft.id, { priority })} />
                      </Field>
                    </div>
                    <Field label="Content">
                      <textarea
                        rows={5}
                        value={draft.content}
                        onChange={(event) => updateComponentDraft(draft.id, { content: event.target.value })}
                      />
                    </Field>
                    <div className="grid four">
                      <CheckboxField
                        label="Always on"
                        checked={draft.alwaysOn}
                        onChange={(alwaysOn) => updateComponentDraft(draft.id, { alwaysOn })}
                      />
                      <CheckboxField
                        label="Pinned"
                        checked={draft.pinned}
                        onChange={(pinned) => updateComponentDraft(draft.id, { pinned })}
                      />
                      <CheckboxField
                        label="Protected"
                        checked={draft.protected}
                        onChange={(protectedValue) => updateComponentDraft(draft.id, { protected: protectedValue })}
                      />
                      <button
                        type="button"
                        className="danger"
                        onClick={() => setComponentDrafts((drafts) => drafts.filter((item) => item.id !== draft.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>

          <details className="setup-panel" open>
            <summary>Starter Story Cards ({totalStoryCardCount})</summary>
            <p className="muted">
              Add Story Cards manually, paste JSON, or upload a .json file. Imported cards are previewed before creation.
            </p>

            <div className="grid two">
              <section className="setup-column">
                <div className="panel-heading">
                  <h3>Manual Story Cards</h3>
                  <button type="button" onClick={() => setManualStoryCardDrafts((drafts) => [...drafts, blankStoryCardDraft()])}>
                    Add Manual Card
                  </button>
                </div>
                {manualStoryCardDrafts.length === 0 ? (
                  <p className="muted">No manual Story Cards yet.</p>
                ) : (
                  <div className="list">
                    {manualStoryCardDrafts.map((draft) => (
                      <article key={draft.id} className="card editor-card">
                        <div className="grid two">
                          <Field label="Title">
                            <input value={draft.title} onChange={(event) => updateStoryCardDraft(draft.id, { title: event.target.value })} />
                          </Field>
                          <Field label="Type">
                            <select
                              value={draft.type}
                              onChange={(event) => updateStoryCardDraft(draft.id, { type: event.target.value as StoryCardType })}
                            >
                              {storyCardTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label="Triggers / keys">
                          <input
                            value={draft.keysText}
                            onChange={(event) => updateStoryCardDraft(draft.id, { keysText: event.target.value })}
                            placeholder="Margo, hedge prince, hidden oath"
                          />
                        </Field>
                        <Field label="Content">
                          <textarea
                            rows={5}
                            value={draft.content}
                            onChange={(event) => updateStoryCardDraft(draft.id, { content: event.target.value })}
                          />
                        </Field>
                        <div className="grid three">
                          <Field label="Priority">
                            <NumberInput value={draft.priority} onChange={(priority) => updateStoryCardDraft(draft.id, { priority })} />
                          </Field>
                          <CheckboxField
                            label="Pinned"
                            checked={draft.pinned}
                            onChange={(pinned) => updateStoryCardDraft(draft.id, { pinned })}
                          />
                          <button
                            type="button"
                            className="danger"
                            onClick={() => setManualStoryCardDrafts((drafts) => drafts.filter((item) => item.id !== draft.id))}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="setup-column">
                <div className="panel-heading">
                  <h3>Story Card JSON</h3>
                  <button type="button" onClick={() => parseStoryCardJson()}>
                    Parse JSON
                  </button>
                </div>
                <Field label="Upload .json file">
                  <input type="file" accept="application/json,.json" onChange={readStoryCardFile} />
                </Field>
                <Field label="Paste Story Card JSON">
                  <textarea
                    rows={10}
                    value={storyCardJsonText}
                    onChange={(event) => setStoryCardJsonText(event.target.value)}
                    placeholder='[{"title":"Margo","keys":"Margo, hedge prince","entry":"Margo calls Seth hedge prince."}]'
                  />
                </Field>
                {jsonImportError && <div className="error-box">{jsonImportError}</div>}
                {jsonImportMessages.map((message) => (
                  <p key={message} className="muted">
                    {message}
                  </p>
                ))}
                {jsonStoryCards.length > 0 && (
                  <div className="notice">
                    <strong>{jsonStoryCards.length} JSON Story Card(s) ready</strong>
                    <ul className="compact-list setup-preview-list">
                      {jsonStoryCards.slice(0, 8).map((card) => (
                        <li key={card.id}>
                          <strong>{card.title}</strong>
                          <span>{card.keys.join(", ") || "No triggers"}</span>
                        </li>
                      ))}
                    </ul>
                    {jsonStoryCards.length > 8 && <p className="muted">Showing first 8 imported cards.</p>}
                    <button type="button" onClick={() => setJsonStoryCards([])}>
                      Clear JSON Cards
                    </button>
                  </div>
                )}
              </section>
            </div>
          </details>
        </article>
      </section>
    );
  }

  if (view === "aidImport") {
    return (
      <section className="page">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Import</p>
              <h3>Import from AI Dungeon</h3>
              <p className="muted">
                Upload your AID export files. Multiple files are read in filename order and merged in sequence.
              </p>
            </div>
          </div>
          {onCreateAdventureFromImport && (
            <AidImportWizard
              onCreateAdventureFromImport={onCreateAdventureFromImport}
              onComplete={() => setView("list")}
              onBack={() => setView("list")}
              backLabel="← Library"
            />
          )}
        </article>
      </section>
    );
  }

  if (view === "github") {
    return (
      <section className="page">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <button type="button" onClick={() => setView("list")}>← Library</button>
              <p className="eyebrow">GitHub Save Slots</p>
              <h3>Load a saved adventure</h3>
            </div>
            <div className="toolbar">
              <button type="button" onClick={() => onListSaves?.()}>Refresh</button>
              {savesStatus && <span className="status-pill">{savesStatus}</span>}
            </div>
          </div>

          {(!saveSlots || saveSlots.length === 0) ? (
            <p className="muted">{savesStatus?.startsWith("Loading") ? "Loading…" : "No saves found."}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.35rem 0.5rem" }}>Adventure</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>Type</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>Turn</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>Saved (UTC)</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {saveSlots.map((slot) => (
                  <tr key={slot.saveId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.35rem 0.5rem" }}>{slot.title}</td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>{slot.saveType}</td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>{slot.turnCount}</td>
                    <td style={{ padding: "0.35rem 0.5rem", fontFamily: "monospace" }}>{formatUtc(slot.savedAt)}</td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>
                      <button type="button" onClick={() => onLoadSave?.(slot)}>Load</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    );
  }

  return (
    <section className="page library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Choose an adventure</h2>
          <p className="muted">Continue a saved story, duplicate a setup, or start a new world.</p>
        </div>
        <div className="toolbar">
          {onListSaves && (
            <button type="button" onClick={() => setView("github")}>
              Load from GitHub
            </button>
          )}
          <button type="button" onClick={() => setView("aidImport")}>
            Import from AI Dungeon
          </button>
          <button type="button" className="primary-action" onClick={() => setView("create")}>
            New Adventure
          </button>
        </div>
      </header>
      <div className="library-grid">
        {adventures.length === 0 && <p className="muted">No adventures saved yet.</p>}
        {adventures.map((adventure) => (
          <article key={adventure.id} className="library-card">
            <AdventureThumbnailFrame
              thumbnail={adventure.thumbnailImage}
              title={adventure.title}
              className="library-card-cover"
            />
            <div className="library-card-body">
            <div>
              <h3>{adventure.title}</h3>
              <p className="muted">
                Updated {new Date(adventure.updatedAt).toLocaleString()} · Created{" "}
                {new Date(adventure.createdAt).toLocaleString()}
              </p>
              {currentAdventure?.id === adventure.id && <p className="status-pill">Open</p>}
            </div>
            <div className="library-card-actions">
              <button type="button" className="primary-action" onClick={() => onOpen(adventure.id)}>
                Select
              </button>
              {onOpenEdit && (
                <button type="button" onClick={() => onOpenEdit(adventure.id)}>
                  Edit
                </button>
              )}
              <button type="button" onClick={() => onDuplicate(adventure.id)}>
                Duplicate
              </button>
              <button type="button" className="danger" onClick={() => onDelete(adventure.id)}>
                Delete
              </button>
            </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
