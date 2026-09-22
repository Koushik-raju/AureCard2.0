"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Task, TaskItem, TaskStatus } from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { setTaskStatus as setSessionTaskStatus } from "@/lib/session-store";
import { updateTaskStatus } from "@/lib/mutations";
import { PriorityDot, formatShortDate } from "./task-visuals";
import { SubtaskInline } from "./subtask-inline";
import { SourceLine, WhoBadge } from "./task-meta";

const COLUMNS: TaskStatus[] = ["todo", "in-progress", "in-review", "done"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type TaskBoardViewProps = {
  tasks: Task[];
  projectName: Map<string, string>;
  spaceName: Map<string, string>;
  itemsByTask?: Record<string, TaskItem[]>;
  docTitle?: Map<string, string>;
};

export function TaskBoardView({ tasks, projectName, spaceName, itemsByTask, docTitle }: TaskBoardViewProps) {
  const [localStatuses, setLocalStatuses] = useState<Record<string, TaskStatus>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  const effectiveTasks = useMemo(
    () =>
      tasks.map((t) =>
        localStatuses[t.id] ? { ...t, status: localStatuses[t.id] } : t
      ),
    [tasks, localStatuses]
  );

  function onDrop(status: TaskStatus) {
    if (!draggingId) return;
    const task = tasks.find((t) => t.id === draggingId);
    const next = status;
    setLocalStatuses((prev) => ({ ...prev, [draggingId]: next }));
    setSessionTaskStatus(draggingId, next);
    void updateTaskStatus(draggingId, next).catch(() => {
      setLocalStatuses((prev) => {
        const copy = { ...prev };
        delete copy[draggingId];
        return copy;
      });
    });
    setDraggingId(null);
    setOverColumn(null);
    if (task) {
      window.dispatchEvent(
        new CustomEvent("atlas:task-status-changed", {
          detail: { taskId: task.id, status: next },
        })
      );
    }
  }

  return (
    <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const columnTasks = effectiveTasks.filter((t) => t.status === column);
        const isOver = overColumn === column;
        return (
          <section
            key={column}
            aria-label={`${getStatusLabel(column)} tasks`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverColumn(column);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverColumn(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(column);
            }}
            className={cn(
              "w-72 shrink-0 rounded-xl transition-colors",
              isOver && "bg-muted/40 ring-1 ring-ring/40"
            )}
          >
            <header className="flex items-center gap-2 px-1 pb-3">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-sm border",
                  column === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
                aria-hidden="true"
              >
                {column === "done" ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </span>
              <h3 className="text-sm font-medium">{getStatusLabel(column)}</h3>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {columnTasks.length}
              </span>
            </header>

            <div className="flex flex-col gap-3">
              {columnTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(task.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", task.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                  className={cn(
                    "group rounded-lg border border-border bg-card p-3.5 transition-all hover:border-muted-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing",
                    draggingId === task.id && "opacity-50"
                  )}
                >
                  <p
                    className={cn(
                      "text-[15px] leading-snug group-hover:text-primary",
                      task.status === "done" && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {task.projectId ? projectName.get(task.projectId) ?? "" : ""}
                    {task.projectId && task.spaceId ? " · " : ""}
                    {task.spaceId ? spaceName.get(task.spaceId) ?? "" : ""}
                  </p>
                  <SourceLine
                    quote={task.quote}
                    sourceDocId={task.sourceDocId}
                    sourceDocTitle={task.sourceDocId ? docTitle?.get(task.sourceDocId) : undefined}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <PriorityDot priority={task.priority} className="mr-1" />
                    <WhoBadge assignee={task.assignee} open={task.status !== "done"} />
                    {task.dueDate ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatShortDate(task.dueDate)}
                      </span>
                    ) : null}
                    <SubtaskInline
                      taskId={task.id}
                      items={itemsByTask?.[task.id] ?? []}
                      brief
                    />
                    {task.assignee ? (
                      <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
                        {initials(task.assignee)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {columnTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}