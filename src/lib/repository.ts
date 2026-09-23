import type {
  DocumentAttachment,
  DocumentBlock,
  DocumentRef,
  Folder,
  List,
  Project,
  Space,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskItem,
} from "@/lib/types";
import { createServerSupabase, isDbConfigured } from "@/lib/server-supabase";
import * as memory from "@/lib/data";

type Row = Record<string, unknown>;

function mapSpace(r: Row): Space {
  return { id: String(r.id), name: String(r.name), description: String(r.description), accent: r.accent as Space["accent"] };
}

function mapProject(r: Row): Project {
  return { id: String(r.id), name: String(r.name), spaceId: String(r.space_id), description: r.description ? String(r.description) : undefined };
}

function mapFolder(r: Row): Folder {
  return { id: String(r.id), name: String(r.name), projectId: String(r.project_id), spaceId: String(r.space_id) };
}

function mapList(r: Row): List {
  return {
    id: String(r.id),
    name: String(r.name),
    folderId: r.folder_id ? String(r.folder_id) : undefined,
    projectId: String(r.project_id),
    spaceId: String(r.space_id),
  };
}

function mapTask(r: Row): Task {
  const rawAssignees = Array.isArray(r.assignees)
    ? (r.assignees as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : [];
  const legacy = r.assignee ? String(r.assignee).trim() : "";
  // Support legacy "A, B" strings stored in the single-assignee column.
  const legacyList = legacy
    ? legacy
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const assignees = rawAssignees.length > 0 ? rawAssignees : legacyList;
  return {
    id: String(r.id),
    title: String(r.title),
    spaceId: String(r.space_id),
    projectId: r.project_id ? String(r.project_id) : undefined,
    listId: r.list_id ? String(r.list_id) : undefined,
    status: (r.status ?? "todo") as Task["status"],
    priority: r.priority ? (r.priority as Task["priority"]) : undefined,
    assignee: assignees[0] ?? (legacy || undefined),
    assignees: assignees.length > 0 ? assignees : undefined,
    tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : undefined,
    dueDate: r.due_date ? String(r.due_date) : undefined,
    startDate: r.start_date ? String(r.start_date) : undefined,
    description: r.description ? String(r.description) : undefined,
    quote: r.quote ? String(r.quote) : undefined,
    sourceDocId: r.source_doc_id ? String(r.source_doc_id) : undefined,
  };
}

function mapItem(r: Row): TaskItem {
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    parentId: r.parent_id ? String(r.parent_id) : undefined,
    title: String(r.title),
    done: Boolean(r.done),
    assignee: r.assignee ? String(r.assignee) : undefined,
    dueDate: r.due_date ? String(r.due_date) : undefined,
    priority: r.priority ? (r.priority as TaskItem["priority"]) : undefined,
    description: r.description ? String(r.description) : undefined,
  };
}

function mapComment(r: Row): TaskComment {
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    author: String(r.author),
    text: String(r.text),
    createdAt: String(r.created_at),
  };
}

function mapActivity(r: Row): TaskActivity {
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    author: r.author ? String(r.author) : "System",
    text: String(r.text),
    when: String(r.when),
    createdAt: r.created_at ? String(r.created_at) : undefined,
  };
}

const RECORDING_TYPES = new Set(["meeting", "call", "thought", "lecture", "conversation"]);
const NOTE_TYPES = new Set(["general", "meeting", "soap"]);

function mapDocument(r: Row): DocumentRef {
  return {
    id: String(r.id),
    title: String(r.title),
    spaceId: String(r.space_id),
    projectId: r.project_id ? String(r.project_id) : undefined,
    kind: (r.kind ?? "doc") as DocumentRef["kind"],
    taskIds: Array.isArray(r.task_ids) ? r.task_ids.map((t) => String(t)) : undefined,
    sourceDocId: r.source_doc_id ? String(r.source_doc_id) : undefined,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    recordingType: typeof r.recording_type === "string" && RECORDING_TYPES.has(r.recording_type)
      ? (r.recording_type as DocumentRef["recordingType"])
      : undefined,
    durationSecs: r.duration_secs !== null && r.duration_secs !== undefined ? Number(r.duration_secs) : undefined,
    summary: r.summary ? String(r.summary) : undefined,
    noteType: typeof r.note_type === "string" && NOTE_TYPES.has(r.note_type)
      ? (r.note_type as DocumentRef["noteType"])
      : undefined,
  };
}

function mapBlock(r: Row): DocumentBlock {
  return {
    id: String(r.id),
    documentId: String(r.document_id),
    type: (r.type ?? "paragraph") as DocumentBlock["type"],
    text: String(r.text ?? ""),
    checked: Boolean(r.checked),
    taskId: r.task_id ? String(r.task_id) : undefined,
  };
}

function mapAttachment(r: Row): TaskAttachment {
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    kind: (r.kind ?? "link") as TaskAttachment["kind"],
    url: String(r.url),
    label: r.label ? String(r.label) : undefined,
  };
}

function mapDocAttachment(r: Row): DocumentAttachment {
  return {
    id: String(r.id),
    documentId: String(r.document_id),
    name: String(r.name),
    mime: String(r.mime ?? ""),
    size: Number(r.size ?? 0),
    data: String(r.data ?? ""),
  };
}

async function queryAll<T>(
  table: string,
  map: (r: Row) => T,
  order?: { column: string; ascending?: boolean }
): Promise<T[]> {
  const client = createServerSupabase();
  if (!client) return [];
  let query = client.from(table).select("*");
  if (order) {
    query = query.order(order.column, {
      ascending: order.ascending ?? true,
      nullsFirst: true,
    });
  }
  const { data, error } = await query;
  if (error) {
    console.error(`[atlas] db ${table}:`, error.message);
    return [];
  }
  return (data ?? []).map((r) => map(r as unknown as Row));
}

// ---------- Collections ----------

export async function getSpaces(): Promise<Space[]> {
  if (!isDbConfigured) return memory.spaces;
  return queryAll("spaces", mapSpace, { column: "position" });
}

export async function getProjects(): Promise<Project[]> {
  if (!isDbConfigured) return memory.projects;
  return queryAll("projects", mapProject, { column: "position" });
}

export async function getFolders(): Promise<Folder[]> {
  if (!isDbConfigured) return memory.folders;
  return queryAll("folders", mapFolder);
}

export async function getLists(): Promise<List[]> {
  if (!isDbConfigured) return memory.lists;
  return queryAll("lists", mapList);
}

export async function getTasks(): Promise<Task[]> {
  if (!isDbConfigured) return memory.tasks;
  return queryAll("tasks", mapTask);
}

export async function getTaskItems(): Promise<TaskItem[]> {
  if (!isDbConfigured) return memory.taskItems;
  return queryAll("task_items", mapItem, { column: "position" });
}

export async function getComments(): Promise<TaskComment[]> {
  if (!isDbConfigured) return memory.taskComments;
  return queryAll("task_comments", mapComment, { column: "created_at" });
}

export async function getActivity(): Promise<TaskActivity[]> {
  if (!isDbConfigured) return memory.taskActivity;
  return queryAll("task_activity", mapActivity);
}

export async function getDocuments(): Promise<DocumentRef[]> {
  if (!isDbConfigured) return memory.documents;
  return queryAll("documents", mapDocument);
}

export async function getDocumentBlocks(): Promise<DocumentBlock[]> {
  if (!isDbConfigured) return memory.documentBlocks;
  return queryAll("document_blocks", mapBlock, { column: "position" });
}

export async function getTaskAttachments(): Promise<TaskAttachment[]> {
  if (!isDbConfigured) return memory.taskAttachments;
  return queryAll("task_attachments", mapAttachment, { column: "position" });
}

export async function getDocumentAttachments(): Promise<DocumentAttachment[]> {
  if (!isDbConfigured) return memory.documentAttachments;
  return queryAll("document_attachments", mapDocAttachment, { column: "position" });
}

// ---------- Lookups ----------

export async function getSpace(id: string): Promise<Space | undefined> {
  if (!isDbConfigured) return memory.getSpace(id);
  const rows = await queryAll("spaces", mapSpace);
  return rows.find((s) => s.id === id);
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (!isDbConfigured) return memory.getProject(id);
  const rows = await queryAll("projects", mapProject);
  return rows.find((p) => p.id === id);
}

export async function getList(id: string): Promise<List | undefined> {
  if (!isDbConfigured) return memory.getList(id);
  const rows = await queryAll("lists", mapList);
  return rows.find((l) => l.id === id);
}

export async function getTask(id: string): Promise<Task | undefined> {
  if (!isDbConfigured) return memory.getTask(id);
  const rows = await queryAll("tasks", mapTask);
  return rows.find((t) => t.id === id);
}

export async function getDocument(id: string): Promise<DocumentRef | undefined> {
  if (!isDbConfigured) return memory.getDocument(id);
  const rows = await queryAll("documents", mapDocument);
  return rows.find((d) => d.id === id);
}

// ---------- Derivers ----------

export async function getSpacesByProject(projectId: string): Promise<Space | undefined> {
  const project = await getProject(projectId);
  return project ? getSpace(project.spaceId) : undefined;
}

export async function getProjectsForSpace(spaceId: string): Promise<Project[]> {
  const all = await getProjects();
  return all.filter((p) => p.spaceId === spaceId);
}

export async function getFoldersForProject(projectId: string): Promise<Folder[]> {
  const all = await getFolders();
  return all.filter((f) => f.projectId === projectId);
}

export async function getListsForProject(projectId: string): Promise<List[]> {
  const all = await getLists();
  return all.filter((l) => l.projectId === projectId);
}

export async function getListsForFolder(folderId: string): Promise<List[]> {
  const all = await getLists();
  return all.filter((l) => l.folderId === folderId);
}

export async function getTasksForSpace(spaceId: string): Promise<Task[]> {
  const all = await getTasks();
  return all.filter((t) => t.spaceId === spaceId);
}

export async function getTasksForProject(projectId: string): Promise<Task[]> {
  const all = await getTasks();
  return all.filter((t) => t.projectId === projectId);
}

export async function getTasksForList(listId: string): Promise<Task[]> {
  const all = await getTasks();
  return all.filter((t) => t.listId === listId);
}

export async function getDocsForSpace(spaceId: string): Promise<DocumentRef[]> {
  const all = await getDocuments();
  return all.filter((d) => d.spaceId === spaceId);
}

export async function getDocsForProject(projectId: string): Promise<DocumentRef[]> {
  const all = await getDocuments();
  return all.filter((d) => d.projectId === projectId);
}

export async function getTaskItemsForTask(taskId: string): Promise<TaskItem[]> {
  const all = await getTaskItems();
  return all.filter((i) => i.taskId === taskId);
}

export async function getTaskAttachmentsForTask(taskId: string): Promise<TaskAttachment[]> {
  const all = await getTaskAttachments();
  return all.filter((a) => a.taskId === taskId);
}

export async function getDocumentAttachmentsForDocument(
  documentId: string
): Promise<DocumentAttachment[]> {
  const all = await getDocumentAttachments();
  return all.filter((a) => a.documentId === documentId);
}

export async function getCommentsForTask(taskId: string): Promise<TaskComment[]> {
  const all = await getComments();
  return all.filter((c) => c.taskId === taskId);
}

export async function getActivityForTask(taskId: string): Promise<TaskActivity[]> {
  const all = await getActivity();
  return all.filter((a) => a.taskId === taskId);
}

export async function getDocumentsForTask(taskId: string): Promise<DocumentRef[]> {
  const all = await getDocuments();
  return all.filter((d) => d.taskIds?.includes(taskId));
}

/** Notes prepared from a recording (or any source document). */
export async function getDocumentsForSource(sourceDocId: string): Promise<DocumentRef[]> {
  const all = await getDocuments();
  return all.filter((d) => d.sourceDocId === sourceDocId);
}

export async function getTasksForDocument(documentId: string): Promise<Task[]> {
  const doc = await getDocument(documentId);
  if (!doc?.taskIds) return [];
  const all = await getTasks();
  return all.filter((t) => doc.taskIds!.includes(t.id));
}

export async function getBlocksForDocument(documentId: string): Promise<DocumentBlock[]> {
  if (!isDbConfigured) return memory.getBlocksForDocument(documentId);
  const all = await getDocumentBlocks();
  return all.filter((b) => b.documentId === documentId);
}

export async function getTaskStatusCounts(): Promise<{ total: number; todo: number; inProgress: number; inReview: number; done: number }> {
  const all = await getTasks();
  return {
    total: all.length,
    todo: all.filter((t) => t.status === "todo").length,
    inProgress: all.filter((t) => t.status === "in-progress").length,
    inReview: all.filter((t) => t.status === "in-review").length,
    done: all.filter((t) => t.status === "done").length,
  };
}