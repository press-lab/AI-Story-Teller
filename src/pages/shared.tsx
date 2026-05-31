import type { ChangeEvent } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function JsonTextarea<T>({
  value,
  onValidChange,
  rows = 6,
}: {
  value: T;
  onValidChange: (value: T) => void;
  rows?: number;
}) {
  function handleBlur(event: ChangeEvent<HTMLTextAreaElement>) {
    try {
      onValidChange(JSON.parse(event.target.value) as T);
      event.target.setCustomValidity("");
    } catch (error) {
      event.target.setCustomValidity(error instanceof Error ? error.message : "Invalid JSON");
      event.target.reportValidity();
    }
  }

  return <textarea rows={rows} defaultValue={JSON.stringify(value, null, 2)} onBlur={handleBlur} spellCheck={false} />;
}

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i} className="search-highlight">{part}</mark> : part,
      )}
    </>
  );
}

export function contentSnippet(content: string, query: string, context = 60): string {
  if (!query) return "";
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - context);
  const end = Math.min(content.length, idx + query.length + context);
  return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
}

export function commaList(value: string[]): string {
  return value.join(", ");
}

export function fromCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
