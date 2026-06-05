"use client";

import { useState } from "react";
import { Pencil, Plus, Ban, RotateCcw } from "lucide-react";
import type { Contact, ContactWithCompany } from "@/lib/types";
import { INTERACTION_TYPES } from "@/lib/types";
import {
  logInteraction,
  createContactTask,
  updateContact,
  deleteContact,
  suppressContact,
  unsuppressContact,
} from "../../actions";

// Suppress = never sync this person again (separate from deleting them).
export function SuppressControl({
  contactId,
  suppressed,
}: {
  contactId: string;
  suppressed: boolean;
}) {
  if (suppressed) {
    return (
      <form action={unsuppressContact}>
        <input type="hidden" name="id" value={contactId} />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-foreground/5"
          title="Resume syncing this person"
        >
          <RotateCcw size={14} /> Unsuppress
        </button>
      </form>
    );
  }
  return (
    <form action={suppressContact}>
      <input type="hidden" name="id" value={contactId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Suppress this person? They'll never be re-synced from email (their record stays).")) {
            e.preventDefault();
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-foreground/5"
        title="Never sync this person from email again"
      >
        <Ban size={14} /> Suppress
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function LogInteraction({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-foreground/5"
      >
        <Plus size={16} /> Log interaction
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await logInteraction(fd);
        setOpen(false);
      }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="contact_id" value={contactId} />
      <div className="flex gap-3">
        <select name="type" defaultValue="note" className={inputCls}>
          {INTERACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input type="datetime-local" name="occurred_at" className={inputCls} />
      </div>
      <input name="summary" placeholder="Summary" autoFocus className={inputCls} />
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        rows={3}
        className={inputCls}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export function AddContactTask({ contactId }: { contactId: string }) {
  return (
    <form
      action={createContactTask}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <input type="hidden" name="contact_id" value={contactId} />
      <input
        name="title"
        placeholder="Add a task for this contact"
        required
        className={`${inputCls} min-w-0 flex-1`}
      />
      <input type="date" name="due_date" className={inputCls} />
      <button
        type="submit"
        className="rounded-lg bg-foreground/10 px-3 py-2 text-sm font-medium hover:bg-foreground/15"
      >
        Add
      </button>
    </form>
  );
}

export function EditAndDelete({ contact }: { contact: ContactWithCompany }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-foreground/5"
      >
        <Pencil size={14} /> Edit
      </button>
    );
  }

  return (
    <EditPanel contact={contact} onClose={() => setOpen(false)} />
  );
}

function EditPanel({
  contact,
  onClose,
}: {
  contact: ContactWithCompany;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
      <form
        action={async (fd) => {
          await updateContact(fd);
          onClose();
        }}
        className="my-8 grid w-full max-w-lg grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 className="col-span-2 text-lg font-semibold">Edit contact</h2>
        <input type="hidden" name="id" value={contact.id} />
        <Labeled label="Name">
          <input name="name" defaultValue={contact.name} className={inputCls} required />
        </Labeled>
        <Labeled label="Company">
          <input name="company" defaultValue={contact.company?.name ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Title">
          <input name="title" defaultValue={contact.title ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Email">
          <input name="email" defaultValue={contact.email ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Phone">
          <input name="phone" defaultValue={contact.phone ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Location">
          <input name="location" defaultValue={contact.location ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="LinkedIn URL">
          <input name="linkedin_url" defaultValue={contact.linkedin_url ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Strength (1-5)">
          <select
            name="relationship_strength"
            defaultValue={contact.relationship_strength?.toString() ?? ""}
            className={inputCls}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Tags (comma separated)" full>
          <input name="tags" defaultValue={(contact.tags ?? []).join(", ")} className={inputCls} />
        </Labeled>
        <Labeled label="How you met" full>
          <input name="how_we_met" defaultValue={contact.how_we_met ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Notes" full>
          <textarea name="notes" defaultValue={contact.notes ?? ""} rows={3} className={inputCls} />
        </Labeled>

        <div className="col-span-2 mt-2 flex items-center justify-between">
          <DeleteButton id={contact.id} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  return (
    <button
      type="submit"
      formAction={deleteContact}
      name="id"
      value={id}
      onClick={(e) => {
        if (!confirm("Delete this contact and all their history?")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
    >
      Delete
    </button>
  );
}

function Labeled({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

// re-export the type-only import users may need
export type { Contact };
