"use client";

import { useState } from "react";

// Lightweight chip editor: type + Enter/comma to add, × or Backspace to remove.
// Shared by tasks and notes. Serialize `value` into a hidden field as JSON for
// server actions.
export function TagsField({
  value,
  onChange,
  placeholder = "Tag by project / goal…",
}: {
  value: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="leading-none text-accent/70 hover:text-accent"
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(input);
          } else if (e.key === "Backspace" && !input && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(input)}
        placeholder={value.length ? "Add tag…" : placeholder}
        className="min-w-[10ch] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
