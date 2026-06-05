import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Always-on capture: polls the Granola REST API for notes updated since the
// watermark and queues them in Supabase for the laptop processor to drain.
// Runs from Vercel Cron (see vercel.json) — never the laptop.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRANOLA = "https://public-api.granola.ai/v1";
const MAX_PER_RUN = 25; // bound work per invocation; watermark advances incrementally

type NoteSummary = { id: string; updated_at: string };

export async function GET(req: Request) {
  // Only Vercel Cron (which sends the CRON_SECRET) may trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GRANOLA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing GRANOLA_API_KEY" }, { status: 500 });
  }

  const sb = getSupabase();
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    // 1) read watermark
    const { data: ws } = await sb
      .from("crm_sync_state")
      .select("last_synced_at")
      .eq("source", "granola")
      .maybeSingle();
    // Granola rejects the +00:00 offset Postgres emits — normalize to ...Z
    const sinceRaw =
      ws?.last_synced_at ?? new Date(Date.now() - 14 * 864e5).toISOString();
    const since = new Date(sinceRaw).toISOString();

    // 2) list all notes updated after the watermark (paginate)
    const summaries: NoteSummary[] = [];
    let cursor: string | null = null;
    do {
      const url = new URL(`${GRANOLA}/notes`);
      url.searchParams.set("updated_after", since);
      url.searchParams.set("page_size", "30");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers });
      if (!r.ok) {
        return NextResponse.json(
          { error: `granola list ${r.status}` },
          { status: 502 },
        );
      }
      const j = await r.json();
      for (const n of j.notes ?? [])
        summaries.push({ id: n.id, updated_at: n.updated_at });
      cursor = j.hasMore ? j.cursor : null;
    } while (cursor);

    // process oldest-first, bounded; watermark advances to last handled note
    summaries.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const batch = summaries.slice(0, MAX_PER_RUN);

    let queued = 0;
    for (const s of batch) {
      const { data: exists } = await sb
        .from("granola_queue")
        .select("note_id")
        .eq("note_id", s.id)
        .maybeSingle();
      if (exists) continue;

      // include=transcript is required — the field is null without it
      const r = await fetch(`${GRANOLA}/notes/${s.id}?include=transcript`, {
        headers,
      });
      if (!r.ok) continue; // 404 = note not summarized yet; will reappear later
      const n = await r.json();
      const ce = n.calendar_event ?? {};

      await sb.from("granola_queue").insert({
        note_id: n.id,
        title: n.title ?? null,
        meeting_time: ce.scheduled_start_time ?? n.created_at ?? null,
        web_url: n.web_url ?? null,
        owner_email: n.owner?.email ?? null,
        attendees: n.attendees ?? [],
        summary_text: n.summary_text ?? null,
        summary_markdown: n.summary_markdown ?? null,
        transcript: n.transcript ?? null,
        note_updated_at: n.updated_at ?? null,
      });
      queued++;
    }

    // 3) advance watermark
    const newWatermark = batch.length
      ? batch[batch.length - 1].updated_at
      : since;
    await sb
      .from("crm_sync_state")
      .update({
        last_synced_at: newWatermark,
        last_run_note: `listed ${summaries.length}, queued ${queued}${
          summaries.length > batch.length ? " (more pending next run)" : ""
        }`,
      })
      .eq("source", "granola");

    return NextResponse.json({
      ok: true,
      listed: summaries.length,
      queued,
      more: summaries.length > batch.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
