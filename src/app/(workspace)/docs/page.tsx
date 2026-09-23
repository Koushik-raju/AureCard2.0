import { getSpaces, getDocuments, getDocMedia } from "@/lib/repository";
import { CreateDocumentButton } from "@/components/create/create-document-form";
import { UploadDocumentButton } from "@/components/create/upload-document-form";
import { DocsExplorer } from "@/components/docs/docs-explorer";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";

export default async function DocsPage() {
  const [spaces, documents, media] = await Promise.all([
    getSpaces(),
    getDocuments(),
    getDocMedia(),
  ]);

  return (
    <ContentWrap>
      <PageHeader
        title="Library"
        actions={
          <>
            <UploadDocumentButton spaces={spaces} />
            <CreateDocumentButton spaces={spaces} />
          </>
        }
      />
      <DocsExplorer documents={documents} spaces={spaces} mediaByDoc={Object.fromEntries(media)} />
    </ContentWrap>
  );
}
