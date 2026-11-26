// The goal each screen gives the workshop's one Pip (D5), and the screens
// where he is not in the room at all, so the Workspace's 2D Pip is the only
// Pip there.
import { describe, expect, test } from "vitest";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import type { PipScreen } from "../../pip/screen-name";
import { pipOnScreen } from "./goal";

const station = (
  lesson: string,
  level: SceneStation["level"],
  complete = false,
  optional = false,
): SceneStation => ({ lesson, level, optional, complete });

/** Fix-It's shape, cut down: core Lessons, then a lab, per Level. */
const COURSE: readonly SceneStation[] = [
  station("b-1", "beginner"),
  station("b-capstone", "beginner"),
  station("b-3", "beginner", false, true),
  station("i-2", "intermediate"),
  station("a-capstone", "advanced"),
];
const ALL_DONE = COURSE.map((s) => ({ ...s, complete: true }));

const on = (screen: PipScreen, path: string): ScreenOnShow => ({
  screen,
  path,
});

describe("the workshop Pip's goal per screen", () => {
  test.each([
    ["welcome", "/"],
    ["resume", "/resume"],
    ["progress", "/progress"],
    ["levelComplete", "/level/beginner/complete"],
    ["courseComplete", "/course/complete"],
    ["other", "/settings"],
  ] as const)("%s keeps him in the room where he stands", (screen, path) => {
    expect(pipOnScreen(on(screen, path), "i-2", COURSE)).toEqual({
      inRoom: true,
      goal: null,
    });
  });

  test("a Lesson's overview and complete screen send him to that Lesson's place, a lab's too", () => {
    expect(
      pipOnScreen(on("intro", "/lesson/b-capstone"), null, COURSE),
    ).toEqual({ inRoom: true, goal: "noticeboard" });
    expect(pipOnScreen(on("intro", "/lesson/b-3/"), null, COURSE)).toEqual({
      inRoom: true,
      goal: "noticeboard",
    });
    expect(
      pipOnScreen(on("complete", "/lesson/a-capstone/complete"), "b-1", COURSE),
    ).toEqual({ inRoom: true, goal: "release-desk" });
  });

  test("the Journey sends him to the place of the Lesson it stands at, else to the first place with a card to do", () => {
    const map = on("map", "/journey");
    expect(pipOnScreen(map, "i-2", COURSE)).toEqual({
      inRoom: true,
      goal: "organizer",
    });
    const beginnerDone = COURSE.map((s) =>
      s.level === "beginner" ? { ...s, complete: true } : s,
    );
    expect(pipOnScreen(map, null, beginnerDone)).toEqual({
      inRoom: true,
      goal: "organizer",
    });
    // Every card done and no Lesson named: he stays where he stands.
    expect(pipOnScreen(map, null, ALL_DONE)).toEqual({
      inRoom: true,
      goal: null,
    });
  });

  test("a Lesson the course does not hold, or no Stations yet, sends him nowhere", () => {
    expect(pipOnScreen(on("intro", "/lesson/z-9"), null, COURSE)).toEqual({
      inRoom: true,
      goal: null,
    });
    expect(pipOnScreen(on("map", "/journey"), "b-1", [])).toEqual({
      inRoom: true,
      goal: null,
    });
  });

  test("on the Workspace and its Step-down he is not in the room: the screen's own Pip is the one Pip", () => {
    expect(pipOnScreen(on("step", "/lesson/b-1/step"), "b-1", COURSE)).toEqual({
      inRoom: false,
    });
    expect(
      pipOnScreen(on("levelup", "/lesson/b-capstone/step"), "b-1", COURSE),
    ).toEqual({ inRoom: false });
  });
});
