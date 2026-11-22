// Where a line of the Check stands. Kept out of CheckLines.tsx so the
// mount's types (mount/types.ts) need no JSX to read it.

/**
 * Where a line of the Check stands: still being checked, met, not met yet,
 * not known because the Check could not run (rose, never a judgement), or a
 * slow line that runs only on Check again (ticket 314).
 */
export type CheckLineState =
  "waiting" | "pass" | "notYet" | "broken" | "pending";
