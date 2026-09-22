"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, Flag, ListTodo, MessageSquare, Paperclip, Pencil, Plus, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssigneeEditor, CellInput, CellShell } from "./inline-cells";
import { AssigneeAvatar, AssigneeStack, PriorityFlag, TagPill, statusHue } from "./hues";
import { formatAssignees, getTaskAssignees, parseAssignees } from "@/lib/assignees";
import type { Task, TaskItem, TaskPriority, TaskStatus } from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { setTaskStatus as setSessionTaskStatus } from "@/lib/session-store";
import { createTask, createTaskItem, deleteTask, updateTask, updateTaskItemDone, type EditTaskInput } from "@/lib/mutations";
import { formatShortDate } from "./task-visuals";
import { DeleteSubtask } from "./task-fields";
import { TaskMenu } from "@/components/create/entity-menus";

const ORDER: TaskStatus[] = ["todo", "in-progress", "in-review", "done"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type SortKey = "manual" | "due" | "priority" | "title";
type CellKind = "status" | "assignee" | "due" | "priority" | "tags";

type GroupedTaskListProps = {
  tasks: Task[];
  projectName?: Map<string, string>;
  spaceName?: Map<string, string>;
  itemsByTask?: Record<string, TaskItem[]>;
  linkToTask?: boolean;
  defaultExpanded?: boolean;
  /** Statuses that start collapsed (e.g. done). Defaults to ["done"]. */
  collapsedByDefault?: TaskStatus[];
  attachmentCounts?: Map<string, number>;
  commentCounts?: Map<string, number>;
  /** Context for the quick-add row when a group can't provide its own. */
  defaultSpaceId?: string;
  defaultProjectId?: string;
  defaultListId?: string;
};

type TaskPatch = Omit<EditTaskInput, "id">;

function priorityLabel(p?: TaskPriority): string {
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Small ClickUp-style status box: click opens the status dropdown. */
function statusBox(s: TaskStatus): string {
  switch (s) {
    case "done":
      return "border-primary bg-primary text-primary-foreground";
    case "in-progress":
      return "border-blue-500 text-blue-500";
    case "in-review":
      return "border-amber-500 text-amber-500";
    default:
      return "border-muted-foreground/40 text-transparent";
  }
}

export function GroupedTaskList({
  tasks,
  projectName,
  spaceName,
  itemsByTask,
  linkToTask = true,
  defaultExpanded = true,
  collapsedByDefault = ["done"],
  attachmentCounts,
  commentCounts,
  defaultSpaceId,
  defaultProjectId,
  defaultListId,
}: GroupedTaskListProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>(() =>
    Object.fromEntries(collapsedByDefault.map((s) => [s, true]))
  );
  const [patches, setPatches] = useState<Record<string, TaskPatch>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("manual");
  const [openCell, setOpenCell] = useState<{ taskId: string; cell: CellKind } | null>(null);
  const [draftCell, setDraftCell] = useState("");
  const [addingStatus, setAddingStatus] = useState<TaskStatus | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewTasks = useMemo(
    () =>
      tasks.map((t) => {
        const p = patches[t.id];
        if (!p) return t;
        const next: Task = {
          ...t,
          title: p.title ?? t.title,
          status: p.status ?? t.status,
          priority: "priority" in p ? (p.priority ?? undefined) : t.priority,
          assignee: "assignees" in p || "assignee" in p
            ? ((p.assignees ?? (p.assignee != null ? parseAssignees(p.assignee) : undefined))?.[0] ?? undefined)
            : t.assignee,
          assignees: "assignees" in p || "assignee" in p
            ? (p.assignees ?? (p.assignee != null ? parseAssignees(p.assignee) : undefined))
            : (t.assignees ?? (t.assignee ? parseAssignees(t.assignee) : undefined)),
          description: p.description ?? t.description,
          dueDate: "dueDate" in p ? (p.dueDate ?? undefined) : t.dueDate,
          tags: p.tags ?? t.tags,
          quote: "quote" in p ? (p.quote ?? undefined) : t.quote,
        };
        return next;
      }),
    [tasks, patches]
  );

  const sortTasks = useMemo(() => {
    const by: Record<SortKey, (a: Task, b: Task) => number> = {
      manual: () => 0,
      due: (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      priority: (a, b) =>
        (PRIORITY_RANK[a.priority ?? ""] ?? 3) - (PRIORITY_RANK[b.priority ?? ""] ?? 3),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return (list: Task[]) => (sort === "manual" ? list : [...list].sort(by[sort]));
  }, [sort]);

  const groups = ORDER.map((status) => ({
    status,
    items: sortTasks(viewTasks.filter((t) => t.status === status)),
  })).filter((group) => group.items.length > 0);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const knownAssignees = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tasks) {
      for (const name of getTaskAssignees(t)) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
    }
    return out.sort((a, b) => a.localeCompare(b)).slice(0, 20);
  }, [tasks]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function commit(taskId: string, patch: TaskPatch) {
    setError(null);
    setPatches((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } }));
    if (patch.status) setSessionTaskStatus(taskId, patch.status);
    setOpenCell(null);
    startTransition(async () => {
      const result = await updateTask({ id: taskId, ...patch });
      if (result.error) {
        setError(result.error);
        setPatches((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        return;
      }
      router.refresh();
    });
  }

  function bulkSet(patch: TaskPatch) {
    if (selected.length === 0) return;
    const ids = selected;
    startTransition(async () => {
      for (const id of ids) {
        const result = await updateTask({ id, ...patch });
        if (result.error) {
          setError(result.error);
          break;
        }
        if (patch.status) setSessionTaskStatus(id, patch.status);
      }
      setSelected([]);
      router.refresh();
    });
  }

  function bulkDelete() {
    if (selected.length === 0) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const ids = selected;
    setConfirmingDelete(false);
    startTransition(async () => {
      for (const id of ids) {
        const result = await deleteTask(id);
        if (result.error) {
          setError(result.error);
          break;
        }
      }
      setSelected([]);
      setPatches({});
      router.refresh();
    });
  }

  function quickAdd(status: TaskStatus, context: { spaceId?: string; projectId?: string; listId?: string }) {
    const title = addTitle.trim();
    if (!title) return;
    const spaceId = context.spaceId ?? defaultSpaceId;
    if (!spaceId) {
      setError("Pick a space before adding a task.");
      return;
    }
    setError(null);
    const payload = {
      title: title.slice(0, 200),
      spaceId,
      projectId: context.projectId ?? defaultProjectId,
      listId: context.listId ?? defaultListId,
      status,
    };
    setAddTitle("");
    setAddingStatus(null);
    startTransition(async () => {
      const result = await createTask(payload);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  if (viewTasks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort tasks"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="manual">Manual</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
          </select>
        </label>
        {selected.length > 0 && (
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
        )}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[760px]">
          <div
            role="row"
            className="grid grid-cols-[20px_32px_minmax(0,1fr)_128px_110px_104px_150px] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span>Task</span>
            <span>Assignee</span>
            <span>Due</span>
            <span>Priority</span>
            <span>Tags</span>
          </div>

          {groups.map(({ status, items }) => {
            const isCollapsed = collapsed[status] ?? !defaultExpanded;
            const first = items[0];
            return (
              <section key={status} aria-label={`${getStatusLabel(status)} tasks`}>
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [status]: !isCollapsed }))}
                  className="flex w-full items-center gap-2 bg-muted/30 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {getStatusLabel(status)}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground/70">
                    {items.length}
                  </span>
                </button>
                {!isCollapsed ? (
                  <ul className="divide-y divide-border">
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        linkToTask={linkToTask}
                        projectName={projectName?.get(task.projectId ?? "")}
                        spaceName={spaceName?.get(task.spaceId)}
                        subtaskCount={itemsByTask?.[task.id]?.length ?? 0}
                        subtasks={itemsByTask?.[task.id] ?? []}
                        attachmentCount={attachmentCounts?.get(task.id) ?? 0}
                        commentCount={commentCounts?.get(task.id) ?? 0}
                        selected={selectedSet.has(task.id)}
                        knownAssignees={knownAssignees}
                        openCell={openCell?.taskId === task.id ? openCell.cell : null}
                        draftCell={draftCell}
                        disabled={isPending}
                        onToggleSelect={() => toggleSelect(task.id)}
                        onOpenCell={(cell, initial) => {
                          setOpenCell({ taskId: task.id, cell });
                          setDraftCell(initial);
                        }}
                        onCloseCell={() => setOpenCell(null)}
                        onDraftCell={setDraftCell}
                        onCommit={(patch) => commit(task.id, patch)}
                      />
                    ))}
                    <li className="group/add px-3 py-1">
                      {addingStatus === status ? (
                        <form
                          className="flex items-center gap-2 py-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            quickAdd(status, {
                              spaceId: first?.spaceId,
                              projectId: first?.projectId,
                              listId: first?.listId,
                            });
                          }}
                        >
                          <Plus className="size-4 shrink-0 text-muted-foreground" />
                          <input
                            value={addTitle}
                            onChange={(e) => setAddTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setAddingStatus(null);
                                setAddTitle("");
                              }
                            }}
                            placeholder={`Add task to ${getStatusLabel(status)}… (Enter to save, Esc to cancel)`}
                            autoFocus
                            maxLength={200}
                            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                          />
                          <button
                            type="submit"
                            disabled={isPending || !addTitle.trim()}
                            className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            Add
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingStatus(status);
                            setAddTitle("");
                          }}
                          className="flex items-center gap-1.5 rounded-md px-1 py-1.5 text-xs text-muted-foreground opacity-0 transition-all hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/add:opacity-100 max-sm:opacity-100"
                        >
                          <Plus className="size-3.5" /> Add task
                        </button>
                      )}
                    </li>
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="sticky bottom-4 z-10 mx-auto mt-3 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-medium">{selected.length} selected</span>
          <select
            aria-label="Bulk set status"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkSet({ status: e.target.value as TaskStatus });
              e.target.value = "";
            }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Set status…</option>
            {ORDER.map((s) => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>
          <select
            aria-label="Bulk set priority"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkSet({ priority: e.target.value as TaskPriority });
              e.target.value = "";
            }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Set priority…</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{priorityLabel(p)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={bulkDelete}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium",
              confirmingDelete
                ? "bg-destructive text-destructive-foreground"
                : "text-destructive hover:bg-destructive/10"
            )}
          >
            {confirmingDelete ? "Confirm delete" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setConfirmingDelete(false);
            }}
            aria-label="Clear selection"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AssigneeCellButton({
  task,
  disabled,
  onOpen,
}: {
  task: Task;
  disabled: boolean;
  onOpen: () => void;
}) {
  const owners = getTaskAssignees(task);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[13px] hover:bg-muted"
      title={owners.length > 0 ? owners.join(", ") : "Set assignees"}
    >
      {owners.length > 0 ? (
        <>
          <AssigneeStack names={owners} size="sm" max={3} />
          <span className="truncate">
            {owners.slice(0, 2).join(", ")}
            {owners.length > 2 ? ` +${owners.length - 2}` : ""}
          </span>
        </>
      ) : (
        <UserRound className="size-4 text-muted-foreground/40" aria-label="No assignee" />
      )}
    </button>
  );
}

function TaskRow({
  task,
  linkToTask,
  projectName,
  spaceName,
  subtaskCount,
  subtasks,
  attachmentCount,
  commentCount,
  selected,
  knownAssignees,
  openCell,
  draftCell,
  disabled,
  onToggleSelect,
  onOpenCell,
  onCloseCell,
  onDraftCell,
  onCommit,
}: {
  task: Task;
  linkToTask: boolean;
  projectName?: string;
  spaceName?: string;
  subtaskCount: number;
  subtasks: TaskItem[];
  attachmentCount: number;
  commentCount: number;
  selected: boolean;
  knownAssignees?: string[];
  openCell: CellKind | null;
  draftCell: string;
  disabled: boolean;
  onToggleSelect: () => void;
  onOpenCell: (cell: CellKind, initial: string) => void;
  onCloseCell: () => void;
  onDraftCell: (v: string) => void;
  onCommit: (patch: TaskPatch) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(task.title);
  const [addingSub, setAddingSub] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [, startSubTransition] = useTransition();

  function toggleSubItem(itemId: string, done: boolean) {
    startSubTransition(async () => {
      try {
        await updateTaskItemDone(task.id, itemId, done);
      } finally {
        router.refresh();
      }
    });
  }

  function submitRename() {
    const title = renameValue.trim();
    if (title && title !== task.title) onCommit({ title: title.slice(0, 200) });
    else setRenaming(false);
  }

  function submitSubtask() {
    const title = subTitle.trim();
    if (!title) return;
    setSubTitle("");
    setAddingSub(false);
    setExpanded(true);
    startSubTransition(async () => {
      try {
        await createTaskItem(task.id, title.slice(0, 200));
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <li
      className={cn(
        "group relative transition-colors hover:bg-muted/40",
        selected && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        role="row"
        className="grid grid-cols-[20px_32px_minmax(0,1fr)_128px_110px_104px_150px] items-center gap-2 px-3 py-2"
      >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse subtasks for ${task.title}` : `Expand subtasks for ${task.title}`}
        title={expanded ? "Collapse subtasks" : "Expand subtasks"}
        className={cn(
          "rounded p-0.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          expanded ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        )}
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform", !expanded && "-rotate-90")}
        />
      </button>
      <span className="flex items-center">
        <button
          type="button"
          onClick={() => onOpenCell("status", task.status)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={openCell === "status"}
          aria-label={`Change status, currently ${getStatusLabel(task.status)}`}
          title={getStatusLabel(task.status)}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            statusBox(task.status),
            task.status !== "done" && "hover:border-muted-foreground/70"
          )}
        >
          {task.status === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
        </button>
      </span>

      <CellShell
        open={openCell === "status"}
        onClose={onCloseCell}
        display={
      <span className="min-w-0">
        {renaming ? (
          <form
            className="flex min-w-0 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(false);
              }}
              autoFocus
              maxLength={200}
              aria-label="Task title"
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring"
            />
          </form>
        ) : (
          <span className="flex min-w-0 items-baseline gap-2">
            {linkToTask ? (
              <Link
                href={`/tasks/${task.id}`}
                className="min-w-0 flex-1 truncate text-sm leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <span className={cn(task.status === "done" && "text-muted-foreground line-through")}>
                  {task.title}
                </span>
              </Link>
            ) : (
              <span className={cn("min-w-0 flex-1 truncate text-sm", task.status === "done" && "text-muted-foreground line-through")}>
                {task.title}
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-normal text-muted-foreground/70">
              <span className="truncate">
                {[projectName, spaceName].filter(Boolean).join(" · ")}
              </span>
              {subtaskCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  title={expanded ? "Collapse subtasks" : "Expand subtasks"}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ListTodo className="size-3" />
                  {subtaskCount}
                </button>
              ) : null}
              {task.tags && task.tags.length > 0 ? (
                <span className="flex min-w-0 items-center gap-1">
                  {task.tags.slice(0, 2).map((t) => (
                    <TagPill key={t} tag={t} />
                  ))}
                  {task.tags.length > 2 ? (
                    <span className="shrink-0">+{task.tags.length - 2}</span>
                  ) : null}
                </span>
              ) : null}
              {attachmentCount > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-0.5" title={`${attachmentCount} attachments`}>
                  <Paperclip className="size-3" />
                  {attachmentCount}
                </span>
              ) : null}
              {commentCount > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-0.5" title={`${commentCount} comments`}>
                  <MessageSquare className="size-3" />
                  {commentCount}
                </span>
              ) : null}
            </span>
          </span>
        )}
      </span>
        }
        editor={
          <div className="flex flex-col gap-1 p-0.5">
            {ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onCommit({ status: s })}
                aria-pressed={s === task.status}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  s !== task.status && "opacity-70 hover:opacity-100"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    statusHue(s)
                  )}
                >
                  {getStatusLabel(s)}
                </span>
                {s === task.status ? (
                  <span className="pr-1 text-xs font-semibold text-primary">✓</span>
                ) : null}
              </button>
            ))}
          </div>
        }
      />

      <CellShell
        open={openCell === "assignee"}
        onClose={onCloseCell}
        wide
        display={
          <AssigneeCellButton
            task={task}
            disabled={disabled}
            onOpen={() => onOpenCell("assignee", formatAssignees(getTaskAssignees(task)))}
          />
        }
        editor={
          <AssigneeEditor
            initial={getTaskAssignees(task)}
            suggestions={knownAssignees}
            onCancel={onCloseCell}
            onSave={(list) => {
              onCommit({ assignees: list, assignee: list[0] ?? null } as TaskPatch);
            }}
          />
        }
      />

      <CellShell
        open={openCell === "due"}
        onClose={onCloseCell}
        display={
          <button
            type="button"
            onClick={() => onOpenCell("due", task.dueDate ?? "")}
            disabled={disabled}
            className="block rounded-md px-1 py-1 text-left text-[13px] tabular-nums hover:bg-muted"
          >
            {task.dueDate ? (
              formatShortDate(task.dueDate)
            ) : (
              <CalendarDays className="size-4 text-muted-foreground/40" aria-label="No due date" />
            )}
          </button>
        }
        editor={
          <CellInput
            type="date"
            value={draftCell}
            onChange={onDraftCell}
            onSave={() => onCommit({ dueDate: draftCell || null })}
            onCancel={onCloseCell}
          />
        }
      />

      <CellShell
        open={openCell === "priority"}
        onClose={onCloseCell}
        display={
          <button
            type="button"
            onClick={() => onOpenCell("priority", task.priority ?? "")}
            disabled={disabled}
            className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[13px] hover:bg-muted"
          >
            {task.priority ? (
              <>
                <PriorityFlag priority={task.priority} />
                <span className="truncate">{priorityLabel(task.priority)}</span>
              </>
            ) : (
              <Flag className="size-4 text-muted-foreground/40" aria-label="No priority" />
            )}
          </button>
        }
        editor={
          <div className="flex flex-col gap-0.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onCommit({ priority: p })}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
              >
                <PriorityFlag priority={p} />
                {priorityLabel(p)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onCommit({ priority: null })}
              className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
          </div>
        }
      />

      <CellShell
        open={openCell === "tags"}
        onClose={onCloseCell}
        wide
        display={
          <button
            type="button"
            onClick={() => onOpenCell("tags", (task.tags ?? []).join(", "))}
            disabled={disabled}
            className="flex max-w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-muted"
          >
            {task.tags && task.tags.length > 0 ? (
              <>
                {task.tags.slice(0, 2).map((t) => (
                  <span key={t} className="truncate rounded-full bg-muted px-1.5 py-0.5 text-[11px]">
                    {t}
                  </span>
                ))}
                {task.tags.length > 2 ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">+{task.tags.length - 2}</span>
                ) : null}
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground/60">—</span>
            )}
          </button>
        }
        editor={
          <CellInput
            value={draftCell}
            onChange={onDraftCell}
            placeholder="Bug, Feature, …"
            onSave={() =>
              onCommit({
                tags: draftCell.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
              })
            }
            onCancel={onCloseCell}
          />
        }
      />
      </div>

      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-border bg-card/95 px-1 py-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:hidden">
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          title={selected ? "Deselect (clear from bulk actions)" : "Select for bulk actions"}
          aria-label={selected ? `Deselect ${task.title}` : `Select ${task.title}`}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "flex size-3.5 items-center justify-center rounded-sm border",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
            )}
          >
            {selected ? <Check className="size-2.5" strokeWidth={3} /> : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAddingSub(true);
            setExpanded(true);
          }}
          title="Add subtask"
          aria-label={`Add subtask to ${task.title}`}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setRenameValue(task.title);
            setRenaming(true);
          }}
          title="Rename task"
          aria-label={`Rename ${task.title}`}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="size-3.5" />
        </button>
        <TaskMenu taskId={task.id} taskTitle={task.title} />
      </span>

      {expanded ? (
        <div className="border-t border-border/60 bg-muted/20 px-8 py-1.5">
          {addingSub ? (
            <form
              className="flex items-center gap-1.5 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitSubtask();
              }}
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAddingSub(false);
                    setSubTitle("");
                  }
                }}
                placeholder="Add subtask… (Enter to save, Esc to cancel)"
                autoFocus
                maxLength={200}
                aria-label="New subtask title"
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="submit"
                disabled={!subTitle.trim()}
                className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
            </form>
          ) : null}
          {subtasks.length > 0 ? (
            <ul className="py-0.5">
              {subtasks.map((sub) => (
                <li key={sub.id} className="group/sub flex items-center gap-2 rounded py-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={sub.done}
                    aria-label={sub.title}
                    onClick={() => toggleSubItem(sub.id, !sub.done)}
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      sub.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 hover:border-primary"
                    )}
                  >
                    {sub.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </button>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px]",
                      sub.done && "text-muted-foreground line-through"
                    )}
                    title={sub.title}
                  >
                    {sub.title}
                  </span>
                  {sub.assignee ? <AssigneeAvatar name={sub.assignee} size="sm" /> : null}
                  {sub.priority ? <PriorityFlag priority={sub.priority} /> : null}
                  {sub.dueDate ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatShortDate(sub.dueDate)}
                    </span>
                  ) : null}
                  <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/sub:opacity-100">
                    <DeleteSubtask taskId={task.id} itemId={sub.id} />
                  </span>
                </li>
              ))}
            </ul>
          ) : addingSub ? null : (
            <p className="py-1 text-xs text-muted-foreground">No subtasks yet.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}
