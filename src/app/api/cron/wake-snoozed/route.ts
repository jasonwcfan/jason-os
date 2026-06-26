import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Time-based task maintenance — pure status flips, no AI — run from Vercel Cron
// (see vercel.json) every few minutes:
//   1) wake_snoozed_tasks(): restore snoozed tasks once their snooze elapses or
//      their due date arrives.
//   2) escalate_due_tasks(): move any task into `now` on its due date.
// The emit_evt_tasks trigger live-refreshes any open UI.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  // Only Vercel Cron (which sends the CRON_SECRET) may trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  const { data: woke, error: e1 } = await sb.rpc("wake_snoozed_tasks");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const { data: escalated, error: e2 } = await sb.rpc("escalate_due_tasks");
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, woke: woke ?? 0, escalated: escalated ?? 0 });
}
