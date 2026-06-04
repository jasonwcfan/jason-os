import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { FollowUpWithContact } from "@/lib/types";
import { shortDate, dueStatus } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { completeFollowUp } from "../actions";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const sb = getSupabase();
  const { data } = await sb
    .from("crm_follow_ups")
    .select("*, contact:crm_contacts(id,name)")
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  const followUps = (data ?? []) as FollowUpWithContact[];

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle={`${followUps.length} pending`}
      />
      <div className="px-8 py-5">
        {followUps.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            Nothing due. Inbox zero on relationships. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {followUps.map((f) => {
              const status = dueStatus(f.due_date);
              return (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <form action={completeFollowUp}>
                    <input type="hidden" name="id" value={f.id} />
                    <button
                      type="submit"
                      title="Mark done"
                      className="flex text-muted hover:text-accent"
                    >
                      <CheckCircle2 size={20} />
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{f.note ?? "Follow up"}</p>
                    {f.contact && (
                      <Link
                        href={`/crm/contacts/${f.contact.id}`}
                        className="text-sm text-muted hover:text-accent"
                      >
                        {f.contact.name}
                      </Link>
                    )}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 text-sm ${
                      status === "overdue"
                        ? "text-red-500"
                        : status === "today"
                          ? "text-accent"
                          : "text-muted"
                    }`}
                  >
                    <Clock size={13} /> {shortDate(f.due_date)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
