import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getProject,
  getSpacesByProject,
  getFoldersForProject,
  getListsForProject,
  getTasksForProject,
  getDocsForProject,
  getSpaces,
  getTaskItems,
} from "@/lib/repository";
import type { TaskItem } from "@/lib/types";
import { CreateTaskButton } from "@/components/create/create-task-form";
import { CreateDocumentButton } from "@/components/create/create-document-form";
import { UploadDocumentButton } from "@/components/create/upload-document-form";
import { ProjectMenu, FolderMenu, ListMenu } from "@/components/create/entity-menus";
import { ProjectHeaderEditor } from "@/components/create/inline-editor";
import {
  CreateFolderButton,
  AddListInline,
} from "@/components/create/project-structure";
import { accentStyles } from "@/lib/accents";
import { cn } from "@/lib/utils";
import { TaskList } from "@/components/tasks/task-list";

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <span className="text-xs text-muted-foreground/60">{count}</span>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const space = await getSpacesByProject(project.id);
  const accent = accentStyles(space?.accent ?? "ink");
  const folders = await getFoldersForProject(project.id);
  const allLists = await getListsForProject(project.id);
  const allTasks = await getTasksForProject(project.id);
  const projectDocs = await getDocsForProject(project.id);
  const allSpaces = await getSpaces();

  const taskItems = await getTaskItems();
  const itemsByTask: Record<string, TaskItem[]> = {};
  for (const item of taskItems) {
    (itemsByTask[item.taskId] ??= []).push(item);
  }

  const tasksInLists = new Set(
    allLists.flatMap((l) => allTasks.filter((t) => t.listId === l.id).map((t) => t.id))
  );
  const unboundLists = allLists.filter((l) => !l.folderId);
  const unboundTasks = allTasks.filter((t) => !tasksInLists.has(t.id));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-10">
      <nav className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="size-4" />
          Projects
        </Link>
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
        <ProjectHeaderEditor
          projectId={project.id}
          name={project.name}
          description={project.description}
          marker={<span className={`size-3 rounded-full ${accent.dot}`} aria-hidden="true" />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <CreateTaskButton
                spaces={allSpaces}
                projects={[project]}
                defaultSpaceId={project.spaceId}
                defaultProjectId={project.id}
              />
              <UploadDocumentButton spaces={allSpaces} defaultProjectId={project.id} />
              <CreateDocumentButton spaces={allSpaces} defaultProjectId={project.id} />
              <ProjectMenu
                projectId={project.id}
                projectName={project.name}
                onDeleteRedirect="/projects"
              />
            </div>
          }
        />
      </header>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <SectionHeading title="Tasks" count={allTasks.length} />
          <CreateFolderButton projectId={project.id} spaceId={project.spaceId} />
        </div>
      </section>

      {folders.map((folder) => {
        const folderLists = allLists.filter((l) => l.folderId === folder.id);
        return (
          <section key={folder.id} className="mt-6">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">{folder.name}</h3>
              <AddListInline
                projectId={project.id}
                spaceId={project.spaceId}
                folderId={folder.id}
              />
              <div className="ml-auto">
                <FolderMenu folderId={folder.id} folderName={folder.name} />
              </div>
            </div>
            {folderLists.map((list) => {
              const listTasks = allTasks.filter((t) => t.listId === list.id);
              if (listTasks.length === 0) return null;
              return (
                <div key={list.id} className="mt-3 border-l border-border pl-4">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {list.name}
                    </h4>
                    <span className="text-xs text-muted-foreground/60">
                      {listTasks.length}
                    </span>
                    <ListMenu listId={list.id} listName={list.name} />
                  </div>
                  <ul className="mt-1 divide-y divide-border">
                    <TaskList tasks={listTasks} itemsByTask={itemsByTask} />
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}

      {folders.length === 0 ? (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Lists</h3>
            <AddListInline
              projectId={project.id}
              spaceId={project.spaceId}
            />
          </div>
        </section>
      ) : null}

      {unboundLists.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Lists</h3>
            <AddListInline
              projectId={project.id}
              spaceId={project.spaceId}
            />
          </div>
          {unboundLists.map((list) => {
            const listTasks = allTasks.filter((t) => t.listId === list.id);
            if (listTasks.length === 0) return null;
            return (
              <div key={list.id} className="mt-3 border-l border-border pl-4">
                <div className="flex items-baseline gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {list.name}
                  </h4>
                  <span className="text-xs text-muted-foreground/60">
                    {listTasks.length}
                  </span>
                  <ListMenu listId={list.id} listName={list.name} />
                </div>
                <ul className="mt-1 divide-y divide-border">
                  <TaskList tasks={listTasks} itemsByTask={itemsByTask} />
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}

      {unboundTasks.length > 0 ? (
        <section className="mt-6 border-l border-border pl-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tasks
          </h3>
          <ul className="mt-1 divide-y divide-border">
            <TaskList tasks={unboundTasks} itemsByTask={itemsByTask} />
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <SectionHeading title="Documents" count={projectDocs.length} />
        <ul className="mt-3 divide-y divide-border">
          {projectDocs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              <span className={cn("size-1.5 shrink-0 rounded-full", accent.dot)} />
              <Link
                href={`/docs/${doc.id}`}
                className="text-[15px] leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors"
              >
                {doc.title}
              </Link>
              <span className="ml-auto text-xs text-muted-foreground">
                {doc.kind === "note" ? "Note" : doc.kind === "file" ? "File" : "Doc"}
              </span>
            </li>
          ))}
          {projectDocs.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No documents yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
