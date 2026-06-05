"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Circle,
  CheckCircle2,
  Plus,
  Pencil,
  Sparkles,
  Clock,
  User2,
  Archive,
  RotateCcw,
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
  reopenTask,
  updateTask,
} from "./actions";

const NOW_CAP = 5;

const VIEW_TABS = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
  { key: "archived", label: "Archived" },
] as const;

export function TaskBoard({
  tasks,
  view,
}: {
  tasks: TaskWithContact[];
  view: string;
}) {
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

  const subtitle =
    view === "open" ? `${tasks.length} open` : `${tasks.length} ${view}`;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={subtitle}
        action={
          view === "open" ? (
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              <Plus size={16} /> Add task
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-3xl px-8 py-5">
        <FilterBar view={view} />

        {view === "open" ? (
          <>
            {adding && <QuickAdd onClose={() => setAdding(false)} />}
            <Lane lane="now" tasks={byLane.now} overCap={byLane.now.length > NOW_CAP} />
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
          </>
        ) : (
          <FlatList tasks={tasks} view={view} />
        )}
      </div>
    </div>
  );
}

function FilterBar({ view }: { view: string }) {
  return (
    <div className="mb-5 flex gap-1">
      {VIEW_TABS.map((t) => (
        <Link
          key={t.key}
          href={`/tasks?view=${t.key}`}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            view === t.key
              ? "bg-accent text-accent-fg font-medium"
              : "text-muted hover:bg-foreground/5"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function FlatList({ tasks, view }: { tasks: TaskWithContact[]; view: string }) {
  if (tasks.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted">No {view} tasks.</p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm ${view === "done" ? "text-muted line-through" : ""}`}
              >
                {t.title}
              </span>
              <span className="text-xs" title={LANE_META[t.priority].label}>
                {LANE_META[t.priority].emoji}
              </span>
              {t.created_by === "agent" && (
                <Sparkles size={12} className="text-accent" />
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              {t.contact && (
                <Link
                  href={`/crm/contacts/${t.contact.id}`}
                  className="inline-flex items-center gap-1 hover:text-accent"
                >
                  <User2 size={11} /> {t.contact.name}
                </Link>
              )}
              <span>
                {view === "done" && t.completed_at
                  ? `done ${shortDate(t.completed_at)}`
                  : shortDate(t.updated_at)}
              </span>
            </div>
            {t.completion_note && (
              <p className="mt-0.5 text-xs italic text-muted">
                — {t.completion_note}
              </p>
            )}
          </div>
          <form action={reopenTask}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-foreground/5"
            >
              <RotateCcw size={12} /> Reopen
            </button>
          </form>
        </li>
      ))}
    </ul>
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
  const [mode, setMode] = useState<"view" | "completing" | "editing">("view");

  if (mode === "completing")
    return <CompletingRow task={task} onUndo={() => setMode("view")} />;
  if (mode === "editing")
    return <EditRow task={task} onClose={() => setMode("view")} />;

  const ds = task.due_date ? dueStatus(task.due_date) : null;
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setMode("completing")}
        title="Mark done"
        className="flex pt-0.5 text-muted transition-colors hover:text-accent"
      >
        <Circle size={18} />
      </button>

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

      <button
        type="button"
        onClick={() => setMode("editing")}
        title="Edit"
        className="flex pt-0.5 text-muted/60 transition-colors hover:text-foreground"
      >
        <Pencil size={14} />
      </button>
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

// Checking off doesn't hide the task — it flips to this confirming state with
// a gentle flash + an optional posterity note. The DB write (and the actual
// hide) only happens when you submit (Enter or Done); an empty note is fine.
function CompletingRow({
  task,
  onUndo,
}: {
  task: TaskWithContact;
  onUndo: () => void;
}) {
  return (
    <li className="task-completing px-3 py-2.5">
      <form action={completeTask} className="flex items-start gap-3">
        <input type="hidden" name="id" value={task.id} />
        <CheckCircle2
          size={18}
          className="check-pop mt-0.5 shrink-0 text-green-500"
        />
        <div className="min-w-0 flex-1">
          <span className="text-sm text-muted line-through">{task.title}</span>
          <div className="note-reveal mt-1.5 flex items-center gap-2">
            <input
              name="completion_note"
              autoFocus
              placeholder="Optional note for posterity — e.g. “Jon declined the offer”"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-foreground/5"
            >
              Undo
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Done
            </button>
          </div>
        </div>
      </form>
    </li>
  );
}

function EditRow({
  task,
  onClose,
}: {
  task: TaskWithContact;
  onClose: () => void;
}) {
  return (
    <li className="px-3 py-3">
      <form
        action={async (fd) => {
          await updateTask(fd);
          onClose();
        }}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={task.id} />
        <input
          name="title"
          defaultValue={task.title}
          required
          autoFocus
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <textarea
          name="details"
          defaultValue={task.details ?? ""}
          rows={2}
          placeholder="Details"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Due
            <input
              type="date"
              name="due_date"
              defaultValue={task.due_date ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
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
