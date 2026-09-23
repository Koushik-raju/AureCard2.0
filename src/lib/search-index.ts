import type {
  Accent,
  DocumentBlock,
  DocumentRef,
  Folder,
  List,
  Project,
  Space,
  Task,
  TaskComment,
} from "@/lib/types";
import { LIBRARY_TYPE_LABEL, resolveDocType } from "@/lib/doc-type";
import { getStatusLabel } from "@/lib/data";

export type SearchEntry = {
  id: string;
  category:
    | "task"
    | "document"
    | "note"
    | "project"
    | "space"
    | "list"
    | "folder"
    | "comment";
  title: string;
  subtitle?: string;
  href: string;
  accent?: Accent;
  match: string;
};

export type SearchIndexInput = {
  spaces: Space[];
  projects: Project[];
  lists: List[];
  folders: Folder[];
  tasks: Task[];
  documents: DocumentRef[];
  blocks: DocumentBlock[];
  comments: TaskComment[];
  /** Attachment mimes per document id (for Recording/Image/File labels). */
  mediaMimes?: Record<string, string[]>;
};

/** The same workspace index behind /search — reused by the ⌘K palette. */
export function buildSearchEntries(input: SearchIndexInput): SearchEntry[] {
  const { spaces, projects, lists, folders, tasks, documents, blocks, comments } = input;
  const mediaMimes = (id: string) => input.mediaMimes?.[id] ?? [];
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const spaceAccent = new Map(spaces.map((s) => [s.id, s.accent]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const docBlocks = new Map<string, string>();
  for (const b of blocks) {
    docBlocks.set(b.documentId, (docBlocks.get(b.documentId) ?? "") + " " + b.text);
  }

  return [
    ...tasks.map((t) => {
      const statusLabel = getStatusLabel(t.status);
      const owners =
        t.assignees && t.assignees.length > 0 ? t.assignees : t.assignee ? [t.assignee] : [];
      return {
        id: t.id,
        category: "task" as const,
        title: t.title,
        subtitle: [
          spaceName.get(t.spaceId),
          t.projectId ? projectName.get(t.projectId) : undefined,
          owners.length > 0 ? `@${owners.join(", @")}` : undefined,
          statusLabel,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/tasks/${t.id}`,
        accent: spaceAccent.get(t.spaceId),
        match: [
          t.title,
          t.description,
          t.tags?.join(" "),
          owners.join(" "),
          spaceName.get(t.spaceId),
          t.projectId ? projectName.get(t.projectId) : undefined,
          t.listId ? listName.get(t.listId) : undefined,
          statusLabel,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }),
    ...documents.map((d) => {
      const linkedTasks = (d.taskIds ?? [])
        .map((id) => taskTitle.get(id))
        .filter((n): n is string => Boolean(n));
      const typeLabel = LIBRARY_TYPE_LABEL[resolveDocType(d, mediaMimes(d.id))];
      return {
        id: d.id,
        category: (d.kind === "note" ? "note" : "document") as SearchEntry["category"],
        title: d.title,
        subtitle: [typeLabel, spaceName.get(d.spaceId), d.projectId ? projectName.get(d.projectId) : undefined]
          .filter(Boolean)
          .join(" · "),
        href: `/docs/${d.id}`,
        accent: spaceAccent.get(d.spaceId),
        match: [
          d.title,
          typeLabel,
          spaceName.get(d.spaceId),
          d.projectId ? projectName.get(d.projectId) : undefined,
          docBlocks.get(d.id),
          linkedTasks.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
      };
    }),
    ...projects.map((p) => ({
      id: p.id,
      category: "project" as const,
      title: p.name,
      subtitle: spaceName.get(p.spaceId),
      href: `/projects/${p.id}`,
      accent: spaceAccent.get(p.spaceId),
      match: [p.name, p.description, spaceName.get(p.spaceId)].filter(Boolean).join(" "),
    })),
    ...spaces.map((s) => ({
      id: s.id,
      category: "space" as const,
      title: s.name,
      subtitle: s.description,
      href: `/spaces/${s.id}`,
      accent: s.accent as SearchEntry["accent"],
      match: [s.name, s.description].join(" "),
    })),
    ...lists.map((l) => ({
      id: l.id,
      category: "list" as const,
      title: l.name,
      subtitle: projectName.get(l.projectId),
      href: `/projects/${l.projectId}`,
      accent: spaceAccent.get(l.spaceId),
      match: [l.name, projectName.get(l.projectId), spaceName.get(l.spaceId)].filter(Boolean).join(" "),
    })),
    ...folders.map((f) => ({
      id: f.id,
      category: "folder" as const,
      title: f.name,
      subtitle: projectName.get(f.projectId),
      href: `/projects/${f.projectId}`,
      accent: undefined,
      match: [f.name, projectName.get(f.projectId)].filter(Boolean).join(" "),
    })),
    ...comments.map((c) => ({
      id: c.id,
      category: "comment" as const,
      title: c.text,
      subtitle: `${c.author} · on ${taskTitle.get(c.taskId) ?? "a task"}`,
      href: `/tasks/${c.taskId}`,
      match: [c.text, c.author, taskTitle.get(c.taskId)].filter(Boolean).join(" "),
    })),
  ];
}

/** Case-insensitive substring match — the same rule as the /search page. */
export function filterSearchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries.filter((e) => e.match.toLowerCase().includes(q));
}
