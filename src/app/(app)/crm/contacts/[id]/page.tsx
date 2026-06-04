import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { ContactWithCompany, Interaction, FollowUp } from "@/lib/types";
import { dateTime, relativeTime, shortDate, dueStatus } from "@/lib/format";
import { Avatar, StrengthDots, TagChip } from "@/components/ui";
import { completeFollowUp } from "../../actions";
import { LogInteraction, AddFollowUp, EditAndDelete } from "./detail-forms";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();

  const { data: contact } = await sb
    .from("crm_contacts")
    .select("*, company:crm_companies(id,name)")
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();
  const c = contact as ContactWithCompany;

  const [{ data: interactionsData }, { data: followUpsData }] = await Promise.all([
    sb
      .from("crm_interactions")
      .select("*")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false }),
    sb
      .from("crm_follow_ups")
      .select("*")
      .eq("contact_id", id)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true }),
  ]);

  const interactions = (interactionsData ?? []) as Interaction[];
  const followUps = (followUpsData ?? []) as FollowUp[];

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <Link
        href="/crm"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} /> All contacts
      </Link>

      {/* header */}
      <div className="flex items-start gap-4">
        <Avatar name={c.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <StrengthDots value={c.relationship_strength} />
          </div>
          <p className="text-muted">
            {[c.title, c.company?.name].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(c.tags ?? []).map((t) => (
              <TagChip key={t}>{t}</TagChip>
            ))}
          </div>
        </div>
        <EditAndDelete contact={c} />
      </div>

      {/* contact methods */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {c.email && (
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Mail size={14} /> {c.email}
          </a>
        )}
        {c.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone size={14} /> {c.phone}
          </span>
        )}
        {c.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} /> {c.location}
          </span>
        )}
        {c.linkedin_url && (
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ExternalLink size={14} /> LinkedIn
          </a>
        )}
      </div>

      {(c.how_we_met || c.notes) && (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
          {c.how_we_met && (
            <p>
              <span className="text-muted">How we met: </span>
              {c.how_we_met}
            </p>
          )}
          {c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
        </div>
      )}

      {/* follow-ups */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Follow-ups
        </h2>
        <div className="space-y-2">
          {followUps
            .filter((f) => f.status === "pending")
            .map((f) => {
              const status = dueStatus(f.due_date);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <form action={completeFollowUp}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="contact_id" value={c.id} />
                    <button
                      type="submit"
                      title="Mark done"
                      className="flex text-muted hover:text-accent"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </form>
                  <span className="flex-1">{f.note ?? "Follow up"}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      status === "overdue"
                        ? "text-red-500"
                        : status === "today"
                          ? "text-accent"
                          : "text-muted"
                    }`}
                  >
                    <Clock size={12} /> {shortDate(f.due_date)}
                  </span>
                </div>
              );
            })}
          <AddFollowUp contactId={c.id} />
        </div>
      </section>

      {/* timeline */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Timeline
          </h2>
          <LogInteraction contactId={c.id} />
        </div>

        {interactions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
            No interactions logged yet.
          </p>
        ) : (
          <ol className="relative ml-2 border-l border-border">
            {interactions.map((it) => (
              <li key={it.id} className="mb-5 ml-5">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-xs font-medium capitalize text-muted">
                    {it.type}
                  </span>
                  <span className="text-xs text-muted" title={dateTime(it.occurred_at)}>
                    {relativeTime(it.occurred_at)}
                  </span>
                </div>
                {it.summary && <p className="mt-1 font-medium">{it.summary}</p>}
                {it.notes && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                    {it.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
