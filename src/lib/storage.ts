"use client";

import { getBrowserSupabase } from "@/lib/supabase-client";

export const STORAGE_BUCKET = "attachments";
/** Cap for Storage uploads (browser → Supabase directly). */
export const STORAGE_MAX_BYTES = 50 * 1024 * 1024;
/** Cap for legacy base64 data-URL payloads (DB row + server action). */
export const DATA_URL_MAX_BYTES = 5 * 1024 * 1024;

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isStorageConfigured(): boolean {
  return getBrowserSupabase() !== null;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type UploadResult =
  | { url: string; via: "storage" | "data-url" }
  | { error: string };

/**
 * Upload a binary file. Prefers Supabase Storage (no server-action size
 * bottleneck, works for videos); falls back to a base64 data URL when the
 * DB/storage client is unavailable (sample-data mode) or the upload fails
 * for a small file.
 */
export async function uploadMediaFile(
  file: File,
  prefix = "uploads"
): Promise<UploadResult> {
  const client = getBrowserSupabase();
  if (client) {
    if (file.size > STORAGE_MAX_BYTES) {
      return { error: `"${file.name}" is too large. Keep files under 50MB.` };
    }
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeName(file.name)}`;
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (!error) {
      const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) return { url: data.publicUrl, via: "storage" };
    }
    // Storage upload failed (e.g. bucket not created yet) — fall through to
    // data URL for small files so uploads keep working.
    if (file.size > DATA_URL_MAX_BYTES) {
      return {
        error: error?.message ?? "Upload failed. Create the 'attachments' storage bucket (see supabase/schema.sql) and try again.",
      };
    }
  } else if (file.size > DATA_URL_MAX_BYTES) {
    return { error: `"${file.name}" is too large. Keep files under 5MB.` };
  }
  try {
    const url = await readAsDataUrl(file);
    return { url, via: "data-url" };
  } catch {
    return { error: `Could not read "${file.name}".` };
  }
}
