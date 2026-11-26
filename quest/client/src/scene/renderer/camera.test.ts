// The Scene's camera in the workshop (the warm workshop, D5): the framing
// each screen asks for, where each framing puts the places and their cards
// on the page, and the camera moves between screens, with Three.js's own
// math and no renderer.
import { PerspectiveCamera } from "three";
import { describe, expect, test } from "vitest";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import { workshopPlaces } from "../workshop/places";
import {
  aim,
  createCameraMoves,
  cubicBezier,
  FOV,
  framingFor,
  planMove,
  poseOf,
  sameView,
  type Framing,
  type Pose,
  type Viewport,
} from "./camera";
import { tellPage, toldCards } from "./workshop/anchors";

type Course = readonly (readonly [string, SceneStation["level"], boolean])[];

const level = (
  lessons: readonly string[],
  of: SceneStation["level"],
  optional: boolean,
): Course => lessons.map((l) => [l, of, optional] as const);

/** Fix-It's Lessons in course order: each Level's core Lessons, then its labs. */
const COURSE: Course = [
  ...level(
    ["b-1", "b-2", "b-6", "b-4", "b-5", "b-capstone"],
    "beginner",
    false,
  ),
  ...level(["b-3"], "beginner", true),
  ...level(
    ["i-2", "i-1", "i-4", "i-6", "i-7", "i-capstone"],
    "intermediate",
    false,
  ),
  ...level(["i-3", "i-5", "i-8"], "intermediate", true),
  ...level(
    ["a-2", "a-8", "a-7", "a-9", "a-6", "a-capstone"],
    "advanced",
    false,
  ),
  ...level(["a-1", "a-3", "a-4", "a-5"], "advanced", true),
];

const stationsWith = (done: readonly string[]): SceneStation[] =>
  COURSE.map(([lesson, level, optional]) => ({
    lesson,
    level,
    optional,
    complete: done.includes(lesson),
  }));

const STATIONS = stationsWith(["b-1", "b-2"]);
const DESKTOP: Viewport = { width: 1440, height: 900 };
const PHONE: Viewport = { width: 390, height: 844 };

const at = (path: string, screen: ScreenOnShow["screen"]): ScreenOnShow => ({
  path,
  screen,
});

/** Where the places and cards fall on a page of `viewport`'s size, through the framing's pose. */
function drawn(framing: Framing, viewport: Viewport) {
  const camera = new PerspectiveCamera(
    FOV,
    viewport.width / viewport.height,
    0.1,
    80,
  );
  aim(camera, poseOf(framing, viewport), viewport);
  const places = workshopPlaces(STATIONS);
  return tellPage(
    camera,
    { left: 0, top: 0, ...viewport },
    places.map((p) => p.id),
    toldCards(places),
  );
}

describe("the framing each screen shows", () => {
  test("Welcome, Progress, the added screens and the Level's and course's ends show the whole room", () => {
    for (const screen of [
      at("/", "welcome"),
      at("/resume", "welcome"),
      at("/progress", "progress"),
      at("/settings", "other"),
      at("/level/beginner/complete", "levelComplete"),
      at("/course/complete", "courseComplete"),
    ])
      expect(framingFor(screen, "b-4", STATIONS), screen.path).toEqual({
        kind: "room",
      });
  });

  test("the Journey frames the place of the Lesson it stands at, else the first place with a card to do, else the room", () => {
    const journey = at("/journey", "map");
    expect(framingFor(journey, "i-3", STATIONS)).toEqual({
      kind: "place",
      place: "organizer",
      panel: false,
    });
    expect(framingFor(journey, null, STATIONS)).toEqual({
      kind: "place",
      place: "noticeboard",
      panel: false,
    });
    const beginnerDone = stationsWith(
      COURSE.filter(([, of]) => of === "beginner").map(([l]) => l),
    );
    expect(framingFor(journey, null, beginnerDone)).toMatchObject({
      place: "organizer",
    });
    const allDone = stationsWith(COURSE.map(([l]) => l));
    expect(framingFor(journey, null, allDone)).toEqual({ kind: "room" });
  });

  test("a Lesson's overview frames its place beside the panel, its step keeps that, and Lesson complete comes close", () => {
    expect(framingFor(at("/lesson/a-4", "intro"), null, STATIONS)).toEqual({
      kind: "place",
      place: "release-desk",
      panel: true,
    });
    expect(framingFor(at("/lesson/a-4/step", "step"), null, STATIONS)).toEqual(
      framingFor(at("/lesson/a-4", "intro"), null, STATIONS),
    );
    expect(
      framingFor(at("/lesson/b-6/complete", "complete"), null, STATIONS),
    ).toEqual({ kind: "close", place: "noticeboard" });
  });

  test("a Lesson the course does not hold, or no snapshot yet, shows the whole room", () => {
    expect(framingFor(at("/lesson/x-9", "intro"), null, STATIONS)).toEqual({
      kind: "room",
    });
    expect(framingFor(at("/journey", "map"), "b-1", [])).toEqual({
      kind: "room",
    });
  });
});

describe("where the framings put the places", () => {
  test("the whole room on a desktop shows all three places and every card", () => {
    const { anchors, view } = drawn({ kind: "room" }, DESKTOP);
    for (const place of ["noticeboard", "organizer", "release-desk"] as const)
      expect(anchors[place]?.visible, place).toBe(true);
    expect(view.points).toHaveLength(COURSE.length);
    expect(view.pip).toBeNull();
  });

  test("a Lesson's overview on a desktop keeps its place's cards in the left 60%, leaving the panel's side free", () => {
    for (const place of ["noticeboard", "organizer", "release-desk"] as const) {
      const { view } = drawn({ kind: "place", place, panel: true }, DESKTOP);
      const own = new Set(
        workshopPlaces(STATIONS)
          .find((p) => p.id === place)
          ?.cards.map((c) => c.lesson),
      );
      const cards = view.points.filter((p) => own.has(p.lesson));
      expect(cards, place).toHaveLength(own.size);
      for (const card of cards)
        expect(card.x + card.r, `${place} ${card.lesson}`).toBeLessThan(
          DESKTOP.width * 0.6,
        );
    }
  });

  test("on a phone the overview keeps its place's cards in the top half, over the panel", () => {
    const { view } = drawn(
      { kind: "place", place: "noticeboard", panel: true },
      PHONE,
    );
    const beginner = view.points.filter((p) => p.lesson.startsWith("b-"));
    expect(beginner).toHaveLength(7);
    for (const card of beginner) {
      expect(card.y + card.r, card.lesson).toBeLessThan(PHONE.height / 2);
      expect(card.x - card.r, card.lesson).toBeGreaterThanOrEqual(0);
      expect(card.x + card.r, card.lesson).toBeLessThanOrEqual(PHONE.width);
    }
  });

  test("close on a place draws its cards larger than the Journey's framing does, every one in view", () => {
    const reach = (framing: Framing) =>
      drawn(framing, DESKTOP).view.points.filter((p) =>
        p.lesson.startsWith("a-"),
      );
    const journey = reach({
      kind: "place",
      place: "release-desk",
      panel: false,
    });
    const close = reach({ kind: "close", place: "release-desk" });
    expect(close).toHaveLength(10);
    expect(close[0]?.r ?? 0).toBeGreaterThan(journey[0]?.r ?? Infinity);
  });

  test("an anchor off the page is told, but not as in view; a card is a 44 px target at the least", () => {
    const { anchors, view } = drawn(
      { kind: "close", place: "noticeboard" },
      PHONE,
    );
    expect(anchors["release-desk"]?.visible).toBe(false);
    expect(anchors["card:a-5"]?.visible).toBe(false);
    expect(view.points.some((p) => p.lesson === "a-5")).toBe(false);
    for (const p of view.points) expect(p.r).toBeGreaterThanOrEqual(22);
  });

  test("a view the same to within a quarter pixel is not told again", () => {
    const a = drawn({ kind: "room" }, DESKTOP).view;
    const b = drawn({ kind: "room" }, DESKTOP).view;
    expect(sameView(a, b)).toBe(true);
    expect(sameView(null, b)).toBe(false);
    expect(sameView(a, drawn({ kind: "room" }, PHONE).view)).toBe(false);
  });
});

describe("the camera moves between screens", () => {
  const change = (from: ScreenOnShow, to: ScreenOnShow, reduced = false) => ({
    from,
    to,
    reduced,
  });
  const journey = at("/journey", "map");

  test("a screen that frames anew travels, and coming back to the Journey stands it at the Lesson left", () => {
    expect(
      planMove(change(at("/", "welcome"), journey), null, STATIONS),
    ).toEqual({ at: null, travel: true });
    expect(
      planMove(
        change(at("/lesson/i-4/complete", "complete"), journey),
        "b-1",
        STATIONS,
      ),
    ).toEqual({ at: "i-4", travel: true });
    expect(
      planMove(change(journey, at("/lesson/b-4", "intro")), "b-4", STATIONS),
    ).toEqual({ at: null, travel: true });
  });

  test("into the Workspace the Scene stops, reduced motion never travels, and between two screens of the whole room nothing moves", () => {
    expect(
      planMove(
        change(at("/lesson/b-1", "intro"), at("/lesson/b-1/step", "step")),
        null,
        STATIONS,
      ).travel,
    ).toBe(false);
    expect(
      planMove(change(at("/", "welcome"), journey, true), null, STATIONS)
        .travel,
    ).toBe(false);
    expect(
      planMove(
        change(at("/progress", "progress"), at("/settings", "other")),
        null,
        STATIONS,
      ).travel,
    ).toBe(false);
  });

  const room = poseOf({ kind: "room" }, DESKTOP);
  const board = poseOf({ kind: "close", place: "noticeboard" }, DESKTOP);
  const linear = (t: number) => t;

  test("a move eases from where the camera stood to the framing, and ends on it", () => {
    const moves = createCameraMoves();
    moves.frame(0, room);
    moves.start(0, 200, linear, true);
    const half = moves.frame(100, board);
    expect(half.between).toBe(true);
    expect(half.moving).toBe(true);
    expect(half.pose.position.distanceTo(room.position)).toBeCloseTo(
      half.pose.position.distanceTo(board.position),
      5,
    );
    const done = moves.frame(200, board);
    expect(done.moving).toBe(false);
    expect(done.between).toBe(false);
    expect(done.pose.position.distanceTo(board.position)).toBe(0);
  });

  test("a new navigation starts the next move from where the last one stood; none starts before a first frame", () => {
    const moves = createCameraMoves();
    moves.start(0, 200, linear, true);
    expect(moves.frame(10, room).moving).toBe(false);
    moves.start(10, 200, linear, true);
    const mid: Pose = moves.frame(60, board).pose;
    moves.end(60, board);
    moves.start(60, 200, linear, true);
    expect(
      moves.frame(60, room).pose.position.distanceTo(mid.position),
    ).toBeCloseTo(0, 5);
  });

  test("the easing is the token's cubic Bézier", () => {
    const inOut = cubicBezier(0.65, 0, 0.35, 1);
    expect(inOut(0)).toBe(0);
    expect(inOut(1)).toBe(1);
    expect(inOut(0.5)).toBeCloseTo(0.5, 3);
    expect(inOut(0.25)).toBeLessThan(0.25);
    expect(inOut(0.75)).toBeGreaterThan(0.75);
  });
});
