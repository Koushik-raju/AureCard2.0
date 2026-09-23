import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getComments,
  getDocMedia,
  getDocumentBlocks,
  getDocuments,
  getFolders,
  getLists,
  getProjects,
  getSpaces,
  getTasks,
} from "@/lib/repository";
import { buildSearchEntries } from "@/lib/search-index";

/**
 * Workspace search index for the ⌘K palette. Same builder as /search,
 * served as JSON. Requires a signed-in user; rows come through RLS.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const [spaces, projects, lists, folders, tasks, documents, blocks, comments, media] =
    await Promise.all([
      getSpaces(),
      getProjects(),
      getLists(),
      getFolders(),
      getTasks(),
      getDocuments(),
      getDocumentBlocks(),
      getComments(),
      getDocMedia(),
    ]);
  const mediaMimes: Record<string, string[]> = Object.fromEntries(
    [...media.entries()].map(([id, list]) => [id, list.map((m) => m.mime)])
  );
  const entries = buildSearchEntries({
    spaces,
    projects,
    lists,
    folders,
    tasks,
    documents,
    blocks,
    comments,
    mediaMimes,
  });
  return NextResponse.json({ entries });
}
