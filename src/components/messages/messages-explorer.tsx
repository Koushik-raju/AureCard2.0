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
import { formatRelativeTime } from "@/lib/dates";

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
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "bg-muted"
                    )}
                  >
                    <AssigneeAvatar name={d.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{d.name}</span>
                        {d.email.toLowerCase() === me ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">(you)</span>
                        ) : null}
                        {unread ? (
                          <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
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

  return (
    <>
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <AssigneeAvatar name={peer.name} size="sm" />
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium">{peer.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{peer.email}</p>
        </div>
      </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
              {thread.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet — say hello.
                </p>
              ) : (
                thread.map((m) => {
                  const mine = m.senderEmail.toLowerCase() === me;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        <p>{m.text}</p>
                        <p
                          className={cn(
                            "mt-1 text-[11px]",
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {formatRelativeTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form
              className="flex items-center gap-2 border-t border-border p-3"
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
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isPending}
                aria-label="Send message"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </form>
            {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
    </>
  );
}
