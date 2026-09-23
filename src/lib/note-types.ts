import type { NoteType, RecordingType } from "@/lib/types";

export const RECORDING_TYPES: { key: RecordingType; label: string }[] = [
  { key: "meeting", label: "Meetings" },
  { key: "conversation", label: "Conversations" },
  { key: "call", label: "Calls" },
  { key: "thought", label: "Thoughts" },
  { key: "lecture", label: "Lectures" },
];

export const NOTE_TYPE_OPTIONS: { key: NoteType; label: string; sections: string[] }[] = [
  {
    key: "general",
    label: "General",
    sections: ["Summary", "Notes", "Actions", "Open Questions"],
  },
  {
    key: "meeting",
    label: "Meeting note",
    sections: ["Agenda", "Summary", "Decisions", "Actions", "Open Questions"],
  },
  {
    key: "soap",
    label: "Clinical SOAP note",
    sections: ["Subjective", "Objective", "Assessment", "Plan", "Notes", "Follow-up"],
  },
];

export function noteTypeLabel(key: NoteType): string {
  return NOTE_TYPE_OPTIONS.find((o) => o.key === key)?.label ?? "General";
}

export function recordingTypeLabel(key: RecordingType): string {
  return RECORDING_TYPES.find((o) => o.key === key)?.label ?? key;
}

export function formatDuration(totalSecs: number | undefined): string | null {
  if (totalSecs === undefined || totalSecs === null || Number.isNaN(totalSecs)) return null;
  const m = Math.floor(totalSecs / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
