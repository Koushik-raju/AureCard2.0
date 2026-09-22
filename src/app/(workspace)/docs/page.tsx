import { getSpaces, getProjects, getTasks, getDocuments } from "@/lib/repository";
import { CreateDocumentButton } from "@/components/create/create-document-form";
import { UploadDocumentButton } from "@/components/create/upload-document-form";
import { DocsExplorer } from "@/components/docs/docs-explorer";
import { ExportLibraryButton } from "@/components/docs/export-button";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";

export default async function DocsPage() {
  const [spaces, projects, tasks, documents] = await Promise.all([
    getSpaces(),
    getProjects(),
    getTasks(),
    getDocuments(),
  ]);
  const openTasks = tasks
    .filter((t) => t.status !== "done")
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      sourceDocId: t.sourceDocId,
    }));

  return (
    <ContentWrap>
      <PageHeader
        title="Library"
        actions={
          <>
            <ExportLibraryButton
              data={{
                exportedAt: new Date().toISOString(),
                spaces,
                projects,
                tasks,
                documents,
              }}
            />
            <UploadDocumentButton spaces={spaces} />
            <CreateDocumentButton spaces={spaces} />
          </>
        }
      />
      <DocsExplorer documents={documents} spaces={spaces} openTasks={openTasks} />
    </ContentWrap>
  );
}
