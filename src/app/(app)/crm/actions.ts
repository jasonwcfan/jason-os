"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function parseTags(v: FormDataEntryValue | null): string[] {
  const s = str(v);
  return s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

// Find-or-create a company by (case-insensitive) name so quick-add can
// take a plain company string without a separate company picker.
async function resolveCompanyId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const sb = getSupabase();
  const { data: existing } = await sb
    .from("crm_companies")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: created } = await sb
    .from("crm_companies")
    .insert({ name })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}

export async function createContact(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;

  const sb = getSupabase();
  const company_id = await resolveCompanyId(str(formData.get("company")));
  const strengthRaw = str(formData.get("relationship_strength"));

  const { data, error } = await sb
    .from("crm_contacts")
    .insert({
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      title: str(formData.get("title")),
      company_id,
      linkedin_url: str(formData.get("linkedin_url")),
      location: str(formData.get("location")),
      tags: parseTags(formData.get("tags")),
      relationship_strength: strengthRaw ? Number(strengthRaw) : null,
      how_we_met: str(formData.get("how_we_met")),
      notes: str(formData.get("notes")),
    })
    .select("id")
    .single();

  revalidatePath("/crm");
  if (!error && data) redirect(`/crm/contacts/${data.id}`);
}

export async function updateContact(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;

  const sb = getSupabase();
  const company_id = await resolveCompanyId(str(formData.get("company")));
  const strengthRaw = str(formData.get("relationship_strength"));

  await sb
    .from("crm_contacts")
    .update({
      name: str(formData.get("name")) ?? "Unnamed",
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      title: str(formData.get("title")),
      company_id,
      linkedin_url: str(formData.get("linkedin_url")),
      location: str(formData.get("location")),
      tags: parseTags(formData.get("tags")),
      relationship_strength: strengthRaw ? Number(strengthRaw) : null,
      how_we_met: str(formData.get("how_we_met")),
      notes: str(formData.get("notes")),
    })
    .eq("id", id);

  revalidatePath(`/crm/contacts/${id}`);
  revalidatePath("/crm");
}

export async function deleteContact(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase().from("crm_contacts").delete().eq("id", id);
  revalidatePath("/crm");
  redirect("/crm");
}

export async function logInteraction(formData: FormData) {
  const contact_id = str(formData.get("contact_id"));
  if (!contact_id) return;

  const occurredRaw = str(formData.get("occurred_at"));
  const payload: Record<string, unknown> = {
    contact_id,
    type: str(formData.get("type")) ?? "note",
    summary: str(formData.get("summary")),
    notes: str(formData.get("notes")),
  };
  if (occurredRaw) payload.occurred_at = new Date(occurredRaw).toISOString();

  await getSupabase().from("crm_interactions").insert(payload);
  revalidatePath(`/crm/contacts/${contact_id}`);
  revalidatePath("/crm");
}

export async function createFollowUp(formData: FormData) {
  const contact_id = str(formData.get("contact_id"));
  const due_date = str(formData.get("due_date"));
  if (!due_date) return;

  await getSupabase().from("crm_follow_ups").insert({
    contact_id,
    due_date,
    note: str(formData.get("note")),
  });

  if (contact_id) revalidatePath(`/crm/contacts/${contact_id}`);
  revalidatePath("/crm/follow-ups");
}

export async function completeFollowUp(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("crm_follow_ups")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/crm/follow-ups");
  const contact_id = str(formData.get("contact_id"));
  if (contact_id) revalidatePath(`/crm/contacts/${contact_id}`);
}
