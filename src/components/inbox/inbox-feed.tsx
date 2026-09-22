"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AtSign, CalendarClock, ListTodo, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export type InboxItem = {
  id: string;
  kind: "assignment" | "comment" | "due" | "activity";
  title: string;
  detail: string;
  href: string;
  when: string;
  ts: number;
};

const KIND_META = {
  assignment: { label: "Assignment", icon: ListTodo },
  comment: { label: "Comment", icon: MessagesSquare },
  due: { label: "Due", icon: CalendarClock },
  activity: { label: "Activity", icon: AtSign },
} as const;

type Filter = "all" | "unread" | "assignment" | "comment" | "due";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "assignment", label: "Assignments" },
  { value: "comment", label: "Comments" },
  { value: "due", label: "Due" },
];

function loadRead(): string[] {
  const raw = readJson<{ ids: string[] }>(PREF_KEYS.inboxRead, { ids: [] });
  return Array.isArray(raw.ids) ? raw.ids : [];
}

export function InboxFeed({ items }: { items: InboxItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [readIds, setReadIds] = useState<string[]>(loadRead);
  const read = useMemo(() => new Set(readIds), [readIds]);

  const unreadCount = items.filter((i) => !read.has(i.id)).length;

  const visible = items.filter((item) => {
    if (filter === "unread") return !read.has(item.id);
    if (filter === "all") return true;
    return item.kind === filter;
  });

  function markAllRead() {
    const ids = items.map((i) => i.id);
    setReadIds(ids);
    writeJson(PREF_KEYS.inboxRead, { ids });
  }

  function toggleRead(id: string) {
    setReadIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeJson(PREF_KEYS.inboxRead, { ids: next });
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter inbox">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === f.value
                ? "border-foreground bg-muted text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            {f.value === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          Mark all read
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Nothing here yet — assignments, mentions and due dates land in this feed."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const unread = !read.has(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border bg-card p-4",
                  unread && "border-l-4 border-l-primary"
                )}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.when}</span>
                  </div>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (unread) toggleRead(item.id);
                    }}
                    className="mt-0.5 block truncate text-[15px] font-medium hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRead(item.id)}
                  aria-pressed={!unread}
                  className="shrink-0"
                >
                  {unread ? "Mark read" : "Unread"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
