"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bold, Code, Italic, List, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase-client";
import { sendDirectMessage } from "@/lib/mutations";
import { AssigneeAvatar } from "@/components/tasks/hues";
import type { DirectMessage, GroupThread, WorkspaceMember } from "@/lib/types";
import { formatDueDate } from "@/lib/dates";
import { localDayKey, todayKey } from "@/lib/due";

function dayDividerLabel(dayKey: string): string {
  if (!dayKey) return "";
  if (dayKey === todayKey()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (dayKey === localDayKey(y)) return "Yesterday";
  return formatDueDate(dayKey);
}

function messageTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayOf(m: DirectMessage): string {
  const t = Date.parse(m.createdAt);
  return Number.isNaN(t) ? "" : localDayKey(new Date(t));
}

function insertAround(
  el: HTMLTextAreaElement | null,
  setDraft: (v: string) => void,
  before: string,
  after: string
) {
  if (!el) return;
  const { selectionStart: s = 0, selectionEnd: e = 0, value } = el;
  const next = `${value.slice(0, s)}${before}${value.slice(s, e)}${after}${value.slice(e)}`;
  setDraft(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = s + before.length + (e - s);
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
}

export function MessagesThread({
  me,
  directory,
  peerEmail,
  group,
  initialThread,
}: {
  me: string;
  directory: WorkspaceMember[];
  peerEmail: string | null;
  group: GroupThread | null;
  initialThread: DirectMessage[];
}) {
  const router = useRouter();
  const [thread, setThread] = useState<DirectMessage[]>(initialThread);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const peer = !group
    ? (directory.find((d) => d.email.toLowerCase() === (peerEmail ?? "").toLowerCase()) ?? null)
    : null;

  const namesByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of directory) map.set(d.email.toLowerCase(), d.name);
    return map;
  }, [directory]);

  function senderName(email: string): string {
    if (email.toLowerCase() === me) return "You";
    return namesByEmail.get(email.toLowerCase()) ?? email;
  }

  const title = group ? group.name : (peer?.name ?? "Messages");
  const subtitle = group
    ? group.memberEmails
        .map((e) => namesByEmail.get(e.toLowerCase()) ?? e)
        .join(", ")
    : (peer?.email ?? "Pick someone from Direct messages in the sidebar.");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, peerEmail, group?.id]);

  // Live inserts for this conversation.
  useEffect(() => {
    if (!me || (!peerEmail && !group)) return;
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
            threadId: row.thread_id ? String(row.thread_id) : undefined,
          };
          if (!msg.id || !msg.text) return;
          if (group) {
            if (msg.threadId !== group.id) return;
          } else {
            const pair = [msg.senderEmail.toLowerCase(), msg.recipientEmail.toLowerCase()];
            if (!pair.includes(me) || !pair.includes((peerEmail ?? "").toLowerCase())) return;
          }
          setThread((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, peerEmail, group]);

  function send() {
    const text = draft.trim();
    if (!text || isPending) return;
    if (!group && !peerEmail) return;
    setError(null);
    setDraft("");
    startTransition(async () => {
      const result = group
        ? await sendDirectMessage({ threadId: group.id, text })
        : await sendDirectMessage({ recipientEmail: peerEmail ?? "", text });
      if (result.error) {
        setError(result.error);
        setDraft(text);
        return;
      }
      router.refresh();
    });
  }

  const tools = [
    { label: "Bold", icon: Bold, before: "**", after: "**" },
    { label: "Italic", icon: Italic, before: "_", after: "_" },
    { label: "Bullet", icon: List, before: "\n- ", after: "" },
    { label: "Quote", icon: Quote, before: "\n> ", after: "" },
    { label: "Code", icon: Code, before: "`", after: "`" },
  ] as const;

  return (
    <section aria-label="Conversation" className="flex min-h-[60vh] flex-col">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <h2 className="truncate text-[15px] font-medium">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite">
        {thread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            {peer ? <AssigneeAvatar name={peer.name} size="md" /> : null}
            <p className="mt-3 text-sm font-medium">{group ? group.name : (peer?.name ?? "No conversation")}</p>
            <p className="mt-1 max-w-60 text-[13px] text-muted-foreground">
              {group
                ? "Messages here stay between group members."
                : "This is the start of your conversation. Messages stay between the two of you."}
            </p>
          </div>
        ) : (
          thread.map((m, i) => {
            const prevDay = i > 0 ? dayOf(thread[i - 1]) : null;
            const day = dayOf(m);
            const mine = m.senderEmail.toLowerCase() === me;
            const name = senderName(m.senderEmail);
            return (
              <div key={m.id}>
                {day && day !== prevDay ? (
                  <div className="mb-3 flex items-center gap-3">
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {dayDividerLabel(day)}
                    </span>
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                <div className="flex items-start gap-2.5">
                  <AssigneeAvatar name={mine ? (namesByEmail.get(me) ?? name) : name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {messageTime(m.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border px-4 py-3 sm:px-6">
        <div
          className={cn(
            "rounded-xl border border-input bg-card",
            "focus-within:border-ring"
          )}
        >
          <div className="flex items-center gap-0.5 border-b border-border/60 px-2 py-1" role="toolbar" aria-label="Formatting">
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onClick={() => insertAround(inputRef.current, setDraft, tool.before, tool.after)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <tool.icon className="size-3.5" />
              </button>
            ))}
            <span className="ml-auto hidden px-1 text-[11px] text-muted-foreground sm:inline">
              Plain text — markers are sent as typed
            </span>
          </div>
          <form
            className="flex items-end gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={group ? `Message ${group.name}…` : peer ? `Message ${peer.name}…` : "Write a message…"}
              aria-label="Write a message"
              maxLength={2000}
              rows={1}
              className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isPending || (!group && !peerEmail)}
              aria-label="Send message"
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              ↑
            </button>
          </form>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
