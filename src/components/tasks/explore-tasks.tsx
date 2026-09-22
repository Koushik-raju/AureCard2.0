"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Space, Task, TaskItem, TaskStatus } from "@/lib/types";
import { useTaskStatusOverrides } from "@/lib/session-store";
import { Input } from "@/components/ui/input";
import { GroupedTaskList } from "./grouped-task-list";
import { TaskBoardView } from "./task-board-view";
import { isMine } from "./task-meta";

type StatusFilter = "all" | TaskStatus;
type OwnerFilter = "all" | "mine" | "waiting";
type ViewMode = "list" | "board";

const STATUS_TABS: {
  key: StatusFilter;
  label: string;
  countKey?: "todo" | "inProgress" | "inReview" | "done";
}[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To Do", countKey: "todo" },
  { key: "in-progress", label: "In Progress", countKey: "inProgress" },
  { key: "in-review", label: "In Review", countKey: "inReview" },
  { key: "done", label: "Done", countKey: "done" },
];

type ExploreTasksProps = {
  tasks: Task[];
  projects: Project[];
  spaces: Space[];
  counts: { total: number; todo: number; inProgress: number; inReview: number; done: number };
  itemsByTask?: Record<string, TaskItem[]>;
  currentUserEmail?: string;
  docTitle?: Map<string, string>;
  attachmentCounts?: Map<string, number>;
  commentCounts?: Map<string, number>;
};

const OWNER_TABS: { key: OwnerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "waiting", label: "Waiting on" },
];

export function ExploreTasks({ tasks, projects, spaces, counts, itemsByTask, currentUserEmail, docTitle, attachmentCounts, commentCounts }: ExploreTasksProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [spaceId, setSpaceId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");
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

  const availableProjects = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.projectId).filter(Boolean) as string[]);
    return projects.filter((p) => ids.has(p.id));
  }, [projects, tasks]);

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
        if (owner === "mine" && !isMine(task.assignee, currentUserEmail)) return false;
        if (owner === "waiting" && (!task.assignee || isMine(task.assignee, currentUserEmail))) return false;
        if (spaceId !== "all" && task.spaceId !== spaceId) return false;
        if (projectId !== "all" && task.projectId !== projectId) return false;
        if (q && !task.title.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [tasks, status, owner, currentUserEmail, spaceId, projectId, query, overrides]);

  // Board view exists only for the "All" section; picking a status tab
  // drops back to the list so per-status boards never appear.
  const effectiveView: ViewMode = status === "all" ? view : "list";

  function pickStatus(next: StatusFilter) {
    setStatus(next);
    if (next !== "all") setView("list");
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {effectiveView === "list" ? (
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => pickStatus(tab.key)}
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
          ) : (
            <div />
          )}

          {status === "all" ? (
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
          ) : (
            <span className="text-xs text-muted-foreground">
              Board view lives on the All tab
            </span>
          )}
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
          <div
            role="tablist"
            aria-label="Owner filter"
            className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5"
          >
            {OWNER_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={owner === tab.key}
                onClick={() => setOwner(tab.key)}
                title={tab.key === "mine" && !currentUserEmail ? "Sign in to use Mine" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  owner === tab.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
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
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Filter by project"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All projects</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {effectiveView === "board" ? (
            <span className="text-xs text-muted-foreground sm:ml-auto">
              Drag cards between columns to change status
            </span>
          ) : null}
        </div>
      </div>

      <ActiveFilterPills
        status={status}
        owner={owner}
        spaceName={spaceId === "all" ? null : (spaceName.get(spaceId) ?? null)}
        projectName={projectId === "all" ? null : (projectName.get(projectId) ?? null)}
        query={query.trim()}
        onClearStatus={() => pickStatus("all")}
        onClearOwner={() => setOwner("all")}
        onClearSpace={() => setSpaceId("all")}
        onClearProject={() => setProjectId("all")}
        onClearQuery={() => setQuery("")}
      />

      {effectiveView === "list" ? (
        <GroupedTaskList
          tasks={filtered}
          projectName={projectName}
          spaceName={spaceName}
          itemsByTask={itemsByTask}
          attachmentCounts={attachmentCounts}
          commentCounts={commentCounts}
          collapsedByDefault={["done"]}
        />
      ) : (
        <TaskBoardView tasks={filtered} projectName={projectName} spaceName={spaceName} itemsByTask={itemsByTask} docTitle={docTitle} />
      )}
    </div>
  );
}

function ActiveFilterPills({
  status,
  owner,
  spaceName,
  projectName,
  query,
  onClearStatus,
  onClearOwner,
  onClearSpace,
  onClearProject,
  onClearQuery,
}: {
  status: StatusFilter;
  owner: OwnerFilter;
  spaceName: string | null;
  projectName: string | null;
  query: string;
  onClearStatus: () => void;
  onClearOwner: () => void;
  onClearSpace: () => void;
  onClearProject: () => void;
  onClearQuery: () => void;
}) {
  const pills: { key: string; label: string; value: string; onClear: () => void }[] = [];
  if (status !== "all") {
    pills.push({
      key: "status",
      label: "Status",
      value: STATUS_TABS.find((t) => t.key === status)?.label ?? status,
      onClear: onClearStatus,
    });
  }
  if (owner !== "all") {
    pills.push({
      key: "owner",
      label: "Owner",
      value: OWNER_TABS.find((t) => t.key === owner)?.label ?? owner,
      onClear: onClearOwner,
    });
  }
  if (spaceName) pills.push({ key: "space", label: "Space", value: spaceName, onClear: onClearSpace });
  if (projectName) {
    pills.push({ key: "project", label: "Project", value: projectName, onClear: onClearProject });
  }
  if (query) pills.push({ key: "q", label: "Search", value: `“${query}”`, onClear: onClearQuery });

  if (pills.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 pl-2.5 pr-1 text-xs"
        >
          <span className="text-muted-foreground">{pill.label}:</span>
          <span className="max-w-40 truncate font-medium">{pill.value}</span>
          <button
            type="button"
            onClick={pill.onClear}
            aria-label={`Clear ${pill.label} filter`}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}