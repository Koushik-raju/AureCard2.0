import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";

const GUIDES = [
  {
    id: "recording",
    title: "Recording your first session",
    body: [
      "Open Record from the sidebar and press Start recording. Your browser asks for microphone permission once — allow it to begin capturing with a live level meter and timer.",
      "Pause and resume any time; press Stop & review when you finish. Listen back, edit the transcript, pick which suggested tasks to keep, then Save to Library.",
      "The recording appears in the Library as a File note with a player, transcript, task and mind-map tabs. Without a microphone, add a typed note from the Library instead.",
    ],
  },
  {
    id: "transcription",
    title: "Transcription & languages",
    body: [
      "Live transcription runs entirely in your browser while you record — audio is only uploaded when you save.",
      "Pick the spoken language under Settings → Voice & languages. If your browser can't transcribe (Safari and Firefox have limited support), recording still works and you can paste or type the transcript on the review screen.",
      "Use the microphone check on the Voice settings page before important sessions.",
    ],
  },
  {
    id: "spaces",
    title: "Spaces, projects and tasks",
    body: [
      "Spaces are top-level contexts (Work, Personal). Projects live inside spaces, with folders and lists for finer structure.",
      "Create anything from the + menu or the relevant page. Tasks carry status, priority, assignee, due dates, subtasks, attachments, quotes and source notes.",
      "Checking a task block inside a document updates the linked task everywhere, and every change lands in History.",
    ],
  },
  {
    id: "assistant",
    title: "Atlas Assistant & Insights",
    body: [
      "Ask (sidebar → Ask) answers questions about your tasks, deadlines and priorities — no setup needed. Try “what's overdue?” or “what should I do first?”.",
      "Insights computes a live digest: completion rate, overdue and due-soon lists, longest-open items, recurring tag topics and captured-but-unresolved items from recordings.",
      "The Mind map draws your whole library as a pan-and-zoom canvas; amber branches mark subjects shared across recordings.",
    ],
  },
  {
    id: "desktop",
    title: "Desktop app & Atlas card pairing",
    body: [
      "The desktop companion adds global capture: press Ctrl+Shift+R anywhere to start or stop a recording, even outside the browser.",
      "Pair an Atlas card from the desktop app to file recordings to a space automatically. Card and device entitlements are managed under Settings → Subscription.",
      "Recordings made on desktop sync into the Library as File notes, identical to browser recordings.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: [
      "No sound captured: check the microphone check on the Voice settings page, confirm the browser has permission in your OS settings, and unplug Bluetooth headsets that may have taken over input.",
      "Save failed with a size error: recordings over 5 MB need Supabase Storage — create the “attachments” bucket (see supabase/schema.sql) so uploads bypass the database row limit.",
      "Signed out unexpectedly: sessions expire; sign back in from the login page. Your workspace data is unaffected.",
    ],
  },
];

export default function SettingsHelpPage() {
  return (
    <ContentWrap>
      <nav className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          ← Settings
        </Link>
      </nav>
      <PageHeader
        eyebrow="Settings"
        title="Help"
        description="Guides for recording, transcription, spaces, Atlas Assistant, the desktop app and troubleshooting."
      />
      <nav aria-label="Guides" className="mb-6 flex flex-wrap gap-1.5">
        {GUIDES.map((g) => (
          <Link
            key={g.id}
            href={`#${g.id}`}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {g.title}
          </Link>
        ))}
      </nav>
      <div className="space-y-4">
        {GUIDES.map((g) => (
          <section
            key={g.id}
            id={g.id}
            className="scroll-mt-20 rounded-xl border border-border bg-card p-6"
          >
            <h2 className="font-serif text-xl font-medium tracking-tight">{g.title}</h2>
            {g.body.map((paragraph, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </ContentWrap>
  );
}
