// The app's own names for a Level and a Lesson's place in it: words the
// browser writes, not quotes from the course.
import type { LevelId } from "@quest/contract";

export const LEVEL_NAMES: Readonly<Record<LevelId, string>> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * "Lesson 3" or "Capstone", as the Learner reads a lesson's place in its
 * Level; plain "Lesson" when the course gives no number.
 */
export function lessonLabel(number: number | null, capstone: boolean): string {
  if (capstone) return "Capstone";
  return number === null ? "Lesson" : `Lesson ${String(number)}`;
}

/** "Beginner · Lesson 1": the eyebrow above a Lesson's title. */
export function lessonEyebrow(
  level: LevelId,
  number: number | null,
  capstone: boolean,
): string {
  return `${LEVEL_NAMES[level]} · ${lessonLabel(number, capstone)}`;
}

const COUNT = ["no", "one", "two", "three", "four", "five"] as const;

/**
 * The link to the Journey, by how many Levels the course has: "See all three
 * levels", or "See the Beginner level" for a course of one.
 */
export function seeLevels(levels: readonly { id: LevelId }[]): string {
  const [only] = levels;
  if (levels.length === 1 && only)
    return `See the ${LEVEL_NAMES[only.id]} level`;
  return `See all ${COUNT[levels.length] ?? String(levels.length)} levels`;
}

/** The Journey's opening words for the course's Levels: "Three levels." or "The Beginner level." */
export function levelsIntro(levels: readonly { id: LevelId }[]): string {
  const [only] = levels;
  if (levels.length === 1 && only) return `The ${LEVEL_NAMES[only.id]} level.`;
  const n = COUNT[levels.length] ?? String(levels.length);
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} levels.`;
}

/** Course complete's line: "All three levels are complete." or "The Beginner level is complete." */
export function levelsComplete(levels: readonly { id: LevelId }[]): string {
  const [only] = levels;
  if (levels.length === 1 && only)
    return `The ${LEVEL_NAMES[only.id]} level is complete.`;
  return `All ${COUNT[levels.length] ?? String(levels.length)} levels are complete.`;
}
