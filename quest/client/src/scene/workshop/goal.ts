// Where each screen wants the workshop's Pip (the warm workshop, D5): the
// one Pip of every Scene screen stands in the room, and the screen gives
// him his goal. The Journey sends him to the place of the Lesson it stands
// at, else to the first place with a card still to do; a Lesson's overview
// and its complete screen send him to that Lesson's place; every other
// screen leaves him where he is. Where the Scene stops (the Workspace) he
// is not in the room, so the screen's own 2D Pip is the one. No 3D code.
import type { LessonId } from "@quest/contract";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import { lessonOfScreen } from "../path";
import { sceneStops } from "../SceneLayer";
import { placeOfLesson, workshopPlaces, type WorkshopPlaceId } from "./places";

/** The room's Pip on a screen: not in the room, or in it with the place the screen sends him to, null to stay where he stands. */
export type PipOnScreen =
  { inRoom: false } | { inRoom: true; goal: WorkshopPlaceId | null };

const OUT: PipOnScreen = { inRoom: false };

/**
 * The room's Pip on `screen`, with the Lesson the Journey stands at and
 * the course's Stations. A Lesson's screens name their Lesson in the path,
 * the one the camera frames, so a Lesson browsed but not open sends him to
 * its place too.
 */
export function pipOnScreen(
  screen: ScreenOnShow,
  journeyAt: LessonId | null,
  stations: readonly SceneStation[],
): PipOnScreen {
  if (sceneStops(screen.screen)) return OUT;
  switch (screen.screen) {
    case "map": {
      const at = journeyAt === null ? null : placeOfLesson(stations, journeyAt);
      const goal =
        at ?? workshopPlaces(stations).find((p) => p.next !== null)?.id ?? null;
      return { inRoom: true, goal };
    }
    case "intro":
    case "complete": {
      const lesson = lessonOfScreen(screen);
      return {
        inRoom: true,
        goal: lesson === null ? null : placeOfLesson(stations, lesson),
      };
    }
    default:
      return { inRoom: true, goal: null };
  }
}
