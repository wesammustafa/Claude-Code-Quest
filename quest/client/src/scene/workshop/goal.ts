// Where each screen wants the workshop's Pip (the warm workshop, D5): the
// one Pip of every Scene screen stands in the room, and the screen gives
// him his goal. The Journey sends him to the place of the Lesson it stands
// at, else to the first place with a card still to do; a Lesson's overview
// and its complete screen send him to that Lesson's place; Progress and
// the Level and course moments, on a wide page, send him aside to the
// armchair, clear of the panels over the room's middle, where his
// Celebration shows; every other screen leaves him where he is. Where the Scene stops (the Workspace) he
// is not in the room, so the screen's own 2D Pip is the one. No 3D code.
import type { LessonId } from "@quest/contract";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import { lessonOfScreen } from "../path";
import { sceneStops } from "../SceneLayer";
import type { SpotId } from "./layout";
import { placeOfLesson, workshopPlaces } from "./places";

/** The room's Pip on a screen: not in the room, or in it with the spot the screen sends him to, null to stay where he stands. */
export type PipOnScreen =
  { inRoom: false } | { inRoom: true; goal: SpotId | null };

const OUT: PipOnScreen = { inRoom: false };

/**
 * Where a screen with panels over the room's middle sends him on a wide
 * page: the whole room's view draws the armchair beside a 720 px column at
 * every wide size, so he stands whole beside the panels rather than behind
 * them. A narrow page's panels cover the room's width: there he stays
 * where he stands.
 */
const ASIDE: SpotId = "armchair";

/**
 * The room's Pip on `screen`, with the Lesson the Journey stands at, the
 * course's Stations and whether the page is narrow. A Lesson's screens name their Lesson in the path,
 * the one the camera frames, so a Lesson browsed but not open sends him to
 * its place too.
 */
export function pipOnScreen(
  screen: ScreenOnShow,
  journeyAt: LessonId | null,
  stations: readonly SceneStation[],
  narrow = false,
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
    case "progress":
    case "levelComplete":
    case "courseComplete":
      return { inRoom: true, goal: narrow ? null : ASIDE };
    default:
      return { inRoom: true, goal: null };
  }
}
