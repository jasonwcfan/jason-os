// Shared types for the CRM module. As new life-OS modules land
// (tasks_*, planning_*), give each its own types file.

export type Company = {
  id: string;
  name: string;
  domain: string | null;
  notes: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  linkedin_url: string | null;
  location: string | null;
  alt_emails: string[];
  tags: string[];
  relationship_strength: number | null;
  how_we_met: string | null;
  notes: string | null;
  source: string;
  external_id: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactWithCompany = Contact & {
  company: Pick<Company, "id" | "name"> | null;
};

export const INTERACTION_TYPES = [
  "note",
  "call",
  "email",
  "meeting",
  "coffee",
  "intro",
  "message",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export type Interaction = {
  id: string;
  contact_id: string;
  type: InteractionType;
  occurred_at: string;
  summary: string | null;
  notes: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
};

export type FollowUp = {
  id: string;
  contact_id: string | null;
  due_date: string;
  note: string | null;
  status: "pending" | "done";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpWithContact = FollowUp & {
  contact: Pick<Contact, "id" | "name"> | null;
};

// ---- Tasks module ----

export const TASK_LANES = ["now", "next", "later", "someday"] as const;
export type TaskLane = (typeof TASK_LANES)[number];

export const LANE_META: Record<
  TaskLane,
  { label: string; emoji: string; blurb: string }
> = {
  now: { label: "Now", emoji: "🔴", blurb: "Today — max 5" },
  next: { label: "Next", emoji: "🟡", blurb: "This week" },
  later: { label: "Later", emoji: "⚪", blurb: "Backlog" },
  someday: { label: "Someday", emoji: "💤", blurb: "Maybe / optional" },
};

export type TaskStatus = "open" | "done" | "archived" | "cancelled";

export type Task = {
  id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskLane;
  due_date: string | null;
  contact_id: string | null;
  created_by: "me" | "agent";
  origin: string;
  origin_detail: string | null;
  priority_reason: string | null;
  groomed_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  agent_status: "assigned" | "running" | "review" | "done" | "failed" | null;
  agent_instructions: string | null;
  agent_result: string | null;
  agent_log_url: string | null;
  assigned_at: string | null;
  agent_finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithContact = Task & {
  contact: Pick<Contact, "id" | "name"> | null;
};
