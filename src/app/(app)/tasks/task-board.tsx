"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Circle,
  CheckCircle2,
  Plus,
  Pencil,
  Bot,
  Sparkles,
  Clock,
  AlarmClock,
  User2,
  Archive,
  RotateCcw,
  GripVertical,
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
import { TagsField } from "@/components/tags-field";
import {
  createTask,
  completeTask,
  setPriority,
  archiveTask,
  reopenTask,
  updateTask,
  assignTask,
  unassignTask,
  reorderTask,
  snoozeTask,
  unsnoozeTask,
} from "./actions";

const NOW_CAP = 5;
const VIEW_TABS = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
  { key: "archived", label: "Archived" },
] as const;

type Lanes = Record<TaskLane, TaskWithContact[]>;

function group(tasks: TaskWithContact[]): Lanes {
  const g: Lanes = { now: [], next: [], later: [], someday: [] };
  for (const t of tasks) g[t.priority].push(t);
  return g;
}

export function TaskBoard({
  tasks,
  view,
}: {
  tasks: TaskWithContact[];
  view: string;
}) {
  const [adding, setAdding] = useState(false);
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
            <DndBoard tasks={tasks} />
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

function DndBoard({ tasks }: { tasks: TaskWithContact[] }) {
  const [lanes, setLanes] = useState<Lanes>(() => group(tasks));
  const draggingRef = useRef(false);
  const [showLater, setShowLater] = useState(false);
  const [showSomeday, setShowSomeday] = useState(false);

  // re-sync from the server unless a drag is in progress
  const sig = tasks
    .map((t) => `${t.id}:${t.priority}:${t.position}:${t.title}:${t.agent_status}:${t.due_date}:${t.snoozed_until}`)
    .join("|");
  useEffect(() => {
    if (!draggingRef.current) setLanes(group(tasks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const laneOf = (id: string): TaskLane | null => {
    if ((TASK_LANES as readonly string[]).includes(id)) return id as TaskLane;
    return (
      (TASK_LANES.find((l) => lanes[l].some((t) => t.id === id)) as TaskLane) ??
      null
    );
  };

  function onDragStart(_e: DragStartEvent) {
    draggingRef.current = true;
    if (typeof window !== "undefined")
      (window as { __josDragging?: boolean }).__josDragging = true;
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = laneOf(activeId);
    const to = laneOf(overId);
    if (!from || !to || from === to) return;
    setLanes((prev) => {
      const moving = prev[from].find((t) => t.id === activeId);
      if (!moving) return prev;
      const next = { ...prev, [from]: prev[from].filter((t) => t.id !== activeId) };
      const overIdx = prev[to].findIndex((t) => t.id === overId);
      const insertAt = overIdx >= 0 ? overIdx : prev[to].length;
      next[to] = [
        ...prev[to].slice(0, insertAt),
        { ...moving, priority: to },
        ...prev[to].slice(insertAt),
      ];
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    draggingRef.current = false;
    if (typeof window !== "undefined")
      (window as { __josDragging?: boolean }).__josDragging = false;
    if (!overId) return;

    const lane = laneOf(activeId);
    if (!lane) return;

    // reorder within the (already-updated) target lane
    setLanes((prev) => {
      const arr = [...prev[lane]];
      const fromIdx = arr.findIndex((t) => t.id === activeId);
      let toIdx = arr.findIndex((t) => t.id === overId);
      if (toIdx < 0) toIdx = arr.length - 1;
      if (fromIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);

      // compute a fractional position between neighbours
      const prevPos = arr[toIdx - 1]?.position;
      const nextPos = arr[toIdx + 1]?.position;
      let pos: number;
      if (prevPos != null && nextPos != null) pos = (prevPos + nextPos) / 2;
      else if (prevPos != null) pos = prevPos + 1;
      else if (nextPos != null) pos = nextPos - 1;
      else pos = moved.position;
      arr[toIdx] = { ...moved, position: pos, priority: lane };

      void reorderTask(activeId, lane, pos);
      return { ...prev, [lane]: arr };
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        draggingRef.current = false;
        if (typeof window !== "undefined")
          (window as { __josDragging?: boolean }).__josDragging = false;
        setLanes(group(tasks));
      }}
    >
      <Lane
        lane="now"
        tasks={lanes.now}
        overCap={lanes.now.filter((t) => !t.due_date).length > NOW_CAP}
      />
      <Lane lane="next" tasks={lanes.next} />
      <Lane
        lane="later"
        tasks={lanes.later}
        collapsible
        open={showLater}
        toggle={() => setShowLater((v) => !v)}
      />
      <Lane
        lane="someday"
        tasks={lanes.someday}
        collapsible
        open={showSomeday}
        toggle={() => setShowSomeday((v) => !v)}
      />
    </DndContext>
  );
}

function Lane({
  lane,
  tasks,
  overCap,
  collapsible,
  open,
  toggle,
}: {
  lane: TaskLane;
  tasks: TaskWithContact[];
  overCap?: boolean;
  collapsible?: boolean;
  open?: boolean;
  toggle?: () => void;
}) {
  const m = LANE_META[lane];
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  const showList = !collapsible || open;
  if (collapsible && tasks.length === 0) return null;

  return (
    <section className="mb-5">
      {collapsible ? (
        <button
          onClick={toggle}
          className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-sm text-muted hover:text-foreground"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="font-medium">
            {m.emoji} {m.label}
          </span>
          <span className="text-xs">{m.blurb}</span>
          <span className="ml-auto text-xs">{tasks.length}</span>
        </button>
      ) : (
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold">
            {m.emoji} {m.label}
          </h2>
          <span className="text-xs text-muted">{m.blurb}</span>
          <span className="ml-auto text-xs text-muted">{tasks.length}</span>
        </div>
      )}

      {overCap && (
        <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
          Over the daily cap of {NOW_CAP} undated tasks — the groomer will trim the
          extras. Due-dated tasks don&apos;t count toward the cap.
        </p>
      )}

      {showList && (
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            ref={setNodeRef}
            className={`min-h-[8px] divide-y divide-border overflow-hidden rounded-xl border bg-surface ${
              isOver ? "border-accent" : "border-border"
            } ${tasks.length === 0 ? "border-dashed" : ""}`}
          >
            {tasks.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted">
                Drop here
              </li>
            ) : (
              tasks.map((t) => <SortableTaskRow key={t.id} task={t} />)
            )}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}

function SortableTaskRow({ task }: { task: TaskWithContact }) {
  const [mode, setMode] = useState<
    "view" | "completing" | "editing" | "assigning" | "snoozing"
  >("view");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: mode !== "view" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (mode !== "view") {
    return (
      <li ref={setNodeRef} style={style}>
        {mode === "completing" && (
          <CompletingForm task={task} onUndo={() => setMode("view")} />
        )}
        {mode === "editing" && (
          <EditForm task={task} onClose={() => setMode("view")} />
        )}
        {mode === "assigning" && (
          <AssignForm task={task} onClose={() => setMode("view")} />
        )}
        {mode === "snoozing" && (
          <SnoozeForm task={task} onClose={() => setMode("view")} />
        )}
      </li>
    );
  }

  // Already-snoozed tasks always show the control (to wake / re-snooze). A fresh
  // snooze is offered for now/next tasks that aren't already due (snoozing past a
  // deadline is pointless — a due task should stay visible).
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueNowOrPast = !!task.due_date && task.due_date <= todayStr;
  const canSnooze =
    !!task.snoozed_until ||
    ((task.priority === "now" || task.priority === "next") && !dueNowOrPast);

  const ds = task.due_date ? dueStatus(task.due_date) : null;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 px-2 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder or move lane"
        className="flex cursor-grab touch-none pt-0.5 text-muted/40 hover:text-muted active:cursor-grabbing"
      >
        <GripVertical size={15} />
      </button>

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
          {task.agent_status && <AgentChip task={task} />}
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
          {task.tags?.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
            >
              {tg}
            </span>
          ))}
          {task.snoozed_until ? (
            <span className="inline-flex items-center gap-1 text-indigo-500">
              <AlarmClock size={11} /> snoozed · {snoozeLabel(task.snoozed_until)}
            </span>
          ) : (
            task.priority_reason && (
              <span className="italic opacity-80">{task.priority_reason}</span>
            )
          )}
        </div>
      </div>

      <LaneSelect task={task} />
      {canSnooze && (
        <button
          type="button"
          onClick={() => setMode("snoozing")}
          title={task.snoozed_until ? "Snoozed — change or wake" : "Snooze"}
          className={`flex pt-0.5 transition-colors hover:text-foreground ${
            task.snoozed_until ? "text-indigo-500" : "text-muted/60"
          }`}
        >
          <AlarmClock size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={() => setMode("assigning")}
        title={task.agent_status ? "Agent assignment" : "Assign to an agent"}
        className={`flex pt-0.5 transition-colors hover:text-foreground ${
          task.agent_status ? "text-accent" : "text-muted/60"
        }`}
      >
        <Bot size={15} />
      </button>
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

function CompletingForm({
  task,
  onUndo,
}: {
  task: TaskWithContact;
  onUndo: () => void;
}) {
  return (
    <div className="task-completing px-3 py-2.5">
      <form action={completeTask} className="flex items-start gap-3">
        <input type="hidden" name="id" value={task.id} />
        <CheckCircle2 size={18} className="check-pop mt-0.5 shrink-0 text-green-500" />
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
    </div>
  );
}

function snoozeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SnoozeForm({
  task,
  onClose,
}: {
  task: TaskWithContact;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const go = (at: Date) => {
    void snoozeTask(task.id, at.toISOString());
    onClose();
  };

  const now = new Date();
  const plusHours = (h: number) => new Date(now.getTime() + h * 3600e3);
  const evening = (() => {
    const x = new Date(now);
    x.setHours(18, 0, 0, 0);
    if (x <= now) x.setDate(x.getDate() + 1);
    return x;
  })();
  const tomorrow9 = (() => {
    const x = new Date(now);
    x.setDate(x.getDate() + 1);
    x.setHours(9, 0, 0, 0);
    return x;
  })();
  const nextWeek = (() => {
    const x = new Date(now);
    const add = ((8 - x.getDay()) % 7) || 7; // days until next Monday
    x.setDate(x.getDate() + add);
    x.setHours(9, 0, 0, 0);
    return x;
  })();
  const presets: [string, Date][] = [
    ["1 hour", plusHours(1)],
    ["3 hours", plusHours(3)],
    ["This evening", evening],
    ["Tomorrow 9 AM", tomorrow9],
    ["Next week", nextWeek],
  ];

  return (
    <div className="px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <AlarmClock size={15} className="text-indigo-500" />
        {task.snoozed_until ? "Re-snooze until…" : "Snooze until…"}
      </div>
      {task.due_date && (
        <p className="mb-2 text-xs text-muted">
          Due {shortDate(task.due_date)} — its calendar reminder still fires; snooze
          won&apos;t push past the due date.
        </p>
      )}
      {task.snoozed_until && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span>💤 Currently snoozed until {snoozeLabel(task.snoozed_until)}</span>
          <button
            type="button"
            onClick={() => {
              void unsnoozeTask(task.id);
              onClose();
            }}
            className="rounded-md border border-border px-2 py-1 hover:bg-foreground/5"
          >
            Wake now
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([label, at]) => (
          <button
            key={label}
            type="button"
            onClick={() => go(at)}
            title={snoozeLabel(at.toISOString())}
            className="rounded-lg border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={!custom}
          onClick={() => custom && go(new Date(custom))}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
        >
          Snooze
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg px-3 py-1 text-xs text-muted hover:bg-foreground/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditForm({
  task,
  onClose,
}: {
  task: TaskWithContact;
  onClose: () => void;
}) {
  const [tagList, setTagList] = useState<string[]>(task.tags ?? []);
  return (
    <div className="px-3 py-3">
      <form
        action={async (fd) => {
          await updateTask(fd);
          onClose();
        }}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="tags" value={JSON.stringify(tagList)} />
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
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tags
          <TagsField value={tagList} onChange={setTagList} />
        </label>
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
    </div>
  );
}

function AssignForm({
  task,
  onClose,
}: {
  task: TaskWithContact;
  onClose: () => void;
}) {
  const returned =
    task.agent_status === "review" || task.agent_status === "failed";
  const header =
    task.agent_status === "review"
      ? "Agent finished a turn — your review"
      : task.agent_status === "failed"
        ? "Agent couldn't finish"
        : task.agent_status
          ? "Agent assignment"
          : "Assign to an agent";

  return (
    <div className="px-3 py-3">
      <form
        action={async (fd) => {
          await assignTask(fd);
          onClose();
        }}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={task.id} />
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot size={15} className="text-accent" />
          {header}
        </div>
        {task.agent_result && (
          <div className="rounded-lg border border-border bg-background p-2.5 text-xs">
            <div className="mb-0.5 font-medium text-foreground">
              {returned ? "What the agent did" : "Last result"}
            </div>
            <p className="whitespace-pre-wrap text-muted">{task.agent_result}</p>
            {task.agent_log_url && (
              <a
                href={task.agent_log_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-accent hover:underline"
              >
                View full log ↗
              </a>
            )}
          </div>
        )}
        <textarea
          name="agent_instructions"
          defaultValue={returned ? "" : (task.agent_instructions ?? "")}
          rows={3}
          autoFocus
          required
          placeholder={
            returned
              ? "Send it back with feedback or the next step… (or approve and mark done)"
              : "Specific instructions — what to do, and what 'done' looks like. Say if you only want pre-work then it back to you."
          }
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2">
          {task.agent_status && (
            <button
              type="submit"
              formNoValidate
              formAction={async (fd) => {
                await unassignTask(fd);
                onClose();
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-foreground/5"
            >
              Unassign
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-foreground/5"
            >
              Cancel
            </button>
            {returned && (
              <button
                type="submit"
                formNoValidate
                formAction={async (fd) => {
                  await completeTask(fd);
                  onClose();
                }}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                Approve &amp; done
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
            >
              <Bot size={13} /> {returned ? "Send back to agent" : "Assign to agent"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AgentChip({ task }: { task: TaskWithContact }) {
  const s = task.agent_status!;
  const styles: Record<string, string> = {
    assigned: "bg-blue-500/15 text-blue-600",
    running: "bg-amber-500/15 text-amber-600",
    review: "bg-indigo-500/15 text-indigo-600",
    done: "bg-green-500/15 text-green-600",
    failed: "bg-red-500/15 text-red-600",
  };
  return (
    <span
      title={task.agent_result ?? undefined}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles[s]}`}
    >
      <Bot size={10} /> {s === "review" ? "review me" : s}
    </span>
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

function FilterBar({ view }: { view: string }) {
  return (
    <div className="mb-5 flex gap-1">
      {VIEW_TABS.map((t) => (
        <Link
          key={t.key}
          href={`/tasks?view=${t.key}`}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            view === t.key
              ? "bg-accent font-medium text-accent-fg"
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

function QuickAdd({ onClose }: { onClose: () => void }) {
  const [tagList, setTagList] = useState<string[]>([]);
  return (
    <form
      action={createTask}
      className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="tags" value={JSON.stringify(tagList)} />
      <input
        name="title"
        placeholder="What needs doing?"
        autoFocus
        required
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <TagsField value={tagList} onChange={setTagList} />
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
