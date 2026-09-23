import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/dates";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export function PriorityDot({
  priority,
  className,
}: {
  priority?: TaskPriority;
  className?: string;
}) {
  if (!priority) return null;
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        priority === "high" && "bg-[oklch(0.65_0.14_40)]",
        priority === "medium" && "bg-[oklch(0.7_0.08_70)]",
        priority === "low" && "bg-[oklch(0.72_0.05_150)]",
        className
      )}
      aria-label={`${priority} priority`}
    />
  );
}

export function StatusIndicator({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
        status === "done"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={"size-3 " + (status === "done" ? "opacity-100" : "opacity-0")}
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function formatShortDate(date?: string): string {
  return formatDueDate(date);
}