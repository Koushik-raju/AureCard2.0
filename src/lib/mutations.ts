"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase, isDbConfigured } from "@/lib/server-supabase";
import { getCurrentUser } from "@/app/actions/auth";
import type {
  Accent,
  DocumentBlockType,
  DocumentRef,
  NoteType,
  Project,
  RecordingType,
  Space,
  Task,
  TaskAttachmentKind,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { getStatusLabel } from "@/lib/data";
import { parseAssignees } from "@/lib/assignees";
import { cascadeDone } from "@/lib/subtask-tree";
import * as memory from "@/lib/data";

/**
 * Persist mutations to Supabase. When the DB is not configured the app runs
 * in sample-data mode and these are no-ops (the UI keeps its own state).
 * Every action re-checks auth instead of relying on the proxy.
 */

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Tags are stored lowercase + trimmed + de-duplicated so "Bug" and "bug"
 * never split into separate topics. Display keeps the stored form.
 */
export function normalizeTags(tags?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Chunk a transcript into ≤1200-char paragraph blocks for storage. */
function splitForStorage(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 300);
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (!current) {
      current = line;
    } else if ((current + " " + line).length <= 1200) {
      current = `${current} ${line}`;
    } else {
      chunks.push(current);
      current = line;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 300);
}

async function requireClient() {
  const client = createServerSupabase();
  const user = await getCurrentUser();
  if (!client || !user) {
    throw new Error("Not signed in.");
  }
  return { client, user };
}

function formatWhen(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Merge key for repeated edits: "updated the assignees to A, B" and
 * "updated the assignees to C" describe the same field, so only the
 * field part ("updated the assignees") is compared.
 */
function mergeBase(text: string): string {
  const i = text.indexOf(" to ");
  return (i === -1 ? text : text.slice(0, i)).trim().toLowerCase();
}

const MERGE_WINDOW_MS = 10 * 60_000;

/**
 * Best-effort history record. Never throws: a failed history write must not
 * break the mutation it accompanies. Repeated edits of the same field on the
 * same task by the same user within 10 minutes update the existing event
 * instead of inserting a new one.
 */
async function logActivity(taskId: string, text: string, actor?: string) {
  const author = actor ?? (await getCurrentUser())?.email ?? "You";
  const now = new Date();
  const base = mergeBase(text);
  if (!isDbConfigured) {
    const existing = memory.taskActivity.find(
      (a) =>
        a.taskId === taskId &&
        a.author === author &&
        mergeBase(a.text) === base &&
        now.getTime() - Date.parse(a.createdAt ?? "") < MERGE_WINDOW_MS
    );
    if (existing) {
      existing.text = text;
      existing.when = formatWhen(now);
      existing.createdAt = now.toISOString();
      // Keep newest-first order.
      const idx = memory.taskActivity.indexOf(existing);
      if (idx > 0) {
        memory.taskActivity.splice(idx, 1);
        memory.taskActivity.unshift(existing);
      }
      return;
    }
    memory.taskActivity.unshift({
      id: newId("ta"),
      taskId,
      author,
      text,
      when: formatWhen(now),
      createdAt: now.toISOString(),
    });
    return;
  }
  const client = createServerSupabase();
  if (!client) return;
  const since = new Date(now.getTime() - MERGE_WINDOW_MS).toISOString();
  const { data: recent } = await client
    .from("task_activity")
    .select("id,text,created_at")
    .eq("task_id", taskId)
    .eq("author", author)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  const match = (recent ?? []).find(
    (r) => mergeBase(String(r.text ?? "")) === base
  );
  if (match) {
    const { error } = await client
      .from("task_activity")
      .update({ text, when: formatWhen(now), created_at: now.toISOString() })
      .eq("id", match.id);
    if (error) console.error("[atlas] logActivity:", error.message);
    return;
  }
  const { error } = await client.from("task_activity").insert({
    id: newId("ta"),
    task_id: taskId,
    author,
    text,
    when: formatWhen(now),
  });
  if (error) console.error("[atlas] logActivity:", error.message);
}

// ---------- Cascade helpers ----------

function removeMemoryDocuments(docIds: Set<string>) {
  if (docIds.size === 0) return;
  for (let i = memory.documents.length - 1; i >= 0; i--) {
    if (docIds.has(memory.documents[i].id)) memory.documents.splice(i, 1);
  }
  for (let i = memory.documentBlocks.length - 1; i >= 0; i--) {
    if (docIds.has(memory.documentBlocks[i].documentId)) memory.documentBlocks.splice(i, 1);
  }
  for (let i = memory.documentAttachments.length - 1; i >= 0; i--) {
    if (docIds.has(memory.documentAttachments[i].documentId)) memory.documentAttachments.splice(i, 1);
  }
}

function removeMemoryTasks(taskIds: Set<string>) {
  if (taskIds.size === 0) return;
  for (let i = memory.tasks.length - 1; i >= 0; i--) {
    if (taskIds.has(memory.tasks[i].id)) memory.tasks.splice(i, 1);
  }
  for (let i = memory.taskItems.length - 1; i >= 0; i--) {
    if (taskIds.has(memory.taskItems[i].taskId)) memory.taskItems.splice(i, 1);
  }
  for (let i = memory.taskComments.length - 1; i >= 0; i--) {
    if (taskIds.has(memory.taskComments[i].taskId)) memory.taskComments.splice(i, 1);
  }
  for (let i = memory.taskActivity.length - 1; i >= 0; i--) {
    if (taskIds.has(memory.taskActivity[i].taskId)) memory.taskActivity.splice(i, 1);
  }
  for (let i = memory.taskAttachments.length - 1; i >= 0; i--) {
    if (taskIds.has(memory.taskAttachments[i].taskId)) memory.taskAttachments.splice(i, 1);
  }
}

/** Delete a project's child rows. Safe against tables that aren't created yet. */
async function deleteProjectCascade(client: SupabaseClient, projectId: string) {
  await client.from("documents").delete().eq("project_id", projectId);
  await client.from("tasks").delete().eq("project_id", projectId);
  await client.from("lists").delete().eq("project_id", projectId);
  await client.from("folders").delete().eq("project_id", projectId);
}

/** Delete rows owned directly by a space (after projects have been cascaded). */
async function deleteSpaceCascade(client: SupabaseClient, spaceId: string) {
  await client.from("documents").delete().eq("space_id", spaceId);
  await client.from("tasks").delete().eq("space_id", spaceId);
  await client.from("lists").delete().eq("space_id", spaceId);
  await client.from("folders").delete().eq("space_id", spaceId);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  if (!isDbConfigured) {
    const task = memory.tasks.find((t) => t.id === taskId);
    if (task) task.status = status;
    const user = await getCurrentUser();
    await logActivity(taskId, `moved the task to ${getStatusLabel(status)}`, user?.email);
    revalidatePath("/tasks");
    revalidatePath("/search");
    revalidatePath(`/tasks/${taskId}`);
    return;
  }
  const { client, user } = await requireClient();
  const { error } = await client
    .from("tasks")
    .update({ status })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  await logActivity(taskId, `moved the task to ${getStatusLabel(status)}`, user.email ?? "Someone");
  revalidatePath("/tasks");
  revalidatePath("/search");
  revalidatePath(`/tasks/${taskId}`);
}

export type EditTaskItemInput = {
  id: string;
  title?: string;
  done?: boolean;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority | null;
  description?: string;
};

/**
 * Update a subtask item (title, done, assignee, due date, priority,
 * Notion-style body). Only provided keys are written.
 */
export async function updateTaskItem(
  taskId: string,
  input: EditTaskItemInput
): Promise<{ error?: string }> {
  const patch: Partial<TaskItem> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "Title is required." };
    patch.title = title.slice(0, 200);
  }
  if (input.done !== undefined) patch.done = input.done;
  if (input.assignee !== undefined) patch.assignee = input.assignee?.trim() || undefined;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate || undefined;
  if (input.priority !== undefined) patch.priority = input.priority ?? undefined;
  if (input.description !== undefined) patch.description = input.description;
  if (!isDbConfigured) {
    const item = memory.taskItems.find((i) => i.id === input.id);
    if (!item) return { error: "Not found." };
    Object.assign(item, patch);
    const user = await getCurrentUser();
    if (input.done !== undefined) {
      await logActivity(
        taskId,
        `${input.done ? "checked off" : "reopened"} a subtask`,
        user?.email
      );
    }
    revalidatePath(`/tasks/${taskId}`);
    return {};
  }
  const { client, user } = await requireClient();
  const livePatch: Record<string, unknown> = {};
  if (patch.title !== undefined) livePatch.title = patch.title;
  if (patch.done !== undefined) livePatch.done = patch.done;
  if ("assignee" in patch) livePatch.assignee = patch.assignee ?? null;
  if ("dueDate" in patch) livePatch.due_date = patch.dueDate ?? null;
  if ("priority" in patch) livePatch.priority = patch.priority ?? null;
  if (patch.description !== undefined) livePatch.description = patch.description;
  const { error } = await client.from("task_items").update(livePatch).eq("id", input.id);
  if (error) return { error: error.message };
  if (input.done !== undefined) {
    await logActivity(
      taskId,
      `${input.done ? "checked off" : "reopened"} a subtask`,
      user.email ?? "Someone"
    );
  }
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function updateTaskItemDone(
  taskId: string,
  itemId: string,
  done: boolean
): Promise<void> {
  if (!isDbConfigured) {
    const siblings = memory.taskItems.filter((i) => i.taskId === taskId);
    const { check, uncheck } = cascadeDone(siblings, itemId, done);
    for (const item of memory.taskItems) {
      if (item.taskId !== taskId) continue;
      if (check.includes(item.id)) item.done = true;
      if (uncheck.includes(item.id)) item.done = false;
    }
    const user = await getCurrentUser();
    await logActivity(taskId, `${done ? "checked off" : "reopened"} a subtask`, user?.email);
    revalidatePath(`/tasks/${taskId}`);
    return;
  }
  const { client, user } = await requireClient();
  const { data: rows, error: fetchError } = await client
    .from("task_items")
    .select("id,parent_id")
    .eq("task_id", taskId);
  if (fetchError) throw new Error(fetchError.message);
  const { check, uncheck } = cascadeDone(
    (rows ?? []).map((r) => ({
      id: String(r.id),
      parentId: r.parent_id ? String(r.parent_id) : undefined,
    })),
    itemId,
    done
  );
  if (check.length > 0) {
    const { error } = await client.from("task_items").update({ done: true }).in("id", check);
    if (error) throw new Error(error.message);
  }
  if (uncheck.length > 0) {
    const { error } = await client.from("task_items").update({ done: false }).in("id", uncheck);
    if (error) throw new Error(error.message);
  }
  await logActivity(taskId, `${done ? "checked off" : "reopened"} a subtask`, user.email ?? "Someone");
  revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskItem(
  taskId: string,
  title: string,
  parentId?: string
): Promise<{ error?: string }> {
  const body = title.trim();
  if (!body) return { error: "Enter a subtask." };
  const id = newId("item");
  if (!isDbConfigured) {
    memory.taskItems.push({
      id,
      taskId,
      parentId: parentId || undefined,
      title: body.slice(0, 200),
      done: false,
    });
    const user = await getCurrentUser();
    await logActivity(taskId, "added a subtask", user?.email);
    revalidatePath(`/tasks/${taskId}`);
    return {};
  }
  const { client, user } = await requireClient();
  const { error } = await client.from("task_items").insert({
    id,
    task_id: taskId,
    parent_id: parentId || null,
    title: body.slice(0, 200),
    done: false,
  });
  if (error) return { error: error.message };
  await logActivity(taskId, "added a subtask", user.email ?? "Someone");
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function deleteTaskItem(taskId: string, itemId: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.taskItems.findIndex((i) => i.id === itemId);
    if (idx !== -1) memory.taskItems.splice(idx, 1);
    revalidatePath(`/tasks/${taskId}`);
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client.from("task_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function addComment(taskId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const user = await getCurrentUser();
  if (!isDbConfigured) {
    await logActivity(taskId, "added a comment", user?.email);
    revalidatePath(`/tasks/${taskId}`);
    return;
  }
  const { client, user: signedIn } = await requireClient();
  const { error } = await client.from("task_comments").insert({
    task_id: taskId,
    author: signedIn.email ?? "Guest",
    text: body.slice(0, 1000),
  });
  if (error) throw new Error(error.message);
  await logActivity(taskId, "added a comment", signedIn.email ?? "Someone");
  revalidatePath(`/tasks/${taskId}`);
}

// ---------- Create ----------

type CreateSpaceInput = { name: string; description?: string; accent: Accent };
export async function createSpace(
  input: CreateSpaceInput
): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  const id = newId("space");
  if (!isDbConfigured) {
    memory.spaces.push({
      id,
      name,
      description: input.description?.trim() ?? "",
      accent: input.accent,
    });
    revalidatePath("/spaces");
    revalidatePath("/home");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("spaces").insert({
    id,
    name,
    description: input.description?.trim() ?? "",
    accent: input.accent,
    position: 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/spaces");
  revalidatePath("/home");
  return { id };
}

type CreateProjectInput = { name: string; spaceId: string; description?: string };
export async function createProject(
  input: CreateProjectInput
): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  if (!input.spaceId) return { error: "Choose a space." };
  const id = newId("proj");
  if (!isDbConfigured) {
    memory.projects.push({
      id,
      name,
      spaceId: input.spaceId,
      description: input.description?.trim() || undefined,
    });
    revalidatePath("/projects");
    revalidatePath("/spaces");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("projects").insert({
    id,
    name,
    space_id: input.spaceId,
    description: input.description?.trim() || null,
    position: 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/spaces");
  return { id };
}

type CreateTaskInput = {
  title: string;
  spaceId: string;
  projectId?: string;
  listId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | string[];
  assignees?: string[];
  description?: string;
  dueDate?: string;
  tags?: string[];
  quote?: string;
  sourceDocId?: string;
};
export async function createTask(
  input: CreateTaskInput
): Promise<{ id?: string; error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  if (!input.spaceId) return { error: "Choose a space." };
  const id = newId("task");
  const assignees = parseAssignees(
    input.assignees ?? (input.assignee as string | string[] | undefined)
  );
  const tags = normalizeTags(input.tags);
  if (!isDbConfigured) {
    memory.tasks.push({
      id,
      title,
      spaceId: input.spaceId,
      projectId: input.projectId || undefined,
      listId: input.listId || undefined,
      status: input.status ?? "todo",
      priority: input.priority ?? undefined,
      assignee: assignees[0] ?? undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
      description: input.description?.trim() || undefined,
      dueDate: input.dueDate || undefined,
      tags: tags.length ? tags : undefined,
      quote: input.quote?.trim() || undefined,
      sourceDocId: input.sourceDocId || undefined,
    });
    revalidatePath("/tasks");
    revalidatePath("/spaces");
    return { id };
  }
  const { client } = await requireClient();
  // `assignees` column may not exist on older DBs — try with it, fall back to legacy.
  const baseRow = {
    id,
    title,
    space_id: input.spaceId,
    project_id: input.projectId || null,
    list_id: input.listId || null,
    status: input.status ?? "todo",
    priority: input.priority ?? null,
    assignee: assignees[0] ?? null,
    description: input.description?.trim() || null,
    due_date: input.dueDate || null,
    tags,
    quote: input.quote?.trim() || null,
    source_doc_id: input.sourceDocId || null,
  };
  const withMulti = { ...baseRow, assignees };
  let { error } = await client.from("tasks").insert(withMulti);
  if (error && /assignees/i.test(error.message)) {
    ({ error } = await client.from("tasks").insert(baseRow));
  }
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/spaces");
  revalidatePath("/search");
  return { id };
}

type CreateDocumentInput = {
  title: string;
  spaceId: string;
  projectId?: string;
  kind?: "doc" | "note" | "file";
  blocks?: { type: DocumentBlockType; text: string }[];
  attachments?: {
    name: string;
    mime: string;
    size: number;
    data: string;
  }[];
  noteType?: NoteType;
  recordingType?: RecordingType;
  durationSecs?: number;
  summary?: string;
  /** Full transcript text; stored as paragraph blocks (also for file docs). */
  transcript?: string;
  /** Document this one was prepared from (notes prepared from recordings). */
  sourceDocId?: string;
};
export async function createDocument(
  input: CreateDocumentInput
): Promise<{ id?: string; error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  if (!input.spaceId) return { error: "Choose a space." };
  const kind = input.kind ?? "doc";
  const id = newId("doc");
  const body = (input.blocks ?? [])
    .map((b) => ({ type: b.type, text: b.text.slice(0, 5000) }))
    .filter((b) => b.text.trim().length > 0)
    .slice(0, 300);
  const attachments = (input.attachments ?? []).slice(0, 50);
  if (kind === "doc" && attachments.length === 0 && body.length === 0) {
    body.push({ type: "paragraph", text: "" });
  }
  if (!isDbConfigured) {
    memory.documents.push({
      id,
      title,
      spaceId: input.spaceId,
      projectId: input.projectId || undefined,
      kind,
      noteType: input.noteType,
      sourceDocId: input.sourceDocId || undefined,
      recordingType: input.recordingType,
      durationSecs: input.durationSecs,
      summary: input.summary,
    });
    if (kind !== "file") {
      memory.documentBlocks.push({
        id: newId("blk"),
        documentId: id,
        type: "heading",
        text: title,
      });
      for (const block of body) {
        memory.documentBlocks.push({
          id: newId("blk"),
          documentId: id,
          type: block.type,
          text: block.text,
        });
      }
    } else if (input.transcript?.trim()) {
      // File docs carry the transcript as paragraph blocks so the
      // recording detail Transcript tab can render it.
      for (const chunk of splitForStorage(input.transcript)) {
        memory.documentBlocks.push({
          id: newId("blk"),
          documentId: id,
          type: "paragraph",
          text: chunk,
        });
      }
    }
    for (const file of attachments) {
      memory.documentAttachments.push({
        id: newId("da"),
        documentId: id,
        name: file.name,
        mime: file.mime,
        size: file.size,
        data: file.data,
      });
    }
    revalidatePath("/docs");
    revalidatePath("/spaces");
    return { id };
  }
  const { client } = await requireClient();
  // `source_doc_id` may not exist on older DBs — retry without it.
  const baseRow = {
    id,
    title,
    space_id: input.spaceId,
    project_id: input.projectId || null,
    kind,
    task_ids: [],
    note_type: input.noteType ?? null,
    recording_type: input.recordingType ?? null,
    duration_secs: input.durationSecs ?? null,
    summary: input.summary ?? null,
  };
  let { error } = input.sourceDocId
    ? await client.from("documents").insert({ ...baseRow, source_doc_id: input.sourceDocId })
    : await client.from("documents").insert(baseRow);
  if (error && /source_doc_id/i.test(error.message)) {
    ({ error } = await client.from("documents").insert(baseRow));
  }
  if (error) return { error: error.message };
  if (kind !== "file") {
    const rows = [
      {
        id: newId("blk"),
        document_id: id,
        type: "heading",
        text: title,
        checked: false,
        position: 0,
      },
      ...body.map((block, index) => ({
        id: newId("blk"),
        document_id: id,
        type: block.type,
        text: block.text,
        checked: false,
        position: index + 1,
      })),
    ];
    const { error: blockError } = await client.from("document_blocks").insert(rows);
    if (blockError) {
      // Avoid leaving an empty ghost document behind.
      await client.from("documents").delete().eq("id", id);
      return { error: blockError.message };
    }
  } else if (input.transcript?.trim()) {
    const rows = splitForStorage(input.transcript).map((text, index) => ({
      id: newId("blk"),
      document_id: id,
      type: "paragraph",
      text,
      checked: false,
      position: index,
    }));
    const { error: blockError } = await client.from("document_blocks").insert(rows);
    if (blockError) {
      await client.from("documents").delete().eq("id", id);
      return { error: blockError.message };
    }
  }
  if (attachments.length > 0) {
    const attachmentRows = attachments.map((file, index) => ({
      id: newId("da"),
      document_id: id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      data: file.data,
      position: index,
    }));
    const { error: attachmentError } = await client
      .from("document_attachments")
      .insert(attachmentRows);
    if (attachmentError) {
      // Avoid leaving an empty ghost document behind.
      await client.from("documents").delete().eq("id", id);
      return { error: attachmentError.message };
    }
  }
  revalidatePath("/docs");
  revalidatePath("/spaces");
  revalidatePath("/search");
  return { id };
}

export type PreparedNoteSections = {
  summary: string;
  keyPoints: string[];
  actions: string[];
  decisions: string[];
  questions: string[];
};

/**
 * Save an editable prepared note linked back to the recording it came from.
 * Sections arrive as plain text (one item per line for lists).
 */
export async function createPreparedNote(input: {
  sourceDocId: string;
  sourceTitle: string;
  title: string;
  spaceId: string;
  projectId?: string;
  sections: PreparedNoteSections;
}): Promise<{ id?: string; error?: string }> {
  const lines = (s: string) =>
    s
      .split(/\n+/)
      .map((l) => l.trim().replace(/^[•\-*]\s+/, ""))
      .filter(Boolean)
      .slice(0, 30);
  const blocks: { type: DocumentBlockType; text: string }[] = [
    { type: "quote", text: `Prepared from “${input.sourceTitle}” — edit freely.` },
  ];
  if (input.sections.summary.trim()) {
    blocks.push({ type: "subheading", text: "Summary" });
    blocks.push({ type: "paragraph", text: input.sections.summary.trim().slice(0, 2000) });
  }
  const pushList = (heading: string, items: string[]) => {
    if (items.length === 0) return;
    blocks.push({ type: "subheading", text: heading });
    for (const item of items) blocks.push({ type: "bulleted", text: item });
  };
  pushList("Key points", lines(input.sections.keyPoints.join("\n")));
  pushList("Action items", lines(input.sections.actions.join("\n")));
  pushList("Decisions", lines(input.sections.decisions.join("\n")));
  pushList("Open questions", lines(input.sections.questions.join("\n")));
  const result = await createDocument({
    title: input.title.trim() || `${input.sourceTitle} — Notes`,
    spaceId: input.spaceId,
    projectId: input.projectId,
    kind: "note",
    noteType: "meeting",
    blocks,
    sourceDocId: input.sourceDocId,
  });
  if (result.id) {
    revalidatePath(`/docs/${input.sourceDocId}`);
  }
  return result;
}

export type CreateDocumentAttachmentInput = {
  name: string;
  mime: string;
  size: number;
  data: string;
};

export async function createDocumentAttachment(
  documentId: string,
  input: CreateDocumentAttachmentInput
): Promise<{ error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "File is required." };
  const id = newId("da");
  if (!isDbConfigured) {
    memory.documentAttachments.push({
      id,
      documentId,
      name,
      mime: input.mime,
      size: input.size,
      data: input.data,
    });
    revalidatePath(`/docs/${documentId}`);
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client.from("document_attachments").insert({
    id,
    document_id: documentId,
    name,
    mime: input.mime,
    size: input.size,
    data: input.data,
    position: 0,
  });
  if (error) return { error: error.message };
  revalidatePath(`/docs/${documentId}`);
  return {};
}

export async function deleteDocumentAttachment(
  documentId: string,
  attachmentId: string
): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.documentAttachments.findIndex((a) => a.id === attachmentId);
    if (idx !== -1) memory.documentAttachments.splice(idx, 1);
    revalidatePath(`/docs/${documentId}`);
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client
    .from("document_attachments")
    .delete()
    .eq("id", attachmentId);
  if (error) return { error: error.message };
  revalidatePath(`/docs/${documentId}`);
  return {};
}

// ---------- Update / Delete ----------

type EditSpaceInput = { id: string; name?: string; description?: string; accent?: Accent };
export async function updateSpace(input: EditSpaceInput): Promise<{ error?: string }> {
  const patch: Partial<Space> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Name is required." };
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.accent !== undefined) patch.accent = input.accent;
  if (!isDbConfigured) {
    const space = memory.spaces.find((s) => s.id === input.id);
    if (!space) return { error: "Not found." };
    Object.assign(space, patch);
    revalidatePath("/spaces");
    revalidatePath("/home");
    return {};
  }
  const { client } = await requireClient();
  // Only provided keys are written: spaces.description is NOT NULL, so an
  // absent description must not overwrite the stored value with NULL
  // (renaming a space must never fail or wipe its description).
  const livePatch: Record<string, unknown> = {};
  if (patch.name !== undefined) livePatch.name = patch.name;
  if (patch.description !== undefined) livePatch.description = patch.description;
  if (patch.accent !== undefined) livePatch.accent = patch.accent;
  const { error } = await client.from("spaces").update(livePatch).eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/spaces");
  revalidatePath("/home");
  return {};
}

export async function deleteSpace(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.spaces.findIndex((s) => s.id === id);
    if (idx === -1) return { error: "Not found." };
    memory.spaces.splice(idx, 1);
    for (let i = memory.projects.length - 1; i >= 0; i--) {
      if (memory.projects[i].spaceId === id) memory.projects.splice(i, 1);
    }
    for (let i = memory.folders.length - 1; i >= 0; i--) {
      if (memory.folders[i].spaceId === id) memory.folders.splice(i, 1);
    }
    for (let i = memory.lists.length - 1; i >= 0; i--) {
      if (memory.lists[i].spaceId === id) memory.lists.splice(i, 1);
    }
    const taskIds = new Set(memory.tasks.filter((t) => t.spaceId === id).map((t) => t.id));
    removeMemoryTasks(taskIds);
    const docIds = new Set(memory.documents.filter((d) => d.spaceId === id).map((d) => d.id));
    removeMemoryDocuments(docIds);
    revalidatePath("/spaces");
    revalidatePath("/home");
    return {};
  }
  const { client } = await requireClient();
  const projectRows = (await client.from("projects").select("id").eq("space_id", id)).data ?? [];
  for (const row of projectRows) {
    await deleteProjectCascade(client, String((row as { id: string }).id));
  }
  await deleteSpaceCascade(client, id);
  const { error } = await client.from("spaces").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/spaces");
  revalidatePath("/home");
  return {};
}

type EditProjectInput = { id: string; name?: string; description?: string | null; spaceId?: string };
export async function updateProject(input: EditProjectInput): Promise<{ error?: string }> {
  const patch: Partial<Project> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Name is required." };
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = (input.description ?? "").trim() || undefined;
  if (input.spaceId !== undefined) patch.spaceId = input.spaceId;
  if (!isDbConfigured) {
    const project = memory.projects.find((p) => p.id === input.id);
    if (!project) return { error: "Not found." };
    Object.assign(project, patch);
    revalidatePath("/projects");
    revalidatePath("/spaces");
    return {};
  }
  const { client } = await requireClient();
  const livePatch: Record<string, unknown> = {};
  if (patch.name !== undefined) livePatch.name = patch.name;
  if ("description" in patch) livePatch.description = patch.description ?? null;
  if (patch.spaceId !== undefined) livePatch.space_id = patch.spaceId;
  const { error } = await client
    .from("projects")
    .update(livePatch)
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/spaces");
  return {};
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.projects.findIndex((p) => p.id === id);
    if (idx === -1) return { error: "Not found." };
    memory.projects.splice(idx, 1);
    const folderIds = new Set(memory.folders.filter((f) => f.projectId === id).map((f) => f.id));
    for (let i = memory.folders.length - 1; i >= 0; i--) {
      if (folderIds.has(memory.folders[i].id)) memory.folders.splice(i, 1);
    }
    const listIds = new Set(memory.lists.filter((l) => l.projectId === id).map((l) => l.id));
    for (let i = memory.lists.length - 1; i >= 0; i--) {
      if (listIds.has(memory.lists[i].id)) memory.lists.splice(i, 1);
    }
    const taskIds = new Set(memory.tasks.filter((t) => t.projectId === id).map((t) => t.id));
    removeMemoryTasks(taskIds);
    const docIds = new Set(memory.documents.filter((d) => d.projectId === id).map((d) => d.id));
    removeMemoryDocuments(docIds);
    revalidatePath("/projects");
    revalidatePath("/spaces");
    revalidatePath("/search");
    return {};
  }
  const { client } = await requireClient();
  await deleteProjectCascade(client, id);
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/spaces");
  revalidatePath("/search");
  return {};
}
export type EditTaskInput = {
  id: string;
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  assignee?: string | string[] | null;
  assignees?: string[] | null;
  description?: string;
  dueDate?: string | null;
  startDate?: string | null;
  tags?: string[];
  quote?: string | null;
  sourceDocId?: string | null;
};

export async function updateTask(input: EditTaskInput): Promise<{ error?: string }> {
  const patch: Partial<Task> = {};
  const changed: string[] = [];
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "Title is required." };
    patch.title = title;
    changed.push("the title");
  }
  if (input.status !== undefined) {
    patch.status = input.status;
    changed.push(`the status to ${getStatusLabel(input.status)}`);
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority ?? undefined;
    changed.push(input.priority ? `priority to ${input.priority}` : "priority");
  }
  if (input.assignees !== undefined || input.assignee !== undefined) {
    const list =
      input.assignees !== undefined
        ? parseAssignees(input.assignees)
        : parseAssignees(input.assignee as string | string[] | null | undefined);
    patch.assignees = list;
    patch.assignee = list[0] ?? undefined;
    changed.push(
      list.length > 0 ? `the assignees to ${list.join(", ")}` : "the assignees"
    );
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || undefined;
    changed.push("the description");
  }
  if (input.dueDate !== undefined) {
    patch.dueDate = input.dueDate || undefined;
    changed.push(input.dueDate ? `the due date to ${input.dueDate}` : "the due date");
  }
  if (input.startDate !== undefined) {
    patch.startDate = input.startDate || undefined;
    changed.push(input.startDate ? `the start date to ${input.startDate}` : "the start date");
  }
  if (input.tags !== undefined) {
    patch.tags = normalizeTags(input.tags);
    changed.push("the tags");
  }
  if (input.quote !== undefined) {
    patch.quote = input.quote?.trim() || undefined;
    changed.push("the source quote");
  }
  if (input.sourceDocId !== undefined) {
    patch.sourceDocId = input.sourceDocId || undefined;
    changed.push("the source note");
  }
  const summary = changed.length ? `updated ${changed.join(", ")}` : "";
  if (!isDbConfigured) {
    const task = memory.tasks.find((t) => t.id === input.id);
    if (!task) return { error: "Not found." };
    Object.assign(task, patch);
    const user = await getCurrentUser();
    if (summary) await logActivity(input.id, summary, user?.email);
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${input.id}`);
    revalidatePath("/home");
    return {};
  }
  const { client, user } = await requireClient();
  const livePatch: Record<string, unknown> = {};
  // Only the fields explicitly provided in the request are written to the DB.
  // Clearing a field (assignee/due date/priority/…) is expressed by the caller
  // passing the key, which maps to NULL here.
  if (Object.prototype.hasOwnProperty.call(patch, "title")) livePatch.title = patch.title;
  if (Object.prototype.hasOwnProperty.call(patch, "status")) livePatch.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, "priority")) livePatch.priority = patch.priority ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "assignees") || Object.prototype.hasOwnProperty.call(patch, "assignee")) {
    const list = patch.assignees ?? (patch.assignee ? [patch.assignee] : []);
    livePatch.assignee = list[0] ?? null;
    livePatch.assignees = list;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "description")) livePatch.description = patch.description ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "dueDate")) livePatch.due_date = patch.dueDate ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "startDate")) livePatch.start_date = patch.startDate ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "tags")) livePatch.tags = patch.tags ?? [];
  if (Object.prototype.hasOwnProperty.call(patch, "quote")) livePatch.quote = patch.quote ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "sourceDocId")) livePatch.source_doc_id = patch.sourceDocId ?? null;
  let { error } = await client.from("tasks").update(livePatch).eq("id", input.id);
  // Older DBs without the `assignees` column: retry with legacy single column.
  if (error && /assignees/i.test(error.message) && "assignees" in livePatch) {
    const fallback = { ...livePatch };
    delete fallback.assignees;
    ({ error } = await client.from("tasks").update(fallback).eq("id", input.id));
  }
  if (error) return { error: error.message };
  if (summary) await logActivity(input.id, summary, user.email ?? "Someone");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${input.id}`);
  revalidatePath("/home");
  revalidatePath("/search");
  return {};
}

export async function deleteTask(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return { error: "Not found." };
    memory.tasks.splice(idx, 1);
    for (let i = memory.taskItems.length - 1; i >= 0; i--) {
      if (memory.taskItems[i].taskId === id) memory.taskItems.splice(i, 1);
    }
    for (let i = memory.taskComments.length - 1; i >= 0; i--) {
      if (memory.taskComments[i].taskId === id) memory.taskComments.splice(i, 1);
    }
    for (let i = memory.taskActivity.length - 1; i >= 0; i--) {
      if (memory.taskActivity[i].taskId === id) memory.taskActivity.splice(i, 1);
    }
    for (let i = memory.taskAttachments.length - 1; i >= 0; i--) {
      if (memory.taskAttachments[i].taskId === id) memory.taskAttachments.splice(i, 1);
    }
    revalidatePath("/tasks");
    revalidatePath("/home");
    revalidatePath("/search");
    return {};
  }
  const { client } = await requireClient();
  // task_attachments may not exist yet on an un-migrated database; supabase returns
  // an error object rather than throwing, so this is safe to run unconditionally.
  await client.from("task_attachments").delete().eq("task_id", id);
  await client.from("task_items").delete().eq("task_id", id);
  await client.from("task_comments").delete().eq("task_id", id);
  await client.from("task_activity").delete().eq("task_id", id);
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/home");
  revalidatePath("/search");
  return {};
}

export type CreateTaskAttachmentInput = {
  kind: TaskAttachmentKind;
  url: string;
  label?: string;
};

export async function createTaskAttachment(
  taskId: string,
  input: CreateTaskAttachmentInput
): Promise<{ error?: string }> {
  const url = input.url.trim();
  if (!url) return { error: "URL is required." };
  const label = input.label?.trim();
  const id = newId("att");
  if (!isDbConfigured) {
    memory.taskAttachments.push({
      id,
      taskId,
      kind: input.kind,
      url,
      label: label || undefined,
    });
    revalidatePath(`/tasks/${taskId}`);
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client.from("task_attachments").insert({
    id,
    task_id: taskId,
    kind: input.kind,
    url,
    label: label ?? "",
    position: 0,
  });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function deleteTaskAttachment(
  taskId: string,
  attachmentId: string
): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.taskAttachments.findIndex((a) => a.id === attachmentId);
    if (idx !== -1) memory.taskAttachments.splice(idx, 1);
    revalidatePath(`/tasks/${taskId}`);
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

type EditDocumentInput = { id: string; title?: string; spaceId?: string; kind?: "doc" | "note" };
export async function updateDocument(input: EditDocumentInput): Promise<{ error?: string }> {
  const patch: Partial<DocumentRef> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "Title is required." };
    patch.title = title;
  }
  if (input.spaceId !== undefined) patch.spaceId = input.spaceId;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (!isDbConfigured) {
    const doc = memory.documents.find((d) => d.id === input.id);
    if (!doc) return { error: "Not found." };
    Object.assign(doc, patch);
    revalidatePath("/docs");
    revalidatePath(`/docs/${input.id}`);
    revalidatePath("/search");
    return {};
  }
  const { client } = await requireClient();
  // Map to snake_case columns; only provided keys are written.
  const livePatch: Record<string, unknown> = {};
  if (patch.title !== undefined) livePatch.title = patch.title;
  if (patch.spaceId !== undefined) livePatch.space_id = patch.spaceId;
  if (patch.kind !== undefined) livePatch.kind = patch.kind;
  const { error } = await client.from("documents").update(livePatch).eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/docs");
  revalidatePath(`/docs/${input.id}`);
  revalidatePath("/search");
  return {};
}

export async function deleteDocument(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    removeMemoryDocuments(new Set([id]));
    revalidatePath("/docs");
    revalidatePath("/search");
    return {};
  }
  const { client } = await requireClient();
  await client.from("document_blocks").delete().eq("document_id", id);
  await client.from("document_attachments").delete().eq("document_id", id);
  const { error } = await client.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/docs");
  revalidatePath("/search");
  return {};
}

// ---------- Folders & Lists ----------

type CreateFolderInput = { name: string; projectId: string; spaceId: string };
export async function createFolder(input: CreateFolderInput): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  const id = newId("folder");
  if (!isDbConfigured) {
    memory.folders.push({ id, name, projectId: input.projectId, spaceId: input.spaceId });
    revalidatePath("/projects");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("folders").insert({
    id,
    name,
    project_id: input.projectId,
    space_id: input.spaceId,
  });
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { id };
}

type CreateListInput = { name: string; projectId: string; spaceId: string; folderId?: string };
export async function createList(input: CreateListInput): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };
  const id = newId("list");
  if (!isDbConfigured) {
    memory.lists.push({
      id,
      name,
      projectId: input.projectId,
      spaceId: input.spaceId,
      folderId: input.folderId || undefined,
    });
    revalidatePath("/projects");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("lists").insert({
    id,
    name,
    project_id: input.projectId,
    space_id: input.spaceId,
    folder_id: input.folderId || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { id };
}

export async function renameFolder(id: string, name: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  if (!isDbConfigured) {
    const folder = memory.folders.find((f) => f.id === id);
    if (!folder) return { error: "Not found." };
    folder.name = trimmed;
    revalidatePath("/projects");
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client.from("folders").update({ name: trimmed }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

export async function renameList(id: string, name: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  if (!isDbConfigured) {
    const list = memory.lists.find((l) => l.id === id);
    if (!list) return { error: "Not found." };
    list.name = trimmed;
    revalidatePath("/projects");
    return {};
  }
  const { client } = await requireClient();
  const { error } = await client.from("lists").update({ name: trimmed }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

export async function deleteFolder(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.folders.findIndex((f) => f.id === id);
    if (idx === -1) return { error: "Not found." };
    memory.folders.splice(idx, 1);
    const listIds = new Set(memory.lists.filter((l) => l.folderId === id).map((l) => l.id));
    for (let i = memory.lists.length - 1; i >= 0; i--) {
      if (listIds.has(memory.lists[i].id)) memory.lists.splice(i, 1);
    }
    const taskIds = new Set(memory.tasks.filter((t) => t.listId && listIds.has(t.listId)).map((t) => t.id));
    removeMemoryTasks(taskIds);
    revalidatePath("/projects");
    return {};
  }
  const { client } = await requireClient();
  const listRows = (await client.from("lists").select("id").eq("folder_id", id)).data ?? [];
  const listIds = listRows.map((r) => String((r as { id: string }).id));
  for (const listId of listIds) {
    await client.from("tasks").delete().eq("list_id", listId);
  }
  if (listIds.length) await client.from("lists").delete().in("id", listIds);
  const { error } = await client.from("folders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

export async function deleteList(id: string): Promise<{ error?: string }> {
  if (!isDbConfigured) {
    const idx = memory.lists.findIndex((l) => l.id === id);
    if (idx === -1) return { error: "Not found." };
    memory.lists.splice(idx, 1);
    const taskIds = new Set(memory.tasks.filter((t) => t.listId === id).map((t) => t.id));
    removeMemoryTasks(taskIds);
    revalidatePath("/projects");
    return {};
  }
  const { client } = await requireClient();
  await client.from("tasks").delete().eq("list_id", id);
  const { error } = await client.from("lists").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

export async function updateBlock(
  documentId: string,
  blockId: string,
  patch: { text?: string; checked?: boolean; taskId?: string | null }
) {
  if (!isDbConfigured) return;
  const { client } = await requireClient();
  const { error } = await client
    .from("document_blocks")
    .update(patch)
    .eq("id", blockId);
  if (error) throw new Error(error.message);
  revalidatePath(`/docs/${documentId}`);
  revalidatePath("/search");
}

export async function insertBlock(
  documentId: string,
  block: {
    id: string;
    type: DocumentBlockType;
    text: string;
    position: number;
  }
) {
  if (!isDbConfigured) return;
  const { client } = await requireClient();
  const { error } = await client.from("document_blocks").insert({
    id: block.id,
    document_id: documentId,
    type: block.type,
    text: block.text,
    position: block.position,
    checked: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/docs/${documentId}`);
}

export async function deleteBlock(documentId: string, blockId: string) {
  if (!isDbConfigured) return;
  const { client } = await requireClient();
  const { error } = await client
    .from("document_blocks")
    .delete()
    .eq("id", blockId);
  if (error) throw new Error(error.message);
  revalidatePath(`/docs/${documentId}`);
  revalidatePath("/search");
}