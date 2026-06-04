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
