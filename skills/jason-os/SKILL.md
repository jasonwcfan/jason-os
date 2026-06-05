---
name: jason-os
description: Operate jason.os — Jason Fan's personal life OS (CRM + Tasks), backed by Supabase. Use whenever Jason wants to manage his life through it: add or look up people/companies, log interactions or meetings, create / prioritize / complete / find tasks, see what's due or "what should I do today", review his sales pipeline, suppress a contact, and so on. Contains the data model, conventions, and ready-to-run SQL.
---

# Operating jason.os

jason.os is Jason Fan's personal operating system. **You operate it; a separate agent builds it** — so work *within* the system, don't change the app or schema. Jason is CEO of **Finic** (AI fraud-intelligence platform). For company context, read `/Users/jasonfan/Documents/finic/company-info/Company/COMPANY.md` and `PRODUCT.md`.

## How you interact with it
All data lives in **Supabase project `frjqwrerxeeuvuqdetve`**. Operate it with the **Supabase MCP** (`execute_sql`). The web app (crm.jason.fan) is just Jason's own window onto the same data — you work via SQL. Tables are namespaced by module: `crm_*` (CRM) and `tasks_*` (Tasks).

## Golden rules (always follow)
1. **`created_by`**: when you create a task because Jason asked for it (even casually in conversation), set `created_by='me'`. Only use `created_by='agent'` for things you inferred on your own initiative.
2. **Dedup before you create.** Tasks: check for a similar **open** title first. Contacts: match by lowercased `email` (and `alt_emails`). Use `on conflict (source/origin, external_id) do nothing` wherever those exist.
3. **Suppression is absolute.** Never create or auto-update anyone whose email is in `crm_suppressed`.
4. **Task priority = 4 fixed lanes by time horizon**: `now` (do today — **HARD CAP 5**), `next` (this week), `later` (backlog), `someday` (maybe). Be conservative — don't reshuffle without a concrete reason; set a short `priority_reason` (≤12 words) when you change a lane; and **never override a task whose `priority_reason='Set by you'`** unless it's overdue.
5. **Don't fight the automation.** Routines already sync Gmail + Granola and groom the backlog (see below). Build on what they produce; don't duplicate it.
6. Never delete CRM data — use status changes / suppression. Prefer idempotent INSERTs.

## Data model (key columns)
- **crm_companies**(id, name, domain, notes, source, external_id) — `unique(source, external_id)`
- **crm_contacts**(id, name, email, phone, title, company_id→crm_companies, linkedin_url, location, **alt_emails** text[], **tags** text[], **relationship_strength** 1–5, how_we_met, notes, source, external_id, **last_interaction_at** [auto]) — `unique(source, external_id)`. NOTE: contacts have no `created_by` (that's tasks-only).
- **crm_interactions**(id, contact_id→crm_contacts, **type** [call/email/meeting/coffee/intro/message/note], occurred_at, summary, notes, source, external_id) — `unique(source, external_id)`. Inserting a row **auto-updates** the contact's `last_interaction_at`.
- **crm_suppressed**(email PK, reason) — permanently excluded from sync.
- **tasks_items**(id, title, details, **status** [open/done/archived/cancelled], **priority** [now/next/later/someday], due_date, contact_id→crm_contacts, **created_by** [me/agent], **origin** [manual/conversation/email-routine/granola/groomer/…], origin_detail, external_id, **priority_reason**, groomed_at, completed_at, **completion_note**, **agent_status** [assigned/running/review/done/failed | null — agents end a turn in 'review', never 'done'], **agent_instructions**, **agent_result**, agent_log_url, assigned_at, agent_finished_at) — `unique(origin, external_id)`.
- Infra: `granola_queue` (meeting capture), `crm_sync_state` (sync watermarks). **`crm_follow_ups` is RETIRED** — everything actionable is a task.

## Cookbook (ready SQL — double single-quotes to escape)

**Look up a person**
```sql
select c.id,c.name,c.title,c.email,co.name as company,c.relationship_strength,c.last_interaction_at
from crm_contacts c left join crm_companies co on co.id=c.company_id
where c.name ilike '%sarah%' or c.email ilike '%sarah%' or co.name ilike '%acme%';
```

**Add a contact** (find-or-create the company first)
```sql
insert into crm_companies (name,domain) values ('Acme','acme.com') on conflict (source,external_id) do nothing;
insert into crm_contacts (name,email,title,company_id,tags,relationship_strength,how_we_met)
values ('Sarah Chen','sarah@acme.com','VP Eng',
        (select id from crm_companies where domain='acme.com'),
        array['lead'],3,'Met at the SaaS dinner');
```

**Log an interaction** (bumps last_interaction_at automatically)
```sql
insert into crm_interactions (contact_id,type,occurred_at,summary,notes)
values ((select id from crm_contacts where lower(email)='sarah@acme.com'),
        'coffee',now(),'Coffee re: fraud pilot','Wants a demo for her team next week.');
```

**Who's gone cold (no contact in 60 days)**
```sql
select name,title,last_interaction_at from crm_contacts
where last_interaction_at < now()-interval '60 days' order by last_interaction_at;
```

**Create a task Jason asked for** (dedup first!)
```sql
-- dedup: select 1 from tasks_items where status='open' and lower(title) like '%one-pager%';
insert into tasks_items (title,priority,due_date,contact_id,created_by,origin)
values ('Send Sarah the security one-pager','next','2026-06-15',
        (select id from crm_contacts where lower(email)='sarah@acme.com'),'me','conversation');
```

**"What should I do today?"** (the morning view)
```sql
select priority,title,due_date,priority_reason,
       (select name from crm_contacts where id=t.contact_id) as who
from tasks_items t
where status='open' and (priority='now' or due_date<=current_date)
order by (priority<>'now'), due_date nulls last;
```

**Complete a task with a posterity note**
```sql
update tasks_items set status='done',completed_at=now(),completion_note='She declined the offer' where id='<id>';
```

**Re-lane a task (always record why)**
```sql
update tasks_items set priority='now',priority_reason='Due tomorrow; blocks PayPal POC' where id='<id>';
```

**Assign a task to an agent, or check assignment results**
```sql
-- assign (dispatcher does ONE turn within ~15 min, then sets agent_status='review').
-- Say in the instructions if you only want pre-work, e.g. 'Draft X then hand back to me':
update tasks_items set agent_status='assigned', agent_instructions='<what to do; note pre-work vs full>', assigned_at=now() where id='<id>';
-- tasks waiting on Jason's review:
select title, agent_result, agent_log_url from tasks_items where agent_status='review';
-- not satisfied? send it back for another turn (prior agent_result stays as context):
update tasks_items set agent_status='assigned', agent_instructions='<feedback / next step>', assigned_at=now() where id='<id>';
-- Jason marks done himself via the normal complete flow; agents NEVER mark a task done.
```

**Suppress someone (never sync again)**
```sql
insert into crm_suppressed (email,reason) values ('recruiter@x.com','vendor, not a lead') on conflict (email) do nothing;
```

**Merge a duplicate person's second email into the canonical contact**
```sql
update crm_contacts
set alt_emails = array(select distinct e from unnest(alt_emails||array['second@email.com']) e where e<>lower(email))
where id='<canonical contact id>';
```

## What runs automatically (don't duplicate it)
- **crm-gmail-sync** (~7:00am daily): new Primary Gmail → new leads, interactions, and tasks for action items Jason owes people.
- **granola-processor** (every 2h): Granola meeting transcripts → CRM meeting-interactions + tasks. Classifies sales/customer vs internal vs hiring vs investor.
- **task-backlog-groomer** (~7:38am daily): de-dupes, archives stale, cancels dead, escalates, enforces the Now≤5 cap, writes `priority_reason`, and emits Jason's morning digest.
- **Vercel cron** captures Granola meetings into `granola_queue` every 30 min.
- **agent-dispatcher** (every 15 min): does ONE agent turn on each assigned task. It infers whether Jason wants PRE-WORK (do part, hand back) or the FULL task, does the work, then sets `agent_status='review'` (**never** 'done' — only Jason marks a task done) with a summary in `agent_result`. Jason then either marks the task done or re-assigns with feedback for another turn. Always-on managed runtime (works even with his laptop closed).

So new leads, logged meetings, and action items appear on their own. **Your role is the human-in-the-loop layer**: answering Jason's questions, capturing what he tells you, curating priorities, and surfacing what matters.

## How to present things to Jason
He explicitly wants a **short, stable, prioritized** picture — never a wall of 100+ items that constantly reshuffles. Default to showing **Now + Next** (Now is the day's ≤5). Explain any priority change in one line. When in doubt about escalating or adding, lean conservative.

## Maintenance
This skill is owned and kept current by the jason.os **building** agent. If anything here ever disagrees with the live database, **the database wins** — flag the drift so the skill gets fixed.
