"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { ContactWithCompany } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Avatar, PageHeader, StrengthDots, TagChip } from "@/components/ui";
import { createContact } from "./actions";

export function ContactList({ contacts }: { contacts: ContactWithCompany[] }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) => {
      const hay = [
        c.name,
        c.email,
        c.title,
        c.company?.name,
        c.location,
        ...(c.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, contacts]);

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> Add contact
          </button>
        }
      />

      <div className="px-8 py-5">
        {adding && <QuickAdd onClose={() => setAdding(false)} />}

        <div className="relative mb-4">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, company, tag…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            {contacts.length === 0
              ? "No contacts yet. Add one, or just tell Claude to."
              : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/crm/contacts/${c.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
                >
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <StrengthDots value={c.relationship_strength} />
                    </div>
                    <div className="truncate text-sm text-muted">
                      {[c.title, c.company?.name].filter(Boolean).join(" · ") ||
                        c.email ||
                        "—"}
                    </div>
                  </div>
                  <div className="hidden shrink-0 gap-1 sm:flex">
                    {(c.tags ?? []).slice(0, 3).map((t) => (
                      <TagChip key={t}>{t}</TagChip>
                    ))}
                  </div>
                  <div className="hidden w-32 shrink-0 text-right text-xs text-muted md:block">
                    {c.last_interaction_at
                      ? relativeTime(c.last_interaction_at)
                      : "no contact yet"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuickAdd({ onClose }: { onClose: () => void }) {
  return (
    <form
      action={createContact}
      className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <Field name="name" placeholder="Name *" autoFocus required />
      <Field name="company" placeholder="Company" />
      <Field name="title" placeholder="Title" />
      <Field name="email" placeholder="Email" type="email" />
      <Field name="tags" placeholder="Tags (comma separated)" />
      <Field name="how_we_met" placeholder="How you met" />
      <div className="col-span-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          Strength
          <select
            name="relationship_strength"
            defaultValue=""
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
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
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Save contact
          </button>
        </div>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
    />
  );
}
