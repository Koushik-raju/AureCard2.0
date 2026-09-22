"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RECOGNITION_LANGS, useVoicePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export function VoicePrefsForm() {
  const { prefs, updatePrefs } = useVoicePrefs();
  const [micState, setMicState] = useState<"unknown" | "ok" | "blocked" | "missing">("unknown");
  const [checking, setChecking] = useState(false);

  async function checkMic() {
    setChecking(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setMicState("missing");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicState("ok");
      }
    } catch {
      setMicState("blocked");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Transcription</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live transcription runs in your browser while you record, in the language below.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Transcription">
          {[
            { value: true, label: "On" },
            { value: false, label: "Off" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => updatePrefs({ transcription: opt.value })}
              aria-pressed={prefs.transcription === opt.value}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                prefs.transcription === opt.value
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <Label htmlFor="voice-lang" className="font-serif text-lg font-medium tracking-tight">
          Recording language
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Used for live transcription on the Record page.
        </p>
        <select
          id="voice-lang"
          value={prefs.lang}
          onChange={(e) => updatePrefs({ lang: e.target.value })}
          className="mt-3 h-10 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
        >
          {RECOGNITION_LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Microphone check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifies this browser can reach your microphone before an important session.
        </p>
        <Button onClick={checkMic} disabled={checking} variant="outline" className="mt-3 min-h-11">
          <Mic className="size-4" /> {checking ? "Checking…" : "Check microphone"}
        </Button>
        {micState === "ok" && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">Microphone is working.</p>
        )}
        {micState === "blocked" && (
          <p className="mt-2 text-sm text-destructive">
            Microphone is blocked. Allow access in your browser&apos;s site settings.
          </p>
        )}
        {micState === "missing" && (
          <p className="mt-2 text-sm text-destructive">
            This browser doesn&apos;t support in-browser recording. Use Chrome or Edge, or add a typed note instead.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Desktop hotkey</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The desktop companion app starts and stops recording globally with{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl+Shift+R</kbd>.
          Install the desktop app to use it outside the browser.
        </p>
      </div>
    </div>
  );
}
