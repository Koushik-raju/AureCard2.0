import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getDocument,
  getBlocksForDocument,
  getTasks,
  getSpace,
  getProject,
  getTasksForDocument,
  getDocumentAttachmentsForDocument,
} from "@/lib/repository";
import { accentStyles } from "@/lib/accents";
import { RecordingDetailTabs } from "@/components/docs/recording-detail-tabs";
import { LinkedTaskChip } from "@/components/docs/linked-task-chip";
import { DocumentMenu } from "@/components/create/entity-menus";
import { DocumentHeaderEditor } from "@/components/create/inline-editor";
import { ContentWrap } from "@/components/layout/content-wrap";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();

  const [space, project, blocks, attachments, linkedTasks, allTasks] =
    await Promise.all([
      getSpace(document.spaceId),
      document.projectId
        ? getProject(document.projectId)
        : Promise.resolve(undefined),
      getBlocksForDocument(id),
      getDocumentAttachmentsForDocument(id),
      getTasksForDocument(id),
      getTasks(),
    ]);
  const accent = accentStyles(space?.accent ?? "ink");

  const taskTitles: Record<string, string> = {};
  const tasksById = new Map(allTasks.map((t) => [t.id, t]));
  for (const block of blocks) {
    if (block.taskId) {
      const task = tasksById.get(block.taskId);
      if (task) taskTitles[task.id] = task.title;
    }
  }

  const isFile = document.kind === "file";

  return (
    <ContentWrap>
      <nav className="mb-6 flex items-center gap-2 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground" aria-label="Breadcrumb">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="size-4" />
          Library
        </Link>
        {project ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/projects/${project.id}`}
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {project.name}
            </Link>
          </>
        ) : null}
        {space ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/spaces/${space.id}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <span className={`size-2 rounded-full ${accent.dot}`} aria-hidden="true" />
              {space.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <DocumentHeaderEditor
          documentId={document.id}
          title={document.title}
          actions={
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {document.kind === "note" ? "Note" : isFile ? "File" : "Doc"}
              </span>
              <DocumentMenu
                documentId={document.id}
                documentTitle={document.title}
              />
            </span>
          }
        />
      </header>

      {linkedTasks.length > 0 ? (
        <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="uppercase tracking-[0.14em] text-[11px] text-muted-foreground">
            Linked tasks
          </span>
          {linkedTasks.map((task) => (
            <LinkedTaskChip key={task.id} task={task} />
          ))}
        </p>
      ) : null}

      <div className="mt-6">
        <RecordingDetailTabs
          document={document}
          blocks={blocks}
          attachments={attachments}
          linkedTasks={linkedTasks}
          taskTitles={taskTitles}
        />
      </div>
    </ContentWrap>
  );
}