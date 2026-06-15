"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, Pin, PinOff, Trash2, ArrowLeft } from "lucide-react";
import type { Note } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { TagsField } from "@/components/tags-field";
import { createNote, updateNote, deleteNote, toggleNotePin } from "./actions";

export function NotesView({ notes }: { notes: Note[] }) {
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [notes]);

  if (editing) {
    return (
      <NoteEditor
        note={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  const shown = filter ? notes.filter((n) => n.tags.includes(filter)) : notes;

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle={`${notes.length} note${notes.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> New note
          </button>
        }
      />
      <div className="mx-auto max-w-3xl px-8 py-5">
        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter(null)}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                filter === null
                  ? "bg-accent font-medium text-accent-fg"
                  : "text-muted hover:bg-foreground/5"
              }`}
            >
              All
            </button>
            {allTags.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setFilter(t === filter ? null : t)}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  filter === t
                    ? "bg-accent font-medium text-accent-fg"
                    : "text-muted hover:bg-foreground/5"
                }`}
              >
                {t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            {notes.length === 0
              ? "No notes yet. Create one, or just tell Claude."
              : "No notes with this tag."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((n) => (
              <li key={n.id}>
                <NoteCard note={n} onOpen={() => setEditing(n)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const snippet = note.body
    .replace(/[#*_`>[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="flex items-start gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            {note.pinned && <Pin size={12} className="shrink-0 text-accent" />}
            <h3 className="truncate text-sm font-medium">{note.title}</h3>
          </div>
          {snippet && (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{snippet}</p>
          )}
        </button>
        <form action={toggleNotePin}>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="pinned" value={String(note.pinned)} />
          <button
            type="submit"
            title={note.pinned ? "Unpin" : "Pin"}
            className={`flex pt-0.5 ${
              note.pinned ? "text-accent" : "text-muted/50 hover:text-foreground"
            }`}
          >
            {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </form>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {note.tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto">{shortDate(note.updated_at)}</span>
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  onClose,
}: {
  note: Note | null;
  onClose: () => void;
}) {
  const [tagList, setTagList] = useState<string[]>(note?.tags ?? []);
  const [body, setBody] = useState(note?.body ?? "");
  const [preview, setPreview] = useState(false);
  const save = note ? updateNote : createNote;

  return (
    <div>
      <PageHeader
        title={note ? "Edit note" : "New note"}
        subtitle={note ? `Updated ${shortDate(note.updated_at)}` : undefined}
        action={
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5"
          >
            <ArrowLeft size={16} /> Back
          </button>
        }
      />
      <div className="mx-auto max-w-3xl px-8 py-5">
        <form
          action={async (fd) => {
            await save(fd);
            onClose();
          }}
          className="flex flex-col gap-3"
        >
          {note && <input type="hidden" name="id" value={note.id} />}
          <input type="hidden" name="tags" value={JSON.stringify(tagList)} />
          <input type="hidden" name="body" value={body} />
          <input
            name="title"
            defaultValue={note?.title ?? ""}
            placeholder="Title"
            autoFocus
            className="rounded-lg border border-border bg-background px-3 py-2 text-base font-medium outline-none focus:border-accent"
          />
          <TagsField value={tagList} onChange={setTagList} />
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`rounded-md px-2 py-1 ${
                !preview
                  ? "bg-accent font-medium text-accent-fg"
                  : "text-muted hover:bg-foreground/5"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`rounded-md px-2 py-1 ${
                preview
                  ? "bg-accent font-medium text-accent-fg"
                  : "text-muted hover:bg-foreground/5"
              }`}
            >
              Preview
            </button>
            <span className="ml-2 text-muted">Markdown supported</span>
          </div>
          {preview ? (
            <div className="note-md min-h-[16rem] rounded-lg border border-border bg-background px-3 py-2">
              {body.trim() ? (
                <ReactMarkdown>{body}</ReactMarkdown>
              ) : (
                <p className="text-sm text-muted">Nothing to preview.</p>
              )}
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              placeholder="Write your note in markdown…"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
            />
          )}
          <div className="flex items-center gap-2">
            {note && (
              <button
                type="submit"
                formNoValidate
                formAction={async (fd) => {
                  await deleteNote(fd);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
