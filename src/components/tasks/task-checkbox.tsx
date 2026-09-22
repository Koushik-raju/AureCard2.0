"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";
import { updateTaskStatus } from "@/lib/mutations";
import { setTaskStatus, useTaskStatusOverrides } from "@/lib/session-store";

export function TaskCheckbox({
  taskId,
  status,
  className,
  label,
}: {
  taskId: string;
  status: TaskStatus;
  className?: string;
  label?: string;
}) {
  const overrides = useTaskStatusOverrides();
  const effective = (overrides[taskId] ?? status) as TaskStatus;
  const done = effective === "done";
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next: TaskStatus = done ? "todo" : "done";
    setTaskStatus(taskId, next);
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, next);
        router.refresh();
      } catch {
        setTaskStatus(taskId, done ? "done" : "todo");
      }
    });
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label ?? (done ? "Mark task as not done" : "Mark task as done")}
      disabled={isPending}
      onClick={toggle}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 hover:border-muted-foreground/70",
        className
      )}
    >
      {done ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}