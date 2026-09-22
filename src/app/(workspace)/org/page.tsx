import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { OrgManager } from "@/components/org/org-manager";
import { getDocuments, getSpaces, getTasks } from "@/lib/repository";

export default async function OrgPage() {
  const [spaces, tasks, documents] = await Promise.all([
    getSpaces(),
    getTasks(),
    getDocuments(),
  ]);

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Collaboration"
        title="Organization"
        description="Model a hospital, site or company with departments. Notes roll up into digests level by level."
      />
      <OrgManager spaces={spaces} tasks={tasks} documents={documents} />
    </ContentWrap>
  );
}
