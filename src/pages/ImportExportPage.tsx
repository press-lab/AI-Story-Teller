import { useMemo, useState, type ChangeEvent } from "react";
import { parseAidStoryCards, mergeAidCardParseResults, type AidCardImportTarget, type AidCardParseResult } from "../importers/aidCardParser";
import { parseAidStoryText, mergeAidStoryParseResults, type AidStoryParseResult } from "../importers/aidStoryParser";
import { createDefaultAdventure, makeComponent } from "../state/defaults";
import { exportAdventureJson } from "../utils/json";
import { nowIso } from "../utils/id";
import type { Adventure, BrainEntry, Message, StoryCard } from "../types/adventure";
import type { AdventurePageProps } from "./pageTypes";
import { Field } from "./shared";

interface ImportExportPageProps extends AdventurePageProps {
  onImportAdventure: (text: string) => Promise<void>;
  onCreateAdventureFromImport: (adventure: Adventure) => Promise<void>;
  onOpenImportedAdventure: () => void;
}

interface AidImportCompletion {
  adventureId: string;
  title: string;
  messageCount: number;
  storyCardCount: number;
  brainCount: number;
  componentCount: number;
}

type AidStep = 1 | 2 | 3 | 4;
type SummaryMode = "blank" | "firstN" | "imported";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
    .map((message) => `${message.role}: ${message.content}`)
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

async function readFiles(event: ChangeEvent<HTMLInputElement>): Promise<string[]> {
  const files = Array.from(event.target.files ?? []);
  const texts = await Promise.all(files.map((file) => file.text()));
  event.target.value = "";
  return texts;
}

function StepIndicator({ step }: { step: AidStep }) {
  const labels = ["Story", "Cards", "Review", "Done"];
  return (
    <div className="toolbar" aria-label="AI Dungeon import step">
      {labels.map((label, index) => (
        <span key={label} className="status-pill">
          {index + 1 === step ? <strong>{index + 1}. {label}</strong> : `${index + 1}. ${label}`}
        </span>
      ))}
    </div>
  );
}

export function ImportExportPage({
  adventure,
  dispatch,
  onImportAdventure,
  onCreateAdventureFromImport,
  onOpenImportedAdventure,
}: ImportExportPageProps) {
  const exportText = useMemo(() => exportAdventureJson(adventure), [adventure]);
  const [importText, setImportText] = useState("");

  const [aidOpen, setAidOpen] = useState(false);
  const [aidStep, setAidStep] = useState<AidStep>(1);
  const [aidStoryText, setAidStoryText] = useState("");
  const [aidStoryResult, setAidStoryResult] = useState<AidStoryParseResult>();
  const [aidMessages, setAidMessages] = useState<Message[]>([]);
  const [aidCardText, setAidCardText] = useState("");
  const [aidCardResult, setAidCardResult] = useState<AidCardParseResult>();
  const [aidCardTargets, setAidCardTargets] = useState<Record<string, AidCardImportTarget>>({});
  const [aidAdventureName, setAidAdventureName] = useState("");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("blank");
  const [summaryMessageCount, setSummaryMessageCount] = useState(12);
  const [aidCompletion, setAidCompletion] = useState<AidImportCompletion>();

  const cardCounts = selectedCounts(aidCardResult?.cards ?? [], aidCardTargets);
  const canCreateAidAdventure =
    aidMessages.length > 0 ||
    cardCounts.storyCards > 0 ||
    cardCounts.brains > 0 ||
    (aidStoryResult?.setupComponents.length ?? 0) > 0;

  async function importAdventure() {
    await onImportAdventure(importText);
    setImportText("");
  }

  function applyAidStoryResult(result: AidStoryParseResult) {
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

  function parseAidStoryInput() {
    applyAidStoryResult(parseAidStoryText(aidStoryText));
  }

  async function loadAidStoryFiles(event: ChangeEvent<HTMLInputElement>) {
    const texts = await readFiles(event);
    setAidStoryText(texts.join("\n\n"));
    applyAidStoryResult(mergeAidStoryParseResults(texts.map(parseAidStoryText)));
  }

  function applyAidCardResult(result: AidCardParseResult) {
    setAidCardResult(result);
    setAidCardTargets(
      Object.fromEntries(result.cards.map((card) => [card.id, initialCardTarget(card)] satisfies [string, AidCardImportTarget])),
    );
  }

  function parseAidCardInput() {
    applyAidCardResult(parseAidStoryCards(aidCardText));
  }

  async function loadAidCardFiles(event: ChangeEvent<HTMLInputElement>) {
    const texts = await readFiles(event);
    setAidCardText(texts.join("\n\n"));
    applyAidCardResult(mergeAidCardParseResults(texts.map(parseAidStoryCards)));
  }

  function setAidCardTarget(cardId: string, target: AidCardImportTarget) {
    setAidCardTargets((current) => ({ ...current, [cardId]: target }));
  }

  function setAllBrainCandidates(target: AidCardImportTarget) {
    if (!aidCardResult) return;
    setAidCardTargets((current) => ({
      ...current,
      ...Object.fromEntries(
        aidCardResult.cards.filter((card) => card.brainCandidate).map((card) => [card.id, target] satisfies [string, AidCardImportTarget]),
      ),
    }));
  }

  function setAllCards(target: AidCardImportTarget) {
    if (!aidCardResult) return;
    setAidCardTargets(Object.fromEntries(aidCardResult.cards.map((card) => [card.id, target] satisfies [string, AidCardImportTarget])));
  }

  function updateAidMessage(index: number, patch: Partial<Message>) {
    setAidMessages((messages) => messages.map((message, itemIndex) => (itemIndex === index ? { ...message, ...patch } : message)));
  }

  function deleteAidMessage(index: number) {
    setAidMessages((messages) => messages.filter((_, itemIndex) => itemIndex !== index));
  }

  function goToStep(step: AidStep) {
    if (step === 2 && !aidStoryResult) parseAidStoryInput();
    if (step === 3 && !aidCardResult) parseAidCardInput();
    setAidStep(step);
  }

  async function createAidAdventure() {
    const base = createDefaultAdventure(aidAdventureName.trim() || aidStoryResult?.detectedTitle?.trim() || "Imported AI Dungeon Adventure");
    const selectedStoryCards: StoryCard[] = [];
    const selectedBrains: BrainEntry[] = [];

    for (const card of aidCardResult?.cards ?? []) {
      const target = aidCardTargets[card.id] ?? initialCardTarget(card);
      if (target === "storyCard") selectedStoryCards.push(card.storyCard);
      if (target === "brain" && card.brainCandidate) selectedBrains.push(card.brainCandidate);
    }

    const setupComponents = (aidStoryResult?.setupComponents ?? []).map((component) => makeComponent(component));
    const timestamp = nowIso();
    const summaryContent =
      summaryMode === "firstN"
        ? summaryFromMessages(aidMessages, summaryMessageCount)
        : summaryMode === "imported"
          ? aidStoryResult?.rollingSummarySuggestion ?? ""
          : "";
    const next: Adventure = {
      ...base,
      components: [...base.components, ...setupComponents],
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
          warnings: [...(aidStoryResult?.warnings ?? []), ...(aidCardResult?.warnings ?? [])],
        },
      },
      activeState: {
        ...base.activeState,
        turn: aidMessages.filter((message) => message.role === "user").length,
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
    setAidStep(4);
  }

  return (
    <section className="page">
      <article className="panel">
        <h3>Import / Export</h3>
        <p className="muted">
          Export downloads your full adventure as JSON — settings, cards, brains, messages, and all.
          Import loads a previously exported JSON back into this browser.
          The <strong>AI Dungeon importer</strong> converts AID scenario JSON (story cards + story text)
          into a new adventure here. Exported files can be shared, backed up, or re-imported on another device.
        </p>
      </article>

      <div className="grid two">
        <article className="panel">
          <h3>Export Adventure</h3>
          <textarea rows={14} readOnly value={exportText} />
          <button type="button" onClick={() => download(`${adventure.title.replace(/\W+/g, "-") || "adventure"}.json`, exportText)}>
            Download JSON
          </button>
        </article>

        <article className="panel">
          <h3>Import Adventure JSON</h3>
          <textarea rows={14} value={importText} onChange={(event) => setImportText(event.target.value)} />
          <button type="button" onClick={importAdventure}>
            Import Adventure
          </button>
          <button type="button" className="danger" onClick={() => dispatch({ type: "RESET_RUNTIME_STATE" })}>
            Reset Runtime State
          </button>
        </article>
      </div>

      <article className="panel">
        <h3>Import from AI Dungeon</h3>
        <p className="muted">
          Quick path: upload your AID <strong>.json</strong> export file below — the importer will auto-detect the story and cards.
          Or use the step-by-step wizard for full control.
        </p>
        <Field label="Upload AID JSON file (quick import)">
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const texts = await readFiles(event);
              if (!texts.length) return;
              const merged = mergeAidStoryParseResults(texts.map(parseAidStoryText));
              applyAidStoryResult(merged);
              // Also try to parse cards from the same file
              const mergedCards = mergeAidCardParseResults(texts.map(parseAidStoryCards));
              if (mergedCards.cards.length > 0) applyAidCardResult(mergedCards);
              setAidOpen(true);
              setAidStep(3);
            }}
          />
        </Field>
        <button type="button" onClick={() => setAidOpen((open) => !open)}>
          {aidOpen ? "Collapse step-by-step wizard" : "Step-by-step wizard (advanced)"}
        </button>

        {aidOpen && (
          <div className="list">
            <StepIndicator step={aidStep} />

            {aidStep === 1 && (
              <div className="card">
                <h3>Step 1: Story Text or Action JSON</h3>
                <p className="muted">
                  Paste a transcript, upload .txt, or upload one or more AI Dungeon action/metadata .json files. This step is optional.
                </p>
                <Field label="Story/action files">
                  <input type="file" multiple accept=".txt,.json,application/json,text/plain" onChange={loadAidStoryFiles} />
                </Field>
                <Field label="Pasted story text or action JSON">
                  <textarea
                    rows={12}
                    value={aidStoryText}
                    onChange={(event) => setAidStoryText(event.target.value)}
                    placeholder="Paste AI Dungeon transcript or actions JSON here."
                  />
                </Field>
                <div className="toolbar">
                  <button type="button" onClick={parseAidStoryInput}>
                    Parse Story
                  </button>
                  <button type="button" onClick={() => goToStep(2)}>
                    Continue to Story Cards
                  </button>
                </div>

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
                    {aidStoryResult.detectedTitle && <p className="notice">Detected title: {aidStoryResult.detectedTitle}</p>}
                    {aidStoryResult.warnings.map((warning) => (
                      <p key={warning} className="notice">
                        {warning}
                      </p>
                    ))}
                    <details open>
                      <summary>Preview Parsed Messages</summary>
                      {aidMessages.length === 0 && <p className="muted">No messages parsed from this input.</p>}
                      <div className="list" style={{ maxHeight: 420, overflow: "auto" }}>
                        {aidMessages.map((message, index) => (
                          <div key={message.id} className="card">
                            <div className="grid two">
                              <Field label={`Message ${index + 1} role`}>
                                <select value={message.role} onChange={(event) => updateAidMessage(index, { role: event.target.value as Message["role"] })}>
                                  <option value="assistant">assistant</option>
                                  <option value="user">user</option>
                                  <option value="system">system</option>
                                </select>
                              </Field>
                              <Field label="Created at">
                                <input value={message.createdAt} onChange={(event) => updateAidMessage(index, { createdAt: event.target.value })} />
                              </Field>
                            </div>
                            <textarea rows={3} value={message.content} onChange={(event) => updateAidMessage(index, { content: event.target.value })} />
                            <button type="button" className="danger" onClick={() => deleteAidMessage(index)}>
                              Remove Message
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}

            {aidStep === 2 && (
              <div className="card">
                <h3>Step 2: Story Cards JSON</h3>
                <p className="muted">
                  Paste or upload AI Dungeon story cards. Cards with character-brain agent keys are preselected as Brain imports.
                </p>
                <Field label="Story card files">
                  <input type="file" multiple accept=".json,application/json" onChange={loadAidCardFiles} />
                </Field>
                <Field label="Pasted story card JSON">
                  <textarea
                    rows={12}
                    value={aidCardText}
                    onChange={(event) => setAidCardText(event.target.value)}
                    placeholder="Paste AI Dungeon story card JSON here."
                  />
                </Field>
                <div className="toolbar">
                  <button type="button" onClick={parseAidCardInput}>
                    Parse Cards
                  </button>
                  <button type="button" onClick={() => goToStep(1)}>
                    Back
                  </button>
                  <button type="button" onClick={() => goToStep(3)}>
                    Continue to Review
                  </button>
                </div>

                {aidCardResult?.error && <p className="error-box">Invalid JSON: {aidCardResult.error}</p>}
                {aidCardResult && (
                  <div className="list">
                    <div className="grid four">
                      <div>
                        <strong>{aidCardResult.cards.length}</strong>
                        <span className="muted"> parsed</span>
                      </div>
                      <div>
                        <strong>{cardCounts.storyCards}</strong>
                        <span className="muted"> story cards</span>
                      </div>
                      <div>
                        <strong>{cardCounts.brains}</strong>
                        <span className="muted"> brains</span>
                      </div>
                      <div>
                        <strong>{aidCardResult.skipped.length}</strong>
                        <span className="muted"> skipped by parser</span>
                      </div>
                    </div>
                    <div className="toolbar">
                      <button type="button" onClick={() => setAllBrainCandidates("brain")}>
                        Brain Candidates to Brain
                      </button>
                      <button type="button" onClick={() => setAllBrainCandidates("storyCard")}>
                        Brain Candidates to Story Card
                      </button>
                      <button type="button" onClick={() => setAllCards("storyCard")}>
                        All to Story Card
                      </button>
                    </div>
                    {aidCardResult.warnings.map((warning) => (
                      <p key={warning} className="notice">
                        {warning}
                      </p>
                    ))}
                    {aidCardResult.skipped.map((skipped) => (
                      <p key={`${skipped.sourceIndex}-${skipped.reason}`} className="notice">
                        Skipped card {skipped.sourceIndex + 1}: {skipped.reason}
                      </p>
                    ))}
                    <details open>
                      <summary>Preview Parsed Cards</summary>
                      {aidCardResult.cards.length === 0 && <p className="muted">No cards parsed from this input.</p>}
                      <div style={{ maxHeight: 440, overflow: "auto" }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Import as</th>
                              <th>Label</th>
                              <th>Title</th>
                              <th>Keys</th>
                              <th>Content</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aidCardResult.cards.map((card) => (
                              <tr key={card.id}>
                                <td>
                                  <select value={aidCardTargets[card.id] ?? initialCardTarget(card)} onChange={(event) => setAidCardTarget(card.id, event.target.value as AidCardImportTarget)}>
                                    <option value="storyCard">Story Card</option>
                                    {card.brainCandidate && <option value="brain">Brain</option>}
                                    <option value="skip">Skip</option>
                                  </select>
                                </td>
                                <td>
                                  {card.suggestion === "storyCard" ? "Story Card" : card.suggestion === "brain" ? "Brain" : "Ambiguous"}
                                  <br />
                                  <span className="muted">{card.suggestionReason}</span>
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
                  </div>
                )}
              </div>
            )}

            {aidStep === 3 && (
              <div className="card">
                <h3>Step 3: Review and Map</h3>
                <Field label="New adventure name">
                  <input
                    value={aidAdventureName}
                    onChange={(event) => setAidAdventureName(event.target.value)}
                    placeholder={aidStoryResult?.detectedTitle || "Imported AI Dungeon Adventure"}
                  />
                </Field>
                <div className="grid four">
                  <div>
                    <strong>{aidMessages.length}</strong>
                    <span className="muted"> messages</span>
                  </div>
                  <div>
                    <strong>{cardCounts.storyCards}</strong>
                    <span className="muted"> story cards</span>
                  </div>
                  <div>
                    <strong>{cardCounts.brains}</strong>
                    <span className="muted"> brains</span>
                  </div>
                  <div>
                    <strong>{aidStoryResult?.setupComponents.length ?? 0}</strong>
                    <span className="muted"> setup components</span>
                  </div>
                </div>
                <Field label="Rolling summary">
                  <select value={summaryMode} onChange={(event) => setSummaryMode(event.target.value as SummaryMode)}>
                    <option value="blank">Leave blank</option>
                    <option value="firstN">Use first N parsed messages</option>
                    {aidStoryResult?.rollingSummarySuggestion && <option value="imported">Use AI Dungeon story summary</option>}
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
                  <textarea rows={5} readOnly value={aidStoryResult.rollingSummarySuggestion} />
                )}
                {!canCreateAidAdventure && <p className="notice">Nothing has been selected for import yet.</p>}
                <div className="toolbar">
                  <button type="button" onClick={() => goToStep(2)}>
                    Back
                  </button>
                  <button type="button" disabled={!canCreateAidAdventure} onClick={createAidAdventure}>
                    Create Adventure
                  </button>
                </div>
              </div>
            )}

            {aidStep === 4 && (
              <div className="card">
                <h3>Step 4: Import Complete</h3>
                {aidCompletion ? (
                  <>
                    <p className="notice">
                      Created {aidCompletion.title}: {aidCompletion.messageCount} messages, {aidCompletion.storyCardCount} story cards,{" "}
                      {aidCompletion.brainCount} brains, {aidCompletion.componentCount} setup components.
                    </p>
                    <div className="toolbar">
                      <button type="button" onClick={() => setAidStep(3)}>
                        Back
                      </button>
                      <button type="button" onClick={onOpenImportedAdventure}>
                        Open New Adventure in Play
                      </button>
                    </div>
                    <p className="muted">Adventure id: {aidCompletion.adventureId}</p>
                  </>
                ) : (
                  <p className="muted">No completed AI Dungeon import yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </article>

      <article className="panel">
        <h3>Raw Imports</h3>
        {adventure.activeState.rawImports.length === 0 && <p className="muted">No raw imports stored.</p>}
        {adventure.activeState.rawImports.map((raw) => (
          <div key={raw.id} className="card">
            <Field label="Title">
              <input
                value={raw.title}
                onChange={(event) => dispatch({ type: "UPDATE_RAW_IMPORT", rawImportId: raw.id, patch: { title: event.target.value } })}
              />
            </Field>
            <textarea
              rows={5}
              value={raw.content}
              onChange={(event) => dispatch({ type: "UPDATE_RAW_IMPORT", rawImportId: raw.id, patch: { content: event.target.value } })}
            />
            <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_RAW_IMPORT", rawImportId: raw.id })}>
              Delete Raw Import
            </button>
          </div>
        ))}
      </article>
    </section>
  );
}

export function assertAdventure(_adventure: Adventure) {
  return true;
}
