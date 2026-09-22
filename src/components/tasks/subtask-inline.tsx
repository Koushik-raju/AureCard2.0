"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskItem, TaskPriority } from "@/lib/types";
import { updateTaskItemDone } from "@/lib/mutations";

function priorityLabel(p: TaskPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function SubtaskInline({
  taskId,
  items,
  brief = false,
  className,
}: {
  taskId: string;
  items: TaskItem[];
  brief?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (total === 0) return null;

  const label = `${done}/${total} subtasks`;

  if (brief) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground",
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <div className={cn("shrink-0", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label="Toggle subtasks"
        className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        {label}
      </button>
      {open ? (
        <ul className="mt-1.5 min-w-52 space-y-1 rounded-lg border border-border bg-card p-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.title}
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startTransition(async () => {
                    try {
                      await updateTaskItemDone(taskId, item.id, !item.done);
                      router.refresh();
                    } catch {
                      /* keep local state; refresh on next visit */
                    }
                  });
                }}
                className={cn(
                  "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  item.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-primary"
                )}
              >
                {item.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </button>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-xs leading-relaxed",
                    item.done && "text-muted-foreground line-through"
                  )}
                >
                  {item.title}
                </span>
                {(item.assignee || item.dueDate || item.priority) && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {[item.assignee, item.dueDate, item.priority ? priorityLabel(item.priority) : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}