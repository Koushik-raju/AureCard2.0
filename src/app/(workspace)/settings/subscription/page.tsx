import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { PlanManager } from "@/components/settings/plan-manager";

export default function SettingsSubscriptionPage() {
  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Settings"
        title="Subscription"
        description="Plan, billing and card/device entitlements."
      />
      <PlanManager />
    </ContentWrap>
  );
}
