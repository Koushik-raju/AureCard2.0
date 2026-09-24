/**
 * Small localStorage-backed preferences used by features that must work
 * without a database round-trip (voice prefs, display name, plan, org chart,
 * inbox read-state). All helpers are window-safe so they can load anywhere.
 */

import { useCallback, useState } from "react";

export const PREF_KEYS = {
  voice: "atlas:voice-prefs",
  displayName: "atlas:display-name",
  plan: "atlas:plan",
  org: "atlas:org-chart",
  inboxRead: "atlas:inbox-read",
  inboxSnapshot: "atlas:inbox-snapshot",
  dmVisits: "atlas:dm-visits",
  spaceTree: "atlas:space-tree",
  spaceTreeWidth: "atlas:space-tree-width",
  notifications: "atlas:notification-prefs",
} as const;

export type VoicePrefs = {
  /** BCP-47 tag used for live transcription, e.g. "en-US". */
  lang: string;
  /** Whether live transcription runs while recording. */
  transcription: boolean;
};

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  lang: "en-US",
  transcription: true,
};

export const RECOGNITION_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ar-SA", label: "Arabic" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
] as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — prefs stay in memory */
  }
}

export function getVoicePrefs(): VoicePrefs {
  return readJson<VoicePrefs>(PREF_KEYS.voice, DEFAULT_VOICE_PREFS);
}

export function useLocalPrefs<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJson<T>(key, initial));
  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((prev) => {
        const next = { ...prev, ...patch };
        writeJson(key, next);
        return next;
      });
    },
    [key]
  );
  const replace = useCallback(
    (next: T) => {
      setValue(next);
      writeJson(key, next);
    },
    [key]
  );
  return [value, update, replace] as const;
}

export function useVoicePrefs() {
  const [prefs, update, replace] = useLocalPrefs<VoicePrefs>(
    PREF_KEYS.voice,
    DEFAULT_VOICE_PREFS
  );
  return { prefs, updatePrefs: update, replacePrefs: replace };
}

export function clearLocalWorkspaceData(): string[] {
  if (typeof window === "undefined") return [];
  const cleared: string[] = [];
  for (const key of Object.values(PREF_KEYS)) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        cleared.push(key);
      }
    } catch {
      /* ignore */
    }
  }
  return cleared;
}
