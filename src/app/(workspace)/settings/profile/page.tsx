import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/app/actions/auth";

export default async function SettingsProfilePage() {
  const user = await getCurrentUser();

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Settings"
        title="Profile"
        description="Display name shown to others in spaces in place of your email."
      />
      <ProfileForm email={user?.email ?? null} />
    </ContentWrap>
  );
}
