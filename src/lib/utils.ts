export { cn } from "cn"

/** "1 task" / "3 tasks" — pass the plural only when it isn't `${one}s`. */
export function plural(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`);
}
