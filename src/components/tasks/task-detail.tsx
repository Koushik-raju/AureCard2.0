"use client";

import { useMemo, useState } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FileText, Pencil, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DocumentRef,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { formatDueDate } from "@/lib/dates";
import { isOverdueTask } from "@/lib/due";
import { LIBRARY_TYPE_LABEL, resolveDocType } from "@/lib/doc-type";
import { assigneesEqual, formatAssignees, getTaskAssignees, parseAssignees } from "@/lib/assignees";
import { AssigneeStack } from "@/components/tasks/hues";
import { PREF_KEYS, readJson } from "@/lib/prefs";
import { setTaskStatus as setSessionTaskStatus } from "@/lib/session-store";
import type { EditTaskInput } from "@/lib/mutations";
import {
  addComment,
  createTaskAttachment,
  deleteTaskAttachment,
  deleteTaskItem,
  updateTask,
  updateTaskItemDone,
  updateTaskStatus,
} from "@/lib/mutations";
import { TaskMenu } from "@/components/create/entity-menus";
import { TaskDocEditor } from "@/components/tasks/task-doc-editor";
import { SubtaskTree } from "@/components/tasks/subtask-rows";
import { trackCommentEcho, useRealtimeTask } from "./use-realtime-task";
import {
  AddSubtask,
  AttachmentsSection,
  AttachmentShow,
  PriorityPicker,
} from "./task-fields";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in-progress", "in-review", "done"];

type TaskDetailProps = {
  task: Task;
  projectName?: string;
  spaceName?: string;
  listName?: string;
  items: TaskItem[];
  comments: TaskComment[];
  activity: TaskActivity[];
  documents: DocumentRef[];
  attachments: TaskAttachment[];
  currentAuthor?: string;
  sourceDocTitle?: string;
  spaceDocs?: { id: string; title: string }[];
  /** Attachment mimes per document id, for proper Recording/Image/File labels. */
  docMedia?: Record<string, string[]>;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[15px] text-foreground">{children}</dd>
    </div>
  );
}

function StatusControl({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change task status"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[15px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{getStatusLabel(status)}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            role="listbox"
            aria-label="Task status"
            className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {STATUS_OPTIONS.map((option) => (
              <li key={option} role="option" aria-selected={option === status}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    option === status && "bg-muted text-foreground"
                  )}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <span>{getStatusLabel(option)}</span>
                  {option === status ? <Check className="size-4" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h3>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function TaskDetail({
  task,
  projectName,
  spaceName,
  listName,
  items,
  comments,
  activity,
  documents,
  attachments,
  currentAuthor,
  sourceDocTitle,
  spaceDocs = [],
  docMedia = {},
}: TaskDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [itemStates, setItemStates] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((s) => [s.id, s.done]))
  );
  const [localComments, setLocalComments] = useState<TaskComment[]>(comments);
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: task.title,
    priority: task.priority ?? (null as TaskPriority | null),
    assignee: formatAssignees(getTaskAssignees(task)),
    dueDate: task.dueDate ?? "",
    tags: (task.tags ?? []).join(", "),
    quote: task.quote ?? "",
    sourceDocId: task.sourceDocId ?? "",
  });
  const [added, setAdded] = useState<TaskAttachment[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const [displayName] = useState(
    () => readJson<{ name: string }>(PREF_KEYS.displayName, { name: "" }).name ?? ""
  );
  const authorName = currentAuthor ?? displayName ?? "";

  useRealtimeTask(task.id, {
    onStatus(s) {
      setStatus((prev) => (prev === s ? prev : s));
    },
    onComment(comment) {
      setLocalComments((prev) =>
        prev.some((c) => c.id === comment.id || (c.author === comment.author && c.text === comment.text))
          ? prev
          : [...prev, comment]
      );
    },
    onItemDone(id, done) {
      setItemStates((prev) => ({ ...prev, [id]: done }));
    },
  });

  const doneCount = useMemo(
    () => items.filter((item) => itemStates[item.id] ?? item.done).length,
    [items, itemStates]
  );

  const toggleItem = (id: string) =>
    setItemStates((prev) => {
      const next = !(prev[id] ?? items.find((i) => i.id === id)?.done ?? false);
      // Mirror the server cascade so parent/children stay consistent instantly.
      const changed: Record<string, boolean> = { [id]: next };
      if (next) {
        const stack = items.filter((i) => i.parentId === id).map((i) => i.id);
        while (stack.length > 0) {
          const child = stack.pop()!;
          changed[child] = true;
          for (const i of items) if (i.parentId === child) stack.push(i.id);
        }
      } else {
        let parent = items.find((i) => i.id === id)?.parentId;
        while (parent) {
          changed[parent] = false;
          parent = items.find((i) => i.id === parent)?.parentId;
        }
      }
      startTransition(() =>
        updateTaskItemDone(task.id, id, next).catch(() => {
          setItemStates((p) => {
            const rollback = { ...p };
            for (const key of Object.keys(changed)) delete rollback[key];
            return rollback;
          });
        })
      );
      return { ...prev, ...changed };
    });

  function startEditing() {
    setDraft({
      title: task.title,
      priority: task.priority ?? null,
      assignee: formatAssignees(getTaskAssignees(task)),
      dueDate: task.dueDate ?? "",
      tags: (task.tags ?? []).join(", "),
      quote: task.quote ?? "",
      sourceDocId: task.sourceDocId ?? "",
    });
    setAdded([]);
    setRemoved(new Set());
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setAdded([]);
    setRemoved(new Set());
    setSaveError(null);
    setEditing(false);
  }

  async function saveEditing() {
    const updates: EditTaskInput = { id: task.id };
    if (draft.title.trim() !== task.title) updates.title = draft.title.trim();
    // Description is edited inline in the Notion-style body above and
    // autosaves independently, so it stays out of the Update form.
    if ((draft.priority ?? null) !== (task.priority ?? null)) updates.priority = draft.priority;
    const assignees = parseAssignees(draft.assignee);
    if (!assigneesEqual(assignees, getTaskAssignees(task))) {
      updates.assignees = assignees;
      updates.assignee = assignees[0] ?? null;
    }
    const due = draft.dueDate || null;
    if (due !== (task.dueDate ?? null)) updates.dueDate = due;
    const tags = parseTags(draft.tags);
    if (tags.join("\u0000") !== (task.tags ?? []).join("\u0000")) updates.tags = tags;
    const quote = draft.quote.trim();
    if ((quote || null) !== (task.quote?.trim() || null)) updates.quote = quote || null;
    const sourceDocId = draft.sourceDocId || null;
    if (sourceDocId !== (task.sourceDocId ?? null)) updates.sourceDocId = sourceDocId;

    startTransition(async () => {
      const result = await updateTask(updates);
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      for (const a of added) {
        const r = await createTaskAttachment(task.id, { kind: a.kind, url: a.url, label: a.label });
        if (r.error) {
          setSaveError(r.error);
          return;
        }
      }
      for (const id of removed) {
        const r = await deleteTaskAttachment(task.id, id);
        if (r.error) {
          setSaveError(r.error);
          return;
        }
      }
      cancelEditing();
      router.refresh();
    });
  }

  const crumb = projectName ?? listName ?? spaceName ?? "Tasks";

  return (
    <div className="w-full px-6 py-8 sm:py-10">
      <nav className="mx-auto mb-6 max-w-prose">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          ← {crumb}
        </Link>
      </nav>

      <header className="mx-auto flex max-w-prose flex-wrap items-start justify-between gap-4">
        {editing ? (
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            aria-label="Task title"
            className="h-10 font-serif text-2xl font-medium tracking-tight"
            autoFocus
          />
        ) : (
          <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">
            {task.title}
          </h1>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <StatusControl
            status={status}
            onChange={(s) => {
              setStatus(s);
              setSessionTaskStatus(task.id, s);
              startTransition(() =>
                updateTaskStatus(task.id, s).catch(() => {
                  setStatus(task.status);
                  setSessionTaskStatus(task.id, task.status);
                })
              );
            }}
          />
          {editing ? (
            <>
              <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={cancelEditing}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={isPending} onClick={() => void saveEditing()}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              <TaskMenu taskId={task.id} taskTitle={task.title} />
            </>
          )}
        </div>
      </header>

      {saveError ? (
        <p className="mx-auto mt-4 max-w-prose text-sm text-destructive">{saveError}</p>
      ) : null}

      {editing ? (
        <div className="mx-auto mt-6 max-w-prose">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <Field label="Priority">
              <PriorityPicker
                value={draft.priority}
                onChange={(p) => setDraft((d) => ({ ...d, priority: p }))}
              />
            </Field>
            <Field label="Assignee">
              <Input
                value={draft.assignee}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                placeholder="Koushik, Rashmi…"
                className="h-8 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Separate multiple assignees with commas.</p>
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Tags">
              <Input
                value={draft.tags}
                onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                placeholder="Bug, Feature, …"
                className="h-8 text-sm"
              />
            </Field>
          </dl>

          <section className="mt-10">
            <SectionHeading>Source</SectionHeading>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="task-quote" className="text-xs text-muted-foreground">
                  Verbatim quote
                </label>
                <textarea
                  id="task-quote"
                  value={draft.quote}
                  onChange={(e) => setDraft((d) => ({ ...d, quote: e.target.value }))}
                  rows={2}
                  placeholder="Exact words this task came from…"
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div>
                <label htmlFor="task-source" className="text-xs text-muted-foreground">
                  Source note
                </label>
                <select
                  id="task-source"
                  value={draft.sourceDocId}
                  onChange={(e) => setDraft((d) => ({ ...d, sourceDocId: e.target.value }))}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No source</option>
                  {spaceDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <SectionHeading>Links &amp; files</SectionHeading>
            <AttachmentsSection
              attachments={attachments}
              added={added}
              removed={removed}
              onAdd={(a) => setAdded((prev) => [...prev, a as TaskAttachment])}
              onRemove={(id) => {
                const existing = attachments.find((x) => x.id === id);
                if (existing) {
                  setRemoved((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                  });
                } else {
                  setAdded((prev) => prev.filter((x) => x.id !== id));
                }
              }}
            />
          </section>
        </div>
      ) : (
        <>
          <dl className="mx-auto mt-6 grid max-w-prose grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border bg-card p-5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Priority">{task.priority ? priorityCapital(task.priority) : "—"}</Field>
            <Field label="Assignees">
              {getTaskAssignees(task).length > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <AssigneeStack names={getTaskAssignees(task)} size="sm" max={5} />
                  <span>{getTaskAssignees(task).join(", ")}</span>
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Due date">
              {task.dueDate ? (
                <span className={isOverdueTask(task) ? "font-medium text-destructive" : undefined}>
                  {formatDueDate(task.dueDate)}
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Tags">
              {task.tags && task.tags.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </Field>
          </dl>

          {task.quote || task.sourceDocId ? (
            <section className="mx-auto mt-10 max-w-prose">
              <SectionHeading>Source</SectionHeading>
              {task.quote ? (
                <blockquote className="mt-3 border-l-2 border-border pl-4 text-[15px] italic leading-relaxed text-foreground">
                  “{task.quote}”
                </blockquote>
              ) : null}
              {task.sourceDocId ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Captured from{" "}
                  <Link
                    href={`/docs/${task.sourceDocId}`}
                    className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {sourceDocTitle ?? "note"}
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <section className="mx-auto mt-10 max-w-prose" aria-label="Task body">
        <SectionHeading>Description</SectionHeading>
        <div className="mt-2">
          <TaskDocEditor
            key={task.id}
            initialDescription={task.description}
            saveBody={(description) => updateTask({ id: task.id, description })}
          />
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-prose">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={subtasksOpen ? "Collapse subtasks" : "Expand subtasks"}
            onClick={() => setSubtasksOpen((o) => !o)}
            className={cn(
              "rounded p-1 text-muted-foreground transition-transform hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              subtasksOpen && "rotate-90"
            )}
          >
            <ChevronDown className="size-4" />
          </button>
          <SectionHeading>Subtasks · {doneCount}/{items.length}</SectionHeading>
        </div>
        {subtasksOpen ? (
          <>
            <SubtaskTree
              taskId={task.id}
              items={items}
              doneMap={itemStates}
              onToggle={toggleItem}
              onDelete={(id) => {
                startTransition(async () => {
                  await deleteTaskItem(task.id, id).catch(() => {});
                  router.refresh();
                });
              }}
            />
            <AddSubtask taskId={task.id} />
          </>
        ) : null}
      </section>

      <section className="mx-auto mt-10 max-w-prose">
        <SectionHeading>Links &amp; files</SectionHeading>
        {attachments.length > 0 ? (
          <AttachmentShow attachments={attachments} />
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground">Nothing attached yet.</p>
        )}
      </section>

      {documents.length > 0 ? (
        <section className="mx-auto mt-10 max-w-prose">
          <SectionHeading>Documents</SectionHeading>
          <ul className="mt-3 divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/docs/${doc.id}`}
                  className="group flex items-center gap-3 rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {doc.kind === "note" ? (
                    <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] leading-snug group-hover:text-primary">
                    {doc.title}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {LIBRARY_TYPE_LABEL[resolveDocType(doc, docMedia[doc.id] ?? [])]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto mt-10 max-w-prose">
        <SectionHeading>Activity</SectionHeading>

        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <label htmlFor="comment" className="text-sm font-medium text-foreground">
            Add a comment
          </label>
          <textarea
            id="comment"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={authorName ? `Comment as ${authorName}` : "Write a comment…"}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => {
                const el = document.getElementById("comment") as HTMLTextAreaElement | null;
                const text = el?.value ?? "";
                if (!text.trim()) return;
                const optimistic: TaskComment = {
                  id: crypto.randomUUID(),
                  taskId: task.id,
                  author: authorName || "You",
                  text: text.trim().slice(0, 1000),
                  createdAt: new Date().toISOString(),
                };
                trackCommentEcho(optimistic.author, optimistic.text);
                setLocalComments((prev) => [...prev, optimistic]);
                if (el) el.value = "";
                startTransition(async () => {
                  try {
                    await addComment(task.id, text);
                  } catch {
                    setLocalComments((prev) => prev.filter((c) => c.id !== optimistic.id));
                  }
                });
              }}
            >
              {isPending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>

        {localComments.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground">Comments</h4>
            <ul className="mt-2 space-y-3">
              {localComments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                    {comment.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activity.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-foreground">History</h4>
            <ul className="mt-2 divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    {item.author ? (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.author}
                      </span>
                    ) : null}
                    <span className="text-sm text-foreground">{item.text}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.when}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function priorityCapital(p: TaskPriority) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}