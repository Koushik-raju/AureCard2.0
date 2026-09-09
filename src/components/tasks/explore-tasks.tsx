"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Space, Task, TaskStatus } from "@/lib/types";
import { useTaskStatusOverrides } from "@/lib/session-store";
import { Input } from "@/components/ui/input";
import { TaskListView } from "./task-list-view";
import { TaskBoardView } from "./task-board-view";

type StatusFilter = "all" | TaskStatus;
type ViewMode = "list" | "board";

const STATUS_TABS: {
  key: StatusFilter;
  label: string;
  countKey?: "todo" | "inProgress" | "done";
}[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To Do", countKey: "todo" },
  { key: "in-progress", label: "In Progress", countKey: "inProgress" },
  { key: "done", label: "Done", countKey: "done" },
];

type ExploreTasksProps = {
  tasks: Task[];
  projects: Project[];
  spaces: Space[];
  counts: { total: number; todo: number; inProgress: number; done: number };
};

export function ExploreTasks({ tasks, projects, spaces, counts }: ExploreTasksProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [spaceId, setSpaceId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const overrides = useTaskStatusOverrides();

  const projectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const spaceName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of spaces) map.set(s.id, s.name);
    return map;
  }, [spaces]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .map((task) =>
        overrides[task.id]
          ? { ...task, status: overrides[task.id] }
          : task
      )
      .filter((task) => {
        if (status !== "all" && task.status !== status) return false;
        if (spaceId !== "all" && task.spaceId !== spaceId) return false;
        if (q && !task.title.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [tasks, status, spaceId, query, overrides]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === tab.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">
                  {tab.countKey ? counts[tab.countKey] : counts.total}
                </span>
              </button>
            ))}
          </div>

          <div
            role="tablist"
            aria-label="Task view"
            className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5"
          >
            <button
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              role="tab"
              aria-selected={view === "board"}
              onClick={() => setView("board")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === "board" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="pl-9"
            />
          </div>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            aria-label="Filter by space"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All spaces</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "list" ? (
        <TaskListView tasks={filtered} projectName={projectName} spaceName={spaceName} />
      ) : (
        <TaskBoardView tasks={filtered} projectName={projectName} spaceName={spaceName} />
      )}
    </div>
  );
}