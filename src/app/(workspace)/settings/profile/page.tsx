import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/app/actions/auth";

export default async function SettingsProfilePage() {
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
        title="Profile"
        description="Display name shown to others in spaces in place of your email."
      />
      <ProfileForm email={user?.email ?? null} />
    </ContentWrap>
  );
}
