import type { DocumentRef } from "@/lib/types";

/** Display type for a library item. Docs and notes share the "note" type. */
export type LibraryItemType = "recording" | "image" | "file" | "note";

export const LIBRARY_TYPE_LABEL: Record<LibraryItemType, string> = {
  recording: "Recording",
  image: "Image",
  file: "File",
  note: "Note",
};

/**
 * Resolve how a document should be presented. Audio (explicit recording type
 * or an audio attachment) is a recording; images are images; anything else
 * binary is a generic file. Without attachment info we fall back to the
 * stored columns (never guessing "recording" from kind alone).
 */
export function resolveDocType(
  doc: Pick<DocumentRef, "kind" | "recordingType" | "durationSecs">,
  mimes: string[] = []
): LibraryItemType {
  if (doc.kind !== "file") return "note";
  if (doc.recordingType || mimes.some((m) => m.startsWith("audio/"))) {
    return "recording";
  }
  if (mimes.some((m) => m.startsWith("image/"))) return "image";
  return "file";
}

export function isRecordingDoc(
  doc: Pick<DocumentRef, "kind" | "recordingType" | "durationSecs">,
  mimes: string[] = []
): boolean {
  return resolveDocType(doc, mimes) === "recording";
}
