import { useState, type ChangeEvent } from "react";
import type {
  Adventure,
  CloudSyncSettings,
  ComponentEntry,
  ComponentType,
  NewAdventureSetup,
  StoryCard,
  StoryCardType,
} from "../types/adventure";
import type { AdventureSummary } from "../db/adventureDb";
import { makeComponent, makeStoryCard } from "../state/defaults";
import { parseAidStoryCards } from "../importers/aidCardParser";
import {
  createDevelopmentAdventureJson,
  createDevelopmentStoryCardsJson,
  developmentAdventureTitle,
} from "../dev/developmentAdventure";
import { createId } from "../utils/id";
import { CheckboxField, Field, NumberInput, fromCommaList } from "./shared";

interface AdventuresPageProps {
  adventures: AdventureSummary[];
  currentAdventure?: Adventure;
  onCreate: (setup: NewAdventureSetup) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  cloudSyncSettings?: CloudSyncSettings;
  cloudSyncStatus?: string;
  onCloudSyncSettingsChange?: (settings: CloudSyncSettings) => void;
  onPushCloudSync?: () => Promise<void>;
  onPullCloudSync?: () => Promise<void>;
  onLoadDevelopmentAdventure?: () => Promise<void>;
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

const componentTypes: ComponentType[] = ["aiInstructions", "plotEssentials", "authorNote", "memory", "custom"];
const storyCardTypes: StoryCardType[] = ["character", "location", "lore", "plot", "custom"];

function isFixedComponentType(type: ComponentType): boolean {
  return type === "aiInstructions" || type === "plotEssentials" || type === "authorNote";
}

function defaultComponentPriority(type: ComponentType): number {
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

function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdventuresPage({
  adventures,
  currentAdventure,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
  cloudSyncSettings,
  cloudSyncStatus,
  onCloudSyncSettingsChange,
  onPushCloudSync,
  onPullCloudSync,
  onLoadDevelopmentAdventure,
}: AdventuresPageProps) {
  const [title, setTitle] = useState("New Adventure");
  const [openingScene, setOpeningScene] = useState("");
  const [componentDrafts, setComponentDrafts] = useState<ComponentDraft[]>([]);
  const [manualStoryCardDrafts, setManualStoryCardDrafts] = useState<StoryCardDraft[]>([]);
  const [storyCardJsonText, setStoryCardJsonText] = useState("");
  const [jsonStoryCards, setJsonStoryCards] = useState<StoryCard[]>([]);
  const [jsonImportError, setJsonImportError] = useState<string | undefined>();
  const [jsonImportMessages, setJsonImportMessages] = useState<string[]>([]);

  const starterComponents = componentDrafts.map(componentFromDraft).filter((component): component is ComponentEntry => Boolean(component));
  const manualStoryCards = manualStoryCardDrafts.map(storyCardFromDraft).filter((card): card is StoryCard => Boolean(card));
  const totalStoryCardCount = manualStoryCards.length + jsonStoryCards.length;

  function updateCloudSync(patch: Partial<CloudSyncSettings>) {
    if (!cloudSyncSettings || !onCloudSyncSettingsChange) return;
    onCloudSyncSettingsChange({ ...cloudSyncSettings, ...patch });
  }

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
    });
  }

  return (
    <section className="page">
      <article className="panel new-adventure-setup">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">New Adventure</p>
            <h3>Set up before playing</h3>
            <p className="muted">
              Add starter context and Story Cards now, or leave everything blank and build it later.
            </p>
          </div>
          <button type="button" onClick={createAdventure}>
            Create Adventure
          </button>
        </div>

        <div className="grid two">
          <Field label="Adventure title">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Opening scene">
            <textarea
              rows={4}
              value={openingScene}
              onChange={(event) => setOpeningScene(event.target.value)}
              placeholder="Optional first assistant message before the player takes a turn."
            />
          </Field>
        </div>

        <details className="setup-panel">
          <summary>Starter Components ({starterComponents.length})</summary>
          <p className="muted">
            Components become World Blocks. Use Plot Essentials for tiny always-on premise/current-state context.
          </p>
          <div className="toolbar">
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
                            {type}
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

      {onLoadDevelopmentAdventure && (
        <details className="panel dev-adventure-panel">
          <summary>Developer Test Adventure</summary>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Playtest Seed</p>
              <h3>{developmentAdventureTitle}</h3>
              <p className="muted">
                Loads a complete adult Fire Nation AU scenario with World Blocks, Story Cards, Characters,
                semantic triggers, a quest, a rolling summary, and one opening message. Use it to test live
                LLM updates without rebuilding setup by hand.
              </p>
            </div>
          </div>
          <div className="toolbar">
            <button type="button" onClick={onLoadDevelopmentAdventure}>
              Load Development Adventure
            </button>
            <button
              type="button"
              onClick={() => downloadJson("ai-story-teller-dev-adventure.json", createDevelopmentAdventureJson())}
            >
              Download Adventure JSON
            </button>
            <button
              type="button"
              onClick={() => downloadJson("ai-story-teller-dev-story-cards.json", createDevelopmentStoryCardsJson())}
            >
              Download Story Cards JSON
            </button>
          </div>
          <p className="notice">
            The full adventure JSON can be re-uploaded through Import / Export. The Story Cards JSON can be
            pasted or uploaded in New Adventure setup or the Story Cards editor.
          </p>
        </details>
      )}

      {cloudSyncSettings && onCloudSyncSettingsChange && (
        <article className="panel cloud-sync-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Personal Cloud Sync</p>
              <h3>Switch between phone and computer</h3>
              <p className="muted">
                Sync all local adventures through a private GitHub repo while keeping this app hosted on GitHub Pages.
                The token is stored only in this browser's localStorage.
              </p>
            </div>
          </div>

          <div className="grid three">
            <Field label="GitHub token">
              <input
                type="password"
                value={cloudSyncSettings.token}
                onChange={(event) => updateCloudSync({ token: event.target.value })}
                placeholder="Fine-grained token with repo contents access"
              />
            </Field>
            <Field label="Owner / username">
              <input
                value={cloudSyncSettings.owner}
                onChange={(event) => updateCloudSync({ owner: event.target.value })}
                placeholder="Leave blank to use token owner"
              />
            </Field>
            <Field label="Private repo">
              <input
                value={cloudSyncSettings.repo}
                onChange={(event) => updateCloudSync({ repo: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid three">
            <Field label="Branch">
              <input
                value={cloudSyncSettings.branch}
                onChange={(event) => updateCloudSync({ branch: event.target.value })}
              />
            </Field>
            <Field label="Sync file path">
              <input
                value={cloudSyncSettings.path}
                onChange={(event) => updateCloudSync({ path: event.target.value })}
              />
            </Field>
            <CheckboxField
              label="Create private repo if missing"
              checked={cloudSyncSettings.createPrivateRepoIfMissing}
              onChange={(createPrivateRepoIfMissing) => updateCloudSync({ createPrivateRepoIfMissing })}
            />
          </div>

          <div className="toolbar">
            <button type="button" disabled={!onPullCloudSync} onClick={onPullCloudSync}>
              Pull From GitHub
            </button>
            <button type="button" disabled={!onPushCloudSync} onClick={onPushCloudSync}>
              Push To GitHub
            </button>
            {cloudSyncStatus && <span className="status-pill">{cloudSyncStatus}</span>}
          </div>
          <p className="notice">
            Sync merges by adventure ID and keeps the newest <code>updatedAt</code> copy. It does not sync provider API keys.
          </p>
        </article>
      )}

      <div className="list">
        {adventures.length === 0 && <p className="muted">No adventures saved yet.</p>}
        {adventures.map((adventure) => (
          <article key={adventure.id} className="card">
            <div>
              <h3>{adventure.title}</h3>
              <p className="muted">
                Updated {new Date(adventure.updatedAt).toLocaleString()} Â· Created{" "}
                {new Date(adventure.createdAt).toLocaleString()}
              </p>
              {currentAdventure?.id === adventure.id && <p className="status-pill">Open</p>}
            </div>
            <div className="row">
              <button type="button" onClick={() => onOpen(adventure.id)}>
                Open
              </button>
              <button type="button" onClick={() => onDuplicate(adventure.id)}>
                Duplicate
              </button>
              <button type="button" className="danger" onClick={() => onDelete(adventure.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
