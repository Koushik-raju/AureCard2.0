"use client";

import { useRef, useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { createDocument } from "@/lib/mutations";
import { DATA_URL_MAX_BYTES, uploadMediaFile } from "@/lib/storage";
import { RECORDING_TYPES } from "@/lib/note-types";
import { Input } from "@/components/ui/input";
import { CreateButton, Field, FormActions, SelectField } from "./inline-create";
import type { DocumentBlockType, RecordingType, Space } from "@/lib/types";

function parseBlocks(text: string): { type: DocumentBlockType; text: string }[] {
  const lines = text.split(/\r?\n/);
  const blocks: { type: DocumentBlockType; text: string }[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) {
      if (inCode) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) continue;
    if (/^#{2,}\s+/.test(line)) {
      blocks.push({ type: "subheading", text: line.replace(/^#+\s+/, "") });
    } else if (/^#\s+/.test(line)) {
      blocks.push({ type: "heading", text: line.replace(/^#+\s+/, "") });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ type: "bulleted", text: line.replace(/^[-*]\s+/, "") });
    } else if (/^\d+[.)]\s+/.test(line)) {
      blocks.push({ type: "numbered", text: line.replace(/^\d+[.)]\s+/, "") });
    } else if (/^>\s+/.test(line)) {
      blocks.push({ type: "quote", text: line.replace(/^>\s+/, "") });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  if (inCode && codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }
  return blocks.slice(0, 300);
}

function isTextFile(file: File) {
  if (/\.(txt|md|markdown)$/i.test(file.name)) return true;
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml") return true;
  return false;
}

export function UploadDocumentButton({
  spaces,
  defaultProjectId,
}: {
  spaces: Space[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [kind, setKind] = useState<"doc" | "note">("doc");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [binary, setBinary] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [recordingType, setRecordingType] = useState<RecordingType>("thought");
  const [durationSecs, setDurationSecs] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setFileMime(file.type || "application/octet-stream");
    setFileSize(file.size);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    const textFile = isTextFile(file);
    if (textFile) {
      setPickedFile(null);
      const reader = new FileReader();
      reader.onload = () => {
        setBody(String(reader.result ?? ""));
        setBinary(false);
      };
      reader.readAsText(file);
    } else {
      // Binary files upload to Supabase Storage on submit, so any size up
      // to the storage cap works (videos included). Nothing is read here.
      setPickedFile(file);
      setBody("");
      setBinary(true);
      setDurationSecs(undefined);
      if (file.type.startsWith("audio/")) {
        // Readjust filing default for audio and capture real duration.
        setRecordingType("thought");
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          if (Number.isFinite(audio.duration)) {
            setDurationSecs(Math.round(audio.duration));
          }
          URL.revokeObjectURL(objectUrl);
        };
        audio.onerror = () => URL.revokeObjectURL(objectUrl);
        audio.src = objectUrl;
      }
    }
    e.target.value = "";
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const effectiveKind: "doc" | "note" | "file" = binary ? "file" : kind;
      let data = body;
      if (binary && pickedFile) {
        if (pickedFile.size > 50 * 1024 * 1024) {
          setError(`"${pickedFile.name}" is too large. Keep files under 50MB.`);
          return;
        }
        setUploading(true);
        try {
          const uploaded = await uploadMediaFile(pickedFile, "docs");
          if ("error" in uploaded) {
            setError(uploaded.error);
            return;
          }
          data = uploaded.url;
        } finally {
          setUploading(false);
        }
      } else if (binary && body && body.length > DATA_URL_MAX_BYTES * 1.4) {
        setError("File is too large. Keep files under 5MB.");
        return;
      }
      const result = await createDocument({
        title,
        spaceId,
        projectId: defaultProjectId,
        kind: effectiveKind,
        blocks: !binary && body ? parseBlocks(body) : undefined,
        recordingType: binary && fileMime.startsWith("audio/") ? recordingType : undefined,
        durationSecs: binary && fileMime.startsWith("audio/") ? durationSecs : undefined,
        attachments:
          binary && fileName && data
            ? [
                {
                  name: fileName,
                  mime: fileMime,
                  size: fileSize,
                  data,
                },
              ]
            : undefined,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/docs/${result.id}`);
      }
      router.refresh();
    });
  }

  return (
    <CreateButton
      label="Upload"
      description="Import a .txt/.md file as a document, or store any file — PDF, image, video up to 50MB."
    >
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Field label="File">
            <input
              ref={fileRef}
              type="file"
              onChange={onFileChange}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
            />
          </Field>
          {fileName ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {binary ? <FileText className="size-3.5" /> : <Upload className="size-3.5" />}
              {binary
                ? `Will store ${fileName} as a file document`
                : `Read ${fileName} (${body.length.toLocaleString()} chars)`}
            </p>
          ) : null}
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Imported notes"
              required
              autoFocus
            />
          </Field>
          <SelectField
            label="Space"
            name="space"
            value={spaceId}
            onChange={setSpaceId}
            placeholder="Pick a space"
            required
            options={spaces.map((s) => ({ value: s.id, label: s.name }))}
          />
          {!binary ? (
            <SelectField
              label="Type"
              name="kind"
              value={kind}
              onChange={(v) => setKind(v as "doc" | "note")}
              options={[
                { value: "doc", label: "Document" },
                { value: "note", label: "Note" },
              ]}
            />
          ) : null}
          {binary && fileMime.startsWith("audio/") ? (
            <Field label="File under">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Recording type">
                {RECORDING_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={recordingType === t.key}
                    onClick={() => setRecordingType(t.key)}
                    className={
                      recordingType === t.key
                        ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                        : "rounded-full border border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}
          {uploading ? (
            <p className="text-sm text-muted-foreground">Uploading file…</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions
            onCancel={close}
            isPending={isPending || uploading}
            submitLabel={binary ? "Upload file" : "Import document"}
          />
        </form>
      )}
    </CreateButton>
  );
}