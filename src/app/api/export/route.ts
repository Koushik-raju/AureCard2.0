import { NextResponse } from "next/server";
import {
  getActivity,
  getComments,
  getDocumentAttachments,
  getDocumentBlocks,
  getDocuments,
  getFolders,
  getLists,
  getProjects,
  getSpaces,
  getTaskAttachments,
  getTaskItems,
  getTasks,
} from "@/lib/repository";

/**
 * Full workspace export as JSON (Privacy → Export). Served from the same
 * repository layer as the pages, so it respects the configured database
 * and row-level access of the signed-in user.
 */
export async function GET() {
  const [
    spaces,
    projects,
    folders,
    lists,
    tasks,
    taskItems,
    comments,
    activity,
    documents,
    documentBlocks,
    taskAttachments,
    documentAttachments,
  ] = await Promise.all([
    getSpaces(),
    getProjects(),
    getFolders(),
    getLists(),
    getTasks(),
    getTaskItems(),
    getComments(),
    getActivity(),
    getDocuments(),
    getDocumentBlocks(),
    getTaskAttachments(),
    getDocumentAttachments(),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    version: 1,
    spaces,
    projects,
    folders,
    lists,
    tasks,
    taskItems,
    comments,
    activity,
    documents,
    documentBlocks,
    taskAttachments,
    documentAttachments,
  });
}
