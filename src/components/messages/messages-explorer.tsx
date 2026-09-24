"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import { getBrowserSupabase } from "@/lib/supabase-client";
import { sendDirectMessage } from "@/lib/mutations";
import { AssigneeAvatar } from "@/components/tasks/hues";
import type { DirectMessage, WorkspaceMember } from "@/lib/types";
import { formatDueDate, formatRelativeTime } from "@/lib/dates";
import { localDayKey, todayKey } from "@/lib/due";

function dayDividerLabel(dayKey: string): string {
  if (dayKey === todayKey()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (dayKey === localDayKey(y)) return "Yesterday";
  return formatDueDate(dayKey);
}

type MessageGroup = { day: string; sender: string; items: DirectMessage[] };

/** Consecutive messages from one sender on one day render as one cluster. */
function groupThread(thread: DirectMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of thread) {
    const t = Date.parse(m.createdAt);
    const day = Number.isNaN(t) ? "" : localDayKey(new Date(t));
    const sender = m.senderEmail.toLowerCase();
    const last = groups[groups.length - 1];
    if (last && last.day === day && last.sender === sender) {
      last.items.push(m);
    } else {
      groups.push({ day, sender, items: [m] });
    }
  }
  return groups;
}

function loadVisits(): Record<string, number> {
  try {
    const raw = readJson<Record<string, number>>(PREF_KEYS.dmVisits, {});
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

let cachedVisitsRaw: string | null = null;
let cachedVisits: Record<string, number> = {};

function subscribeVisits(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

/** Storage-backed visit map (snapshot-cached so subscribers stay stable). */
function readStoredVisits(): Record<string, number> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREF_KEYS.dmVisits);
  } catch {
    return {};
  }
  if (raw === cachedVisitsRaw) return cachedVisits;
  cachedVisitsRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cachedVisits =
      parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    cachedVisits = {};
  }
  return cachedVisits;
}

function markVisited(email: string) {
  const key = email.trim().toLowerCase();
  if (!key) return;
  writeJson(PREF_KEYS.dmVisits, { ...loadVisits(), [key]: Date.now() });
}

function otherParty(m: DirectMessage, me: string): string {
  return m.senderEmail.toLowerCase() === me ? m.recipientEmail : m.senderEmail;
}

export function MessagesExplorer({
  me,
  directory,
  peerEmail,
  initialThread,
  recent,
}: {
  me: string;
  directory: WorkspaceMember[];
  peerEmail: string | null;
  initialThread: DirectMessage[];
  recent: DirectMessage[];
}) {
  // Unread dots from storage; the open thread never shows one.
  // Writes happen in click handlers + mount only — never during render.
  const visits = useSyncExternalStore(
    subscribeVisits,
    readStoredVisits,
    () => ({}) as Record<string, number>
  );
  const openKey = (peerEmail ?? "").toLowerCase();
  useEffect(() => {
    if (peerEmail) markVisited(peerEmail);
  }, [peerEmail]);

  const peer = directory.find((d) => d.email.toLowerCase() === (peerEmail ?? "").toLowerCase());

  const latestByPeer = useMemo(() => {
    const map = new Map<string, DirectMessage>();
    for (const m of [...recent].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const other = otherParty(m, me).toLowerCase();
      if (!map.has(other)) map.set(other, m);
    }
    return map;
  }, [recent, me]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="People" className="rounded-xl border border-border bg-card p-2">
        {directory.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nobody yet — invite people on the{" "}
            <Link href="/org" className="underline">
              Organization
            </Link>{" "}
            page.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {directory.map((d) => {
              const key = d.email.toLowerCase();
              const last = latestByPeer.get(key);
              const unread =
                !!last &&
                key !== openKey &&
                last.senderEmail.toLowerCase() !== me &&
                Date.parse(last.createdAt) > (visits[key] ?? 0);
              const selected = key === (peerEmail ?? "").toLowerCase();
              return (
                <li key={d.id}>
                  <Link
                    href={`/messages?to=${encodeURIComponent(d.email)}`}
                    onClick={() => markVisited(d.email)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "bg-muted"
                    )}
                  >
                    <span className="relative shrink-0">
                      <AssigneeAvatar name={d.name} size="md" />
                      {unread ? (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-label="Unread" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm font-medium">{d.name}</span>
                        {d.email.toLowerCase() === me ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">(you)</span>
                        ) : null}
                        {last ? (
                          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatRelativeTime(last.createdAt)}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn("block truncate text-[13px]", last ? "text-muted-foreground" : "text-muted-foreground/70")}>
                        {last ? last.text : d.email}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <section aria-label="Conversation" className="flex min-h-[50vh] flex-col rounded-xl border border-border bg-card">
        {!peer ? (
          <p className="m-auto px-6 py-16 text-center text-sm text-muted-foreground">
            Pick someone to start messaging.
          </p>
        ) : (
          <ThreadView
            key={peer.email.toLowerCase()}
            me={me}
            peer={peer}
            initialThread={initialThread}
          />
        )}
      </section>
    </div>
  );
}

function ThreadView({
  me,
  peer,
  initialThread,
}: {
  me: string;
  peer: WorkspaceMember;
  initialThread: DirectMessage[];
}) {
  const router = useRouter();
  const [thread, setThread] = useState<DirectMessage[]>(initialThread);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const peerEmail = peer.email;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  // Live inserts for this pair.
  useEffect(() => {
    if (!me || !peerEmail) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel("dm-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          const msg: DirectMessage = {
            id: String(row.id ?? ""),
            senderEmail: String(row.sender_email ?? ""),
            recipientEmail: String(row.recipient_email ?? ""),
            text: String(row.text ?? ""),
            createdAt: String(row.created_at ?? new Date().toISOString()),
          };
          if (!msg.id || !msg.text) return;
          const pair = [msg.senderEmail.toLowerCase(), msg.recipientEmail.toLowerCase()];
          if (!pair.includes(me) || !pair.includes(peerEmail.toLowerCase())) return;
          markVisited(otherParty(msg, me));
          setThread((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, peerEmail]);

  function send() {
    const text = draft.trim();
    if (!text || isPending) return;
    setError(null);
    setDraft("");
    startTransition(async () => {
      const result = await sendDirectMessage({ recipientEmail: peerEmail, text });
      if (result.error) {
        setError(result.error);
        setDraft(text);
        return;
      }
      router.refresh();
    });
  }

  const groups = useMemo(() => groupThread(thread), [thread]);

  return (
    <>
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <AssigneeAvatar name={peer.name} size="sm" />
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium">{peer.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{peer.email}</p>
        </div>
      </header>
            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-6" aria-live="polite">
              {thread.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <AssigneeAvatar name={peer.name} size="md" />
                  <p className="mt-3 text-sm font-medium">{peer.name}</p>
                  <p className="mt-1 max-w-60 text-[13px] text-muted-foreground">
                    This is the start of your conversation. Messages stay between the two of you.
                  </p>
                </div>
              ) : (
                groups.map((group, gi) => (
                  <div key={`${group.day}-${group.sender}-${gi}`}>
                    {(gi === 0 || groups[gi - 1]?.day !== group.day) && group.day ? (
                      <div className="mb-3 flex justify-center">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {dayDividerLabel(group.day)}
                        </span>
                      </div>
                    ) : null}
                    <div className={cn("flex", group.sender === me ? "justify-end" : "justify-start gap-2")}>
                      {group.sender !== me ? (
                        <AssigneeAvatar name={peer.name} size="sm" />
                      ) : null}
                      <div className={cn("min-w-0 max-w-[70%] space-y-1", group.sender === me && "flex flex-col items-end")}>
                        {group.items.map((m) => {
                          const mine = m.senderEmail.toLowerCase() === me;
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "w-fit max-w-full rounded-xl px-3 py-1.5 text-sm leading-relaxed shadow-sm",
                                mine
                                  ? "bg-primary text-primary-foreground"
                                  : "border border-border bg-card text-foreground"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.text}</p>
                              <p
                                className={cn(
                                  "mt-0.5 text-right text-[10px] tabular-nums",
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground/70"
                                )}
                              >
                                {formatRelativeTime(m.createdAt)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <form
              className="flex items-end gap-2 border-t border-border bg-card px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${peer.name}…`}
                aria-label={`Message ${peer.name}`}
                maxLength={2000}
                className="min-h-10 min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isPending}
                aria-label="Send message"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </form>
            {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
    </>
  );
}
