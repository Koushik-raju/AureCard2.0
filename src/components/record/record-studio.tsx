"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Disc3, Mic, Pause, Play, RotateCcw, Save, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocument, createTask } from "@/lib/mutations";
import { uploadMediaFile } from "@/lib/storage";
import { getVoicePrefs } from "@/lib/prefs";
import { RECORDING_TYPES } from "@/lib/note-types";
import {
  extractTaskSuggestions,
  summarizeTranscript,
} from "@/lib/transcript";
import type { RecordingType, Space } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "paused" | "review";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

function formatElapsed(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function defaultTitle(now: Date): string {
  const day = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false });
  return `Recording ${day}, ${time}`;
}

export function RecordStudio({ spaces }: { spaces: Space[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptUnsupported, setTranscriptUnsupported] = useState(false);
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [recordingType, setRecordingType] = useState<RecordingType>("thought");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [isPending, startTransition] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("");
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");
  const startStampRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const drawMeter = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      if (phaseRef.current !== "recording" && phaseRef.current !== "paused") return;
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const bars = 48;
      const gap = 3;
      const barW = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.7)] / 255;
        const h = Math.max(3, v * height);
        const live = phaseRef.current === "recording";
        ctx.fillStyle = live ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
        ctx.globalAlpha = live ? 0.55 + v * 0.45 : 0.35;
        const x = i * (barW + gap);
        ctx.fillRect(x, (height - h) / 2, barW, h);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopMeter();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [stopMeter]);

  useEffect(() => teardown, [teardown]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const extra =
        phaseRef.current === "paused" && pauseStartRef.current
          ? Date.now() - pauseStartRef.current
          : 0;
      setElapsed((Date.now() - startStampRef.current - pausedTotalRef.current - extra) / 1000);
    }, 250);
  }, []);

  const attachRecognition = useCallback((lang: string) => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setTranscriptUnsupported(true);
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript ?? "";
          if (res.isFinal) finalTranscriptRef.current += `${text}\n`;
          else interim += text;
        }
        const combined = `${finalTranscriptRef.current}${interim ? `\n${interim}` : ""}`.trim();
        setTranscript(combined);
      };
      rec.onerror = () => {
        /* keep recording; transcription is best-effort */
      };
      rec.onend = () => {
        // Auto-restart while still recording (Chrome stops after pauses).
        if (phaseRef.current === "recording" && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            /* already started */
          }
        } else {
          setTranscribing(false);
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setTranscribing(true);
    } catch {
      setTranscriptUnsupported(true);
    }
  }, []);

  async function start() {
    setError(null);
    setMicDenied(false);
    setTranscript("");
    setSuggestions([]);
    setChecked([]);
    finalTranscriptRef.current = "";
    chunksRef.current = [];
    pausedTotalRef.current = 0;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicDenied(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setPhase("review");
        setTitle((t) => t || defaultTitle(new Date()));
        setSuggestions(extractTaskSuggestions(finalTranscriptRef.current));
        setChecked((prev) => {
          if (prev.length > 0) return prev;
          return extractTaskSuggestions(finalTranscriptRef.current).map(() => true);
        });
      };
      recorderRef.current = recorder;

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const audioCtx = new Ctx();
        audioCtxRef.current = audioCtx;
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
      }

      recorder.start(250);
      startStampRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
      startTimer();
      drawMeter();

      const prefs = getVoicePrefs();
      if (prefs.transcription) attachRecognition(prefs.lang);
      else setTranscriptUnsupported(false);
    } catch (err) {
      setMicDenied(true);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the microphone in your browser, then try again — or add a typed note instead."
          : "Could not start recording with this microphone."
      );
      teardown();
    }
  }

  function pause() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      pauseStartRef.current = Date.now();
      recognitionRef.current?.stop();
      setTranscribing(false);
      setPhase("paused");
    }
  }

  function resume() {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      pausedTotalRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
      setPhase("recording");
      const prefs = getVoicePrefs();
      if (prefs.transcription) {
        finalTranscriptRef.current = transcript ? `${transcript}\n` : "";
        attachRecognition(prefs.lang);
      }
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopMeter();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setTranscribing(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function discard() {
    teardown();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript("");
    setSuggestions([]);
    setChecked([]);
    setTitle("");
    setElapsed(0);
    setError(null);
    setPhase("idle");
  }

  function toggleSuggestion(i: number) {
    setChecked((prev) => prev.map((c, idx) => (idx === i ? !c : c)));
  }

  function save() {
    const trimmedTitle = title.trim() || defaultTitle(new Date());
    if (!spaceId) {
      setError("Choose a space for this recording.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
      const ext = extensionFor(mimeRef.current);
      const file = new File([blob], `${trimmedTitle}.${ext}`, { type: blob.type || "audio/webm" });
      const upload = await uploadMediaFile(file, "recordings");
      if ("error" in upload) {
        setError(upload.error);
        return;
      }
      const durationSecs = Math.max(1, Math.round(elapsed));
      const cleanTranscript = transcript.trim();
      const result = await createDocument({
        title: trimmedTitle,
        spaceId,
        kind: "file",
        recordingType,
        durationSecs,
        summary: cleanTranscript ? summarizeTranscript(cleanTranscript) : undefined,
        transcript: cleanTranscript || undefined,
        attachments: [
          { name: file.name, mime: file.type || "audio/webm", size: file.size, data: upload.url },
        ],
      });
      if (result.error || !result.id) {
        setError(result.error ?? "Could not save this recording.");
        return;
      }
      const chosen = suggestions.filter((_, i) => checked[i]);
      for (const text of chosen) {
        const taskResult = await createTask({
          title: text,
          spaceId,
          quote: text,
          sourceDocId: result.id,
        });
        if (taskResult.error) break;
      }
      router.push(`/docs/${result.id}`);
      router.refresh();
    });
  }

  const recording = phase === "recording";
  const paused = phase === "paused";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {recording || paused ? (
          <Disc3 className={cn("size-5", recording && "animate-spin")} />
        ) : (
          <Mic className="size-5" />
        )}
      </div>
      <h2 className="mt-4 font-serif text-xl font-medium tracking-tight">
        Record in browser
      </h2>

      {(recording || paused) && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-medium tabular-nums" aria-live="polite">
              {formatElapsed(elapsed)}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {recording ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 animate-pulse rounded-full bg-destructive" />
                  Recording
                </span>
              ) : (
                "Paused"
              )}
            </p>
          </div>
          <canvas
            ref={canvasRef}
            width={560}
            height={72}
            className="mt-3 h-[72px] w-full rounded-lg bg-muted/50"
            aria-hidden="true"
          />
          {transcribing && (
            <p className="mt-2 text-xs text-muted-foreground">Transcribing live…</p>
          )}
          {transcriptUnsupported && (
            <p className="mt-2 text-xs text-muted-foreground">
              Live transcription isn&apos;t available in this browser — the audio still records normally.
            </p>
          )}
          {transcript && (
            <p className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
              {transcript}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {recording ? (
              <Button variant="outline" onClick={pause} className="min-h-11">
                <Pause className="size-4" /> Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={resume} className="min-h-11">
                <Play className="size-4" /> Resume
              </Button>
            )}
            <Button onClick={stop} className="min-h-11">
              <Square className="size-4" /> Stop & review
            </Button>
          </div>
        </div>
      )}

      {phase === "idle" && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Capture audio with live transcription, then save it to your
            Library with suggested follow-up tasks. Nothing leaves your
            browser until you hit save.
          </p>
          <Button onClick={start} className="mt-4 min-h-11">
            <Mic className="size-4" /> Start recording
          </Button>
        </div>
      )}

      {phase === "review" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="tabular-nums">{formatElapsed(elapsed)}</span>
            <span aria-hidden="true">·</span>
            <span>Ready to save</span>
          </div>
          {audioUrl && (
            <audio src={audioUrl} controls className="w-full" aria-label="Recorded audio preview" />
          )}
          <div className="space-y-2">
            <Label htmlFor="rec-title">Title</Label>
            <Input
              id="rec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recording title"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rec-space">Space</Label>
              <select
                id="rec-space"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium" id="rec-type-label">Type</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="rec-type-label">
                {RECORDING_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setRecordingType(t.key)}
                    aria-pressed={recordingType === t.key}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      recordingType === t.key
                        ? "border-foreground bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-transcript">
              Transcript {transcript ? "" : "(add one manually or leave empty)"}
            </Label>
            <textarea
              id="rec-transcript"
              rows={5}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                finalTranscriptRef.current = e.target.value;
                const next = extractTaskSuggestions(e.target.value);
                setSuggestions(next);
                setChecked(next.map(() => true));
              }}
              placeholder="What was said… edit freely — this becomes the note's transcript."
              className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </div>
          {suggestions.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Suggested tasks ({checked.filter(Boolean).length} selected)
              </legend>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary/60 has-checked:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={!!checked[i]}
                        onChange={() => toggleSuggestion(i)}
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <span className="leading-snug">{s}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={isPending} className="min-h-11">
              <Save className="size-4" /> {isPending ? "Saving…" : "Save to Library"}
            </Button>
            <Button variant="outline" onClick={discard} disabled={isPending} className="min-h-11">
              <RotateCcw className="size-4" /> Discard
            </Button>
            <Button variant="ghost" onClick={start} disabled={isPending} className="min-h-11">
              <Mic className="size-4" /> Record again
            </Button>
          </div>
        </div>
      )}

      {micDenied && (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No microphone found or access was blocked. You can still capture the
          moment as a typed note from the Library.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
