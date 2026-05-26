import type { AdventurePageProps } from "./pageTypes";
import { Field } from "./shared";

export function ChroniclePage({ adventure, dispatch }: AdventurePageProps) {
  return (
    <section className="page">
      <article className="panel">
        <h3>Adventure Chronicle</h3>
        <p className="muted">
          Complete persisted transcript. This is source material for summaries and memory proposals; it is not compressed.
        </p>
        <strong>{adventure.messages.length} messages</strong>
      </article>

      <div className="list">
        {adventure.messages.length === 0 && <p className="muted">No chronicle entries yet.</p>}
        {adventure.messages.map((message, index) => (
          <article key={message.id} className="card editor-card">
            <div className="grid three">
              <Field label={`Entry ${index + 1} Role`}>
                <input readOnly value={message.role} />
              </Field>
              <Field label="Created At">
                <input readOnly value={message.createdAt} />
              </Field>
              <Field label="Message ID">
                <input readOnly value={message.id} />
              </Field>
            </div>
            <textarea
              rows={5}
              value={message.content}
              onChange={(event) => dispatch({ type: "UPDATE_MESSAGE", messageId: message.id, content: event.target.value })}
            />
            <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_MESSAGE", messageId: message.id })}>
              Delete Entry
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
