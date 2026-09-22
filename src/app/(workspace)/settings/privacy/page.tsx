import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { PrivacyTools } from "@/components/settings/privacy-tools";
import { getCurrentUser } from "@/app/actions/auth";

export default async function SettingsPrivacyPage() {
  const user = await getCurrentUser();

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Settings"
        title="Privacy & data"
        description="Export all notes and transcripts as JSON, manage this device's local data, and account controls."
      />
      <PrivacyTools email={user?.email ?? null} />
    </ContentWrap>
  );
}
