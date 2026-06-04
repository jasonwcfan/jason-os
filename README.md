# jason.os

A personal operating system. CRM is module #1; tasks, planning, and
self-feedback modules come next. Built to be driven primarily by talking
to Claude, with a lightweight web UI as a window onto the same data.

Live at **crm.jason.fan** (CRM module).

## Stack

- **Next.js 16** (App Router, React 19, Tailwind v4) on **Vercel**
- **Supabase Postgres** for data
- Single-user **password gate** (signed cookie via edge proxy) — no auth provider

## Architecture

```
You (any device) ──talk──► Claude ──(Supabase MCP)──► Postgres ◄── Next.js UI (Vercel)
```

Claude reads/writes the database directly through the Supabase MCP server.
The web app is a thin server-rendered view over the same tables, using the
service-role key **server-side only** (it bypasses RLS; RLS denies everyone
else).

### Module convention

Every module namespaces its tables with a prefix in the `public` schema:
`crm_*` today, `tasks_*` / `planning_*` / `feedback_*` later. The sidebar is
generated from `src/lib/modules.ts` — add an entry + a route group under
`src/app/(app)/` to ship a new module.

### Integration-ready

Every record carries `source` (default `'manual'`) and `external_id` with a
`unique (source, external_id)` constraint, so future inbound syncs
(Amplemarket, Granola, Slack, …) can upsert and dedupe cleanly into the same
tables.

## CRM data model (`crm_*`)

- `crm_companies` — name, domain, notes
- `crm_contacts` — person + `company_id`, tags[], relationship strength,
  how you met, `last_interaction_at` (auto-maintained by trigger)
- `crm_interactions` — typed activity timeline (call/email/meeting/coffee/…)
- `crm_follow_ups` — due-dated reminders, pending/done

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Required env vars (see `.env.example`):

| Var | What |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only) |
| `APP_PASSWORD` | The password to unlock the app |
| `AUTH_SECRET` | Random 32-byte hex; signs the auth cookie |

## Driving it by talking to Claude

Claude has direct database access, so you can just say things like:

- "Add Sarah Chen, VP Eng at Acme, met at the SaaS dinner, tag her investor-intro."
- "Log that I had coffee with Alex today; remind me to follow up in 3 weeks."
- "Who haven't I talked to in 60+ days?"
- "What follow-ups are overdue?"
