"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Circle,
  Plus,
  Sparkles,
  Clock,
  User2,
  Archive,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  TASK_LANES,
  LANE_META,
  type TaskLane,
  type TaskWithContact,
} from "@/lib/types";
import { shortDate, dueStatus } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import {
  createTask,
  completeTask,
  setPriority,
  archiveTask,
} from "./actions";

const NOW_CAP = 5;

export function TaskBoard({ tasks }: { tasks: TaskWithContact[] }) {
  const [adding, setAdding] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [showSomeday, setShowSomeday] = useState(false);

  const byLane = useMemo(() => {
    const g: Record<TaskLane, TaskWithContact[]> = {
      now: [],
      next: [],
      later: [],
      someday: [],
    };
    for (const t of tasks) g[t.priority].push(t);
    return g;
  }, [tasks]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} open`}
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> Add task
          </button>
        }
      />

      <div className="mx-auto max-w-3xl px-8 py-5">
        {adding && <QuickAdd onClose={() => setAdding(false)} />}

        <Lane
          lane="now"
          tasks={byLane.now}
          overCap={byLane.now.length > NOW_CAP}
        />
        <Lane lane="next" tasks={byLane.next} />

        <Collapsed
          lane="later"
          tasks={byLane.later}
          open={showLater}
          toggle={() => setShowLater((v) => !v)}
        />
        <Collapsed
          lane="someday"
          tasks={byLane.someday}
          open={showSomeday}
          toggle={() => setShowSomeday((v) => !v)}
        />

        {tasks.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            Nothing on your plate. Add a task, or just tell Claude.
          </p>
        )}
      </div>
    </div>
  );
}

function Lane({
  lane,
  tasks,
  overCap,
}: {
  lane: TaskLane;
  tasks: TaskWithContact[];
  overCap?: boolean;
}) {
  const m = LANE_META[lane];
  if (tasks.length === 0 && lane !== "now") return null;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">
          {m.emoji} {m.label}
        </h2>
        <span className="text-xs text-muted">{m.blurb}</span>
        <span className="ml-auto text-xs text-muted">
          {lane === "now" ? `${tasks.length}/${NOW_CAP}` : tasks.length}
        </span>
      </div>
      {overCap && (
        <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
          Over the daily cap of {NOW_CAP} — the groomer will trim this overnight.
        </p>
      )}
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
          Nothing here.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Collapsed({
  lane,
  tasks,
  open,
  toggle,
}: {
  lane: TaskLane;
  tasks: TaskWithContact[];
  open: boolean;
  toggle: () => void;
}) {
  const m = LANE_META[lane];
  if (tasks.length === 0) return null;
  return (
    <section className="mb-4">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-muted hover:text-foreground"
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="font-medium">
          {m.emoji} {m.label}
        </span>
        <span className="text-xs">{m.blurb}</span>
        <span className="ml-auto text-xs">{tasks.length}</span>
      </button>
      {open && (
        <ul className="mt-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: TaskWithContact }) {
  const ds = task.due_date ? dueStatus(task.due_date) : null;
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <form action={completeTask} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          title="Mark done"
          className="flex text-muted transition-colors hover:text-accent"
        >
          <Circle size={18} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{task.title}</span>
          {task.created_by === "agent" && (
            <span
              title={`Added by ${task.origin_detail || task.origin || "an agent"}`}
              className="inline-flex items-center text-accent"
            >
              <Sparkles size={12} />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 ${
                ds === "overdue"
                  ? "text-red-500"
                  : ds === "today"
                    ? "text-accent"
                    : ""
              }`}
            >
              <Clock size={11} /> {shortDate(task.due_date)}
            </span>
          )}
          {task.contact && (
            <Link
              href={`/crm/contacts/${task.contact.id}`}
              className="inline-flex items-center gap-1 hover:text-accent"
            >
              <User2 size={11} /> {task.contact.name}
            </Link>
          )}
          {task.priority_reason && (
            <span className="italic opacity-80">{task.priority_reason}</span>
          )}
        </div>
      </div>

      <LaneSelect task={task} />

      <form action={archiveTask}>
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          title="Archive"
          className="flex pt-0.5 text-muted/60 transition-colors hover:text-foreground"
        >
          <Archive size={15} />
        </button>
      </form>
    </li>
  );
}

function LaneSelect({ task }: { task: TaskWithContact }) {
  return (
    <form action={setPriority}>
      <input type="hidden" name="id" value={task.id} />
      <select
        name="priority"
        defaultValue={task.priority}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-muted outline-none focus:border-accent"
      >
        {TASK_LANES.map((l) => (
          <option key={l} value={l}>
            {LANE_META[l].emoji} {LANE_META[l].label}
          </option>
        ))}
      </select>
    </form>
  );
}

function QuickAdd({ onClose }: { onClose: () => void }) {
  return (
    <form
      action={createTask}
      className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input
        name="title"
        placeholder="What needs doing?"
        autoFocus
        required
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Lane
          <select
            name="priority"
            defaultValue="next"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            {TASK_LANES.map((l) => (
              <option key={l} value={l}>
                {LANE_META[l].emoji} {LANE_META[l].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Due
          <input
            type="date"
            name="due_date"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Add task
          </button>
        </div>
      </div>
    </form>
  );
}
