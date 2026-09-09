import Link from "next/link";
import { getSpaces } from "@/lib/repository";
import { CreateSpaceButton } from "@/components/create/create-space-form";
import { accentStyles } from "@/lib/accents";

export default async function SpacesPage() {
  const spaces = await getSpaces();
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Spaces
          </h1>
          <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
            Broader working contexts that hold your projects, tasks, documents, and
            notes.
          </p>
        </div>
        <CreateSpaceButton />
      </header>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spaces.map((space) => {
          const accent = accentStyles(space.accent);
          return (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-muted-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${accent.dot}`}
                  aria-hidden="true"
                />
                <h2 className="truncate text-base font-medium">{space.name}</h2>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {space.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
