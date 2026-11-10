// Where a Step's work happens, as the Where chip names it. Kept out of
// Where.tsx so the mount's types (mount/types.ts) need no JSX to read it.
export type WhereKind =
  "terminal" | "claude" | "claude-2" | "shell" | "editor" | "browser";
