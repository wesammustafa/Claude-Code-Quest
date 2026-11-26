// The Lessons' cards at each place (the warm workshop, D4): where each card
// sits on its place's surface, in the place's card order, read left to
// right and top to bottom. Pure arithmetic, with no Three.js, so a test
// holds every count a course can give a Level.
import type { LessonId } from "@quest/contract";
import type { WorkshopPlaceId } from "../../workshop/places";

/** A place's surface the cards lie on: its size, in the Scene's units, and how its cards are cut and laid. */
export interface CardSurface {
  width: number;
  height: number;
  /** A card's height over its width. */
  aspect: number;
  /** The widest a card grows when few share the surface. */
  maxWidth: number;
  /** How far a card may lean either way, in radians: pinned by hand, or 0 for a neat row of labels. */
  lean: number;
}

/** A card's place on its surface: its centre from the surface's centre (x right, y up), its size and its lean. */
export interface CardSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  lean: number;
}

/** The share of its cell a card takes, which leaves the gap between cards. */
const FILL = 0.8;

/** Each card's lean, as a share of the surface's own, in turn: a hand-pinned look that never repeats in a row. */
const LEANS = [-0.6, 0.8, -0.2, 0.5, -0.9, 0.3, 1, -0.4, 0.1, -0.7, 0.6, -1];

/**
 * Where `count` cards sit on a surface: the grid that gives them the
 * largest cards, filled row by row from the top left, its last row centred,
 * each card leaning a little by its place in the order. Cards never overlap
 * one another or cross the surface's edge, whatever the count.
 */
export function layoutCards(count: number, surface: CardSurface): CardSlot[] {
  if (count <= 0) return [];
  const { width, height, aspect, maxWidth } = surface;
  let best = { columns: 1, rows: count, card: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    // The card that fits its cell with the lean's corners kept inside it.
    const card = fitIn(width / columns, height / rows, aspect, surface.lean);
    if (card > best.card) best = { columns, rows, card };
  }
  const { columns, rows } = best;
  const cardWidth = Math.min(best.card, maxWidth);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const column = i % columns;
    return {
      x: (column - (inRow - 1) / 2) * cellWidth,
      y: ((rows - 1) / 2 - row) * cellHeight,
      width: cardWidth,
      height: cardWidth * aspect,
      lean: surface.lean * (LEANS[i % LEANS.length] ?? 0),
    };
  });
}

/** The widest card of `aspect` that, leaning by up to `lean`, keeps inside FILL of a cell. */
function fitIn(
  cellWidth: number,
  cellHeight: number,
  aspect: number,
  lean: number,
): number {
  const cos = Math.cos(lean);
  const sin = Math.sin(Math.abs(lean));
  // A w by w * aspect card turned by `lean` spans w (cos + aspect sin)
  // across and w (sin + aspect cos) down.
  return Math.min(
    (cellWidth * FILL) / (cos + aspect * sin),
    (cellHeight * FILL) / (sin + aspect * cos),
  );
}

/** A point in the Scene, in its units. */
export type Point3 = readonly [x: number, y: number, z: number];

/**
 * Where a place's surface lies in the room: its centre, the way its cards
 * read across (right) and up, and the way it faces, all unit and square to
 * one another.
 */
export interface SurfaceFrame {
  centre: Point3;
  right: Point3;
  up: Point3;
  out: Point3;
}

/** Each place's surface: the noticeboard's cork, the kit organizer's drawer fronts, the release desk's top. */
export const SURFACES: Readonly<
  Record<WorkshopPlaceId, CardSurface & SurfaceFrame>
> = {
  noticeboard: {
    centre: [-3.4, 1.95, -4.9],
    right: [1, 0, 0],
    up: [0, 1, 0],
    out: [0, 0, 1],
    width: 2.5,
    height: 1.55,
    aspect: 1.2,
    maxWidth: 0.46,
    lean: 0.07,
  },
  // Its front looks into the room, toward -x: its right, seen from there, is +z.
  organizer: {
    centre: [6.27, 0.86, -2.2],
    right: [0, 0, 1],
    up: [0, 1, 0],
    out: [-1, 0, 0],
    width: 1.95,
    height: 1.4,
    aspect: 0.62,
    maxWidth: 0.42,
    lean: 0,
  },
  // Its cards lie on its top, read from the room's front: up is -z.
  "release-desk": {
    centre: [4.5, 0.836, 1.82],
    right: [1, 0, 0],
    up: [0, 0, -1],
    out: [0, 1, 0],
    width: 1.66,
    height: 0.74,
    aspect: 1.15,
    maxWidth: 0.4,
    lean: 0.09,
  },
};

/** A point on a surface, `x` across and `y` up from its centre and `lift` out of it, in the room. */
export function onSurface(
  frame: SurfaceFrame,
  x: number,
  y: number,
  lift = 0,
): [number, number, number] {
  const { centre: c, right: r, up: u, out: o } = frame;
  return [
    c[0] + r[0] * x + u[0] * y + o[0] * lift,
    c[1] + r[1] * x + u[1] * y + o[1] * lift,
    c[2] + r[2] * x + u[2] * y + o[2] * lift,
  ];
}

/** A Lesson's card where it is drawn: its place's surface and its slot there. */
export interface PlacedCard {
  lesson: LessonId;
  place: WorkshopPlaceId;
  slot: CardSlot;
  /** Its centre in the room. */
  at: [number, number, number];
}

/** Every card of a place, laid on its surface in the place's order. */
export function placedCards(
  place: WorkshopPlaceId,
  lessons: readonly LessonId[],
): PlacedCard[] {
  const surface = SURFACES[place];
  const slots = layoutCards(lessons.length, surface);
  return lessons.map((lesson, i) => {
    const slot = slots[i] ?? { x: 0, y: 0, width: 0, height: 0, lean: 0 };
    return {
      lesson,
      place,
      slot,
      at: onSurface(surface, slot.x, slot.y),
    };
  });
}
