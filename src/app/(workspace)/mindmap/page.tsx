import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { MindmapCanvas } from "@/components/mindmap/mindmap-canvas";
import { buildMindGraph } from "@/lib/mindmap";
import {
  getDocMedia,
  getDocuments,
  getProjects,
  getSpaces,
  getTasks,
} from "@/lib/repository";

export default async function MindmapPage() {
  const [spaces, projects, documents, tasks, media] = await Promise.all([
    getSpaces(),
    getProjects(),
    getDocuments(),
    getTasks(),
    getDocMedia(),
  ]);
  const mediaMimes: Record<string, string[]> = Object.fromEntries(
    [...media.entries()].map(([id, list]) => [id, list.map((m) => m.mime)])
  );
  const graph = buildMindGraph({ spaces, projects, documents, tasks, mediaMimes });
  const sharedCount = graph.nodes.filter((n) => n.kind === "topic").length;

  return (
    <ContentWrap wide>
      <PageHeader
        eyebrow="Aure"
        title="Mind map"
        description="Whole-library concept map. Subjects in more than one recording highlight as amber branches; standalone recordings stay grey."
      />
      {graph.nodes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing to map yet. Add a <Link href="/docs" className="underline">note</Link> or a{" "}
          <Link href="/record" className="underline">recording</Link> and the map grows here.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {graph.nodes.length} concepts · {sharedCount} shared{" "}
            {sharedCount === 1 ? "subject" : "subjects"}
          </p>
          <MindmapCanvas graph={graph} />
        </>
      )}
    </ContentWrap>
  );
}
