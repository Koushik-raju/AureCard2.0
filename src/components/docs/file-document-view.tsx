"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, File as FileIcon, FileText, Film, Image as ImageIcon, Music } from "lucide-react";
import type { DocumentAttachment } from "@/lib/types";
import { isRemoteUrl } from "@/lib/storage";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useTextPreview(data: string) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) setText(String(reader.result ?? ""));
    };
    const blob = dataUrlToBlob(data);
    if (blob && blob.size <= 512 * 1024) reader.readAsText(blob);
    return () => {
      cancelled = true;
    };
  }, [data]);
  return text;
}

export function dataUrlToBlob(data: string): Blob | null {
  const comma = data.indexOf(",");
  if (comma < 0) return null;
  const meta = data.slice(0, comma);
  const body = data.slice(comma + 1);
  const mime = /^data:([^;]+)/.exec(meta)?.[1] ?? "application/octet-stream";
  let base64 = body.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function isTextMime(mime: string, name: string) {
  if (/\.(txt|md|markdown|csv|json|xml|log)$/i.test(name)) return true;
  if (mime.startsWith("text/")) return true;
  if (/^(application\/(json|xml|javascript|x-javascript)|text\/)/.test(mime)) return true;
  return false;
}

export function FileDocumentView({ attachments }: { attachments: DocumentAttachment[] }) {
  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-sm text-muted-foreground">
        <Download className="size-5" />
        This file document is empty.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {attachments.map((file) => (
        <AttachmentCard key={file.id} file={file} />
      ))}
    </div>
  );
}

function KindIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime.startsWith("video/")) return <Film className={className} />;
  if (mime.startsWith("audio/")) return <Music className={className} />;
  if (mime === "application/pdf" || mime.startsWith("text/")) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

function AttachmentCard({ file }: { file: DocumentAttachment }) {
  const url = file.data;
  const remote = isRemoteUrl(url);
  const preview = useTextPreview(remote ? "" : url);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <KindIcon mime={file.mime} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{file.name}</span>
          <span className="block text-xs text-muted-foreground">
            {file.mime || "file"} · {formatBytes(file.size)}
          </span>
        </span>
        <a
          href={url}
          download={remote ? undefined : file.name}
          target={remote ? "_blank" : undefined}
          rel={remote ? "noopener noreferrer" : undefined}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="size-4" />
          Download
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="size-4" />
          Open
        </a>
      </div>
      <div className="p-4">

      {file.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={file.name}
          className="max-h-[70vh] w-full rounded-lg border border-border bg-muted object-contain"
        />
      ) : file.mime.startsWith("video/") ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video max-h-[70vh] w-full rounded-lg border border-border bg-black"
        />
      ) : file.mime.startsWith("audio/") ? (
        <audio src={url} controls className="w-full" />
      ) : file.mime === "application/pdf" ? (
        <iframe
          src={url}
          title={file.name}
          className="h-[70vh] w-full rounded-lg border border-border bg-muted"
        />
      ) : isTextMime(file.mime, file.name) && !remote ? (
        preview === null ? (
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Preview unavailable for files over 512 KB. Use Download to view the full file.
          </div>
        ) : (
          <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
            {preview}
          </pre>
        )
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
          No inline preview for {file.mime || "this file"}. Download the file to view it.
        </div>
      )}
      </div>
    </div>
  );
}