"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Flag, ListTodo, MessageSquare, Paperclip, Pencil, Plus, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CellInput, CellShell } from "./inline-cells";
import { AssigneeAvatar, PriorityFlag, TagPill, statusHue } from "./hues";
import type { Task, TaskItem, TaskPriority, TaskStatus } from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { setTaskStatus as setSessionTaskStatus } from "@/lib/session-store";
import { createTask, deleteTask, deleteTaskItem, updateTask, updateTaskItemDone, type EditTaskInput } from "@/lib/mutations";
import { formatShortDate } from "./task-visuals";
import { TaskCheckbox } from "./task-checkbox";
import { AddSubtask } from "./task-fields";
import { SubtaskTree } from "./subtask-rows";
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

export function GroupedTaskList({
  tasks,
  projectName,
  spaceName,
  itemsByTask,
  linkToTask = true,
  defaultExpanded = true,
  attachmentCounts,
  commentCounts,
  defaultSpaceId,
  defaultProjectId,
  defaultListId,
}: GroupedTaskListProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>({});
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
          assignee: "assignee" in p ? (p.assignee ?? undefined) : t.assignee,
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
  const visibleIds = useMemo(() => viewTasks.map((t) => t.id), [viewTasks]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === visibleIds.length ? [] : visibleIds));
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

  const allSelected = selected.length > 0 && selected.length === visibleIds.length;

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
        <div className="min-w-[880px]">
          <div
            role="row"
            className="grid grid-cols-[32px_minmax(0,1fr)_128px_128px_110px_104px_150px] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={toggleSelectAll}
              aria-label="Select all tasks"
              className="size-4 accent-primary"
            />
            <span>Task</span>
            <span>Status</span>
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
                    <li className="px-3 py-1">
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
                          className="flex items-center gap-1.5 rounded-md px-1 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

  function deleteSubItem(itemId: string) {
    startSubTransition(async () => {
      try {
        await deleteTaskItem(task.id, itemId);
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

  return (
    <li
      className={cn(
        "group relative transition-colors hover:bg-muted/40",
        selected && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        role="row"
        className="grid grid-cols-[32px_minmax(0,1fr)_128px_128px_110px_104px_150px] items-center gap-2 px-3 py-2"
      >
      <span className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${task.title}`}
          title="Select for bulk actions"
          className={cn(
            "size-4 shrink-0 accent-primary transition-opacity focus-visible:opacity-100",
            selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100"
          )}
        />
        <TaskCheckbox taskId={task.id} status={task.status} />
      </span>

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
        ) : linkToTask ? (
          <Link
            href={`/tasks/${task.id}`}
            className="block max-w-full truncate text-sm leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <span className={cn(task.status === "done" && "text-muted-foreground line-through")}>
              {task.title}
            </span>
          </Link>
        ) : (
          <span className={cn("block truncate text-sm", task.status === "done" && "text-muted-foreground line-through")}>
            {task.title}
          </span>
        )}
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">
            {[projectName, spaceName].filter(Boolean).join(" · ")}
          </span>
          {subtaskCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              title={expanded ? "Collapse subtasks" : "Expand subtasks"}
              className="inline-flex shrink-0 items-center gap-1 rounded px-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <CellShell
        open={openCell === "status"}
        onClose={onCloseCell}
        display={
          <button
            type="button"
            onClick={() => onOpenCell("status", task.status)}
            disabled={disabled}
            className={cn(
              "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
              statusHue(task.status)
            )}
          >
            <span className="truncate">{getStatusLabel(task.status)}</span>
            <ChevronDown className="size-3 shrink-0" />
          </button>
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
        display={
          <button
            type="button"
            onClick={() => onOpenCell("assignee", task.assignee ?? "")}
            disabled={disabled}
            className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[13px] hover:bg-muted"
            title={task.assignee || "Set assignee"}
          >
            {task.assignee ? (
              <>
                <AssigneeAvatar name={task.assignee} size="sm" />
                <span className="truncate">{task.assignee}</span>
              </>
            ) : (
              <UserRound className="size-4 text-muted-foreground/40" aria-label="No assignee" />
            )}
          </button>
        }
        editor={
          <CellInput
            value={draftCell}
            onChange={onDraftCell}
            placeholder="Assignee"
            onSave={() => onCommit({ assignee: draftCell.trim() || null })}
            onCancel={onCloseCell}
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
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          title={expanded ? "Collapse subtasks" : "Expand subtasks"}
          aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
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
        <div className="border-t border-border/60 px-8 py-2">
          {subtasks.length > 0 ? (
            <SubtaskTree
              taskId={task.id}
              items={subtasks}
              doneMap={{}}
              onToggle={(itemId) => {
                const item = subtasks.find((i) => i.id === itemId);
                toggleSubItem(itemId, !(item?.done ?? false));
              }}
              onDelete={deleteSubItem}
            />
          ) : (
            <p className="py-1 text-xs text-muted-foreground">No subtasks yet.</p>
          )}
          <AddSubtask taskId={task.id} />
        </div>
      ) : null}
    </li>
  );
}
