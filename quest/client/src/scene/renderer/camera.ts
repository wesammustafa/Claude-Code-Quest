// Where the Scene's camera stands for each place (09 9.3, ticket 52), and
// how it moves between them. Plain math over Three.js's vectors, with no
// renderer, so a test holds each pose and move.
import { PerspectiveCamera, Vector3 } from "three";
import type { LessonId } from "@quest/contract";
import type {
  SceneStation,
  ScreenChange,
  ScreenOnShow,
} from "../../mount/types";
import {
  lessonOfScreen,
  type Band,
  type PathView,
  type StationPoint,
} from "../path";
import { sceneStops } from "../SceneLayer";
import { BEACON_HEIGHT, beginnerLayout, pathPoint } from "./beginner";

/** The camera's vertical field of view, in degrees. */
export const FOV = 45;

/** Where the camera stands, what it looks at, and where on the page that point falls, as a shift from the page's centre in CSS pixels. */
export interface Pose {
  position: Vector3;
  look: Vector3;
  shift: { x: number; y: number };
}

/**
 * The place the camera frames: a Station of the Journey's path, the whole
 * Level, a dive into a Station behind its Lesson's screens, or the meadow
 * every other screen sits over.
 */
export type Place =
  | { kind: "station"; at: number; band: Band }
  | { kind: "whole"; band: Band }
  | { kind: "dive"; at: number }
  | { kind: "meadow" };

/** The Journey's state, as the camera reads it. */
export interface PathState {
  at: LessonId | null;
  whole: boolean;
  band: Band | null;
}

/** The Beginner Level's Stations in path order, from the stations the Scene is told. */
export function beginnerStations(
  stations: readonly SceneStation[],
): readonly SceneStation[] {
  return stations.filter((s) => s.level === "beginner");
}

/** The place a screen shows, given the Journey's state and the Beginner Stations. */
export function placeFor(
  screen: ScreenOnShow,
  path: PathState,
  stations: readonly SceneStation[],
): Place {
  const ids = beginnerStations(stations).map((s) => s.lesson);
  if (screen.screen === "map" && path.band !== null) {
    if (path.whole) return { kind: "whole", band: path.band };
    const at = path.at === null ? -1 : ids.indexOf(path.at);
    return { kind: "station", at: Math.max(0, at), band: path.band };
  }
  const lesson = lessonOfScreen(screen);
  const at = lesson === null ? -1 : ids.indexOf(lesson);
  if (at >= 0) return { kind: "dive", at };
  return { kind: "meadow" };
}

/**
 * What a screen change asks of the camera (09 9.3): the Station Pip
 * stands at when the Journey comes back from a Lesson's screens, and
 * whether the camera travels. It travels into a Station's Lesson and back
 * out to the Journey; into the Workspace the Scene stops, so the change is
 * the screens' own; under reduced motion it never travels; between two
 * screens over the meadow nothing moves.
 */
export function planMove(
  change: Pick<ScreenChange, "from" | "to" | "reduced">,
  lessons: readonly LessonId[],
): { at: LessonId | null; travel: boolean } {
  const lessonOf = (screen: ScreenOnShow) => {
    const lesson = lessonOfScreen(screen);
    return lesson !== null && lessons.includes(lesson) ? lesson : null;
  };
  const back = lessonOf(change.from);
  const at = change.to.screen === "map" ? back : null;
  const onPath = (screen: ScreenOnShow) =>
    screen.screen === "map" || lessonOf(screen) !== null;
  const travel =
    !change.reduced &&
    !sceneStops(change.to.screen) &&
    (onPath(change.from) || onPath(change.to));
  return { at, travel };
}

/** The page's size in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** How far up the camera looks down on each place, in radians. */
const ELEVATION = { station: 0.42, whole: 0.62, dive: 0.38 } as const;
/** How much of the path the views frame across their band, in scene units. */
const STATION_WIDTH = 15;
const WHOLE_MARGIN = 4;
/** The share of the band the framed width fills. */
const FILL = 0.92;
/** How close the dive comes to its beacon. */
const DIVE_DISTANCE = 4.2;
/** Where the meadow view stands and looks: over the near ground, toward the path. */
const MEADOW = {
  position: new Vector3(0, 3.4, 15),
  look: new Vector3(0, 0.4, -6),
} as const;

/** The camera's focal length in CSS pixels for a page of `height`. */
const focal = (height: number) =>
  height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** The camera's distance from `look` that fits `width` and `depth` of the ground across `band`. */
function fit(
  viewport: Viewport,
  band: Band,
  width: number,
  depth: number,
  elevation: number,
): number {
  const f = focal(viewport.height);
  const across = (width * f) / Math.max(1, band.width * FILL);
  const down =
    (depth * Math.sin(elevation) * f) / Math.max(1, band.height * FILL);
  return Math.max(across, down);
}

/** The shift that puts the look point at the band's centre. */
function shiftTo(viewport: Viewport, band: Band): Pose["shift"] {
  return {
    x: band.left + band.width / 2 - viewport.width / 2,
    y: band.top + band.height / 2 - viewport.height / 2,
  };
}

/** A camera `distance` back from `look`, raised by `elevation`, looking toward the far hills. */
function from(look: Vector3, distance: number, elevation: number): Vector3 {
  return new Vector3(
    look.x,
    look.y + Math.sin(elevation) * distance,
    look.z + Math.cos(elevation) * distance,
  );
}

/** Where a Station's beacon floats. */
export function beaconOf(at: number): Vector3 {
  const foot = beginnerLayout().stations[at] ?? new Vector3();
  const capstone = at === beginnerLayout().stations.length - 1;
  return foot.clone().setY(foot.y + BEACON_HEIGHT * (capstone ? 1.3 : 1));
}

/** The camera's pose for a place on a page of this size. */
export function poseOf(place: Place, viewport: Viewport): Pose {
  const layout = beginnerLayout();
  switch (place.kind) {
    case "station": {
      const look = (layout.stations[place.at] ?? layout.centre)
        .clone()
        .setY(0.6);
      const d = fit(viewport, place.band, STATION_WIDTH, 3, ELEVATION.station);
      return {
        position: from(look, d, ELEVATION.station),
        look,
        shift: shiftTo(viewport, place.band),
      };
    }
    case "whole": {
      const look = layout.centre.clone().setY(0.4);
      const d = fit(
        viewport,
        place.band,
        layout.span.width + WHOLE_MARGIN,
        layout.span.depth + WHOLE_MARGIN,
        ELEVATION.whole,
      );
      return {
        position: from(look, d, ELEVATION.whole),
        look,
        shift: shiftTo(viewport, place.band),
      };
    }
    case "dive": {
      const look = beaconOf(place.at);
      return {
        position: from(look, DIVE_DISTANCE, ELEVATION.dive),
        look,
        shift: { x: 0, y: 0 },
      };
    }
    case "meadow":
      return {
        position: MEADOW.position.clone(),
        look: MEADOW.look.clone(),
        shift: { x: 0, y: 0 },
      };
  }
}

/** Two poses mixed: `t` 0 is `a`, 1 is `b`. */
export function mixPoses(a: Pose, b: Pose, t: number): Pose {
  return {
    position: a.position.clone().lerp(b.position, t),
    look: a.look.clone().lerp(b.look, t),
    shift: {
      x: a.shift.x + (b.shift.x - a.shift.x) * t,
      y: a.shift.y + (b.shift.y - a.shift.y) * t,
    },
  };
}

/** Where Pip stands at a Station: on the path just in front of its plinth. */
export function pipFootAt(share: number): Vector3 {
  return pathPoint(share).add(new Vector3(0, 0.05, 0.95));
}

/** A move under way: from the pose it started at, over `ms`, eased by `ease`. */
interface Move {
  from: Pose;
  start: number;
  ms: number;
  ease: (t: number) => number;
  /** Pip's place along the path when it started, as a share of the path. */
  pipFrom: number;
  /** A move between screens, which S11's change ends at the cap, as against a glide on the Journey. */
  between: boolean;
}

/** What the camera shows in one frame. */
export interface Shot {
  pose: Pose;
  /** Pip's place along the path, as a share of it. */
  pip: number;
  /** A move between screens is still under way. */
  between: boolean;
  /** A move is under way, so another frame is needed. */
  moving: boolean;
}

/**
 * The camera's moves (09 9.1, 9.3): each starts from where the camera
 * stands, even mid-move, and goes to its place's pose as that place stands
 * in each frame, so the Journey's band can scroll under it. A new move
 * replaces the one in flight; a move ended early stays where it stood.
 */
export interface CameraMoves {
  /** Starts a move from the last frame's pose; none before the first frame. */
  start: (
    now: number,
    ms: number,
    ease: (t: number) => number,
    between: boolean,
  ) => void;
  /** Ends the move in flight where it stands at `now`, toward `target`. */
  end: (now: number, target: Pose) => void;
  /** The frame at `now` toward `target`, Pip walking toward `pipGoal`. */
  frame: (now: number, target: Pose, pipGoal: number) => Shot;
}

export function createCameraMoves(): CameraMoves {
  let live: Pose | null = null;
  let pip = 0;
  let move: Move | null = null;
  const at = (m: Move, now: number) => {
    if (m.ms <= 0) return 1;
    return m.ease(Math.min(1, Math.max(0, (now - m.start) / m.ms)));
  };
  return {
    start: (now, ms, ease, between) => {
      if (live === null) return;
      move = { from: live, start: now, ms, ease, pipFrom: pip, between };
    },
    end: (now, target) => {
      if (move === null) return;
      live = mixPoses(move.from, target, at(move, now));
      move = null;
    },
    frame: (now, target, pipGoal) => {
      if (move !== null && now - move.start >= move.ms) move = null;
      const m = move;
      const t = m === null ? 1 : at(m, now);
      const pose = m === null ? target : mixPoses(m.from, target, t);
      live = pose;
      pip = m === null ? pipGoal : m.pipFrom + (pipGoal - m.pipFrom) * t;
      return {
        pose,
        pip,
        between: move?.between === true,
        moving: move !== null,
      };
    },
  };
}

/** Puts the camera at a pose: its look point at the pose's shift from the page's centre. */
export function aim(
  camera: PerspectiveCamera,
  pose: Pose,
  viewport: Viewport,
): void {
  camera.position.copy(pose.position);
  camera.lookAt(pose.look);
  const { width, height } = viewport;
  if (pose.shift.x === 0 && pose.shift.y === 0) {
    if (camera.view !== null) camera.clearViewOffset();
  } else
    camera.setViewOffset(
      width,
      height,
      -pose.shift.x,
      -pose.shift.y,
      width,
      height,
    );
  camera.updateMatrixWorld();
}

/** A Station's reach for a tap, at the least: a 44 px target (WCAG 2.5.8's enhanced size). */
const MIN_REACH_PX = 22;
/** How far round a beacon a tap reaches, in scene units. */
const REACH = 1.1;

/** Where every Station and Pip's feet fall on the page, as the aimed camera draws them. */
export function viewOf(
  camera: PerspectiveCamera,
  viewport: Viewport,
  stations: readonly { lesson: LessonId; lit: boolean }[],
  pipShare: number,
): PathView {
  const v = new Vector3();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const toPage = (p: Vector3) => {
    v.copy(p).project(camera);
    return {
      x: ((v.x + 1) / 2) * viewport.width,
      y: ((1 - v.y) / 2) * viewport.height,
      front: v.z < 1,
    };
  };
  const points: StationPoint[] = [];
  stations.forEach(({ lesson, lit }, i) => {
    const beacon = beaconOf(i);
    const c = toPage(beacon);
    if (!c.front) return;
    const edge = toPage(beacon.addScaledVector(right, REACH));
    points.push({
      lesson,
      x: c.x,
      y: c.y,
      r: Math.max(MIN_REACH_PX, Math.hypot(edge.x - c.x, edge.y - c.y)),
      lit,
    });
  });
  const foot = toPage(pipFootAt(pipShare));
  return { points, pip: foot.front ? { x: foot.x, y: foot.y } : null };
}

/** A drawn point moves less than this, in CSS pixels, and the page is not told again. */
const STILL_PX = 0.25;

/** Whether two views draw the same, to within STILL_PX. */
export function sameView(a: PathView | null, b: PathView): boolean {
  if (a === null || a.points.length !== b.points.length) return false;
  const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.abs(p.x - q.x) < STILL_PX && Math.abs(p.y - q.y) < STILL_PX;
  if (a.pip === null || b.pip === null) {
    if (a.pip !== b.pip) return false;
  } else if (!near(a.pip, b.pip)) return false;
  return a.points.every((p, i) => {
    const q = b.points[i];
    return (
      q !== undefined &&
      p.lesson === q.lesson &&
      p.lit === q.lit &&
      near(p, q) &&
      Math.abs(p.r - q.r) < STILL_PX
    );
  });
}

/**
 * A cubic Bézier easing as CSS's cubic Bézier timing function gives it, solved for x by
 * Newton's method with a bisection fallback.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slope(x1, x2, t);
      if (Math.abs(s) < 1e-6) break;
      t -= (at(x1, x2, t) - x) / s;
    }
    if (t < 0 || t > 1 || Math.abs(at(x1, x2, t) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        if (at(x1, x2, t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return at(y1, y2, t);
  };
}
