import type { DocumentRef, Project, Space, Task } from "@/lib/types";
import { resolveDocType } from "@/lib/doc-type";

export type MindNodeKind = "space" | "project" | "doc" | "topic" | "recording" | "image" | "file" | "note";

/** Node kinds that represent a library document (styled like docs). */
export const DOC_NODE_KINDS: ReadonlySet<MindNodeKind> = new Set([
  "doc",
  "recording",
  "image",
  "file",
  "note",
]);

export type MindNode = {
  id: string;
  label: string;
  kind: MindNodeKind;
  depth: number;
  /** True when this subject spans more than one recording (amber branch). */
  shared: boolean;
  href?: string;
  x: number;
  y: number;
};

export type MindEdge = { from: string; to: string };

export type MindGraph = { nodes: MindNode[]; edges: MindEdge[] };

const X_GAP = 280;
const Y_GAP = 84;

function layout(nodes: MindNode[]): MindNode[] {
  const byDepth = new Map<number, MindNode[]>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }
  return nodes.map((node) => {
    const siblings = byDepth.get(node.depth) ?? [node];
    const index = siblings.indexOf(node);
    return {
      ...node,
      x: 140 + node.depth * X_GAP,
      y: 60 + index * Y_GAP,
    };
  });
}

export function buildMindGraph(input: {
  spaces: Space[];
  projects: Project[];
  documents: DocumentRef[];
  tasks: Task[];
  /** Attachment mimes per document id, for telling recordings from images. */
  mediaMimes?: Record<string, string[]>;
}): MindGraph {
  const { spaces, projects, documents, tasks } = input;
  const nodes: MindNode[] = [];
  const edges: MindEdge[] = [];

  // Tag usage across tasks: a topic is "shared" when ≥2 tasks carry it.
  const tagUse = new Map<string, number>();
  for (const task of tasks) {
    for (const raw of task.tags ?? []) {
      const tag = raw.trim();
      if (tag) tagUse.set(tag, (tagUse.get(tag) ?? 0) + 1);
    }
  }
  const sharedTags = new Set(
    [...tagUse.entries()].filter(([, n]) => n >= 2).map(([tag]) => tag)
  );

  const taskTags = new Map<string, Set<string>>();
  for (const task of tasks) {
    taskTags.set(
      task.id,
      new Set((task.tags ?? []).map((t) => t.trim()).filter(Boolean))
    );
  }
  const docShared = (doc: DocumentRef): boolean => {
    const linked = tasks.filter(
      (t) => t.sourceDocId === doc.id || doc.taskIds?.includes(t.id)
    );
    return linked.some((t) =>
      [...(taskTags.get(t.id) ?? [])].some((tag) => sharedTags.has(tag))
    );
  };

  for (const space of spaces) {
    nodes.push({ id: `space:${space.id}`, label: space.name, kind: "space", depth: 0, shared: false, href: `/spaces/${space.id}`, x: 0, y: 0 });
  }
  for (const project of projects) {
    nodes.push({ id: `project:${project.id}`, label: project.name, kind: "project", depth: 1, shared: false, href: `/projects/${project.id}`, x: 0, y: 0 });
    edges.push({ from: `space:${project.spaceId}`, to: `project:${project.id}` });
  }
  const docsBySpace = new Map<string, DocumentRef[]>();
  for (const doc of documents) {
    const list = docsBySpace.get(doc.spaceId) ?? [];
    list.push(doc);
    docsBySpace.set(doc.spaceId, list);
    const shared = docShared(doc);
    const kind: MindNodeKind =
      doc.kind === "file"
        ? resolveDocType(doc, input.mediaMimes?.[doc.id] ?? [])
        : "note";
    nodes.push({
      id: `doc:${doc.id}`,
      label: doc.title,
      kind,
      depth: 2,
      shared,
      href: `/docs/${doc.id}`,
      x: 0,
      y: 0,
    });
    if (doc.projectId) {
      edges.push({ from: `project:${doc.projectId}`, to: `doc:${doc.id}` });
    } else {
      edges.push({ from: `space:${doc.spaceId}`, to: `doc:${doc.id}` });
    }
  }
  for (const tag of sharedTags) {
    const id = `topic:${tag}`;
    nodes.push({ id, label: tag, kind: "topic", depth: 3, shared: true, x: 0, y: 0 });
    for (const doc of documents) {
      const linked = tasks.filter(
        (t) => t.sourceDocId === doc.id || doc.taskIds?.includes(t.id)
      );
      if (linked.some((t) => taskTags.get(t.id)?.has(tag))) {
        edges.push({ from: `doc:${doc.id}`, to: id });
      }
    }
  }

  return { nodes: layout(nodes), edges };
}
