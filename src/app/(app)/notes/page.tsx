import { getSupabase } from "@/lib/supabase";
import { NotesView } from "./notes-view";
import type { Note } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { data } = await getSupabase()
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  return <NotesView notes={(data ?? []) as Note[]} />;
}
