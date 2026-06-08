import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Restores snoozed tasks to their original lane once their snooze time passes.
// Pure status flip — no AI — so it runs as a Vercel Cron (see vercel.json),
// every few minutes. The DB function does a column-to-column update and the
// emit_evt_tasks trigger live-refreshes any open UI.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  // Only Vercel Cron (which sends the CRON_SECRET) may trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabase().rpc("wake_snoozed_tasks");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, woke: data ?? 0 });
}
