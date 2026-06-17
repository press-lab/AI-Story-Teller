import { useState, type ChangeEvent } from "react";
import {
  mergeAidCardParseResults,
  parseAidStoryCards,
  type AidCardImportTarget,
  type AidCardParseResult,
} from "../importers/aidCardParser";
import {
  mergeAidStoryParseResults,
  parseAidStoryText,
  type AidStoryParseResult,
} from "../importers/aidStoryParser";
import {
  mergeComponentParseResults,
  parseComponentsJson,
  type ComponentParseResult,
} from "../importers/componentParser";
import { createDefaultAdventure, makeComponent } from "../state/defaults";
import type { Adventure, BrainEntry, ComponentEntry, ComponentType, Message, StoryCard } from "../types/adventure";
import { nowIso } from "../utils/id";
import { Field } from "../pages/shared";

type SummaryMode = "blank" | "firstN" | "imported";

interface AidImportCompletion {
  adventureId: string;
  title: string;
  messageCount: number;
  storyCardCount: number;
  brainCount: number;
  componentCount: number;
}

interface AidImportWizardProps {
  onCreateAdventureFromImport: (adventure: Adventure) => Promise<void>;
  /** Called when the user clicks "Open New Adventure" after a successful import. */
  onComplete: () => void;
  /** If provided, a back/collapse button is shown using this callback. */
  onBack?: () => void;
  backLabel?: string;
}

async function readFilesAlphabetical(event: ChangeEvent<HTMLInputElement>): Promise<string[]> {
  const files = Array.from(event.target.files ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
  const texts = await Promise.all(files.map((f) => f.text()));
  event.target.value = "";
  return texts;
}

function initialCardTarget(card: AidCardParseResult["cards"][number]): AidCardImportTarget {
  return card.suggestion === "brain" ? "brain" : "storyCard";
}

function shortPreview(text: string, length = 220): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

function summaryFromMessages(messages: Message[], count: number): string {
  return messages
    .slice(0, Math.max(0, count))
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
}

function selectedCounts(cards: AidCardParseResult["cards"], targets: Record<string, AidCardImportTarget>) {
  return cards.reduce(
    (counts, card) => {
      const target = targets[card.id] ?? initialCardTarget(card);
      if (target === "storyCard") counts.storyCards += 1;
      if (target === "brain") counts.brains += 1;
      if (target === "skip") counts.skipped += 1;
      return counts;
    },
    { storyCards: 0, brains: 0, skipped: 0 },
  );
}

const singletonComponentTypes = new Set<ComponentType>([
  "narrationRules",
  "aiInstructions",
  "plotEssentials",
  "currentArc",
  "activePressure",
  "authorNote",
]);

function mergeSingletonComponents<T extends { type: ComponentType }>(components: T[]): T[] {
  const merged: T[] = [];
  for (const component of components) {
    if (!singletonComponentTypes.has(component.type)) {
      merged.push(component);
      continue;
    }
    const existingIndex = merged.findIndex((candidate) => candidate.type === component.type);
    if (existingIndex === -1) merged.push(component);
    else merged[existingIndex] = component;
  }
  return merged;
}

export function AidImportWizard({ onCreateAdventureFromImport, onComplete, onBack, backLabel = "← Back" }: AidImportWizardProps) {
  const [aidStoryText, setAidStoryText] = useState("");
  const [aidStoryResult, setAidStoryResult] = useState<AidStoryParseResult>();
  const [aidMessages, setAidMessages] = useState<Message[]>([]);
  const [aidCardText, setAidCardText] = useState("");
  const [aidCardResult, setAidCardResult] = useState<AidCardParseResult>();
  const [aidCardTargets, setAidCardTargets] = useState<Record<string, AidCardImportTarget>>({});
  const [aidComponentText, setAidComponentText] = useState("");
  const [aidComponentResult, setAidComponentResult] = useState<ComponentParseResult>();
  const [aidAdventureName, setAidAdventureName] = useState("");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("blank");
  const [summaryMessageCount, setSummaryMessageCount] = useState(12);
  const [aidCompletion, setAidCompletion] = useState<AidImportCompletion>();

  const cardCounts = selectedCounts(aidCardResult?.cards ?? [], aidCardTargets);
  const setupComponentCount = mergeSingletonComponents([
    ...(aidStoryResult?.setupComponents ?? []),
    ...(aidComponentResult?.components.map((parsed) => parsed.component) ?? []),
  ]).length;
  const canCreate =
    aidMessages.length > 0 ||
    cardCounts.storyCards > 0 ||
    cardCounts.brains > 0 ||
    setupComponentCount > 0 ||
    Boolean(aidComponentResult?.openingScene);

  function applyStoryResult(result: AidStoryParseResult) {
    setAidStoryResult(result);
    setAidMessages(result.messages);
    if (!aidAdventureName.trim() && result.detectedTitle) {
      setAidAdventureName(result.detectedTitle.trim());
    }
    if (summaryMode === "blank" && result.rollingSummarySuggestion) {
      setSummaryMode("imported");
    } else if (summaryMode === "imported" && !result.rollingSummarySuggestion) {
      setSummaryMode("blank");
    }
  }

  function applyCardResult(result: AidCardParseResult) {
    setAidCardResult(result);
    setAidCardTargets(
      Object.fromEntries(
        result.cards.map((card) => [card.id, initialCardTarget(card)] satisfies [string, AidCardImportTarget]),
      ),
    );
  }

  async function loadStoryFiles(event: ChangeEvent<HTMLInputElement>) {
    const texts = await readFilesAlphabetical(event);
    setAidStoryText(texts.join("\n\n"));
    applyStoryResult(mergeAidStoryParseResults(texts.map(parseAidStoryText)));
  }

  async function loadCardFiles(event: ChangeEvent<HTMLInputElement>) {
    const texts = await readFilesAlphabetical(event);
    setAidCardText(texts.join("\n\n"));
    applyCardResult(mergeAidCardParseResults(texts.map(parseAidStoryCards)));
  }

  async function loadComponentFiles(event: ChangeEvent<HTMLInputElement>) {
    const texts = await readFilesAlphabetical(event);
    setAidComponentText(texts.join("\n\n"));
    setAidComponentResult(mergeComponentParseResults(texts.map(parseComponentsJson)));
  }

  function parseStoryInput() {
    applyStoryResult(parseAidStoryText(aidStoryText));
  }

  function parseCardInput() {
    applyCardResult(parseAidStoryCards(aidCardText));
  }

  function parseComponentInput() {
    setAidComponentResult(parseComponentsJson(aidComponentText));
  }

  function setCardTarget(cardId: string, target: AidCardImportTarget) {
    setAidCardTargets((current) => ({ ...current, [cardId]: target }));
  }

  function setAllBrainCandidates(target: AidCardImportTarget) {
    if (!aidCardResult) return;
    setAidCardTargets((current) => ({
      ...current,
      ...Object.fromEntries(
        aidCardResult.cards
          .filter((card) => card.brainCandidate)
          .map((card) => [card.id, target] satisfies [string, AidCardImportTarget]),
      ),
    }));
  }

  function setAllCards(target: AidCardImportTarget) {
    if (!aidCardResult) return;
    setAidCardTargets(
      Object.fromEntries(aidCardResult.cards.map((card) => [card.id, target] satisfies [string, AidCardImportTarget])),
    );
  }

  async function createAdventure() {
    const base = createDefaultAdventure(
      aidAdventureName.trim() || aidStoryResult?.detectedTitle?.trim() || "Imported AI Dungeon Adventure",
    );
    const selectedStoryCards: StoryCard[] = [];
    const selectedBrains: BrainEntry[] = [];

    for (const card of aidCardResult?.cards ?? []) {
      const target = aidCardTargets[card.id] ?? initialCardTarget(card);
      if (target === "storyCard") selectedStoryCards.push(card.storyCard);
      if (target === "brain" && card.brainCandidate) selectedBrains.push(card.brainCandidate);
    }

    const setupComponents = mergeSingletonComponents<ComponentEntry>([
      ...(aidStoryResult?.setupComponents ?? []).map((component) => makeComponent(component)),
      ...(aidComponentResult?.components.map((parsed) => parsed.component) ?? []),
    ]);
    const timestamp = nowIso();
    const summaryContent =
      summaryMode === "firstN"
        ? summaryFromMessages(aidMessages, summaryMessageCount)
        : summaryMode === "imported"
          ? (aidStoryResult?.rollingSummarySuggestion ?? "")
          : "";

    const next: Adventure = {
      ...base,
      openingScene: aidComponentResult?.openingScene ?? aidStoryResult?.openingScene ?? base.openingScene,
      components: mergeSingletonComponents([...base.components, ...setupComponents]),
      storyCards: selectedStoryCards,
      brains: selectedBrains,
      messages: aidMessages,
      rollingSummary: { content: summaryContent, updatedAt: timestamp },
      metadata: {
        ...base.metadata,
        aiDungeonImport: {
          importedAt: timestamp,
          storySourceKind: aidStoryResult?.sourceKind,
          messageCount: aidMessages.length,
          setupComponentCount: setupComponents.length,
          parsedCardCount: aidCardResult?.cards.length ?? 0,
          skippedCards: aidCardResult?.skipped ?? [],
          warnings: [
            ...(aidStoryResult?.warnings ?? []),
            ...(aidCardResult?.warnings ?? []),
            ...(aidComponentResult?.warnings ?? []),
          ],
        },
      },
      activeState: {
        ...base.activeState,
        turn: aidMessages.filter((m) => m.role === "user").length,
      },
      updatedAt: timestamp,
    };

    await onCreateAdventureFromImport(next);
    setAidCompletion({
      adventureId: next.id,
      title: next.title,
      messageCount: aidMessages.length,
      storyCardCount: selectedStoryCards.length,
      brainCount: selectedBrains.length,
      componentCount: setupComponents.length,
    });
  }

  if (aidCompletion) {
    return (
      <div className="card">
        <h3>Import Complete</h3>
        <p className="notice">
          Created <strong>{aidCompletion.title}</strong>: {aidCompletion.messageCount} messages,{" "}
          {aidCompletion.storyCardCount} story cards, {aidCompletion.brainCount} brains,{" "}
          {aidCompletion.componentCount} setup components.
        </p>
        <div className="toolbar">
          <button type="button" onClick={onComplete}>Open New Adventure</button>
        </div>
        <p className="muted">Adventure id: {aidCompletion.adventureId}</p>
      </div>
    );
  }

  return (
    <div className="list">
      <div className="card">
        <h3>Step 1: Story Text or Action JSON</h3>
        <p className="muted">
          Upload your AID export <strong>.json</strong> files — multiple files are merged in filename order.
        </p>
        <Field label="Story / action files (multi-file OK)">
          <input type="file" multiple accept=".json,.txt,application/json,text/plain" onChange={loadStoryFiles} />
        </Field>
        <details>
          <summary className="muted">Paste story text or JSON instead</summary>
          <Field label="Pasted story text or action JSON">
            <textarea
              rows={8}
              value={aidStoryText}
              onChange={(event) => setAidStoryText(event.target.value)}
              placeholder="Paste AI Dungeon transcript or actions JSON here."
            />
          </Field>
          <button type="button" onClick={parseStoryInput}>Parse Story Text</button>
        </details>

        {aidStoryResult && (
          <div className="list">
            <div className="grid three">
              <div>
                <strong>{aidMessages.length}</strong>
                <span className="muted"> messages</span>
              </div>
              <div>
                <strong>{aidStoryResult.setupComponents.length}</strong>
                <span className="muted"> setup components</span>
              </div>
              <div>
                <strong>{aidStoryResult.sourceKind}</strong>
                <span className="muted"> source</span>
              </div>
            </div>
            {aidStoryResult.detectedTitle && (
              <p className="notice">Detected title: {aidStoryResult.detectedTitle}</p>
            )}
            {aidStoryResult.warnings.map((w) => (
              <p key={w} className="notice">{w}</p>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Step 2: Story Cards</h3>
        <p className="muted">
          Upload AI Dungeon story card files. Cards with character keys are pre-assigned as Brains.
        </p>
        <Field label="Story card files (multi-file OK)">
          <input type="file" multiple accept=".json,application/json" onChange={loadCardFiles} />
        </Field>
        <details>
          <summary className="muted">Paste story card JSON instead</summary>
          <Field label="Pasted story card JSON">
            <textarea
              rows={8}
              value={aidCardText}
              onChange={(event) => setAidCardText(event.target.value)}
              placeholder="Paste AI Dungeon story card JSON here."
            />
          </Field>
          <button type="button" onClick={parseCardInput}>Parse Story Cards</button>
        </details>

        {aidCardResult && (
          <div className="list">
            {aidCardResult.error && <p className="error-box">Invalid JSON: {aidCardResult.error}</p>}
            <div className="grid four">
              <div><strong>{aidCardResult.cards.length}</strong><span className="muted"> parsed</span></div>
              <div><strong>{cardCounts.storyCards}</strong><span className="muted"> story cards</span></div>
              <div><strong>{cardCounts.brains}</strong><span className="muted"> brains</span></div>
              <div><strong>{aidCardResult.skipped.length}</strong><span className="muted"> skipped</span></div>
            </div>
            <div className="toolbar">
              <button type="button" onClick={() => setAllBrainCandidates("brain")}>Brain Candidates → Brain</button>
              <button type="button" onClick={() => setAllBrainCandidates("storyCard")}>Brain Candidates → Story Card</button>
              <button type="button" onClick={() => setAllCards("storyCard")}>All → Story Card</button>
            </div>
            {aidCardResult.warnings.map((w) => <p key={w} className="notice">{w}</p>)}
            {aidCardResult.cards.length > 0 && (
              <details open>
                <summary>Card Assignments ({aidCardResult.cards.length})</summary>
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Import as</th>
                        <th>Title</th>
                        <th>Keys</th>
                        <th>Content</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aidCardResult.cards.map((card) => (
                        <tr key={card.id}>
                          <td>
                            <select
                              value={aidCardTargets[card.id] ?? initialCardTarget(card)}
                              onChange={(event) => setCardTarget(card.id, event.target.value as AidCardImportTarget)}
                            >
                              <option value="storyCard">Story Card</option>
                              {card.brainCandidate && <option value="brain">Brain</option>}
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                          <td>{card.title}</td>
                          <td>{shortPreview(card.keysText, 120)}</td>
                          <td>{shortPreview(card.content)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Step 3: Plot Components</h3>
        <p className="muted">
          Upload a Plot Components JSON file exported by AI Story Teller. The file may also include a top-level
          openingScene. Uploaded singleton components replace matching defaults or AI Dungeon metadata; custom
          components are added.
        </p>
        <Field label="Plot component files (multi-file OK)">
          <input type="file" multiple accept=".json,application/json" onChange={loadComponentFiles} />
        </Field>
        <details>
          <summary className="muted">Paste plot component JSON instead</summary>
          <Field label="Pasted plot component JSON">
            <textarea
              rows={8}
              value={aidComponentText}
              onChange={(event) => setAidComponentText(event.target.value)}
              placeholder={'Paste JSON shaped like { "openingScene": "...", "components": [...] } here.'}
            />
          </Field>
          <button type="button" onClick={parseComponentInput}>Parse Plot Components</button>
        </details>

        {aidComponentResult && (
          <div className="list">
            {aidComponentResult.error && <p className="error-box">Invalid JSON: {aidComponentResult.error}</p>}
            <div className="grid three">
              <div><strong>{aidComponentResult.components.length}</strong><span className="muted"> parsed</span></div>
              <div><strong>{setupComponentCount}</strong><span className="muted"> setup components</span></div>
              <div><strong>{aidComponentResult.skipped.length}</strong><span className="muted"> skipped</span></div>
            </div>
            {aidComponentResult.warnings.map((warning) => <p key={warning} className="notice">{warning}</p>)}
            {aidComponentResult.skipped.map((skipped) => (
              <p key={`${skipped.sourceIndex}:${skipped.reason}`} className="notice">
                Component {skipped.sourceIndex + 1}: {skipped.reason}
              </p>
            ))}
            {aidComponentResult.openingScene && (
              <details open>
                <summary>Opening Scene Preview</summary>
                <textarea rows={6} readOnly value={aidComponentResult.openingScene} />
              </details>
            )}
            {aidComponentResult.components.length > 0 && (
              <details open>
                <summary>Component Preview ({aidComponentResult.components.length})</summary>
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Title</th>
                        <th>Content</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aidComponentResult.components.map(({ component }, index) => (
                        <tr key={`${component.id}:${index}`}>
                          <td>{component.type}</td>
                          <td>{component.title}</td>
                          <td>{shortPreview(component.content)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Create Adventure</h3>
        <Field label="Adventure name">
          <input
            value={aidAdventureName}
            onChange={(event) => setAidAdventureName(event.target.value)}
            placeholder={aidStoryResult?.detectedTitle || "Imported AI Dungeon Adventure"}
          />
        </Field>
        <Field label="Rolling summary">
          <select value={summaryMode} onChange={(event) => setSummaryMode(event.target.value as SummaryMode)}>
            <option value="blank">Leave blank</option>
            <option value="firstN">Use first N parsed messages</option>
            {aidStoryResult?.rollingSummarySuggestion && (
              <option value="imported">Use AI Dungeon story summary</option>
            )}
          </select>
        </Field>
        {summaryMode === "firstN" && (
          <Field label="Messages to include in rolling summary">
            <input
              type="number"
              min={1}
              value={summaryMessageCount}
              onChange={(event) => setSummaryMessageCount(Number(event.target.value))}
            />
          </Field>
        )}
        {summaryMode === "imported" && aidStoryResult?.rollingSummarySuggestion && (
          <textarea rows={4} readOnly value={aidStoryResult.rollingSummarySuggestion} />
        )}
        <div className="grid four">
          <div><strong>{aidMessages.length}</strong><span className="muted"> messages</span></div>
          <div><strong>{cardCounts.storyCards}</strong><span className="muted"> story cards</span></div>
          <div><strong>{cardCounts.brains}</strong><span className="muted"> brains</span></div>
          <div><strong>{setupComponentCount}</strong><span className="muted"> components</span></div>
        </div>
        {!canCreate && <p className="notice">Load story, card, or component files above to enable import.</p>}
        <div className="toolbar">
          {onBack && (
            <button type="button" onClick={onBack}>
              {backLabel}
            </button>
          )}
          <button type="button" disabled={!canCreate} onClick={createAdventure}>
            Create Adventure
          </button>
        </div>
      </div>
    </div>
  );
}
