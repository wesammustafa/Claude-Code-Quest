// Where the Scene's camera stands in the workshop for each screen (the warm
// workshop, D5), and how it moves between them. Plain math over Three.js's
// vectors, with no renderer, so a test holds each framing, pose and move.
import { PerspectiveCamera, Vector3 } from "three";
import type { LessonId } from "@quest/contract";
import type {
  SceneStation,
  ScreenChange,
  ScreenOnShow,
} from "../../mount/types";
import { lessonOfScreen, type PathView } from "../path";
import { sceneStops } from "../SceneLayer";
import {
  placeOfLesson,
  workshopPlaces,
  type WorkshopPlaceId,
} from "../workshop/places";

/** The camera's vertical field of view, in degrees. */
export const FOV = 45;

/** Where the camera stands, what it looks at, and where on the page that point falls, as a shift from the page's centre in CSS pixels. */
export interface Pose {
  position: Vector3;
  look: Vector3;
  shift: { x: number; y: number };
}

/**
 * What the camera frames: the whole room; a Level's place, with or without
 * room kept free for the screen's panel beside it (or below it, on a narrow
 * page); or close on a place.
 */
export type Framing =
  | { kind: "room" }
  | { kind: "place"; place: WorkshopPlaceId; panel: boolean }
  | { kind: "close"; place: WorkshopPlaceId };

const ROOM_WIDE: Framing = { kind: "room" };

/** The place of a Lesson's card, framed as asked, or the whole room for a Lesson with no card. */
function atLesson(
  stations: readonly SceneStation[],
  lesson: LessonId | null,
  frame: (place: WorkshopPlaceId) => Framing,
): Framing {
  const place = lesson === null ? null : placeOfLesson(stations, lesson);
  return place === null ? ROOM_WIDE : frame(place);
}

/**
 * The framing a screen shows (D5): the Journey frames the place of the
 * Lesson it stands at (`at`), else the first place with a card still to do;
 * a Lesson's overview frames its Lesson's place beside the panel, and its
 * step, where the Scene stops, keeps that; Lesson complete comes close on
 * the place; every other screen shows the whole room.
 */
export function framingFor(
  screen: ScreenOnShow,
  at: LessonId | null,
  stations: readonly SceneStation[],
): Framing {
  switch (screen.screen) {
    case "map": {
      const place =
        (at === null ? null : placeOfLesson(stations, at)) ??
        workshopPlaces(stations).find((p) => p.next !== null)?.id ??
        null;
      return place === null
        ? ROOM_WIDE
        : { kind: "place", place, panel: false };
    }
    case "intro":
    case "step":
    case "levelup":
      return atLesson(stations, lessonOfScreen(screen), (place) => ({
        kind: "place",
        place,
        panel: true,
      }));
    case "complete":
      return atLesson(stations, lessonOfScreen(screen), (place) => ({
        kind: "close",
        place,
      }));
    default:
      return ROOM_WIDE;
  }
}

/** Whether two framings frame the same. */
export function sameFraming(a: Framing, b: Framing): boolean {
  if (a.kind === "room" || b.kind === "room") return a.kind === b.kind;
  if (a.kind !== b.kind || a.place !== b.place) return false;
  return a.kind !== "place" || b.kind !== "place" || a.panel === b.panel;
}

/**
 * What a screen change asks of the camera (09 9.3): the Lesson the Journey
 * stands at when it comes back from that Lesson's screens, and whether the
 * camera travels. It travels when the framing changes; into the Workspace
 * the Scene stops, so the change is the screens' own; under reduced motion
 * it never travels.
 */
export function planMove(
  change: Pick<ScreenChange, "from" | "to" | "reduced">,
  at: LessonId | null,
  stations: readonly SceneStation[],
): { at: LessonId | null; travel: boolean } {
  const left = lessonOfScreen(change.from);
  const back =
    change.to.screen === "map" &&
    left !== null &&
    stations.some((s) => s.lesson === left)
      ? left
      : null;
  const travel =
    !change.reduced &&
    !sceneStops(change.to.screen) &&
    !sameFraming(
      framingFor(change.from, at, stations),
      framingFor(change.to, back ?? at, stations),
    );
  return { at: back, travel };
}

/** The page's size in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** A page narrower than this share of its height (a phone held upright) keeps a screen's panel below the Scene, not beside it. */
const NARROW = 0.9;

/** Whether a page is narrow: its panel goes below, and the room is framed closer. */
export const isNarrow = (viewport: Viewport): boolean =>
  viewport.width < viewport.height * NARROW;

/** The share of a wide page the Scene keeps on its left beside a panel, and of a narrow one on its top above it. */
const BESIDE_PANEL = 0.6;
const ABOVE_PANEL = 0.5;

type V3 = readonly [number, number, number];

/**
 * How a framing sees what it frames: the point it looks at, the way back
 * from that point to the camera, and how much round it must show across
 * and up, in the Scene's units; a narrow page shows less across, and may
 * look down more steeply, so the room fills its height.
 */
interface View {
  look: V3;
  from: V3;
  width: number;
  height: number;
  narrow: { look: V3; from: V3; width: number };
}

const unit = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

/** The whole room, from over its open front. */
const ROOM_VIEW: View = {
  look: [0.5, 1.15, -0.7],
  from: unit(0, 0.42, 1),
  width: 13.4,
  height: 6.8,
  narrow: { look: [0, 0.8, -1.4], from: unit(0, 0.7, 1), width: 6.8 },
};

/** Each place, seen from the room, with Pip's spot in front of it in view. */
const PLACE_VIEWS: Readonly<Record<WorkshopPlaceId, View>> = {
  noticeboard: {
    look: [-3.2, 1.55, -4.1],
    from: unit(0.22, 0.36, 1),
    width: 5.2,
    height: 4,
    narrow: { look: [-3.3, 1.5, -4.2], from: unit(0.18, 0.4, 1), width: 3.9 },
  },
  organizer: {
    look: [5.85, 0.95, -2.0],
    from: unit(-1, 0.4, 0.42),
    width: 4.6,
    height: 3.5,
    narrow: { look: [6.0, 0.95, -2.1], from: unit(-1, 0.4, 0.3), width: 3.1 },
  },
  "release-desk": {
    look: [4.55, 0.85, 2.3],
    from: unit(-0.35, 0.8, 0.9),
    width: 4.4,
    height: 3.3,
    narrow: { look: [4.5, 0.85, 2.1], from: unit(-0.25, 0.8, 0.9), width: 3 },
  },
};

/** How much of its place's view the close framing shows. */
const CLOSE = 0.72;

/** The camera's focal length in CSS pixels for a page of `height`. */
const focal = (height: number) =>
  height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** The camera's pose for a framing on a page of this size. */
export function poseOf(framing: Framing, viewport: Viewport): Pose {
  const narrow = isNarrow(viewport);
  const view = framing.kind === "room" ? ROOM_VIEW : PLACE_VIEWS[framing.place];
  const scale = framing.kind === "close" ? CLOSE : 1;
  // The part of the page the framing fills: all of it, or what a panel leaves.
  const panel = framing.kind === "place" && framing.panel;
  const region = {
    width: panel && !narrow ? viewport.width * BESIDE_PANEL : viewport.width,
    height: panel && narrow ? viewport.height * ABOVE_PANEL : viewport.height,
  };
  const f = focal(viewport.height);
  const seen = narrow ? { ...view, ...view.narrow } : view;
  const distance = Math.max(
    (seen.width * scale * f) / Math.max(1, region.width),
    (seen.height * scale * f) / Math.max(1, region.height),
  );
  const look = new Vector3(...seen.look);
  return {
    position: new Vector3(...seen.from).multiplyScalar(distance).add(look),
    look,
    shift: {
      x: (region.width - viewport.width) / 2,
      y: (region.height - viewport.height) / 2,
    },
  };
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

/** A move under way: from the pose it started at, over `ms`, eased by `ease`. */
interface Move {
  from: Pose;
  start: number;
  ms: number;
  ease: (t: number) => number;
  /** A move between screens, which S11's change ends at the cap, as against a glide on the Journey. */
  between: boolean;
}

/** What the camera shows in one frame. */
export interface Shot {
  pose: Pose;
  /** A move between screens is still under way. */
  between: boolean;
  /** A move is under way, so another frame is needed. */
  moving: boolean;
}

/**
 * The camera's moves (09 9.1, 9.3): each starts from where the camera
 * stands, even mid-move, and goes to its framing's pose as that stands in
 * each frame, so a page resized mid-move still lands. A new move replaces
 * the one in flight; one ended early starts the next from where it stood.
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
  /** The frame at `now` toward `target`. */
  frame: (now: number, target: Pose) => Shot;
}

export function createCameraMoves(): CameraMoves {
  let live: Pose | null = null;
  let move: Move | null = null;
  const at = (m: Move, now: number) => {
    if (m.ms <= 0) return 1;
    return m.ease(Math.min(1, Math.max(0, (now - m.start) / m.ms)));
  };
  return {
    start: (now, ms, ease, between) => {
      if (live === null) return;
      move = { from: live, start: now, ms, ease, between };
    },
    end: (now, target) => {
      if (move === null) return;
      live = mixPoses(move.from, target, at(move, now));
      move = null;
    },
    frame: (now, target) => {
      if (move !== null && now - move.start >= move.ms) move = null;
      const pose =
        move === null ? target : mixPoses(move.from, target, at(move, now));
      live = pose;
      return {
        pose,
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

/** A drawn point moves less than this, in CSS pixels, and the page is not told again. */
const STILL_PX = 0.25;

/** Whether two views draw the same, to within STILL_PX. */
export function sameView(a: PathView | null, b: PathView): boolean {
  if (a === null || a.points.length !== b.points.length) return false;
  const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.abs(p.x - q.x) < STILL_PX && Math.abs(p.y - q.y) < STILL_PX;
  if (a.pip === null || b.pip === null) {
    if (a.pip !== b.pip) return false;
  } else if (
    !near(a.pip, b.pip) ||
    a.pip.walk !== b.pip.walk ||
    Math.abs((a.pip.pace ?? 0) - (b.pip.pace ?? 0)) >= STILL_PX
  )
    return false;
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
