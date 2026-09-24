"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  Layers,
  Link2,
  List as ListIcon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import {
  createFolder,
  createList,
  deleteFolder,
  deleteList,
  deleteProject,
  deleteSpace,
  duplicateFolder,
  duplicateList,
  moveFolder,
  moveList,
  renameFolder,
  renameList,
  updateProject,
  updateSpace,
} from "@/lib/mutations";
import { Dropdown, MenuItem } from "@/components/create/entity-menu";
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

const PANEL_MIN = 180;
const PANEL_MAX = 420;
const PANEL_DEFAULT = 240;

function loadPanelWidth(): number {
  try {
    const raw = readJson<{ width?: number }>(PREF_KEYS.spaceTreeWidth, {});
    const w = typeof raw.width === "number" ? raw.width : PANEL_DEFAULT;
    return Math.min(PANEL_MAX, Math.max(PANEL_MIN, w));
  } catch {
    return PANEL_DEFAULT;
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

type MenuTarget =
  | { kind: "space"; id: string; name: string }
  | { kind: "project"; id: string; name: string; spaceId: string }
  | { kind: "folder"; id: string; name: string; projectId: string; spaceId: string }
  | { kind: "list"; id: string; name: string; projectId: string; spaceId: string; folderId?: string };

function targetHref(target: MenuTarget): string {
  switch (target.kind) {
    case "space":
      return `/spaces/${target.id}`;
    case "project":
      return `/projects/${target.id}`;
    case "folder":
      return `/tasks?folder=${target.id}`;
    case "list":
      return `/tasks?list=${target.id}`;
  }
}

function TreeNodeMenu({
  target,
  projects,
  folders,
  open,
  onOpenChange,
  onChanged,
}: {
  target: MenuTarget;
  projects: Project[];
  folders: Folder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "rename" | "move" | "confirm">(null);
  const [name, setName] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, startTransition] = useTransition();

  function run(promise: Promise<{ error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        setError(result.error);
        return;
      }
      setMode(null);
      after?.();
      onChanged();
    });
  }

  const [error, setError] = useState<string | null>(null);

  function openMode(next: "rename" | "move" | "confirm") {
    setName(target.name);
    setMoveTo("");
    setError(null);
    setCopied(false);
    setMode(next);
  }

  function saveRename() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (target.kind === "space") run(updateSpace({ id: target.id, name: trimmed }));
    else if (target.kind === "project") run(updateProject({ id: target.id, name: trimmed }));
    else if (target.kind === "folder") run(renameFolder(target.id, trimmed));
    else run(renameList(target.id, trimmed));
  }

  function confirmDelete() {
    if (target.kind === "space") run(deleteSpace(target.id));
    else if (target.kind === "project") run(deleteProject(target.id));
    else if (target.kind === "folder") run(deleteFolder(target.id));
    else run(deleteList(target.id));
  }

  function doDuplicate() {
    if (target.kind === "folder") run(duplicateFolder(target.id));
    else if (target.kind === "list") run(duplicateList(target.id));
  }

  function doMove() {
    if (target.kind === "list") run(moveList(target.id, moveTo || null));
    else if (target.kind === "folder" && moveTo) run(moveFolder(target.id, moveTo));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${targetHref(target)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy link.");
    }
  }

  const moveOptions =
    target.kind === "list"
      ? folders
          .filter((f) => f.projectId === target.projectId && f.id !== target.folderId)
          .map((f) => ({ value: f.id, label: f.name }))
      : target.kind === "folder"
        ? projects
            .filter((p) => p.spaceId === target.spaceId && p.id !== target.projectId)
            .map((p) => ({ value: p.id, label: p.name }))
        : [];
  const destructiveHint =
    target.kind === "space"
      ? "Deletes the space with all projects, folders, lists and tasks inside. This can't be undone."
      : target.kind === "project"
        ? "Deletes the project with its folders, lists and tasks. This can't be undone."
        : target.kind === "folder"
          ? "Deletes the folder with its lists and tasks. This can't be undone."
          : "Deletes the list with its tasks. This can't be undone.";

  return (
    <Dropdown
      align="left"
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setMode(null);
          setCopied(false);
        }
      }}
      trigger={
        <span
          role="button"
          tabIndex={0}
          aria-label={`Actions for ${target.name}`}
          title="Actions"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(!open);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(!open);
            }
          }}
          className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </span>
      }
    >
      {mode === null ? (
        <>
          <MenuItem icon={<Pencil className="size-4" />} closeOnClick={false} onClick={() => openMode("rename")}>
            Rename
          </MenuItem>
          <MenuItem
            icon={copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            closeOnClick={false}
            onClick={() => void copyLink()}
          >
            {copied ? "Copied!" : "Copy link"}
          </MenuItem>
          {target.kind === "list" ? (
            <MenuItem
              icon={<Plus className="size-4" />}
              onClick={() => router.push(`/tasks?list=${target.id}`)}
            >
              New task here
            </MenuItem>
          ) : null}
          {target.kind === "folder" || target.kind === "list" ? (
            <MenuItem icon={<Copy className="size-4" />} closeOnClick={false} onClick={doDuplicate}>
              Duplicate
            </MenuItem>
          ) : null}
          {moveOptions.length > 0 ? (
            <MenuItem icon={<ArrowRightLeft className="size-4" />} closeOnClick={false} onClick={() => openMode("move")}>
              Move to…
            </MenuItem>
          ) : null}
          <MenuItem icon={<Trash2 className="size-4" />} danger closeOnClick={false} onClick={() => openMode("confirm")}>
            Delete
          </MenuItem>
        </>
      ) : null}
      {mode === "rename" ? (
        <form
          className="flex items-center gap-1 p-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            saveRename();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={80}
            aria-label="New name"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[13px] outline-none focus-visible:border-ring"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </form>
      ) : null}
      {mode === "move" ? (
        <div className="flex flex-col gap-1 p-0.5">
          {target.kind === "list" ? (
            <button
              type="button"
              onClick={() => {
                setMoveTo("");
                doMove();
              }}
              className="rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
            >
              Project root (no folder)
            </button>
          ) : null}
          {moveOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setMoveTo(o.value);
                if (target.kind === "list") run(moveList(target.id, o.value));
                else run(moveFolder(target.id, o.value));
              }}
              className="rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
      {mode === "confirm" ? (
        <div className="p-1.5">
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">{destructiveHint}</p>
          {error ? <p className="px-1 pt-1 text-xs text-destructive">{error}</p> : null}
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
      {mode !== "confirm" && error ? (
        <p className="px-2 py-1 text-xs text-destructive">{error}</p>
      ) : null}
    </Dropdown>
  );
}

export function SpaceTree() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<TreeData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => loadPanelWidth());
  const [addingFolder, setAddingFolder] = useState<string | null>(null);
  const [addingList, setAddingList] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

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

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };
    const move = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(
        PANEL_MAX,
        Math.max(PANEL_MIN, drag.startWidth + (ev.clientX - drag.startX))
      );
      drag.startWidth = next;
      drag.startX = ev.clientX;
      setPanelWidth(next);
      writeJson(PREF_KEYS.spaceTreeWidth, { width: next });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <aside
      aria-label="Spaces"
      style={{ width: panelWidth }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-border bg-card/40 lg:flex relative"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize spaces panel"
        title="Drag to resize"
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize touch-none transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:bg-primary/40"
      />
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
                  <div
                    className="group flex items-center gap-1 rounded-md hover:bg-muted"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuFor(`s:${space.id}`);
                    }}
                  >
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
                    <TreeNodeMenu
                      target={{ kind: "space", id: space.id, name: space.name }}
                      projects={data?.projects ?? []}
                      folders={data?.folders ?? []}
                      open={menuFor === `s:${space.id}`}
                      onOpenChange={(o) => setMenuFor(o ? `s:${space.id}` : null)}
                      onChanged={refresh}
                    />
                  </div>
                  {sOpen ? (
                    <ul className="ml-4 space-y-0.5 border-l border-border/60 pl-1">
                      {projects.map(({ project, openCount: pCount, folders, looseLists }) => {
                        const pKey = `p:${project.id}`;
                        const pOpen = expanded[pKey] ?? false;
                        return (
                          <li key={project.id}>
                            <div
                              className="group flex items-center gap-1 rounded-md hover:bg-muted"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setMenuFor(`p:${project.id}`);
                              }}
                            >
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
                              <TreeNodeMenu
                                target={{ kind: "project", id: project.id, name: project.name, spaceId: project.spaceId }}
                                projects={data?.projects ?? []}
                                folders={data?.folders ?? []}
                                open={menuFor === `p:${project.id}`}
                                onOpenChange={(o) => setMenuFor(o ? `p:${project.id}` : null)}
                                onChanged={refresh}
                              />
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
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          setMenuFor(`f:${folder.id}`);
                                        }}
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
                                        <TreeNodeMenu
                                          target={{ kind: "folder", id: folder.id, name: folder.name, projectId: project.id, spaceId: project.spaceId }}
                                          projects={data?.projects ?? []}
                                          folders={data?.folders ?? []}
                                          open={menuFor === `f:${folder.id}`}
                                          onOpenChange={(o) => setMenuFor(o ? `f:${folder.id}` : null)}
                                          onChanged={refresh}
                                        />
                                      </div>
                                      {fOpen ? (
                                        <ul className="ml-4 space-y-px border-l border-border/60 pl-1">
                                          {lists.map((list) => {
                                            const lActive = activeList === list.id && showTasks;
                                            return (
                                              <li key={list.id}>
                                                <div
                                                  className={cn(
                                                    "group flex items-center gap-1 rounded-md hover:bg-muted",
                                                    lActive && "bg-muted"
                                                  )}
                                                  onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setMenuFor(`l:${list.id}`);
                                                  }}
                                                >
                                                  <Link
                                                    href={`/tasks?list=${list.id}`}
                                                    aria-current={lActive ? "page" : undefined}
                                                    className={cn(
                                                      "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                      lActive && "font-medium text-foreground"
                                                    )}
                                                  >
                                                    <ListIcon className="size-3.5 shrink-0" />
                                                    <span className="min-w-0 flex-1 truncate">{list.name}</span>
                                                    {countBadge(openByList.get(list.id) ?? 0)}
                                                  </Link>
                                                  <TreeNodeMenu
                                                    target={{ kind: "list", id: list.id, name: list.name, projectId: project.id, spaceId: project.spaceId, folderId: folder.id }}
                                                    projects={data?.projects ?? []}
                                                    folders={data?.folders ?? []}
                                                    open={menuFor === `l:${list.id}`}
                                                    onOpenChange={(o) => setMenuFor(o ? `l:${list.id}` : null)}
                                                    onChanged={refresh}
                                                  />
                                                </div>
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
                                      <div
                                        className={cn(
                                          "group flex items-center gap-1 rounded-md hover:bg-muted",
                                          lActive && "bg-muted"
                                        )}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          setMenuFor(`l:${list.id}`);
                                        }}
                                      >
                                        <Link
                                          href={`/tasks?list=${list.id}`}
                                          aria-current={lActive ? "page" : undefined}
                                          className={cn(
                                            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            lActive && "font-medium text-foreground"
                                          )}
                                        >
                                          <ListIcon className="size-3.5 shrink-0" />
                                          <span className="min-w-0 flex-1 truncate">{list.name}</span>
                                          {countBadge(openByList.get(list.id) ?? 0)}
                                        </Link>
                                        <TreeNodeMenu
                                          target={{ kind: "list", id: list.id, name: list.name, projectId: project.id, spaceId: project.spaceId }}
                                          projects={data?.projects ?? []}
                                          folders={data?.folders ?? []}
                                          open={menuFor === `l:${list.id}`}
                                          onOpenChange={(o) => setMenuFor(o ? `l:${list.id}` : null)}
                                          onChanged={refresh}
                                        />
                                      </div>
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
