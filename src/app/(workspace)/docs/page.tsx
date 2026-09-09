import Link from "next/link";
import { FileText, StickyNote } from "lucide-react";
import { getSpaces, getDocuments } from "@/lib/repository";
import { CreateDocumentButton } from "@/components/create/create-document-form";
import { accentStyles } from "@/lib/accents";
import { cn } from "@/lib/utils";

export default async function DocsPage() {
  const [spaces, documents] = await Promise.all([getSpaces(), getDocuments()]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Docs
          </h1>
          <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
            A calm, distraction-free place to write — where tasks can live right
            inside your documents.
          </p>
        </div>
        <CreateDocumentButton spaces={spaces} />
      </header>

      {spaces.map((space) => {
        const spaceDocs = documents.filter((d) => d.spaceId === space.id);
        const accent = accentStyles(space.accent);
        if (spaceDocs.length === 0) return null;

        return (
          <section key={space.id} className="mt-10 first-of-type:mt-8">
            <div className="flex items-center gap-2.5">
              <span className={`size-2.5 rounded-full ${accent.dot}`} aria-hidden="true" />
              <h2 className="text-sm font-medium">{space.name}</h2>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {spaceDocs.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/docs/${doc.id}`}
                    className="group flex items-center gap-3 rounded-sm py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {doc.kind === "note" ? (
                      <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] leading-snug group-hover:text-primary">
                      {doc.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground"
                      )}
                    >
                      {doc.kind === "note" ? "Note" : "Doc"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}