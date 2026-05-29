import type { Adventure, GitHubSaveSettings, GitHubSaveSlot } from "../types/adventure";
import { CheckboxField, Field, NumberInput } from "./shared";

interface CloudSavesPageProps {
  adventure: Adventure;
  gitHubSaveSettings: GitHubSaveSettings;
  onGitHubSaveSettingsChange: (settings: GitHubSaveSettings) => void;
  saveSlots: GitHubSaveSlot[];
  savesStatus: string;
  loadingSlotId?: string;
  loadError?: string;
  onDismissError?: () => void;
  onListSaves: () => void;
  onSaveNow: () => void;
  onLoadSave: (slot: GitHubSaveSlot) => void;
}

function formatUtc(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d{3}Z$/, " UTC").replace(/Z$/, " UTC");
}

export function CloudSavesPage({
  adventure,
  gitHubSaveSettings,
  onGitHubSaveSettingsChange,
  saveSlots,
  savesStatus,
  loadingSlotId,
  loadError,
  onDismissError,
  onListSaves,
  onSaveNow,
  onLoadSave,
}: CloudSavesPageProps) {
  function update(patch: Partial<GitHubSaveSettings>) {
    onGitHubSaveSettingsChange({ ...gitHubSaveSettings, ...patch });
  }

  return (
    <section className="page">
      <div className="grid two">
        <article className="panel" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GitHub Save Slots</p>
              <h3>{adventure.title}</h3>
              <p className="muted">
                Full adventure snapshots stored in your private GitHub repo. Secrets (API keys) are never saved.
                Credentials are configured in Settings → Personal Cloud Sync.
              </p>
            </div>
          </div>

          <div className="grid three">
            <CheckboxField
              label="Auto-save after turns"
              checked={gitHubSaveSettings.autoSaveEnabled}
              onChange={(autoSaveEnabled) => update({ autoSaveEnabled })}
            />
            <Field label="Auto-save every N turns">
              <NumberInput
                min={1}
                value={gitHubSaveSettings.autoSaveEveryNTurns}
                onChange={(autoSaveEveryNTurns) => update({ autoSaveEveryNTurns })}
              />
            </Field>
            <Field label="Saves folder path">
              <input
                value={gitHubSaveSettings.savesBasePath}
                onChange={(event) => update({ savesBasePath: event.target.value })}
              />
            </Field>
          </div>

          <div className="toolbar">
            <button type="button" onClick={onSaveNow}>Save Now</button>
            <button type="button" onClick={onListSaves}>List Saves</button>
            {savesStatus && <span className="status-pill">{savesStatus}</span>}
          </div>

          {loadError && (
            <div className="error-box error-dismissible" style={{ marginTop: "0.5rem" }}>
              <span>{loadError}</span>
              <button type="button" className="error-dismiss" aria-label="Dismiss error" onClick={onDismissError}>×</button>
            </div>
          )}

          {saveSlots.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
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
                {saveSlots.map((slot) => {
                  const isLoading = loadingSlotId === slot.saveId;
                  return (
                    <tr key={slot.saveId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.35rem 0.5rem" }}>{slot.title}</td>
                      <td style={{ padding: "0.35rem 0.5rem" }}>{slot.saveType}</td>
                      <td style={{ padding: "0.35rem 0.5rem" }}>{slot.turnCount}</td>
                      <td style={{ padding: "0.35rem 0.5rem", fontFamily: "monospace" }}>{formatUtc(slot.savedAt)}</td>
                      <td style={{ padding: "0.35rem 0.5rem" }}>
                        <button
                          type="button"
                          disabled={isLoading || !!loadingSlotId}
                          onClick={() => onLoadSave(slot)}
                        >
                          {isLoading ? "Loading…" : "Load"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className="notice">
            Loading a save will overwrite the local copy for that adventure and switch to it.
          </p>
        </article>
      </div>
    </section>
  );
}
