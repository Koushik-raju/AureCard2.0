"use client";

import Link from "next/link";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";

/** True when the assignee value refers to the signed-in user (name or email). */
export function isMine(assignee: string | undefined, me: string | undefined): boolean {
  if (!assignee || !me) return false;
  const a = assignee.trim().toLowerCase();
  const m = me.trim().toLowerCase();
  if (!a || !m) return false;
  if (a === m) return true;
  const local = m.split("@")[0];
  return a === local || local.startsWith(a) || a.startsWith(local);
}

/** "who?" flag for open tasks with no owner. */
export function WhoBadge({ assignee, open }: { assignee?: string; open: boolean }) {
  if (assignee || !open) return null;
  return (
    <span
      title="No owner yet"
      className="shrink-0 rounded-full border border-dashed border-muted-foreground/50 px-2 py-0.5 text-[11px] text-muted-foreground"
    >
      who?
    </span>
  );
}

/** Verbatim quote + link back to the source note. Takes IDs/titles only. */
export function SourceLine({
  quote,
  sourceDocId,
  sourceDocTitle,
  className,
}: {
  quote?: string;
  sourceDocId?: string;
  sourceDocTitle?: string;
  className?: string;
}) {
  if (!quote && !sourceDocId) return null;
  return (
    <p className={cn("mt-1 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        {quote ? <span className="italic">“{quote}”</span> : null}
        {quote && sourceDocId ? " " : null}
        {sourceDocId ? (
          <Link
            href={`/docs/${sourceDocId}`}
            className="not-italic underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {sourceDocTitle ? `from ${sourceDocTitle}` : "from note"}
          </Link>
        ) : null}
      </span>
    </p>
  );
}
