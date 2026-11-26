// The workshop's places (the warm workshop, D4): one place in the room for
// each Level of the course, holding a card for each of its Lessons, its core
// Lessons in course order and then its optional ones (labs). Read from the
// Stations the Scene is told, so any course's Levels and Lessons find their
// places with no per-Lesson art. No 3D code here.
import type { LessonId, LevelId } from "@quest/contract";
import type { SceneStation } from "../../mount/types";

/** A place in the workshop: Beginner's noticeboard, Intermediate's kit organizer, Advanced's release desk. */
export type WorkshopPlaceId = "noticeboard" | "organizer" | "release-desk";

const PLACE_OF_LEVEL: Readonly<Record<LevelId, WorkshopPlaceId>> = {
  beginner: "noticeboard",
  intermediate: "organizer",
  advanced: "release-desk",
};

/** A Lesson's card at its Level's place. */
export interface WorkshopCard {
  lesson: LessonId;
  /** An optional Lesson (a lab). */
  optional: boolean;
  /** Complete, so its card is pinned. */
  complete: boolean;
}

export interface WorkshopPlace {
  id: WorkshopPlaceId;
  level: LevelId;
  /** Its Level's Lessons: the core ones in course order, then the optional ones. */
  cards: readonly WorkshopCard[];
  /** The first core Lesson not complete, else the first optional one not complete; null once all are. */
  next: LessonId | null;
}

/** Each Level's place, in the order the Levels come; a Level with no Lesson has none. */
export function workshopPlaces(
  stations: readonly SceneStation[],
): readonly WorkshopPlace[] {
  const levels: LevelId[] = [];
  const byLevel = new Map<LevelId, SceneStation[]>();
  for (const station of stations) {
    let own = byLevel.get(station.level);
    if (own === undefined) {
      own = [];
      byLevel.set(station.level, own);
      levels.push(station.level);
    }
    own.push(station);
  }
  return levels.map((level) => {
    const own = byLevel.get(level) ?? [];
    const cards = [
      ...own.filter((s) => !s.optional),
      ...own.filter((s) => s.optional),
    ].map(({ lesson, optional, complete }) => ({ lesson, optional, complete }));
    const next = cards.find((c) => !c.complete)?.lesson ?? null;
    return { id: PLACE_OF_LEVEL[level], level, cards, next };
  });
}

/** The place a Lesson's card is at, or null for a Lesson the Stations do not hold. */
export function placeOfLesson(
  stations: readonly SceneStation[],
  lesson: LessonId,
): WorkshopPlaceId | null {
  const station = stations.find((s) => s.lesson === lesson);
  return station === undefined ? null : PLACE_OF_LEVEL[station.level];
}
