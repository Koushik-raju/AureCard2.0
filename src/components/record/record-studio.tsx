"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Disc3, Mic, Pause, Play, RotateCcw, Save, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocument, createTask } from "@/lib/mutations";
import { uploadMediaFile } from "@/lib/storage";
import { getVoicePrefs } from "@/lib/prefs";
import { RECORDING_TYPES } from "@/lib/note-types";
import {
  cycleSpeaker,
  extractTaskSuggestions,
  formatTurns,
  parseTurns,
  renameSpeakerInTurns,
  rosterOf,
  stripSpeakers,
  summarizeTranscript,
  type Turn,
} from "@/lib/transcript";
import { AssigneeAvatar } from "@/components/tasks/hues";
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
  // Speaker turns are the single source of truth for what was said; the plain
  // transcript string mirrors them for the non-conversation UI and save path.
  const [turns, setTurns] = useState<Turn[]>([{ speaker: "Speaker 1", text: "" }]);
  const [turnInterim, setTurnInterim] = useState("");
  // Names added via the Speakers panel before they own any turn.
  const [extraSpeakers, setExtraSpeakers] = useState<string[]>([]);
  const turnsRef = useRef<Turn[]>([{ speaker: "Speaker 1", text: "" }]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  const extraSpeakersRef = useRef<string[]>([]);
  useEffect(() => {
    extraSpeakersRef.current = extraSpeakers;
  }, [extraSpeakers]);
  // One central roster — turn rows only reference it, never define names.
  const roster = useMemo(
    () => rosterOf(turns, extraSpeakers),
    [turns, extraSpeakers]
  );
  const lastFinalAtRef = useRef(0);
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

  const refreshSuggestions = useCallback((plain: string) => {
    const next = extractTaskSuggestions(plain);
    setSuggestions(next);
    setChecked(next.map(() => true));
  }, []);

  /** Single-source update: turns → formatted text → suggestions. */
  const syncFromTurns = useCallback((next: Turn[]) => {
    setTurns(next);
    const formatted = formatTurns(next);
    setTranscript(formatted);
    refreshSuggestions(stripSpeakers(formatted));
  }, [refreshSuggestions]);

  /** Append finalized speech; a pause before it usually means a new speaker. */
  const appendFinalChunk = useCallback((text: string) => {
    const chunk = text.trim();
    if (!chunk) return;
    const now = Date.now();
    const list = turnsRef.current;
    const last = list[list.length - 1];
    const gap = now - lastFinalAtRef.current;
    lastFinalAtRef.current = now;
    setTurnInterim("");
    const speakers = rosterOf(list, extraSpeakersRef.current);
    if (gap > 6000 && last && last.text.trim()) {
      syncFromTurns([...list, { speaker: cycleSpeaker(speakers, last.speaker), text: chunk }]);
    } else if (last) {
      const next = [...list];
      next[next.length - 1] = {
        ...last,
        text: last.text ? `${last.text} ${chunk}` : chunk,
      };
      syncFromTurns(next);
    } else {
      syncFromTurns([{ speaker: speakers[0] ?? "Speaker 1", text: chunk }]);
    }
  }, [syncFromTurns]);

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
        const finals: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript ?? "";
          if (!text.trim()) continue;
          if (res.isFinal) finals.push(text.trim());
          else interim += text;
        }
        if (finals.length > 0) {
          finalTranscriptRef.current += `${finals.join(" ")}\n`;
          appendFinalChunk(finals.join(" "));
        } else {
          setTurnInterim(interim.trim());
        }
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
  }, [appendFinalChunk]);

  async function start() {
    setError(null);
    setMicDenied(false);
    setTranscript("");
    const fresh: Turn[] = [{ speaker: "Speaker 1", text: "" }];
    setTurns(fresh);
    turnsRef.current = fresh;
    setExtraSpeakers([]);
    extraSpeakersRef.current = [];
    setTurnInterim("");
    lastFinalAtRef.current = 0;
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
        const plain = stripSpeakers(formatTurns(turnsRef.current));
        finalTranscriptRef.current = plain ? `${plain}\n` : "";
        setTranscript(formatTurns(turnsRef.current));
        refreshSuggestions(plain);
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
      lastFinalAtRef.current = Date.now();
      setPhase("recording");
      const prefs = getVoicePrefs();
      if (prefs.transcription) {
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
    const fresh: Turn[] = [{ speaker: "Speaker 1", text: "" }];
    setTurns(fresh);
    turnsRef.current = fresh;
    setExtraSpeakers([]);
    extraSpeakersRef.current = [];
    setTurnInterim("");
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

  function addTurn() {
    const speakers = rosterOf(turnsRef.current, extraSpeakersRef.current);
    const last = turnsRef.current[turnsRef.current.length - 1]?.speaker ?? "";
    const next: Turn = { speaker: cycleSpeaker(speakers, last), text: "" };
    const updated = [...turnsRef.current, next];
    setTurns(updated);
    setTranscript(formatTurns(updated));
  }

  function updateTurn(index: number, patch: Partial<Turn>) {
    const list = turnsRef.current.map((t, i) => (i === index ? { ...t, ...patch } : t));
    syncFromTurns(list);
  }

  function removeTurn(index: number) {
    const list = turnsRef.current.filter((_, i) => i !== index);
    syncFromTurns(list.length > 0 ? list : [{ speaker: "Speaker 1", text: "" }]);
  }

  function addSpeaker() {
    const existing = rosterOf(turnsRef.current, extraSpeakersRef.current).map((n) =>
      n.toLowerCase()
    );
    let n = existing.length + 1;
    let name = `Person ${n}`;
    while (existing.includes(name.toLowerCase())) {
      n += 1;
      name = `Person ${n}`;
    }
    setExtraSpeakers((prev) => [...prev, name]);
  }

  function renameSpeaker(oldName: string, newName: string) {
    const clean = newName.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!clean) return;
    const oldKey = oldName.trim().toLowerCase();
    // Renaming onto an existing name merges the two speakers.
    const list = renameSpeakerInTurns(turnsRef.current, oldName, clean);
    setExtraSpeakers((prev) => prev.filter((n) => n.trim().toLowerCase() !== oldKey));
    syncFromTurns(list);
  }

  function removeSpeaker(name: string) {
    const key = name.trim().toLowerCase();
    const remaining = rosterOf(turnsRef.current, extraSpeakersRef.current).filter(
      (n) => n.toLowerCase() !== key
    );
    const fallback = remaining[0] ?? "";
    const list = turnsRef.current.map((t) =>
      t.speaker.trim().toLowerCase() === key ? { ...t, speaker: fallback } : t
    );
    setExtraSpeakers((prev) => prev.filter((n) => n.trim().toLowerCase() !== key));
    syncFromTurns(list);
  }

  const isConvType = recordingType === "conversation" || recordingType === "meeting";

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
      const formatted = formatTurns(turnsRef.current);
      // Conversations keep "Speaker: …" lines; monologues store plain text.
      const cleanTranscript = (
        recordingType === "conversation" || recordingType === "meeting"
          ? formatted
          : stripSpeakers(formatted)
      ).trim();
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
          {(() => {
            const liveBase = isConvType ? formatTurns(turns) : stripSpeakers(formatTurns(turns));
            const live = `${liveBase}${turnInterim ? `\n${turnInterim}` : ""}`.trim();
            return live ? (
              <p className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
                {live}
              </p>
            ) : null;
          })()}
          {isConvType && (
            <button
              type="button"
              onClick={addTurn}
              className="mt-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ＋ New speaker turn
            </button>
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
          <div className="mt-3 space-y-2">
            <span className="text-sm font-medium" id="rec-type-label-idle">What are you recording?</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="rec-type-label-idle">
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
            {(recordingType === "conversation" || recordingType === "meeting") && (
              <p className="text-xs text-muted-foreground">
                Conversation mode splits speech into speaker turns — fix names after you stop.
              </p>
            )}
          </div>
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
            <Label id="rec-transcript-label">
              Transcript {transcript ? "" : "(add one manually or leave empty)"}
            </Label>
            {isConvType ? (
              <div className="space-y-3" role="group" aria-labelledby="rec-transcript-label">
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Speakers · {roster.length}
                    </p>
                    <button
                      type="button"
                      onClick={addSpeaker}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      ＋ Add person
                    </button>
                  </div>
                  {roster.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No speakers yet — add one, then assign turns below.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {roster.map((name) => {
                        const count = turns.filter(
                          (t) => t.speaker.trim().toLowerCase() === name.toLowerCase()
                        ).length;
                        return (
                          <li key={name.toLowerCase()} className="flex items-center gap-2">
                            <AssigneeAvatar name={name} size="sm" />
                            <input
                              value={name}
                              onChange={(e) => renameSpeaker(name, e.target.value)}
                              aria-label={`Rename ${name}`}
                              maxLength={32}
                              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                            />
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {count} {count === 1 ? "turn" : "turns"}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSpeaker(name)}
                              disabled={roster.length <= 1}
                              aria-label={`Remove ${name}`}
                              title="Remove speaker (turns move to the first remaining speaker)"
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {turns.map((t, i) => {
                  const canonical =
                    roster.find(
                      (n) => n.toLowerCase() === t.speaker.trim().toLowerCase()
                    ) ?? "";
                  return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex shrink-0 items-center gap-1.5">
                      <AssigneeAvatar name={canonical || "Unknown"} size="sm" />
                      <select
                        value={canonical}
                        onChange={(e) => updateTurn(i, { speaker: e.target.value })}
                        aria-label={`Speaker for turn ${i + 1}`}
                        className="h-9 max-w-28 truncate rounded-lg border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring"
                      >
                        {!canonical ? (
                          <option value="">Unknown</option>
                        ) : null}
                        {roster.map((name) => (
                          <option key={name.toLowerCase()} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </span>
                    <textarea
                      value={t.text}
                      onChange={(e) => updateTurn(i, { text: e.target.value })}
                      aria-label={`Turn ${i + 1} text`}
                      rows={2}
                      placeholder="What was said…"
                      className="min-w-0 flex-1 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeTurn(i)}
                      disabled={turns.length <= 1 && !t.text && !t.speaker}
                      aria-label={`Remove turn ${i + 1}`}
                      className="rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addTurn}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ＋ Add turn
                </button>
              </div>
            ) : (
              <textarea
                id="rec-transcript"
                rows={5}
                value={stripSpeakers(transcript)}
                onChange={(e) => {
                  syncFromTurns(parseTurns(e.target.value));
                }}
                placeholder="What was said… edit freely — this becomes the note's transcript."
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            )}
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
