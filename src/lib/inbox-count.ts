import { PREF_KEYS, readJson } from "@/lib/prefs";
import {
  DEFAULT_NOTIFICATION_PREFS,
  applyNotificationPrefs,
  type InboxKind,
  type NotificationPrefs,
} from "@/lib/notifications";

export type SnapshotEntry = {
  id: string;
  kind: string;
  mine?: boolean;
  title?: string;
  href?: string;
  ts?: number;
};

const INBOX_KINDS: InboxKind[] = ["assignment", "comment", "due", "activity"];

/** Last inbox snapshot (written on every inbox visit), tolerant of old shapes. */
export function readSnapshotEntries(): SnapshotEntry[] {
  try {
    const raw = readJson<{ ids?: string[]; entries?: SnapshotEntry[] }>(
      PREF_KEYS.inboxSnapshot,
      { ids: [] }
    );
    if (Array.isArray(raw.entries)) return raw.entries;
    if (Array.isArray(raw.ids)) {
      return raw.ids.map((id) => ({ id, kind: "assignment" }));
    }
    return [];
  } catch {
    return [];
  }
}

export function readPrefs(): NotificationPrefs {
  try {
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...readJson<Partial<NotificationPrefs>>(PREF_KEYS.notifications, {}),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function toKind(kind: string): InboxKind {
  return (INBOX_KINDS as readonly string[]).includes(kind)
    ? (kind as InboxKind)
    : "activity";
}

export type CountableEntry = { id: string; kind: InboxKind; mine?: boolean };

export function toCountable(entries: SnapshotEntry[]): CountableEntry[] {
  return entries.map((e) => ({ id: e.id, kind: toKind(e.kind), mine: !!e.mine }));
}

function readIds(): Set<string> {
  try {
    return new Set(readJson<{ ids: string[] }>(PREF_KEYS.inboxRead, { ids: [] }).ids ?? []);
  } catch {
    return new Set();
  }
}

/** Unread count under the current notification prefs. */
export function inboxUnreadCount(): number {
  try {
    const read = readIds();
    return applyNotificationPrefs(toCountable(readSnapshotEntries()), readPrefs()).filter(
      (i) => !read.has(i.id)
    ).length;
  } catch {
    return 0;
  }
}

/** Latest unread entries (for the bell dropdown), newest first. */
export function latestUnread(limit = 5): SnapshotEntry[] {
  try {
    const read = readIds();
    const allowed = new Set(
      applyNotificationPrefs(toCountable(readSnapshotEntries()), readPrefs()).map((i) => i.id)
    );
    return readSnapshotEntries()
      .filter((e) => allowed.has(e.id) && !read.has(e.id))
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}
