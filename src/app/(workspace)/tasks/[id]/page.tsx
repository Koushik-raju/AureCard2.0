import { notFound } from "next/navigation";
import {
  getTask,
  getProject,
  getSpace,
  getList,
  getTaskItemsForTask,
  getCommentsForTask,
  getActivityForTask,
  getDocumentsForTask,
  getTaskAttachmentsForTask,
  getDocument,
  getDocsForSpace,
} from "@/lib/repository";
import { getCurrentUser } from "@/app/actions/auth";
import { TaskDetail } from "@/components/tasks/task-detail";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const user = await getCurrentUser();
  const [project, space, list, items, comments, activity, documents, attachments, sourceDoc, spaceDocs] =
    await Promise.all([
      task.projectId ? getProject(task.projectId) : Promise.resolve(undefined),
      task.spaceId ? getSpace(task.spaceId) : Promise.resolve(undefined),
      task.listId ? getList(task.listId) : Promise.resolve(undefined),
      getTaskItemsForTask(task.id),
      getCommentsForTask(task.id),
      getActivityForTask(task.id),
      getDocumentsForTask(task.id),
      getTaskAttachmentsForTask(task.id),
      task.sourceDocId ? getDocument(task.sourceDocId) : Promise.resolve(undefined),
      getDocsForSpace(task.spaceId),
    ]);

  return (
    <TaskDetail
      task={task}
      projectName={project?.name}
      spaceName={space?.name}
      listName={list?.name}
      items={items}
      comments={comments}
      activity={activity}
      documents={documents}
      attachments={attachments}
      currentAuthor={user?.email}
      sourceDocTitle={sourceDoc?.title}
      spaceDocs={spaceDocs.map((d) => ({ id: d.id, title: d.title }))}
    />
  );
}
