import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { ContactList } from "./contact-list";
import type { ContactWithCompany } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const sb = getSupabase();

  const [{ data: contactsData }, { count: dueCount }] = await Promise.all([
    sb
      .from("crm_contacts")
      .select("*, company:crm_companies(id,name)")
      .order("last_interaction_at", { ascending: false, nullsFirst: false }),
    sb
      .from("crm_follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", new Date().toISOString().slice(0, 10)),
  ]);

  const contacts = (contactsData ?? []) as ContactWithCompany[];

  return (
    <div>
      {dueCount ? (
        <Link
          href="/crm/follow-ups"
          className="block bg-accent/10 px-8 py-2.5 text-sm text-accent hover:bg-accent/15"
        >
          {dueCount} follow-up{dueCount === 1 ? "" : "s"} due →
        </Link>
      ) : null}
      <ContactList contacts={contacts} />
    </div>
  );
}
