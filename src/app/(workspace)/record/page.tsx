import Link from "next/link";
import { FileAudio, PenLine } from "lucide-react";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RecordStudio } from "@/components/record/record-studio";
import {
  getDocMedia,
  getDocumentAttachmentsForDocument,
  getDocuments,
  getSpaces,
} from "@/lib/repository";
import { isRecordingDoc } from "@/lib/doc-type";
import { formatDuration, recordingTypeLabel } from "@/lib/note-types";

export default async function RecordPage() {
  const [spaces, documents, media] = await Promise.all([getSpaces(), getDocuments(), getDocMedia()]);
  const mimesOf = (id: string) => (media.get(id) ?? []).map((m) => m.mime);
  const recordings = documents
    .filter((d) => isRecordingDoc(d, mimesOf(d.id)))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 6);

  const audioByDoc: Record<string, string | undefined> = {};
  await Promise.all(
    recordings.map(async (doc) => {
      const files = await getDocumentAttachmentsForDocument(doc.id);
      audioByDoc[doc.id] = files.find((f) => f.mime.startsWith("audio/"))?.data;
    })
  );

  const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Capture"
        title="Record"
        description="Capture a meeting, call, lecture or thought — with live transcription and suggested follow-ups. If the microphone is unavailable, fall back to a typed note."
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <RecordStudio spaces={spaces} />
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <PenLine className="size-5" />
          </div>
          <h2 className="mt-4 font-serif text-xl font-medium tracking-tight">
            Typed note instead
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Mic unavailable? Add a note by hand from the Library — General,
            Meeting or Clinical SOAP types live there.
          </p>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link href="/docs">Go to Library</Link>
          </Button>
        </div>
      </div>

      <section className="mt-10" aria-label="Recent recordings">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Recent recordings
        </h2>
        {recordings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing recorded yet — your first recording lands here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {recordings.map((doc) => {
              const audio = audioByDoc[doc.id];
              const duration = formatDuration(doc.durationSecs);
              return (
                <li
                  key={doc.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <FileAudio className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/docs/${doc.id}`}
                        className="truncate text-[15px] font-medium hover:underline"
                      >
                        {doc.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          doc.recordingType ? recordingTypeLabel(doc.recordingType) : "",
                          spaceNames.get(doc.spaceId) ?? "",
                          duration ? `· ${duration}` : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      {doc.summary && (
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                          {doc.summary}
                        </p>
                      )}
                    </div>
                  </div>
                  {audio ? (
                    <audio
                      src={audio}
                      controls
                      preload="none"
                      className="mt-3 w-full"
                      aria-label={`Play ${doc.title}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ContentWrap>
  );
}
