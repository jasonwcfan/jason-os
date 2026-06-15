"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function tags(v: FormDataEntryValue | null): string[] {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    if (!Array.isArray(a)) return [];
    return [...new Set(a.map((x) => String(x).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export async function createNote(formData: FormData) {
  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  if (!title && !body) return;
  await getSupabase().from("notes").insert({
    title: title || "Untitled",
    body,
    tags: tags(formData.get("tags")),
    source: "manual",
  });
  revalidatePath("/notes");
}

export async function updateNote(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("notes")
    .update({
      title: str(formData.get("title")) || "Untitled",
      body: str(formData.get("body")),
      tags: tags(formData.get("tags")),
    })
    .eq("id", id);
  revalidatePath("/notes");
}

export async function deleteNote(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase().from("notes").delete().eq("id", id);
  revalidatePath("/notes");
}

export async function toggleNotePin(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  const pinned = str(formData.get("pinned")) === "true";
  await getSupabase().from("notes").update({ pinned: !pinned }).eq("id", id);
  revalidatePath("/notes");
}
