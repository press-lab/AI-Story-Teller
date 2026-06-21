import { useState } from "react";
import type { AdventurePageProps } from "./pageTypes";

const PAGE_SIZE = 100;

export function ChroniclePage({ adventure, dispatch }: AdventurePageProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [limit, setLimit] = useState(PAGE_SIZE);

  const messages = adventure.messages;
  const visible = messages.slice(0, limit);
  const hasMore = messages.length > limit;

  return (
    <section className="page">
      <article className="panel">
        <h3>Adventure Chronicle — {messages.length} entries</h3>
        <p className="muted">
          Complete story transcript stored locally. Not sent to the AI — only the Recent Messages window
          and active memory surfaces reach the model. Click any entry to edit.
        </p>
      </article>

      <div className="list">
        {messages.length === 0 && <p className="muted">No chronicle entries yet.</p>}
        {visible.map((message, index) =>
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
                  onClick={() => {
                    dispatch({ type: "DELETE_MESSAGE", messageId: message.id });
                    setEditingId(undefined);
                  }}
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
            <article
              key={message.id}
              className={`chronicle-entry ${message.role}`}
              onClick={() => setEditingId(message.id)}
            >
              <span className="chronicle-role">{message.role}</span>
              <p className="chronicle-text">{message.content}</p>
            </article>
          ),
        )}
        {hasMore && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show more ({messages.length - limit} remaining)
          </button>
        )}
      </div>
    </section>
  );
}
