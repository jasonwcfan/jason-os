import { getSupabase } from "@/lib/supabase";
import { TaskBoard } from "./task-board";
import type { TaskWithContact } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const sb = getSupabase();
  const { data } = await sb
    .from("tasks_items")
    .select("*, contact:crm_contacts(id,name)")
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  return <TaskBoard tasks={(data ?? []) as TaskWithContact[]} />;
}
