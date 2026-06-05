import { getSupabase } from "@/lib/supabase";

// A private iCal feed of upcoming reminders (open tasks + pending follow-ups
// with a due date). Subscribe to it once on your phone; the calendar app
// fires the native alerts. Token in the path is the auth (no cookie — calendar
// clients can't log in), so /api/calendar is excluded from the password gate.

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function vevent(opts: {
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description?: string;
  dtstamp: string;
}): string {
  const d = opts.date.replace(/-/g, "");
  return [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${opts.dtstamp}`,
    // 9:00–9:15 local (floating w/ TZID) so it reads as a morning reminder
    `DTSTART;TZID=${TZ}:${d}T090000`,
    `DTEND;TZID=${TZ}:${d}T091500`,
    `SUMMARY:${esc(opts.summary)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.summary)}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const expected = process.env.CAL_FEED_TOKEN;
  // accept "<token>" or "<token>.ics"
  const clean = token.replace(/\.ics$/, "");
  if (!expected || clean !== expected) {
    return new Response("not found", { status: 404 });
  }

  const sb = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const now = stamp(new Date());

  const [{ data: tasks }, { data: followUps }] = await Promise.all([
    sb
      .from("tasks_items")
      .select("id,title,details,due_date,priority")
      .eq("status", "open")
      .not("due_date", "is", null)
      .gte("due_date", today),
    sb
      .from("crm_follow_ups")
      .select("id,note,due_date,contact:crm_contacts(name)")
      .eq("status", "pending")
      .not("due_date", "is", null)
      .gte("due_date", today),
  ]);

  const events: string[] = [];

  for (const t of tasks ?? []) {
    events.push(
      vevent({
        uid: `task-${t.id}@jason.os`,
        date: t.due_date as string,
        summary: `✅ ${t.title}`,
        description: (t.details as string) ?? undefined,
        dtstamp: now,
      }),
    );
  }
  for (const f of followUps ?? []) {
    const contact = (f.contact as { name?: string } | null)?.name;
    events.push(
      vevent({
        uid: `followup-${f.id}@jason.os`,
        date: f.due_date as string,
        summary: `🤝 ${(f.note as string) ?? "Follow up"}${contact ? ` — ${contact}` : ""}`,
        dtstamp: now,
      }),
    );
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//jason.os//reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:jason.os reminders",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="jason-os.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
