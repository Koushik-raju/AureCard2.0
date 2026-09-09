import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-[oklch(0.65_0.14_40)]",
  medium: "bg-[oklch(0.7_0.08_70)]",
  low: "bg-[oklch(0.75_0.04_150)]",
};

export function TaskRow({ task }: { task: Task }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
          task.status === "done"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40"
        )}
        aria-hidden="true"
      >
        {task.status === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
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
      {task.dueDate ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      ) : null}
    </li>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <li className="py-3 text-sm text-muted-foreground">No tasks yet.</li>;
  }
  return (
    <>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </>
  );
}
