// The screen names Pip's director uses, kept out of director.ts so the
// mount's types (mount/types.ts) read them without the director's modules.

/**
 * The screen the browser shows, by the spec's view names (`levelup` is the
 * Step-down). The spec gives Level complete and course complete no view name;
 * the owner gave them their own (2026-10-26).
 */
export type PipScreen =
  | "welcome"
  | "resume"
  | "map"
  | "intro"
  | "step"
  | "levelup"
  | "complete"
  | "next"
  | "levelComplete"
  | "courseComplete"
  | "progress"
  | "other";
