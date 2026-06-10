import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

// The jason.os MCP server — purpose-built, discoverable tools for operating the
// CRM + Tasks. Bearer-token authed (MCP_TOKEN); runs server-side with the
// service-role Supabase client. Endpoint: /api/mcp/mcp (Streamable HTTP).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LANES = ["now", "next", "later", "someday"] as const;
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

async function resolveCompanyId(name?: string | null): Promise<string | null> {
  if (!name) return null;
  const sb = getSupabase();
  const { data: ex } = await sb
    .from("crm_companies")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (ex) return ex.id as string;
  const { data: cr } = await sb
    .from("crm_companies")
    .insert({ name })
    .select("id")
    .single();
  return (cr?.id as string) ?? null;
}

async function contactIdFrom(
  id?: string,
  email?: string,
): Promise<string | null> {
  if (id) return id;
  if (!email) return null;
  const { data } = await getSupabase()
    .from("crm_contacts")
    .select("id")
    .or(`email.eq.${email.toLowerCase()},alt_emails.cs.{${email.toLowerCase()}}`)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

const handler = createMcpHandler(
  (server) => {
    // ---- Tasks ----
    server.tool(
      "tasks_list",
      "List tasks. Defaults to open tasks ordered by lane position. Filter by status (open/done/archived/cancelled) and/or lane (now/next/later/someday).",
      {
        status: z.enum(["open", "done", "archived", "cancelled"]).optional(),
        lane: z.enum(LANES).optional(),
        contact_id: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().optional(),
      },
      async ({ status, lane, contact_id, tag, limit }) => {
        let q = getSupabase()
          .from("tasks_items")
          .select(
            "id,title,status,priority,position,due_date,snoozed_until,snooze_from_priority,tags,agent_status,agent_result,contact:crm_contacts(id,name)",
          )
          .eq("status", status ?? "open")
          .order("position", { ascending: true })
          .limit(limit ?? 200);
        if (lane) q = q.eq("priority", lane);
        if (contact_id) q = q.eq("contact_id", contact_id);
        if (tag) q = q.contains("tags", [tag]);
        const { data, error } = await q;
        return ok(error ? { error: error.message } : data);
      },
    );

    server.tool(
      "task_tags",
      "List the current task tag vocabulary (open tasks) with usage counts, most-used first. Call this BEFORE tagging so you reuse existing tags (e.g. 'PayPal POC') instead of coining near-duplicate variants.",
      {},
      async () => {
        const { data, error } = await getSupabase().rpc("task_tag_counts");
        return ok(error ? { error: error.message } : data);
      },
    );

    server.tool(
      "task_create",
      "Create a task. lane defaults to 'next'. Set by='me' when Jason asked for it (even verbally), 'agent' when you inferred it autonomously. Check tasks_list for duplicates first. If the task comes from an email or meeting, CHECK ITS TIMESTAMP first — don't create tasks from stale (e.g. weeks/months-old) messages unless they're clearly still actionable today; old threads are usually already handled or dead. due_date (YYYY-MM-DD) is optional and is the reminder: set one only if the task genuinely has a date it must happen by — it'll appear on Jason's calendar. tags = higher-level project/goal labels (e.g. 'PayPal POC', 'fundraising'); reuse existing ones via task_tags rather than coining variants.",
      {
        title: z.string(),
        lane: z.enum(LANES).optional(),
        due_date: z.string().optional(),
        details: z.string().optional(),
        contact_id: z.string().optional(),
        tags: z.array(z.string()).optional(),
        by: z.enum(["me", "agent"]).optional(),
      },
      async ({ title, lane, due_date, details, contact_id, tags, by }) => {
        const { data, error } = await getSupabase()
          .from("tasks_items")
          .insert({
            title,
            priority: lane ?? "next",
            due_date: due_date ?? null,
            details: details ?? null,
            contact_id: contact_id ?? null,
            tags: tags ?? [],
            created_by: by ?? "me",
            origin: "mcp",
          })
          .select("id")
          .single();
        return ok(error ? { error: error.message } : { created: data?.id });
      },
    );

    server.tool(
      "task_update",
      "Update a task's title, details, due_date, lane and/or tags. A due_date is the ONLY reminder mechanism — setting one places the task on Jason's subscribed calendar (date is YYYY-MM-DD). Not every task needs one. Curate dates actively: set, adjust, or CLEAR them (pass due_date: null to remove) so the calendar reflects reality. tags REPLACES the full tag set (pass the complete desired array; [] clears) — higher-level project/goal labels; reuse the existing vocabulary via task_tags.",
      {
        id: z.string(),
        title: z.string().optional(),
        details: z.string().optional(),
        due_date: z.string().nullable().optional(),
        lane: z.enum(LANES).optional(),
        tags: z.array(z.string()).optional(),
      },
      async ({ id, title, details, due_date, lane, tags }) => {
        const patch: Record<string, unknown> = {};
        if (title !== undefined) patch.title = title;
        if (details !== undefined) patch.details = details;
        if (due_date !== undefined) patch.due_date = due_date;
        if (lane !== undefined) patch.priority = lane;
        if (tags !== undefined) patch.tags = tags;
        const { error } = await getSupabase()
          .from("tasks_items")
          .update(patch)
          .eq("id", id);
        return ok(error ? { error: error.message } : { updated: id });
      },
    );

    server.tool(
      "task_complete",
      "Mark a task done, with an optional completion note for posterity.",
      { id: z.string(), completion_note: z.string().optional() },
      async ({ id, completion_note }) => {
        const { error } = await getSupabase()
          .from("tasks_items")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
            completion_note: completion_note ?? null,
          })
          .eq("id", id);
        return ok(error ? { error: error.message } : { completed: id });
      },
    );

    server.tool(
      "task_reorder",
      "Set a task's lane and its position within that lane (lower position = higher in the lane).",
      { id: z.string(), lane: z.enum(LANES), position: z.number() },
      async ({ id, lane, position }) => {
        const { error } = await getSupabase()
          .from("tasks_items")
          .update({ priority: lane, position })
          .eq("id", id);
        return ok(error ? { error: error.message } : { reordered: id });
      },
    );

    server.tool(
      "task_assign",
      "Assign a task to an autonomous agent with instructions (it'll run, then return for Jason's review). Re-call to send back with new instructions.",
      { id: z.string(), instructions: z.string() },
      async ({ id, instructions }) => {
        const { error } = await getSupabase()
          .from("tasks_items")
          .update({
            agent_status: "assigned",
            agent_instructions: instructions,
            agent_result: null,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", id);
        return ok(error ? { error: error.message } : { assigned: id });
      },
    );

    server.tool(
      "task_snooze",
      "Snooze a Now or Next task: hides it in 'later' until `until`, then a server cron auto-restores it to its original lane. This is separate from due_date: snooze = 'when I want to see it again' (board triage, not on the calendar); due_date = the deadline/calendar reminder. A snoozed task with a due_date STILL shows its calendar reminder. Snooze can't outlast the deadline — if the task has a due_date, the wake is clamped to that date (and snoozing is refused if it's already due). Only now/next tasks can be snoozed. `until` is an ISO 8601 timestamp with offset (e.g. 2026-06-09T14:00:00-07:00).",
      { id: z.string(), until: z.string() },
      async ({ id, until }) => {
        const sb = getSupabase();
        const { data: t } = await sb
          .from("tasks_items")
          .select("priority, snooze_from_priority, due_date")
          .eq("id", id)
          .maybeSingle();
        if (!t) return ok({ error: "task not found" });
        const from = (t.snooze_from_priority ?? t.priority) as string;
        if (from !== "now" && from !== "next")
          return ok({ error: "only now/next tasks can be snoozed" });
        // Clamp the wake to the due date; refuse if it's already due.
        let wake = new Date(until);
        if (t.due_date) {
          const maxWake = new Date(`${t.due_date}T12:00:00Z`);
          if (wake > maxWake) wake = maxWake;
        }
        if (wake.getTime() <= Date.now())
          return ok({
            error: "task is due now/today — not snoozing (a deadline overrides a snooze)",
          });
        const { error } = await sb
          .from("tasks_items")
          .update({
            priority: "later",
            snoozed_until: wake.toISOString(),
            snooze_from_priority: from,
            priority_reason: "Snoozed",
          })
          .eq("id", id);
        return ok(
          error ? { error: error.message } : { snoozed: id, until: wake.toISOString() },
        );
      },
    );

    server.tool(
      "task_unsnooze",
      "Wake a snoozed task now: restore it to its original lane immediately.",
      { id: z.string() },
      async ({ id }) => {
        const sb = getSupabase();
        const { data: t } = await sb
          .from("tasks_items")
          .select("snooze_from_priority")
          .eq("id", id)
          .maybeSingle();
        const back = (t?.snooze_from_priority as string) ?? "next";
        const { error } = await sb
          .from("tasks_items")
          .update({
            priority: back,
            snoozed_until: null,
            snooze_from_priority: null,
            priority_reason: null,
          })
          .eq("id", id);
        return ok(error ? { error: error.message } : { woke: id });
      },
    );

    // ---- CRM ----
    server.tool(
      "contacts_search",
      "Search contacts by name, email, or company.",
      { query: z.string(), limit: z.number().optional() },
      async ({ query, limit }) => {
        const { data, error } = await getSupabase()
          .from("crm_contacts")
          .select(
            "id,name,title,email,relationship_strength,last_interaction_at,tags,company:crm_companies(name)",
          )
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(limit ?? 20);
        return ok(error ? { error: error.message } : data);
      },
    );

    server.tool(
      "contact_get",
      "Fetch one contact (by id or email) with company.",
      { id: z.string().optional(), email: z.string().optional() },
      async ({ id, email }) => {
        const cid = await contactIdFrom(id, email);
        if (!cid) return ok({ error: "not found" });
        const { data } = await getSupabase()
          .from("crm_contacts")
          .select("*, company:crm_companies(id,name,domain)")
          .eq("id", cid)
          .maybeSingle();
        return ok(data);
      },
    );

    server.tool(
      "contact_create",
      "Create a contact (find-or-creates the company by name). Dedup by email first.",
      {
        name: z.string(),
        email: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        linkedin_url: z.string().optional(),
        tags: z.array(z.string()).optional(),
        relationship_strength: z.number().optional(),
        how_we_met: z.string().optional(),
        notes: z.string().optional(),
      },
      async (a) => {
        const company_id = await resolveCompanyId(a.company);
        const { data, error } = await getSupabase()
          .from("crm_contacts")
          .insert({
            name: a.name,
            email: a.email ?? null,
            title: a.title ?? null,
            company_id,
            linkedin_url: a.linkedin_url ?? null,
            tags: a.tags ?? [],
            relationship_strength: a.relationship_strength ?? null,
            how_we_met: a.how_we_met ?? null,
            notes: a.notes ?? null,
          })
          .select("id")
          .single();
        return ok(error ? { error: error.message } : { created: data?.id });
      },
    );

    server.tool(
      "interaction_log",
      "Log a CRM interaction on a contact (by contact_id or email). Updates last_interaction_at automatically.",
      {
        contact_id: z.string().optional(),
        email: z.string().optional(),
        type: z
          .enum(["call", "email", "meeting", "coffee", "intro", "message", "note"])
          .optional(),
        summary: z.string().optional(),
        notes: z.string().optional(),
        occurred_at: z.string().optional(),
      },
      async (a) => {
        const cid = await contactIdFrom(a.contact_id, a.email);
        if (!cid) return ok({ error: "contact not found" });
        const { error } = await getSupabase().from("crm_interactions").insert({
          contact_id: cid,
          type: a.type ?? "note",
          summary: a.summary ?? null,
          notes: a.notes ?? null,
          occurred_at: a.occurred_at ?? new Date().toISOString(),
        });
        return ok(error ? { error: error.message } : { logged: cid });
      },
    );

    server.tool(
      "contact_suppress",
      "Suppress an email so it's never synced into the CRM again (separate from deleting).",
      { email: z.string(), reason: z.string().optional() },
      async ({ email, reason }) => {
        const { error } = await getSupabase()
          .from("crm_suppressed")
          .upsert(
            { email: email.toLowerCase(), reason: reason ?? "via MCP" },
            { onConflict: "email" },
          );
        return ok(error ? { error: error.message } : { suppressed: email });
      },
    );
  },
  {},
  { basePath: "/api/mcp", maxDuration: 60 },
);

// Auth gate. Accepts the token either as `Authorization: Bearer <MCP_TOKEN>`
// (Claude Code CLI / clients that support custom headers) OR as a `?key=`
// query param (for clients like Claude Desktop whose connector UI only takes
// a URL — the secret URL is the auth, same model as the iCal feed).
async function authed(req: Request) {
  const token = process.env.MCP_TOKEN;
  if (token) {
    const fromHeader = req.headers.get("authorization") === `Bearer ${token}`;
    const fromQuery = new URL(req.url).searchParams.get("key") === token;
    if (!fromHeader && !fromQuery) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return handler(req);
}

export { authed as GET, authed as POST, authed as DELETE };
