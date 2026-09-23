import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { PlanManager } from "@/components/settings/plan-manager";

export default function SettingsSubscriptionPage() {
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
        title="Subscription"
        description="Plan, billing and card/device entitlements."
      />
      <PlanManager />
    </ContentWrap>
  );
}
