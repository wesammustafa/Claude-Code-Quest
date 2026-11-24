// The Scene's camera (09 9.3, ticket 52): the place each screen shows, the
// pose for each place and where it puts the Stations on the page, and the
// camera moves between screens, with Three.js's own math and no renderer.
import { PerspectiveCamera } from "three";
import { describe, expect, test } from "vitest";
import type { SceneStation, ScreenOnShow } from "../../mount/types";
import type { Band } from "../path";
import {
  aim,
  createCameraMoves,
  cubicBezier,
  FOV,
  glideOf,
  pipStation,
  placeFor,
  planMove,
  poseOf,
  sameView,
  viewOf,
  walkEase,
  walkWay,
  type Place,
  type Pose,
} from "./camera";
import { beginnerLayout } from "./beginner";

const BEGINNER = ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"];
const STATIONS: SceneStation[] = [
  ...BEGINNER.map((lesson, i) => ({
    lesson,
    level: "beginner" as const,
    complete: i < 2,
  })),
  { lesson: "i-1", level: "intermediate", complete: false },
];
const VIEWPORT = { width: 1440, height: 900 };
const BAND: Band = { left: 170, top: 300, width: 1100, height: 320 };

const at = (path: string, screen: ScreenOnShow["screen"]): ScreenOnShow => ({
  path,
  screen,
});
const noPath = { at: null, whole: false, band: null };

/** A camera as the renderer aims it, on a page of VIEWPORT's size. */
function aimed(pose: Pose): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    FOV,
    VIEWPORT.width / VIEWPORT.height,
    0.1,
    160,
  );
  aim(camera, pose, VIEWPORT);
  return camera;
}

const marks = BEGINNER.map((lesson) => ({ lesson, lit: false }));

describe("the place each screen shows", () => {
  test("the Journey with its band frames Pip's Station, or the whole Level once pulled back", () => {
    const journey = at("/journey", "map");
    expect(
      placeFor(journey, { at: "b-3", whole: false, band: BAND }, STATIONS),
    ).toEqual({ kind: "station", at: 2, band: BAND });
    expect(
      placeFor(journey, { at: "b-3", whole: true, band: BAND }, STATIONS),
    ).toEqual({ kind: "whole", band: BAND });
    // No band (another Level, or before the renderer draws): the meadow.
    expect(placeFor(journey, noPath, STATIONS)).toEqual({ kind: "meadow" });
  });

  test("a Beginner Lesson's overview, step and complete screens dive into its Station; the rest stand over the meadow", () => {
    expect(placeFor(at("/lesson/b-2", "intro"), noPath, STATIONS)).toEqual({
      kind: "dive",
      at: 1,
    });
    expect(
      placeFor(at("/lesson/b-capstone/complete", "complete"), noPath, STATIONS),
    ).toEqual({ kind: "dive", at: 5 });
    for (const screen of [
      at("/lesson/i-1", "intro"),
      at("/progress", "progress"),
      at("/", "welcome"),
      at("/settings", "other"),
    ])
      expect(placeFor(screen, noPath, STATIONS), screen.path).toEqual({
        kind: "meadow",
      });
  });
});

describe("the poses", () => {
  test("at a Station, its beacon falls in the band's middle and its neighbours inside the band", () => {
    const camera = aimed(
      poseOf({ kind: "station", at: 2, band: BAND }, VIEWPORT),
    );
    const view = viewOf(camera, VIEWPORT, marks, 0);
    const b3 = view.points.find((p) => p.lesson === "b-3");
    expect(b3?.x).toBeCloseTo(BAND.left + BAND.width / 2, -1);
    expect(Math.abs((b3?.y ?? 0) - (BAND.top + BAND.height / 2))).toBeLessThan(
      BAND.height / 3,
    );
    for (const lesson of ["b-2", "b-4"]) {
      const p = view.points.find((q) => q.lesson === lesson);
      expect(p?.x, lesson).toBeGreaterThan(BAND.left);
      expect(p?.x, lesson).toBeLessThan(BAND.left + BAND.width);
    }
  });

  test("pulled back, all six Stations fall inside the band", () => {
    const camera = aimed(poseOf({ kind: "whole", band: BAND }, VIEWPORT));
    const view = viewOf(camera, VIEWPORT, marks, 0);
    expect(view.points.map((p) => p.lesson)).toEqual(BEGINNER);
    for (const p of view.points) {
      expect(p.x, p.lesson).toBeGreaterThan(BAND.left);
      expect(p.x, p.lesson).toBeLessThan(BAND.left + BAND.width);
      expect(p.y, p.lesson).toBeGreaterThan(BAND.top);
      expect(p.y, p.lesson).toBeLessThan(BAND.top + BAND.height);
    }
  });

  test("a narrow phone band backs the camera off to keep the whole Level in it", () => {
    const phone = { width: 390, height: 844 };
    const band = { left: 16, top: 260, width: 358, height: 300 };
    const camera = new PerspectiveCamera(FOV, phone.width / phone.height);
    aim(camera, poseOf({ kind: "whole", band }, phone), phone);
    const view = viewOf(camera, phone, marks, 0);
    for (const p of view.points) {
      expect(p.x, p.lesson).toBeGreaterThan(band.left);
      expect(p.x, p.lesson).toBeLessThan(band.left + band.width);
    }
  });

  test("a dive puts its Station's beacon at the page's middle, close", () => {
    const camera = aimed(poseOf({ kind: "dive", at: 0 }, VIEWPORT));
    const b1 = viewOf(camera, VIEWPORT, marks, 0).points.find(
      (p) => p.lesson === "b-1",
    );
    expect(b1?.x).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(b1?.y).toBeCloseTo(VIEWPORT.height / 2, 0);
    expect(b1?.r).toBeGreaterThan(100);
  });

  test("every Station's reach is a 44 px target at the least, and the lit state is the one told", () => {
    const camera = aimed(poseOf({ kind: "whole", band: BAND }, VIEWPORT));
    const view = viewOf(
      camera,
      VIEWPORT,
      BEGINNER.map((lesson) => ({ lesson, lit: lesson === "b-1" })),
      0,
    );
    for (const p of view.points) expect(p.r).toBeGreaterThanOrEqual(22);
    expect(view.points.filter((p) => p.lit).map((p) => p.lesson)).toEqual([
      "b-1",
    ]);
    expect(view.pip).not.toBeNull();
  });

  test("a view the same to within a quarter pixel is not told again", () => {
    const camera = aimed(poseOf({ kind: "whole", band: BAND }, VIEWPORT));
    const a = viewOf(camera, VIEWPORT, marks, 0);
    const b = viewOf(camera, VIEWPORT, marks, 0);
    expect(sameView(a, b)).toBe(true);
    expect(sameView(null, b)).toBe(false);
    expect(sameView(a, viewOf(camera, VIEWPORT, marks, 0.5))).toBe(false);
  });
});

describe("the camera moves between screens", () => {
  const change = (from: ScreenOnShow, to: ScreenOnShow, reduced = false) => ({
    from,
    to,
    reduced,
  });
  const journey = at("/journey", "map");

  test("entering a Lesson dives, and coming back returns Pip to its Station", () => {
    expect(
      planMove(change(journey, at("/lesson/b-2", "intro")), BEGINNER),
    ).toEqual({ at: null, travel: true });
    expect(
      planMove(
        change(at("/lesson/b-1/complete", "complete"), journey),
        BEGINNER,
      ),
    ).toEqual({ at: "b-1", travel: true });
    expect(
      planMove(change(at("/lesson/b-3", "intro"), journey), BEGINNER),
    ).toEqual({ at: "b-3", travel: true });
  });

  test("into the Workspace the Scene stops: the change is the screens' own", () => {
    expect(
      planMove(
        change(at("/lesson/b-1", "intro"), at("/lesson/b-1/step", "step")),
        BEGINNER,
      ),
    ).toEqual({ at: null, travel: false });
    expect(
      planMove(change(journey, at("/lesson/b-1/step", "levelup")), BEGINNER),
    ).toEqual({ at: null, travel: false });
  });

  test("reduced motion never travels, and between screens over the meadow nothing moves", () => {
    expect(
      planMove(change(journey, at("/lesson/b-2", "intro"), true), BEGINNER),
    ).toEqual({ at: null, travel: false });
    expect(
      planMove(
        change(at("/progress", "progress"), at("/settings", "other")),
        BEGINNER,
      ).travel,
    ).toBe(false);
    // An Intermediate Lesson has no Station yet (ticket 57).
    expect(
      planMove(
        change(at("/lesson/i-1", "intro"), at("/progress", "progress")),
        BEGINNER,
      ).travel,
    ).toBe(false);
  });

  const station = poseOf({ kind: "station", at: 0, band: BAND }, VIEWPORT);
  const dive = poseOf({ kind: "dive", at: 0 }, VIEWPORT);
  const linear = (t: number) => t;

  test("a move eases from where the camera stood to the place, and ends on it", () => {
    const moves = createCameraMoves();
    moves.frame(0, station, 0);
    moves.start(0, 200, linear, true);
    const half = moves.frame(100, dive, 0.5);
    expect(half.between).toBe(true);
    expect(half.moving).toBe(true);
    expect(half.pose.position.distanceTo(station.position)).toBeCloseTo(
      half.pose.position.distanceTo(dive.position),
      5,
    );
    const done = moves.frame(200, dive, 0.5);
    expect(done.moving).toBe(false);
    expect(done.between).toBe(false);
    expect(done.pose.position.distanceTo(dive.position)).toBe(0);
    expect(done.pip).toBe(0.5);
  });

  test("a new navigation starts the next move from where the last one stood", () => {
    const moves = createCameraMoves();
    moves.frame(0, station, 0);
    moves.start(0, 200, linear, true);
    const mid = moves.frame(50, dive, 0).pose;
    // Ended where it stands, then a new move back to the Station.
    moves.end(50, dive);
    moves.start(50, 200, linear, true);
    const next = moves.frame(50, station, 0).pose;
    expect(next.position.distanceTo(mid.position)).toBeCloseTo(0, 5);
  });

  test("a move ended at the cap stays where it stood; none starts before a first frame", () => {
    const moves = createCameraMoves();
    moves.start(0, 200, linear, true);
    expect(moves.frame(0, station, 0).moving).toBe(false);
    moves.start(0, 200, linear, true);
    moves.end(360, dive);
    const after = moves.frame(361, dive, 0);
    expect(after.moving).toBe(false);
    expect(after.pose.position.distanceTo(dive.position)).toBe(0);
  });

  test("Pip walks while a glide moves him along the path, the way he goes across the page, and stands once it ends", () => {
    const shares = beginnerLayout().shares;
    const [b1 = 0, b2 = 0] = shares;
    const moves = createCameraMoves();
    expect(moves.frame(0, station, b1).walk).toBe(0);
    // On to the next Station: rightward across the page.
    moves.start(0, 360, linear, false);
    const on = moves.frame(180, station, b2);
    expect(on).toMatchObject({ moving: true, walk: 1 });
    expect(moves.frame(360, station, b2)).toMatchObject({
      moving: false,
      walk: 0,
    });
    // Back again: leftward.
    moves.start(400, 360, linear, false);
    expect(moves.frame(500, station, b1).walk).toBe(-1);
    // A move that keeps Pip where he is, as the pull-back does, is no walk.
    moves.frame(800, station, b1);
    moves.start(800, 360, linear, false);
    expect(moves.frame(900, station, b1)).toMatchObject({
      moving: true,
      walk: 0,
    });
    for (let i = 1; i < shares.length; i++) {
      expect(walkWay(shares[i - 1] ?? 0, shares[i] ?? 0)).toBe(1);
      expect(walkWay(shares[i] ?? 0, shares[i - 1] ?? 0)).toBe(-1);
    }
  });

  test("the view says which way Pip walks, and a new way is told again", () => {
    const camera = aimed(station);
    const standing = viewOf(camera, VIEWPORT, marks, 0.09);
    expect(standing.pip).not.toHaveProperty("walk");
    const walking = viewOf(camera, VIEWPORT, marks, 0.09, 1);
    expect(walking.pip).toMatchObject({ walk: 1 });
    expect(sameView(standing, walking)).toBe(false);
    expect(sameView(walking, viewOf(camera, VIEWPORT, marks, 0.09, 1))).toBe(
      true,
    );
  });

  test("a glide tells how fast Pip goes along the path", () => {
    const [b1 = 0, b2 = 0] = beginnerLayout().shares;
    const moves = createCameraMoves();
    moves.frame(0, station, b1);
    moves.start(0, 800, linear, false);
    expect(moves.frame(400, station, b2).pace).toBeCloseTo((b2 - b1) / 0.8, 6);
    expect(moves.frame(800, station, b2).pace).toBe(0);
  });

  test("the view tells Pip's pace over the ground on the page, in a Station's view and the whole Level's", () => {
    const [b1 = 0, b2 = 0] = beginnerLayout().shares;
    const pace = (b2 - b1) / 0.8;
    for (const place of [
      { kind: "station", at: 0, band: BAND },
      { kind: "whole", band: BAND },
    ] as const) {
      const camera = aimed(poseOf(place, VIEWPORT));
      const view = viewOf(camera, VIEWPORT, marks, b1, 1, pace);
      // Over the whole move, about the two Stations' distance on the page.
      const [p1, p2] = view.points;
      if (p1 === undefined || p2 === undefined) throw new Error("no marks");
      const apart = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      expect(view.pip?.pace, place.kind).toBeGreaterThan(apart / 0.8 / 2);
      expect(view.pip?.pace, place.kind).toBeLessThan((apart / 0.8) * 2);
    }
    // Standing, no pace is told.
    const camera = aimed(station);
    expect(viewOf(camera, VIEWPORT, marks, b1, 0, pace).pip).not.toHaveProperty(
      "pace",
    );
  });

  test("a new Station walks Pip there in a Station's view and in the whole Level's; the pull-back glides; nothing else moves", () => {
    const st = (at: number): Place => ({ kind: "station", at, band: BAND });
    const whole: Place = { kind: "whole", band: BAND };
    const meadow: Place = { kind: "meadow" };
    expect(pipStation(st(2), 4)).toBe(2);
    expect(pipStation(whole, 4)).toBe(4);
    expect(pipStation(whole, -1)).toBe(0);
    expect(pipStation({ kind: "dive", at: 3 }, 1)).toBe(3);
    const on = (place: Place, pip: number) => ({ place, pip });
    expect(glideOf(on(st(0), 0), on(st(1), 1))).toBe("walk");
    // Pulled back, he walks too: the camera stands, he goes.
    expect(glideOf(on(whole, 0), on(whole, 1))).toBe("walk");
    expect(glideOf(on(st(1), 1), on(whole, 1))).toBe("pull");
    expect(glideOf(on(whole, 1), on(st(1), 1))).toBe("pull");
    expect(glideOf(on(whole, 1), on(whole, 1))).toBeNull();
    expect(glideOf(on(meadow, 0), on(st(1), 1))).toBeNull();
    expect(glideOf(on(st(1), 1), on({ kind: "dive", at: 1 }, 1))).toBeNull();
  });

  test("a walk sets off from a stand on the token's easing, and a new Station chosen on the way carries him on at his speed", () => {
    const base = [0.65, 0, 0.35, 1] as const;
    expect(walkEase(base, 0, 0.2, 0.4, 0.8)).toBe(base);
    // Walking the other way, the new walk starts from a stand.
    expect(walkEase(base, -0.3, 0.2, 0.4, 0.8)).toBe(base);
    // On the way at 0.25 shares a second, 0.2 still to go over 0.8 s: the
    // new walk leaves at that speed, its slope one in units of the move.
    const [x1, y1, x2, y2] = walkEase(base, 0.25, 0.2, 0.4, 0.8);
    expect(y1 / x1).toBeCloseTo((0.25 * 0.8) / 0.2, 9);
    expect([x2, y2]).toEqual([0.35, 1]);
    const ease = cubicBezier(x1, y1, x2, y2);
    expect(ease(0.01) / 0.01).toBeCloseTo(1, 1);
    expect(ease(1)).toBe(1);
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
