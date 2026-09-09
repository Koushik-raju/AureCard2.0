"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { PriorityDot, StatusIndicator, formatShortDate } from "./task-visuals";

type TaskListViewProps = {
  tasks: Task[];
  projectName: Map<string, string>;
  spaceName: Map<string, string>;
};

export function TaskListView({ tasks, projectName, spaceName }: TaskListViewProps) {
  return (
    <ul className="mt-6 divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/tasks/${task.id}`}
            className="group flex items-center gap-3 rounded-sm py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatusIndicator status={task.status} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-[15px] leading-snug group-hover:text-primary",
                  task.status === "done" && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {getStatusLabel(task.status)}
                {task.projectId ? ` · ${projectName.get(task.projectId) ?? ""}` : ""}
                {task.spaceId ? ` · ${spaceName.get(task.spaceId) ?? ""}` : ""}
                {task.assignee ? ` · ${task.assignee}` : ""}
              </p>
            </div>
            <PriorityDot priority={task.priority} />
            {task.dueDate ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatShortDate(task.dueDate)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
      {tasks.length === 0 ? (
        <li className="py-10 text-center text-sm text-muted-foreground">
          No tasks match your filters.
        </li>
      ) : null}
    </ul>
  );
}