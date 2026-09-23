export type InboxKind = "assignment" | "comment" | "due" | "activity";

export type NotificationPrefs = {
  assignment: boolean;
  comment: boolean;
  due: boolean;
  activity: boolean;
  /** Show items for the user's own actions (hidden by default). */
  includeMine: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  assignment: true,
  comment: true,
  due: true,
  activity: true,
  includeMine: false,
};

export type NotifiableItem = {
  id: string;
  kind: InboxKind;
  mine?: boolean;
};

/** Feed + badge visibility for one item under the given prefs. */
export function isNotifiable(item: NotifiableItem, prefs: NotificationPrefs): boolean {
  if (!prefs[item.kind]) return false;
  if (item.mine && !prefs.includeMine) return false;
  return true;
}

export function applyNotificationPrefs<T extends NotifiableItem>(
  items: T[],
  prefs: NotificationPrefs
): T[] {
  return items.filter((i) => isNotifiable(i, prefs));
}
