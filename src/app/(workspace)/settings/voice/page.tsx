import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { VoicePrefsForm } from "@/components/settings/voice-prefs-form";

export default function SettingsVoicePage() {
  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Settings"
        title="Voice & languages"
        description="Recording language, transcription and microphone prefs. Changes apply immediately to the Record page."
      />
      <VoicePrefsForm />
    </ContentWrap>
  );
}
