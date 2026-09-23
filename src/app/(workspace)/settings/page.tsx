import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";

const SECTIONS = [
  { href: "/settings/profile", title: "Profile", desc: "Name shown to others in spaces." },
  { href: "/settings/notifications", title: "Notifications", desc: "Which inbox events notify you." },
  { href: "/settings/voice", title: "Voice & languages", desc: "Recording, transcription and language prefs." },
  { href: "/settings/subscription", title: "Subscription", desc: "Plan and billing." },
  { href: "/settings/privacy", title: "Privacy & data", desc: "Export notes as JSON, manage local data." },
  { href: "/settings/help", title: "Help", desc: "Guides and support." },
];

export default function SettingsPage() {
  return (
    <ContentWrap>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Account, voice, subscription, privacy and help — everything about how your workspace behaves."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block min-h-11 rounded-xl border border-border bg-card p-5 transition-colors hover:border-ring"
            >
              <h2 className="font-serif text-lg font-medium tracking-tight">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </ContentWrap>
  );
}
