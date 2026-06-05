"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import type { TaskLane } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

const LANES: TaskLane[] = ["now", "next", "later", "someday"];
function lane(v: FormDataEntryValue | null): TaskLane {
  const s = str(v);
  return s && (LANES as string[]).includes(s) ? (s as TaskLane) : "next";
}

// Created from the UI ⇒ created_by 'me'. (Agents create via SQL with
// created_by='agent' unless Jason explicitly asked, per the module rules.)
export async function createTask(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) return;
  await getSupabase().from("tasks_items").insert({
    title,
    details: str(formData.get("details")),
    priority: lane(formData.get("priority")),
    due_date: str(formData.get("due_date")),
    created_by: "me",
    origin: "manual",
  });
  revalidatePath("/tasks");
}

export async function completeTask(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completion_note: str(formData.get("completion_note")),
    })
    .eq("id", id);
  revalidatePath("/tasks");
}

export async function reopenTask(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({ status: "open", completed_at: null })
    .eq("id", id);
  revalidatePath("/tasks");
}

// When Jason moves a task by hand we stamp priority_reason='Set by you' so
// the grooming routine knows to respect it (keeps priorities from churning).
export async function setPriority(formData: FormData) {
  const id = str(formData.get("id"));
  const priority = lane(formData.get("priority"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({ priority, priority_reason: "Set by you" })
    .eq("id", id);
  revalidatePath("/tasks");
}

export async function archiveTask(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({ status: "archived" })
    .eq("id", id);
  revalidatePath("/tasks");
}

// Assign a task to an autonomous agent. A dispatcher picks up 'assigned'
// rows and runs them with these instructions, writing status/result back.
export async function assignTask(formData: FormData) {
  const id = str(formData.get("id"));
  const instructions = str(formData.get("agent_instructions"));
  if (!id || !instructions) return;
  await getSupabase()
    .from("tasks_items")
    .update({
      agent_status: "assigned",
      agent_instructions: instructions,
      agent_result: null,
      assigned_at: new Date().toISOString(),
      agent_finished_at: null,
    })
    .eq("id", id);
  revalidatePath("/tasks");
}

export async function unassignTask(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({ agent_status: null, agent_finished_at: null })
    .eq("id", id);
  revalidatePath("/tasks");
}

export async function updateTask(formData: FormData) {
  const id = str(formData.get("id"));
  if (!id) return;
  await getSupabase()
    .from("tasks_items")
    .update({
      title: str(formData.get("title")) ?? "Untitled",
      details: str(formData.get("details")),
      due_date: str(formData.get("due_date")),
    })
    .eq("id", id);
  revalidatePath("/tasks");
}
