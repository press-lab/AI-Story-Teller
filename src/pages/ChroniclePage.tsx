import { useState } from "react";
import type { AdventurePageProps } from "./pageTypes";
import { useActionFeedback } from "../components/ActionFeedback";

const PAGE_SIZE = 100;

interface ChroniclePageProps extends AdventurePageProps {
  onOpenPlay?: () => void;
}

export function ChroniclePage({ adventure, dispatch, onOpenPlay }: ChroniclePageProps) {
  const { confirmAction, notify } = useActionFeedback();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");

  const messages = adventure.messages;
  const searchLower = search.trim().toLowerCase();
  const filtered = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => !searchLower || message.role.toLowerCase().includes(searchLower) || message.content.toLowerCase().includes(searchLower));
  const visible = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  async function deleteMessage(messageId: string) {
    const confirmed = await confirmAction({
      title: "Delete story entry?",
      message: "Delete this entry from the Story history?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    dispatch({ type: "DELETE_MESSAGE", messageId });
    setEditingId(undefined);
    notify("Story entry deleted.", { type: "success" });
  }

  return (
    <section className="page editor-surface chronicle-page">
      <div className="editor-page-summary">
        <div className="editor-page-copy">
          <p className="eyebrow">Story tools</p>
          <h2>Story history</h2>
          <p className="muted">Every story entry in order. Search, review, or correct an earlier entry here.</p>
        </div>
        <div className="editor-stat-row" aria-label="Chronicle counts">
          <span>{messages.length} entries</span>
          {searchLower && <span>{filtered.length} shown</span>}
        </div>
      </div>

      <div className="editor-command-bar">
        <input
          type="search"
          placeholder="Search story history..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(PAGE_SIZE);
          }}
        />
      </div>

      <div className="list chronicle-list">
        {messages.length === 0 && (
          <div className="editor-empty-state chronicle-empty-state" role="status">
            <strong>Your Story history will appear here</strong>
            <p className="muted">Take a turn in Play, and each Story entry will be saved in order.</p>
            {onOpenPlay && <button type="button" onClick={onOpenPlay}>Go to Play</button>}
          </div>
        )}
        {messages.length > 0 && visible.length === 0 && <p className="muted">No story entries match that search.</p>}
        {visible.map(({ message, index }) =>
          editingId === message.id ? (
            <article key={message.id} className="card chronicle-editing">
              <div className="toolbar">
                <span className="eyebrow">
                  #{index + 1} · {message.role}
                </span>
                <button type="button" onClick={() => setEditingId(undefined)}>Done</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void deleteMessage(message.id)}
                >
                  Delete
                </button>
              </div>
              <textarea
                autoFocus
                rows={Math.max(3, Math.min(20, message.content.split("\n").length + 2))}
                value={message.content}
                onChange={(e) =>
                  dispatch({ type: "UPDATE_MESSAGE", messageId: message.id, content: e.target.value })
                }
              />
            </article>
          ) : (
            <article key={message.id} className={`chronicle-entry ${message.role}`}>
              <header className="toolbar chronicle-entry-header">
                <span className="chronicle-role">{message.role}</span>
                <button
                  type="button"
                  className="chronicle-entry-edit"
                  aria-label={`Edit story entry ${index + 1}`}
                  onClick={() => setEditingId(message.id)}
                >
                  Edit
                </button>
              </header>
              <p className="chronicle-text">{message.content}</p>
            </article>
          ),
        )}
        {hasMore && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show more ({filtered.length - limit} remaining)
          </button>
        )}
      </div>
    </section>
  );
}
