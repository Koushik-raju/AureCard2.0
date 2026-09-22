"use client";

import Link from "next/link";
import { Check, CircleDot, Eye, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";
import { useTaskStatusOverrides } from "@/lib/session-store";

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  todo: CircleDot,
  "in-progress": Play,
  "in-review": Eye,
  done: Check,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "text-muted-foreground",
  "in-progress": "text-primary",
  "in-review": "text-amber-600",
  done: "text-foreground",
};

export function LinkedTaskChip({ task }: { task: Task }) {
  const overrides = useTaskStatusOverrides();
  const status = overrides[task.id] ?? task.status;
  const Icon = STATUS_ICON[status];

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className={cn("size-3.5 shrink-0", STATUS_COLOR[status])} />
      <span className="truncate">{task.title}</span>
    </Link>
  );
}