"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  Layers,
  List as ListIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import { createFolder, createList } from "@/lib/mutations";
import type { Folder, List, Project, Space } from "@/lib/types";

type TreeTask = {
  id: string;
  spaceId: string;
  projectId: string | null;
  listId: string | null;
  status: string;
};

type TreeData = {
  spaces: Space[];
  projects: Project[];
  folders: Folder[];
  lists: List[];
  tasks: TreeTask[];
};

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = readJson<Record<string, boolean>>(PREF_KEYS.spaceTree, {});
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function taskInFolder(
  t: TreeTask,
  folderId: string,
  listById: Map<string, List>
): boolean {
  if (!t.listId) return false;
  return listById.get(t.listId)?.folderId === folderId;
}

export function SpaceTree() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<TreeData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [addingFolder, setAddingFolder] = useState<string | null>(null);
  const [addingList, setAddingList] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchTree = useCallback(() => {
    fetch("/api/search")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.tree) setData(json.tree);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree, pathname]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeJson(PREF_KEYS.spaceTree, next);
      return next;
    });
  }

  function refresh() {
    router.refresh();
    fetchTree();
  }

  function submitFolder(projectId: string, spaceId: string) {
    const name = newName.trim();
    if (!name || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createFolder({ name, projectId, spaceId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAddingFolder(null);
      setNewName("");
      refresh();
    });
  }

  function submitList(projectId: string, spaceId: string, folderId?: string) {
    const name = newName.trim();
    if (!name || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createList({ name, projectId, spaceId, folderId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAddingList(null);
      setNewName("");
      refresh();
    });
  }

  const activeFolder = searchParams.get("folder");
  const activeList = searchParams.get("list");
  const showTasks = pathname === "/tasks" || pathname.startsWith("/tasks/");

  const tree = useMemo(() => {
    if (!data) return [];
    const listById = new Map(data.lists.map((l) => [l.id, l]));
    const open = data.tasks.filter((t) => t.status !== "done");
    return data.spaces.map((space) => {
      const spaceProjects = data.projects.filter((p) => p.spaceId === space.id);
      return {
        space,
        openCount: open.filter((t) => t.spaceId === space.id).length,
        projects: spaceProjects.map((project) => {
          const projectFolders = data.folders.filter((f) => f.projectId === project.id);
          const looseLists = data.lists.filter(
            (l) => l.projectId === project.id && !l.folderId
          );
          return {
            project,
            openCount: open.filter((t) => t.projectId === project.id).length,
            folders: projectFolders.map((folder) => ({
              folder,
              openCount: open.filter((t) => taskInFolder(t, folder.id, listById)).length,
              lists: data.lists.filter((l) => l.folderId === folder.id),
            })),
            looseLists,
          };
        }),
      };
    });
  }, [data]);

  const openByList = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of data?.tasks ?? []) {
      if (t.status === "done" || !t.listId) continue;
      map.set(t.listId, (map.get(t.listId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  if (collapsed) {
    return (
      <div className="hidden shrink-0 border-r border-border lg:block">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Show spaces panel"
          title="Show spaces panel"
          className="p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    );
  }

  const countBadge = (n: number) =>
    n > 0 ? (
      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {n}
      </span>
    ) : null;

  return (
    <aside
      aria-label="Spaces"
      className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-card/40 lg:flex"
    >
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Spaces
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Hide spaces panel"
          title="Hide spaces panel"
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>
      <nav className="flex-1 px-2 pb-3">
        <Link
          href="/tasks"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            showTasks && !activeFolder && !activeList ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="size-4 shrink-0" />
          All tasks
        </Link>
        {!data ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">Loading spaces…</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {tree.map(({ space, openCount, projects }) => {
              const sOpen = expanded[`s:${space.id}`] ?? true;
              return (
                <li key={space.id}>
                  <div className="group flex items-center gap-1 rounded-md hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => toggle(`s:${space.id}`)}
                      aria-expanded={sOpen}
                      aria-label={`${sOpen ? "Collapse" : "Expand"} ${space.name}`}
                      className="rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {sOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                    <Link
                      href={`/tasks?space=${space.id}`}
                      className="min-w-0 flex-1 truncate rounded py-1.5 pr-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {space.name}
                    </Link>
                    {countBadge(openCount)}
                  </div>
                  {sOpen ? (
                    <ul className="ml-4 space-y-0.5 border-l border-border/60 pl-1">
                      {projects.map(({ project, openCount: pCount, folders, looseLists }) => {
                        const pKey = `p:${project.id}`;
                        const pOpen = expanded[pKey] ?? false;
                        return (
                          <li key={project.id}>
                            <div className="group flex items-center gap-1 rounded-md hover:bg-muted">
                              <button
                                type="button"
                                onClick={() => toggle(pKey)}
                                aria-expanded={pOpen}
                                aria-label={`${pOpen ? "Collapse" : "Expand"} ${project.name}`}
                                className="rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {pOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                              </button>
                              <Link
                                href={`/tasks?project=${project.id}`}
                                className="min-w-0 flex-1 truncate rounded py-1 pr-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {project.name}
                              </Link>
                              {countBadge(pCount)}
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingFolder(project.id);
                                  setAddingList(null);
                                  setNewName("");
                                  setError(null);
                                }}
                                aria-label={`New folder in ${project.name}`}
                                title="New folder"
                                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                            {addingFolder === project.id ? (
                              <form
                                className="ml-5 flex items-center gap-1 py-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  submitFolder(project.id, project.spaceId);
                                }}
                              >
                                <input
                                  value={newName}
                                  onChange={(e) => setNewName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") setAddingFolder(null);
                                  }}
                                  placeholder="Folder name…"
                                  autoFocus
                                  maxLength={80}
                                  aria-label="Folder name"
                                  className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[13px] outline-none focus-visible:border-ring"
                                />
                              </form>
                            ) : null}
                            {pOpen ? (
                              <ul className="ml-4 space-y-0.5 border-l border-border/60 pl-1">
                                {folders.map(({ folder, openCount: fCount, lists }) => {
                                  const fKey = `f:${folder.id}`;
                                  const fOpen = expanded[fKey] ?? false;
                                  const isActive = activeFolder === folder.id && showTasks;
                                  return (
                                    <li key={folder.id}>
                                      <div
                                        className={cn(
                                          "group flex items-center gap-1 rounded-md hover:bg-muted",
                                          isActive && "bg-muted"
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => toggle(fKey)}
                                          aria-expanded={fOpen}
                                          aria-label={`${fOpen ? "Collapse" : "Expand"} ${folder.name}`}
                                          className="rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                          {fOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                        </button>
                                        <Link
                                          href={`/tasks?folder=${folder.id}`}
                                          aria-current={isActive ? "page" : undefined}
                                          className={cn(
                                            "min-w-0 flex-1 truncate rounded py-1 pr-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            isActive && "font-medium"
                                          )}
                                        >
                                          <span className="mr-1 inline-flex items-center gap-1">
                                            <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                            {folder.name}
                                          </span>
                                        </Link>
                                        {countBadge(fCount)}
                                      </div>
                                      {fOpen ? (
                                        <ul className="ml-4 space-y-px border-l border-border/60 pl-1">
                                          {lists.map((list) => {
                                            const lActive = activeList === list.id && showTasks;
                                            return (
                                              <li key={list.id}>
                                                <Link
                                                  href={`/tasks?list=${list.id}`}
                                                  aria-current={lActive ? "page" : undefined}
                                                  className={cn(
                                                    "flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    lActive && "bg-muted font-medium text-foreground"
                                                  )}
                                                >
                                                  <ListIcon className="size-3.5 shrink-0" />
                                                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                                                  {countBadge(openByList.get(list.id) ?? 0)}
                                                </Link>
                                              </li>
                                            );
                                          })}
                                          <li>
                                            {addingList === folder.id ? (
                                              <form
                                                className="flex items-center gap-1 py-1"
                                                onSubmit={(e) => {
                                                  e.preventDefault();
                                                  submitList(project.id, project.spaceId, folder.id);
                                                }}
                                              >
                                                <input
                                                  value={newName}
                                                  onChange={(e) => setNewName(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Escape") setAddingList(null);
                                                  }}
                                                  placeholder="List name…"
                                                  autoFocus
                                                  maxLength={80}
                                                  aria-label="List name"
                                                  className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                                                />
                                              </form>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAddingList(folder.id);
                                                  setAddingFolder(null);
                                                  setNewName("");
                                                  setError(null);
                                                }}
                                                className="flex items-center gap-1 rounded px-1 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                              >
                                                <Plus className="size-3" /> List
                                              </button>
                                            )}
                                          </li>
                                        </ul>
                                      ) : null}
                                    </li>
                                  );
                                })}
                                {looseLists.map((list) => {
                                  const lActive = activeList === list.id && showTasks;
                                  return (
                                    <li key={list.id}>
                                      <Link
                                        href={`/tasks?list=${list.id}`}
                                        aria-current={lActive ? "page" : undefined}
                                        className={cn(
                                          "flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                          lActive && "bg-muted font-medium text-foreground"
                                        )}
                                      >
                                        <ListIcon className="size-3.5 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate">{list.name}</span>
                                        {countBadge(openByList.get(list.id) ?? 0)}
                                      </Link>
                                    </li>
                                  );
                                })}
                                {addingList === `p:${project.id}` ? (
                                  <form
                                    className="flex items-center gap-1 py-1"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      submitList(project.id, project.spaceId);
                                    }}
                                  >
                                    <input
                                      value={newName}
                                      onChange={(e) => setNewName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") setAddingList(null);
                                      }}
                                      placeholder="List name…"
                                      autoFocus
                                      maxLength={80}
                                      aria-label="List name"
                                      className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                                    />
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddingList(`p:${project.id}`);
                                      setAddingFolder(null);
                                      setNewName("");
                                      setError(null);
                                    }}
                                    className="flex items-center gap-1 rounded px-1 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                  >
                                    <Plus className="size-3" /> List
                                  </button>
                                )}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="px-2 pt-2 text-xs text-destructive">{error}</p> : null}
      </nav>
    </aside>
  );
}
