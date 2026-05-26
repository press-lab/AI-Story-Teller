import { useState } from "react";
import type { Adventure } from "../types/adventure";
import type { AdventureSummary } from "../db/adventureDb";

interface AdventuresPageProps {
  adventures: AdventureSummary[];
  currentAdventure?: Adventure;
  onCreate: (title: string) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AdventuresPage({
  adventures,
  currentAdventure,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
}: AdventuresPageProps) {
  const [title, setTitle] = useState("New Adventure");

  return (
    <section className="page">
      <div className="toolbar">
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <button type="button" onClick={() => onCreate(title.trim() || "New Adventure")}>
          Create Adventure
        </button>
      </div>

      <div className="list">
        {adventures.length === 0 && <p className="muted">No adventures saved yet.</p>}
        {adventures.map((adventure) => (
          <article key={adventure.id} className="card">
            <div>
              <h3>{adventure.title}</h3>
              <p className="muted">
                Updated {new Date(adventure.updatedAt).toLocaleString()} · Created{" "}
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
