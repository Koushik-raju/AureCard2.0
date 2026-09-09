"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, isDbConfigured } from "@/lib/server-supabase";
import { getCurrentUser } from "@/app/actions/auth";
import type { Accent, DocumentBlockType, TaskPriority, TaskStatus } from "@/lib/types";
import * as memory from "@/lib/data";

/**
 * Persist mutations to Supabase. When the DB is not configured the app runs
 * in sample-data mode and these are no-ops (the UI keeps its own state).
 * Every action re-checks auth instead of relying on the proxy.
 */

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function requireClient() {
  const client = createServerSupabase();
  const user = await getCurrentUser();
  if (!client || !user) {
    throw new Error("Not signed in.");
  }
  return { client, user };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  if (!isDbConfigured) return;
  const { client } = await requireClient();
  const { error } = await client
    .from("tasks")
    .update({ status })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/search");
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTaskItemDone(
  taskId: string,
  itemId: string,
  done: boolean
) {
  if (!isDbConfigured) return;
  const { client } = await requireClient();
  const { error } = await client
    .from("task_items")
    .update({ done })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
}

export async function addComment(taskId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  if (!isDbConfigured) return;
  const { client, user } = await requireClient();
  const { error } = await client.from("task_comments").insert({
    task_id: taskId,
    author: user.email ?? "Guest",
    text: body.slice(0, 1000),
  });
  if (error) throw new Error(error.message);
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
  description?: string;
  dueDate?: string;
  tags?: string[];
};
export async function createTask(
  input: CreateTaskInput
): Promise<{ id?: string; error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  if (!input.spaceId) return { error: "Choose a space." };
  const id = newId("task");
  if (!isDbConfigured) {
    memory.tasks.push({
      id,
      title,
      spaceId: input.spaceId,
      projectId: input.projectId || undefined,
      listId: input.listId || undefined,
      status: input.status ?? "todo",
      priority: input.priority ?? undefined,
      description: input.description?.trim() || undefined,
      dueDate: input.dueDate || undefined,
      tags: input.tags?.length ? input.tags : undefined,
    });
    revalidatePath("/tasks");
    revalidatePath("/spaces");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("tasks").insert({
    id,
    title,
    space_id: input.spaceId,
    project_id: input.projectId || null,
    list_id: input.listId || null,
    status: input.status ?? "todo",
    priority: input.priority ?? null,
    description: input.description?.trim() || null,
    due_date: input.dueDate || null,
    tags: input.tags?.length ? input.tags : [],
  });
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
  kind?: "doc" | "note";
};
export async function createDocument(
  input: CreateDocumentInput
): Promise<{ id?: string; error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  if (!input.spaceId) return { error: "Choose a space." };
  const kind = input.kind ?? "doc";
  const id = newId("doc");
  if (!isDbConfigured) {
    memory.documents.push({
      id,
      title,
      spaceId: input.spaceId,
      projectId: input.projectId || undefined,
      kind,
    });
    memory.documentBlocks.push({
      id: newId("blk"),
      documentId: id,
      type: "heading",
      text: title,
    });
    revalidatePath("/docs");
    revalidatePath("/spaces");
    return { id };
  }
  const { client } = await requireClient();
  const { error } = await client.from("documents").insert({
    id,
    title,
    space_id: input.spaceId,
    project_id: input.projectId || null,
    kind,
    task_ids: [],
  });
  if (error) return { error: error.message };
  const blockId = newId("blk");
  const { error: blockError } = await client.from("document_blocks").insert({
    id: blockId,
    document_id: id,
    type: "heading",
    text: title,
    checked: false,
    position: 0,
  });
  if (blockError) return { error: blockError.message };
  revalidatePath("/docs");
  revalidatePath("/spaces");
  revalidatePath("/search");
  return { id };
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