"use client";

import { useMemo, useState } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, FileText, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  DocumentRef,
  Task,
  TaskActivity,
  TaskComment,
  TaskItem,
  TaskStatus,
} from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { setTaskStatus as setSessionTaskStatus } from "@/lib/session-store";
import {
  addComment,
  updateTaskItemDone,
  updateTaskStatus,
} from "@/lib/mutations";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in-progress", "done"];

type TaskDetailProps = {
  task: Task;
  projectId?: string;
  projectName?: string;
  spaceName?: string;
  listName?: string;
  items: TaskItem[];
  comments: TaskComment[];
  activity: TaskActivity[];
  documents: DocumentRef[];
  currentAuthor?: string;
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

function TaskItemNode({
  item,
  children,
  done,
  onToggle,
  depth,
}: {
  item: TaskItem;
  children: React.ReactNode;
  done: boolean;
  onToggle: (id: string) => void;
  depth: number;
}) {
  return (
    <li>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          role="checkbox"
          aria-checked={done}
          aria-label={item.title}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} /> : null}
        </button>
        <span
          className={cn(
            "text-[15px] leading-snug",
            depth > 0 && "text-[14px]",
            done && "text-muted-foreground line-through"
          )}
        >
          {item.title}
        </span>
      </div>
      {children ? (
        <ul className="border-l border-border/70 pl-3 mt-1">{children}</ul>
      ) : null}
    </li>
  );
}

function RecursiveItems({
  items,
  parentId,
  doneMap,
  onToggle,
}: {
  items: TaskItem[];
  parentId: string | undefined;
  doneMap: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const childrenOf = useMemo(
    () => items.filter((item) => (item.parentId ?? undefined) === parentId),
    [items, parentId]
  );

  if (childrenOf.length === 0) return null;

  return (
    <>
      {childrenOf.map((item) => {
        const depth = item.parentId
          ? countDepth(items, item.id)
          : 0;
        return (
          <TaskItemNode
            key={item.id}
            item={item}
            done={doneMap[item.id] ?? item.done}
            onToggle={onToggle}
            depth={depth}
          >
            <RecursiveItems
              items={items}
              parentId={item.id}
              doneMap={doneMap}
              onToggle={onToggle}
            />
          </TaskItemNode>
        );
      })}
    </>
  );
}

function countDepth(items: TaskItem[], id: string): number {
  const item = items.find((i) => i.id === id);
  if (!item || !item.parentId) return 0;
  return 1 + countDepth(items, item.parentId);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h3>
  );
}

export function TaskDetail({
  task,
  projectId,
  projectName,
  spaceName,
  listName,
  items,
  comments,
  activity,
  documents,
  currentAuthor,
}: TaskDetailProps) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [itemStates, setItemStates] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((s) => [s.id, s.done]))
  );
  const [localComments, setLocalComments] = useState<TaskComment[]>(comments);
  const [isPending, startTransition] = useTransition();

  const doneCount = useMemo(
    () => items.filter((item) => itemStates[item.id] ?? item.done).length,
    [items, itemStates]
  );

  const toggleItem = (id: string) =>
    setItemStates((prev) => {
      const next = !prev[id];
      startTransition(() =>
        updateTaskItemDone(task.id, id, next).catch(() => {
          setItemStates((p) => ({ ...p, [id]: !next }));
        })
      );
      return { ...prev, [id]: next };
    });

  const crumb = projectName ?? listName ?? spaceName ?? "Tasks";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-10">
      <nav className="mb-6">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          ← {crumb}
        </Link>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">
          {task.title}
        </h1>
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
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <Field label="Status">{getStatusLabel(status)}</Field>
        <Field label="Priority">{task.priority ? capitalize(task.priority) : "—"}</Field>
        <Field label="Assignee">{task.assignee ?? "—"}</Field>
        <Field label="Due date">{formatDate(task.dueDate) ?? "—"}</Field>
        <Field label="Project">
          {projectName ? (
            projectId ? (
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {projectName}
              </Link>
            ) : (
              projectName
            )
          ) : (
            "—"
          )}
        </Field>
        <Field label="Tags">
          {task.tags && task.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
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

      {task.description ? (
        <section className="mt-10">
          <SectionHeading>Description</SectionHeading>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-foreground">
            {task.description}
          </p>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>
            Subtasks · {doneCount}/{items.length}
          </SectionHeading>
          <ul className="mt-3">
            <RecursiveItems
              items={items}
              parentId={undefined}
              doneMap={itemStates}
              onToggle={toggleItem}
            />
          </ul>
        </section>
      ) : null}

      {documents.length > 0 ? (
        <section className="mt-10">
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
                    {doc.kind === "note" ? "Note" : "Doc"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading>Activity</SectionHeading>

        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <label htmlFor="comment" className="text-sm font-medium text-foreground">
            Add a comment
          </label>
          <textarea
            id="comment"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={currentAuthor ? `Comment as ${currentAuthor}` : "Write a comment…"}
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
                  author: currentAuthor ?? "You",
                  text: text.trim().slice(0, 1000),
                  createdAt: new Date().toISOString(),
                };
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
                  <span className="text-sm text-foreground">{item.text}</span>
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(date?: string) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
