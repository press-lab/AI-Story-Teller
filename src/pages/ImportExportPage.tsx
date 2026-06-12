import { useState } from "react";
import { exportAdventureJson } from "../utils/json";
import type { Adventure } from "../types/adventure";
import type { AdventurePageProps } from "./pageTypes";
import { Field } from "./shared";
import { AidImportWizard } from "../components/AidImportWizard";

interface ImportExportPageProps extends AdventurePageProps {
  onImportAdventure: (text: string) => Promise<void>;
  onCreateAdventureFromImport: (adventure: Adventure) => Promise<void>;
  onOpenImportedAdventure: () => void;
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportExportPage({
  adventure,
  dispatch,
  onImportAdventure,
  onCreateAdventureFromImport,
  onOpenImportedAdventure,
}: ImportExportPageProps) {
  const [importText, setImportText] = useState("");

  async function importAdventure() {
    await onImportAdventure(importText);
    setImportText("");
  }

  function slug() {
    return adventure.title.replace(/\W+/g, "-") || "adventure";
  }

  function handleExport() {
    const text = exportAdventureJson(adventure);
    download(`${slug()}.json`, text);
  }

  function handleExportStoryCards() {
    const text = JSON.stringify({ storyCards: adventure.storyCards }, null, 2);
    download(`${slug()}-story-cards.json`, text);
  }

  function handleExportComponents() {
    const text = JSON.stringify({
      openingScene: adventure.openingScene,
      components: adventure.components,
    }, null, 2);
    download(`${slug()}-components.json`, text);
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
          <p className="muted">Downloads the full adventure as a JSON file.</p>
          <button type="button" onClick={handleExport}>
            Download JSON
          </button>
          <button type="button" onClick={handleExportStoryCards}>
            Export Story Cards
          </button>
          <button type="button" onClick={handleExportComponents}>
            Export Plot Components
          </button>
        </article>

        <article className="panel">
          <h3>Import Adventure JSON</h3>
          <textarea rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste exported JSON here…" />
          <button type="button" onClick={importAdventure} disabled={!importText.trim()}>
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
          Convert an AID scenario export into a new adventure. Multiple export files are read in filename
          order — upload them all at once and the importer merges them in sequence.
        </p>
        <AidImportWizard
          onCreateAdventureFromImport={onCreateAdventureFromImport}
          onComplete={onOpenImportedAdventure}
        />
      </article>

      <article className="panel">
        <h3>Raw Imports</h3>
        {adventure.activeState.rawImports.length === 0 && <p className="muted">No raw imports stored.</p>}
        {adventure.activeState.rawImports.map((raw) => (
          <div key={raw.id} className="card">
            <Field label="Title">
              <input
                value={raw.title}
                onChange={(event) =>
                  dispatch({ type: "UPDATE_RAW_IMPORT", rawImportId: raw.id, patch: { title: event.target.value } })
                }
              />
            </Field>
            <textarea
              rows={5}
              value={raw.content}
              onChange={(event) =>
                dispatch({ type: "UPDATE_RAW_IMPORT", rawImportId: raw.id, patch: { content: event.target.value } })
              }
            />
            <button
              type="button"
              className="danger"
              onClick={() => dispatch({ type: "DELETE_RAW_IMPORT", rawImportId: raw.id })}
            >
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
