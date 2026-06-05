import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client, used ONLY for the Realtime change-feed
// subscription. Uses the public anon key — which can read the non-sensitive
// `realtime_events` feed but nothing else (RLS denies anon on all CRM/Tasks
// tables). Real data is always fetched server-side with the service role.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
