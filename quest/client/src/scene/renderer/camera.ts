// Where the Scene's camera stands in the workshop for each screen (the warm
// workshop, D5), and how it moves between them; while today's Journey shows
// its stage band (09 9.3), the camera frames its Stations' cards in the
// band, and Pip's feet in front of them. Plain math over Three.js's
// vectors, with no renderer, so a test holds each framing, pose and move.
import { PerspectiveCamera, Vector3 } from "three";
import type { LessonId } from "@quest/contract";
import type { ScreenChange, ScreenOnShow } from "../../mount/types";
import { lessonOfScreen, type Band, type PathView } from "../path";
import { sceneStops } from "../SceneLayer";
import { PIP_RADIUS, SPOTS, type FloorPoint } from "../workshop/layout";
import type { WorkshopPlace, WorkshopPlaceId } from "../workshop/places";
import { placedCards, SURFACES, type PlacedCard } from "./workshop/cards";

/** The camera's vertical field of view, in degrees. */
export const FOV = 45;

/**
 * Where the camera stands, what it looks at, and where on the page that
 * point falls, as a shift from the page's centre in CSS pixels; and where
 * Pip's feet stand in the framing, for the Journey's stage, or null.
 */
export interface Pose {
  position: Vector3;
  look: Vector3;
  shift: { x: number; y: number };
  pip: Vector3 | null;
}

/** The Journey's state, as the camera reads it: the Lesson it stands at, whether its stage is pulled back to the whole Level, and the stage's band on the page while it shows. */
export interface PathState {
  at: LessonId | null;
  whole: boolean;
  band: Band | null;
}

/**
 * Welcome's part in its framing: where Pip was last sent on the floor, or
 * null, and the box of Welcome's card on the page, or null before it is
 * measured. A spot the room's view draws Pip under the card at, or off the
 * page, is framed anew to keep him clear of it.
 */
export interface WelcomeState {
  to: FloorPoint | null;
  card: Band | null;
}

const NO_WELCOME: WelcomeState = { to: null, card: null };

/**
 * What the camera frames: the whole room, or the whole room under
 * Welcome's card, which on a narrow page keeps the top, panned to keep Pip
 * clear of the card where he was sent; a Level's place, with or without
 * room kept free for the screen's panel beside it (or below it, on a narrow
 * page); close on a place, beside the panel too; or, while today's Journey
 * shows its stage, the card of the Lesson Pip stands at, or its whole place
 * pulled back, framed in the stage's band with Pip's feet in front of the
 * card.
 */
export type Framing =
  | { kind: "room" }
  | ({ kind: "welcome" } & WelcomeState)
  | { kind: "place"; place: WorkshopPlaceId; panel: boolean }
  | { kind: "close"; place: WorkshopPlaceId }
  | { kind: "stage"; card: PlacedCard; whole: boolean; band: Band };

const ROOM_WIDE: Framing = { kind: "room" };

/** The place that holds a Lesson's card, or null for a Lesson the places do not hold. */
function placeHolding(
  places: readonly WorkshopPlace[],
  lesson: LessonId | null,
): WorkshopPlace | null {
  if (lesson === null) return null;
  return places.find((p) => p.cards.some((c) => c.lesson === lesson)) ?? null;
}

/** The place of a Lesson's card, framed as asked, or the whole room for a Lesson with no card. */
function atLesson(
  places: readonly WorkshopPlace[],
  lesson: LessonId | null,
  frame: (place: WorkshopPlaceId) => Framing,
): Framing {
  const place = placeHolding(places, lesson);
  return place === null ? ROOM_WIDE : frame(place.id);
}

/**
 * The framing a screen shows (D5): the Journey frames the place of the
 * Lesson it stands at, else the first place with a card still to do, and
 * while its stage shows, that Lesson's card in the stage's band, or the
 * whole place pulled back; a Lesson's overview frames its Lesson's place
 * beside the panel, and its step, where the Scene stops, keeps that; Lesson
 * complete comes close on the place, beside its panel; Welcome shows the
 * whole room under its card; every other screen shows the whole room.
 */
export function framingFor(
  screen: ScreenOnShow,
  path: PathState,
  places: readonly WorkshopPlace[],
  welcome: WelcomeState = NO_WELCOME,
): Framing {
  switch (screen.screen) {
    case "map": {
      const holding = placeHolding(places, path.at);
      const place = holding ?? places.find((p) => p.next !== null) ?? null;
      if (place === null) return ROOM_WIDE;
      const card =
        holding === null || path.band === null
          ? undefined
          : placedCards(
              holding.id,
              holding.cards.map((c) => c.lesson),
            ).find((c) => c.lesson === path.at);
      return card === undefined || path.band === null
        ? { kind: "place", place: place.id, panel: false }
        : { kind: "stage", card, whole: path.whole, band: path.band };
    }
    case "intro":
    case "step":
    case "levelup":
      return atLesson(places, lessonOfScreen(screen), (place) => ({
        kind: "place",
        place,
        panel: true,
      }));
    case "complete":
      return atLesson(places, lessonOfScreen(screen), (place) => ({
        kind: "close",
        place,
      }));
    case "welcome":
      return { kind: "welcome", ...welcome };
    default:
      return ROOM_WIDE;
  }
}

/** Whether two framings frame the same: the stage's band moving on the page, as it scrolls, is the same framing. */
export function sameFraming(a: Framing, b: Framing): boolean {
  switch (a.kind) {
    case "room":
      return b.kind === a.kind;
    case "welcome":
      return b.kind === "welcome" && a.to?.x === b.to?.x && a.to?.z === b.to?.z;
    case "place":
      return b.kind === "place" && a.place === b.place && a.panel === b.panel;
    case "close":
      return b.kind === "close" && a.place === b.place;
    case "stage":
      return (
        b.kind === "stage" &&
        a.card.lesson === b.card.lesson &&
        a.whole === b.whole
      );
  }
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
  path: PathState,
  places: readonly WorkshopPlace[],
): { at: LessonId | null; travel: boolean } {
  const left = lessonOfScreen(change.from);
  const back =
    change.to.screen === "map" && placeHolding(places, left) !== null
      ? left
      : null;
  const travel =
    !change.reduced &&
    !sceneStops(change.to.screen) &&
    !sameFraming(
      framingFor(change.from, path, places),
      framingFor(
        change.to,
        back === null ? path : { ...path, at: back },
        places,
      ),
    );
  return { at: back, travel };
}

/** The page's size in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** A page at most this share of its height across (a phone held upright) keeps a screen's panel below the Scene, not beside it. */
const NARROW = 0.9;

/**
 * Whether a page is narrow: its panel goes below, and the room is framed
 * closer. At exactly NARROW too, as the page's CSS has it (app.css,
 * scene-narrow's max-aspect-ratio), so the camera and the panel agree.
 */
export const isNarrow = (viewport: Viewport): boolean =>
  viewport.width <= viewport.height * NARROW;

/** The share of a wide page the Scene keeps on its left beside a panel, and of a narrow one on its top above it (the panel's five eighths, layout.ts). */
const BESIDE_PANEL = 0.6;
const ABOVE_PANEL = 3 / 8;

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

/**
 * The whole room under Welcome's card: on a wide page the room's own view,
 * the card at its foot on the left; on a narrow one framed from Pip's start
 * back to the noticeboard, below the card, as the prototype's phone shows
 * it, with the places off to the side tagged at the page's edge.
 */
const WELCOME_VIEW: View = {
  ...ROOM_VIEW,
  narrow: { look: [-0.3, 0.7, 0], from: unit(0.1, 0.7, 1), width: 6.4 },
};

/** The shares of a narrow page's top and foot that Welcome's card and Pip's toolbar keep, which the room is framed between. */
const UNDER_CARD = 0.34;
const OVER_TOOLBAR = 0.14;

/** Each place, seen from the room, with Pip's spot in front of it in view. */
const PLACE_VIEWS: Readonly<Record<WorkshopPlaceId, View>> = {
  noticeboard: {
    look: [-3.2, 1.55, -4.1],
    from: unit(0.22, 0.36, 1),
    width: 5.2,
    height: 4,
    narrow: { look: [-3.3, 1.5, -4.2], from: unit(0.18, 0.4, 1), width: 3.9 },
  },
  // Seen from above Pip's head, which then falls below the lowest row of
  // its upright face's cards, as the noticeboard's and desk's views keep
  // him clear of theirs.
  organizer: {
    look: [5.85, 0.95, -2.0],
    from: unit(-1, 0.8, 0.42),
    width: 4.6,
    height: 3.5,
    narrow: { look: [5.6, 0.9, -2.0], from: unit(-1, 0.7, 0.3), width: 3.1 },
  },
  "release-desk": {
    look: [4.55, 0.85, 2.3],
    from: unit(-0.35, 0.8, 0.9),
    width: 4.4,
    height: 3.3,
    narrow: { look: [4.5, 0.85, 2.1], from: unit(-0.25, 0.8, 0.9), width: 3 },
  },
};

/**
 * How much further back a framing beside a panel stands on a wide page than
 * its place's own view, so Pip by the place stays a modest figure beside
 * the panel, about an eighth of the page's height, as the prototype shows
 * him; a narrow page's panel below already leaves him about that.
 */
const BESIDE_BACK = 1.5;

/** How much of the framing beside the panel the close framing shows. */
const CLOSE = 0.8;

/** What a framing sees on a page of one shape: a View with its narrow page's parts taken in. */
type Seen = Omit<View, "narrow">;

const seenOn = (view: View, narrow: boolean): Seen =>
  narrow ? { ...view, ...view.narrow } : view;

/**
 * How much round a card the Journey's stage shows: a little either side,
 * and, up the page, from the front of Pip's feet to over his head or the
 * top of the card's surface, whichever is higher, with this margin, so
 * every card of a place is framed alike.
 */
const CARD_ACROSS = 2.4;
const CARD_MARGIN = 0.3;
/** How tall Pip stands, to his antennas' tips, in the Scene's units. */
const PIP_TALL = 1.1;
/** The share of the stage's band a framing fills, which keeps every Station's mark wholly on it. */
const BAND_FILL = 0.9;

/** Where Pip stands at a card on the Journey's stage: on the line of his place's spot, square in front of the card. */
function pipFootAt(card: PlacedCard): Vector3 {
  const { stand } = SPOTS[card.place];
  const [rx, , rz] = SURFACES[card.place].right;
  const along = (card.at[0] - stand.x) * rx + (card.at[2] - stand.z) * rz;
  return new Vector3(stand.x + rx * along, 0, stand.z + rz * along);
}

/**
 * The stage's view of a card: from its place's side, turned square to the
 * card's row, so the card and Pip's feet in front of it fall in one column
 * of the page, and high enough to hold both. Its height is measured up the
 * page, not up the room: seen from above, what stands nearer the camera
 * falls lower on the page, so the desk's steep view, framed by heights
 * alone, drew the front of Pip's feet under the panel below the band.
 */
function cardView(card: PlacedCard, narrow: boolean): Seen {
  const surface = SURFACES[card.place];
  const [fx, fy, fz] = seenOn(PLACE_VIEWS[card.place], narrow).from;
  const [rx, ry, rz] = surface.right;
  const along = fx * rx + fy * ry + fz * rz;
  const from = new Vector3(
    ...unit(fx - rx * along, fy - ry * along, fz - rz * along),
  );
  // Up the page: the room's up with its part along the view taken out.
  const up = new Vector3(0, 1, 0).addScaledVector(from, -from.y).normalize();
  const foot = pipFootAt(card);
  const at = new Vector3(...card.at);
  const surfaceUp = new Vector3(...surface.up);
  const fromCentre = at.clone().sub(new Vector3(...surface.centre));
  const surfaceTop = at
    .clone()
    .addScaledVector(surfaceUp, surface.height / 2 - fromCentre.dot(surfaceUp));
  const toCamera = new Vector3(from.x, 0, from.z).normalize();
  const mid = at.clone().add(foot).multiplyScalar(0.5).setY(0);
  const heights = [
    surfaceTop,
    foot.clone().setY(PIP_TALL),
    foot.clone().addScaledVector(toCamera, PIP_RADIUS),
  ].map((p) => p.sub(mid).dot(up));
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  return {
    look: mid.addScaledVector(up, (low + high) / 2).toArray(),
    from: from.toArray(),
    width: CARD_ACROSS,
    height: high - low + 2 * CARD_MARGIN,
  };
}

/** The camera's focal length in CSS pixels for a page of `height`. */
const focal = (height: number) =>
  height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** The camera's pose for a framing on a page of this size. */
export function poseOf(framing: Framing, viewport: Viewport): Pose {
  const narrow = isNarrow(viewport);
  let seen: Seen;
  let scale = 1;
  // The part of the page the framing fills, and its centre's shift from the page's.
  let region: { width: number; height: number };
  let shift: Pose["shift"];
  if (framing.kind === "stage") {
    const { band, card } = framing;
    seen = framing.whole
      ? seenOn(PLACE_VIEWS[card.place], narrow)
      : cardView(card, narrow);
    region = { width: band.width * BAND_FILL, height: band.height * BAND_FILL };
    shift = {
      x: band.left + band.width / 2 - viewport.width / 2,
      y: band.top + band.height / 2 - viewport.height / 2,
    };
  } else if (framing.kind === "welcome") {
    seen = seenOn(WELCOME_VIEW, narrow);
    const top = narrow ? viewport.height * UNDER_CARD : 0;
    const foot = narrow ? viewport.height * OVER_TOOLBAR : 0;
    region = { width: viewport.width, height: viewport.height - top - foot };
    shift = { x: 0, y: (top - foot) / 2 };
  } else {
    seen = seenOn(
      framing.kind === "room" ? ROOM_VIEW : PLACE_VIEWS[framing.place],
      narrow,
    );
    // All of the page, or what a panel leaves.
    const panel =
      framing.kind === "close" || (framing.kind === "place" && framing.panel);
    if (panel && !narrow) scale = BESIDE_BACK;
    if (framing.kind === "close") scale *= CLOSE;
    region = {
      width: panel && !narrow ? viewport.width * BESIDE_PANEL : viewport.width,
      height: panel && narrow ? viewport.height * ABOVE_PANEL : viewport.height,
    };
    shift = {
      x: (region.width - viewport.width) / 2,
      y: (region.height - viewport.height) / 2,
    };
  }
  const f = focal(viewport.height);
  const distance = Math.max(
    (seen.width * scale * f) / Math.max(1, region.width),
    (seen.height * scale * f) / Math.max(1, region.height),
  );
  const look = new Vector3(...seen.look);
  const pose: Pose = {
    position: new Vector3(...seen.from).multiplyScalar(distance).add(look),
    look,
    shift,
    pip: framing.kind === "stage" ? pipFootAt(framing.card) : null,
  };
  return framing.kind === "welcome" && framing.to !== null
    ? keepClear(pose, viewport, framing.to, framing.card, narrow)
    : pose;
}

/** How far Pip stands clear of the page's edges and of Welcome's card, in CSS pixels. */
const CLEAR_PX = 16;
/** The share of a wide page's foot Pip's toolbar keeps. */
const TOOLBAR_WIDE = 0.1;
/** Pip's width over his height, as he stands drawn on the page. */
const PIP_WIDTH = 0.8;

/** A box on the page: its left, top, right and bottom edges. */
interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Edges, b: Edges) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * How far to move Pip's box across and down the page so it lies in `free`
 * and clear of `card`: the least move into the free part, then, if he would
 * still stand under the card, the least move past one of its edges that
 * keeps him in the free part (the least of them all if none does).
 */
export function clearMove(
  pip: Edges,
  free: Edges,
  card: Edges | null,
): { x: number; y: number } {
  const into = (lo: number, hi: number, min: number, max: number) =>
    lo < min ? min - lo : hi > max ? Math.max(max - hi, min - lo) : 0;
  const x = into(pip.left, pip.right, free.left, free.right);
  const y = into(pip.top, pip.bottom, free.top, free.bottom);
  const at = (dx: number, dy: number): Edges => ({
    left: pip.left + dx,
    right: pip.right + dx,
    top: pip.top + dy,
    bottom: pip.bottom + dy,
  });
  if (card === null || !overlaps(at(x, y), card)) return { x, y };
  const moved = at(x, y);
  const ways = [
    { x: x + card.right - moved.left, y },
    { x: x + card.left - moved.right, y },
    { x, y: y + card.bottom - moved.top },
    { x, y: y + card.top - moved.bottom },
  ];
  const inside = (m: { x: number; y: number }) => {
    const b = at(m.x, m.y);
    return (
      b.left >= free.left - 0.5 &&
      b.right <= free.right + 0.5 &&
      b.top >= free.top - 0.5 &&
      b.bottom <= free.bottom + 0.5
    );
  };
  const size = (m: { x: number; y: number }) => Math.hypot(m.x - x, m.y - y);
  const fits = ways.filter(inside);
  const from = fits.length > 0 ? fits : ways;
  return from.reduce((a, b) => (size(b) < size(a) ? b : a));
}

/**
 * Welcome's room with Pip sent to `to`: the room's own pose when it draws
 * him whole on the page, clear of the card and over his toolbar; else that
 * pose panned, across the page and up or down it, just far enough that it
 * does. Pip about the room is kept in view, never under the card.
 */
function keepClear(
  pose: Pose,
  viewport: Viewport,
  to: FloorPoint,
  card: Band | null,
  narrow: boolean,
): Pose {
  const camera = new PerspectiveCamera(
    FOV,
    viewport.width / viewport.height,
    0.1,
    100,
  );
  aim(camera, pose, viewport);
  const onPage = (y: number) => {
    const v = new Vector3(to.x, y, to.z).project(camera);
    return {
      x: ((v.x + 1) / 2) * viewport.width,
      y: ((1 - v.y) / 2) * viewport.height,
    };
  };
  const feet = onPage(0);
  const head = onPage(PIP_TALL);
  const half = ((feet.y - head.y) * PIP_WIDTH) / 2;
  const pip: Edges = {
    left: Math.min(feet.x, head.x) - half,
    right: Math.max(feet.x, head.x) + half,
    top: head.y,
    bottom: feet.y,
  };
  const foot = viewport.height * (narrow ? OVER_TOOLBAR : TOOLBAR_WIDE);
  const free: Edges = {
    left: CLEAR_PX,
    top: CLEAR_PX,
    right: viewport.width - CLEAR_PX,
    bottom: viewport.height - foot - CLEAR_PX,
  };
  const around =
    card === null
      ? null
      : {
          left: card.left - CLEAR_PX,
          top: card.top - CLEAR_PX,
          right: card.left + card.width + CLEAR_PX,
          bottom: card.top + card.height + CLEAR_PX,
        };
  const move = clearMove(pip, free, around);
  if (move.x === 0 && move.y === 0) return pose;
  // A pan parallel to the page moves a point at Pip's depth by the
  // focal length over that depth per unit: the camera moves the other way.
  const mid = new Vector3(to.x, PIP_TALL / 2, to.z);
  const forward = camera.getWorldDirection(new Vector3());
  const depth = mid.clone().sub(camera.position).dot(forward);
  const perPx = depth / focal(viewport.height);
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const pan = right
    .multiplyScalar(-move.x * perPx)
    .add(up.multiplyScalar(move.y * perPx));
  return {
    ...pose,
    position: pose.position.clone().add(pan),
    look: pose.look.clone().add(pan),
  };
}

/** Two poses mixed: `t` 0 is `a`, 1 is `b`; Pip walks from `a`'s feet to `b`'s, or stands at `b`'s. */
function mixPoses(a: Pose, b: Pose, t: number): Pose {
  return {
    position: a.position.clone().lerp(b.position, t),
    look: a.look.clone().lerp(b.look, t),
    shift: {
      x: a.shift.x + (b.shift.x - a.shift.x) * t,
      y: a.shift.y + (b.shift.y - a.shift.y) * t,
    },
    pip:
      a.pip === null || b.pip === null
        ? (b.pip?.clone() ?? null)
        : a.pip.clone().lerp(b.pip, t),
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
