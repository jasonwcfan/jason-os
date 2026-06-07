import { getSupabase } from "@/lib/supabase";
import { TaskBoard } from "./task-board";
import type { TaskWithContact } from "@/lib/types";

export const dynamic = "force-dynamic";

const VIEWS = ["open", "done", "cancelled", "archived"] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: raw } = await searchParams;
  const view = (VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as (typeof VIEWS)[number])
    : "open";

  const sb = getSupabase();
  let query = sb
    .from("tasks_items")
    .select("*, contact:crm_contacts(id,name)")
    .eq("status", view);

  query =
    view === "open"
      ? query.order("position", { ascending: true }).order("created_at", { ascending: true })
      : query.order("updated_at", { ascending: false });

  const { data } = await query;
  return <TaskBoard tasks={(data ?? []) as TaskWithContact[]} view={view} />;
}
