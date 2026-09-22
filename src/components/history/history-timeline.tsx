"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Project, Space, Task, TaskActivity } from "@/lib/types";
import { Input } from "@/components/ui/input";

function ymd(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (ymd(iso) === ymd(today.toISOString())) return "Today";
  if (ymd(iso) === ymd(y.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function HistoryTimeline({
  activity,
  tasks,
  spaces,
  projects,
}: {
  activity: TaskActivity[];
  tasks: Task[];
  spaces: Space[];
  projects: Project[];
}) {
  const [spaceId, setSpaceId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [query, setQuery] = useState("");

  const projectsInSpaces = useMemo(
    () => (spaceId === "all" ? projects : projects.filter((p) => p.spaceId === spaceId)),
    [projects, spaceId]
  );
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activity.filter((a) => {
      const task = taskById.get(a.taskId);
      if (spaceId !== "all" && task?.spaceId !== spaceId) return false;
      if (projectId !== "all" && task?.projectId !== projectId) return false;
      if (!q) return true;
      const hay = `${task?.title ?? ""} ${a.text} ${a.author}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activity, taskById, spaceId, projectId, query]);

  const groups = useMemo(() => {
    const map = new Map<string, TaskActivity[]>();
    for (const a of filtered) {
      const key = a.createdAt ? ymd(a.createdAt) : "earlier";
      (map.get(key) ?? map.set(key, []).get(key)!).push(a);
    }
    return [...map.entries()].sort((a, b) => (a[0] === "earlier" ? 1 : b[0] === "earlier" ? -1 : b[0].localeCompare(a[0])));
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity…"
            aria-label="Search activity"
            className="pl-9"
          />
        </div>
        <select
          value={spaceId}
          onChange={(e) => {
            setSpaceId(e.target.value);
            setProjectId("all");
          }}
          aria-label="Filter by space"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All spaces</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Filter by project"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All projects</option>
          {projectsInSpaces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No activity matches.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {day === "earlier" ? "Earlier" : dayLabel(day)}
                <span className="ml-2 text-muted-foreground/60">{items.length}</span>
              </h2>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {items.map((a) => {
                  const task = taskById.get(a.taskId);
                  return (
                    <li key={a.id} className="flex items-baseline justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] leading-snug">{a.text}</p>
                        {task ? (
                          <Link
                            href={`/tasks/${task.id}`}
                            className="mt-0.5 inline-block text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          >
                            {task.title}
                          </Link>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground/70">
                        {a.when}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}