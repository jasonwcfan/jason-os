"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Subscribes to the DB change feed and re-fetches the current page's server
// data whenever anything changes — live updates, no polling. The ping carries
// no data; router.refresh() pulls fresh data through the server.
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250); // coalesce bursts
    };

    const channel = supabaseBrowser
      .channel("jos-change-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "realtime_events" },
        bump,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabaseBrowser.removeChannel(channel);
    };
  }, [router]);

  return null;
}
