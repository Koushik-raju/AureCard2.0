import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { VoicePrefsForm } from "@/components/settings/voice-prefs-form";

export default function SettingsVoicePage() {
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
        title="Voice & languages"
        description="Recording language, transcription and microphone prefs. Changes apply immediately to the Record page."
      />
      <VoicePrefsForm />
    </ContentWrap>
  );
}
