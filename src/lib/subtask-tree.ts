/**
 * Checking a parent auto-checks its whole subtree; unchecking a child
 * unchecks its ancestors. Returns the ids whose `done` flag was set, so
 * callers can update the database and optimistic UI for the same rows.
 */
export function cascadeDone(
  items: { id: string; parentId?: string }[],
  itemId: string,
  done: boolean
): { check: string[]; uncheck: string[] } {
  const byParent = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  for (const item of items) {
    if (item.parentId) {
      parentOf.set(item.id, item.parentId);
      const list = byParent.get(item.parentId) ?? [];
      list.push(item.id);
      byParent.set(item.parentId, list);
    }
  }
  if (done) {
    const check = [itemId];
    const queue = [...(byParent.get(itemId) ?? [])];
    while (queue.length > 0) {
      const id = queue.pop()!;
      check.push(id);
      queue.push(...(byParent.get(id) ?? []));
    }
    return { check, uncheck: [] };
  }
  const uncheck = [itemId];
  let parent = parentOf.get(itemId);
  while (parent) {
    uncheck.push(parent);
    parent = parentOf.get(parent);
  }
  return { check: [], uncheck };
}
