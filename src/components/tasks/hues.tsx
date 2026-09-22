"use client";

import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/lib/types";

/**
 * ClickUp-style hues with explicit light/dark pairs: soft pastels in the
 * light theme, the same hue in a richer/deeper form in the dark theme.
 * Every class is a full literal so Tailwind can generate it.
 */

type Hue = { pill: string };

const HUES: Hue[] = [
  { pill: "bg-red-100 text-red-800 dark:bg-red-500/30 dark:text-red-100" },
  { pill: "bg-orange-100 text-orange-800 dark:bg-orange-500/30 dark:text-orange-100" },
  { pill: "bg-amber-100 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100" },
  { pill: "bg-green-100 text-green-800 dark:bg-green-500/30 dark:text-green-100" },
  { pill: "bg-teal-100 text-teal-800 dark:bg-teal-500/30 dark:text-teal-100" },
  { pill: "bg-blue-100 text-blue-800 dark:bg-blue-500/30 dark:text-blue-100" },
  { pill: "bg-violet-100 text-violet-800 dark:bg-violet-500/30 dark:text-violet-100" },
  { pill: "bg-pink-100 text-pink-800 dark:bg-pink-500/30 dark:text-pink-100" },
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic hue for any label (tags, names). */
export function hueFor(key: string): Hue {
  if (!key) return HUES[5];
  return HUES[hashKey(key.trim().toLowerCase()) % HUES.length];
}

export function statusHue(status: TaskStatus): string {
  switch (status) {
    case "in-progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/30 dark:text-blue-100";
    case "in-review":
      return "bg-amber-100 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100";
    case "done":
      return "bg-green-100 text-green-800 dark:bg-green-500/30 dark:text-green-100";
    default:
      return "bg-stone-200/80 text-stone-700 dark:bg-stone-500/25 dark:text-stone-200";
  }
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Colored initial circle for an assignee. */
export function AssigneeAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        size === "sm" ? "size-5 text-[10px]" : "size-6 text-[11px]",
        hueFor(name).pill
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Colored pill for a tag. */
export function TagPill({ tag }: { tag: string }) {
  return (
    <span className={cn("truncate rounded px-1.5 py-px text-[11px] font-medium", hueFor(tag).pill)}>
      {tag}
    </span>
  );
}

/** Flag glyph for priority (red/amber/green like ClickUp). */
export function PriorityFlag({ priority, className }: { priority?: TaskPriority; className?: string }) {
  if (!priority) return null;
  return (
    <Flag
      aria-label={`${priority} priority`}
      fill="currentColor"
      className={cn(
        "size-3.5 shrink-0",
        priority === "high" && "text-red-500 dark:text-red-400",
        priority === "medium" && "text-amber-500 dark:text-amber-400",
        priority === "low" && "text-emerald-500 dark:text-emerald-400",
        className
      )}
    />
  );
}
