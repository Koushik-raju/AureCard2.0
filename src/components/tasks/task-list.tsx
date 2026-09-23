import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/dates";
import type { Task, TaskItem } from "@/lib/types";
import { TaskCheckbox } from "./task-checkbox";
import { SubtaskInline } from "./subtask-inline";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-[oklch(0.65_0.14_40)]",
  medium: "bg-[oklch(0.7_0.08_70)]",
  low: "bg-[oklch(0.75_0.04_150)]",
};

export function TaskRow({ task, items }: { task: Task; items?: TaskItem[] }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <TaskCheckbox taskId={task.id} status={task.status} />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={cn(
            "truncate text-[15px] leading-snug",
            task.status === "done" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </span>
        {task.priority ? (
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              PRIORITY_DOT[task.priority]
            )}
            aria-label={`${task.priority} priority`}
          />
        ) : null}
      </div>
      <SubtaskInline taskId={task.id} items={items ?? []} />
      {task.dueDate ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatDueDate(task.dueDate)}
        </span>
      ) : null}
    </li>
  );
}

export function TaskList({
  tasks,
  itemsByTask,
}: {
  tasks: Task[];
  itemsByTask?: Record<string, TaskItem[]>;
}) {
  if (tasks.length === 0) {
    return <li className="py-3 text-sm text-muted-foreground">No tasks yet.</li>;
  }
  return (
    <>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} items={itemsByTask?.[task.id]} />
      ))}
    </>
  );
}
