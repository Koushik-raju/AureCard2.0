import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { PrivacyTools } from "@/components/settings/privacy-tools";
import { getCurrentUser } from "@/app/actions/auth";

export default async function SettingsPrivacyPage() {
  const user = await getCurrentUser();

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
        title="Privacy & data"
        description="Export all notes and transcripts as JSON, manage this device's local data, and account controls."
      />
      <PrivacyTools email={user?.email ?? null} />
    </ContentWrap>
  );
}
