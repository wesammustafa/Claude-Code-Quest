// The workshop room (the warm workshop, D3), built in code with no modelled
// asset: a planked floor, panelled walls with two windows and an open
// entrance, hanging lamps, the workbench on its rug, the shelf, the solder
// station, the armchair and tea table, plants, and the three Levels' places
// (the noticeboard, the kit organizer and the release desk), each standing
// where the floor plan (../../workshop/layout.ts) keeps Pip off it. Every
// colour is the look's, baked under the room's light (./bake.ts); the soft
// shadows on the floor are plain meshes, so no tier needs a shadow map.
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  PlaneGeometry,
  Vector3,
} from "three";
import type { LessonId } from "@quest/contract";
import type { SceneLook } from "../../../mount/types";
import { FURNITURE, ROOM, type FloorRect } from "../../workshop/layout";
import type { WorkshopCard, WorkshopPlaceId } from "../../workshop/places";
import {
  baked,
  LAMPS,
  lightingOf,
  merged,
  mix,
  shade,
  type Lighting,
} from "./bake";
import { layoutCards, onSurface, SURFACES, type CardSlot } from "./cards";

type V3 = readonly [number, number, number];

/** The walls' height, tall enough to fill the view over the room, and how far the planked floor runs out past the room's open front. */
const WALL_HEIGHT = 5.6;
const FLOOR_FRONT = 10;
/** A plank's width and a board's length, and how long a stretch of board is lit as one. */
const PLANK = 0.33;
const BOARD = 3.2;
const LIT_STEP = 0.8;
/** The plank rows' tones, in turn, as shares of the floor's colour. */
const PLANK_TONES = [1, 0.955, 1.025, 0.94];

/** A large face is cut into pieces about this long, so the lamps' glow falls across it. */
const GLOW_STEP = 0.6;
const cuts = (length: number) => Math.max(1, Math.ceil(length / GLOW_STEP));

/** What the room is drawn with: its look's colours, mixed into the shades the room uses, and its light. */
interface Paint {
  light: Lighting;
  floor: Color;
  wall: Color;
  panel: Color;
  wood: Color;
  frame: Color;
  cork: Color;
  fabric: Color;
  teal: Color;
  leaf: Color;
  pot: Color;
  metal: Color;
  window: Color;
  glow: Color;
  look: SceneLook["workshop"];
}

function paintOf(look: SceneLook): Paint {
  const w = look.workshop;
  return {
    light: lightingOf(look),
    floor: new Color(w.floor),
    wall: new Color(w.wall),
    panel: mix(w.wall, w.wood, 0.35),
    wood: new Color(w.wood),
    frame: shade(w.wood, 0.62),
    cork: mix(w.wood, w.wall, 0.3),
    fabric: new Color(w.fabric),
    teal: new Color(w.teal),
    leaf: new Color(w.leaf),
    pot: mix(w.fabric, w.wood, 0.45),
    metal: mix(w.ink, w.paper, 0.55),
    window: new Color(w.window),
    glow: new Color(w.glow),
    look: w,
  };
}

function placed(g: BufferGeometry, p: V3, r?: V3): BufferGeometry {
  if (r !== undefined)
    g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...r)));
  g.translate(...p);
  return g;
}

/** A box `s` wide, tall and deep at `p`, turned by `r`; a large one cut for the lamps' glow. */
function box(
  paint: Paint,
  colour: Color,
  p: V3,
  s: V3,
  r?: V3,
  lit = true,
): BufferGeometry {
  const [x, y, z] = s;
  return baked(
    placed(new BoxGeometry(x, y, z, cuts(x), cuts(y), cuts(z)), p, r),
    paint.light,
    colour,
    lit,
  );
}

/** A cylinder, or a cone, standing at `p` with `sides` facets. */
function cylinder(
  paint: Paint,
  colour: Color,
  p: V3,
  top: number,
  bottom: number,
  height: number,
  sides = 7,
  r?: V3,
): BufferGeometry {
  return baked(
    placed(new CylinderGeometry(top, bottom, height, sides), p, r),
    paint.light,
    colour,
  );
}

/** A low-poly ball at `p`, squashed by `scale`. */
function ball(
  paint: Paint,
  colour: Color,
  p: V3,
  radius: number,
  detail = 0,
  lit = true,
  scale: V3 = [1, 1, 1],
): BufferGeometry {
  const g = new IcosahedronGeometry(radius, detail);
  g.scale(...scale);
  return baked(placed(g, p), paint.light, colour, lit);
}

/** A flat piece of floor covering `rect` at `y`, cut for the lamps' glow. */
function floorPiece(
  paint: Paint,
  colour: Color,
  rect: FloorRect,
  y: number,
): BufferGeometry {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const g = new PlaneGeometry(w, d, cuts(w), cuts(d));
  g.rotateX(-Math.PI / 2);
  g.translate((rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2);
  return baked(g, paint.light, colour);
}

/** The planked floor: rows of boards in turning tones, their joints staggered, over the darker seams between them. */
function floorGeometry(paint: Paint): BufferGeometry[] {
  const x0 = ROOM.x0 - 0.3;
  const x1 = ROOM.x1 + 0.3;
  const z0 = ROOM.z0 - 0.3;
  const parts = [
    floorPiece(
      paint,
      shade(paint.floor, 0.8),
      { x0, z0, x1, z1: FLOOR_FRONT },
      -0.004,
    ),
  ];
  const gap = 0.008;
  for (let row = 0, z = z0; z < FLOOR_FRONT; row++, z += PLANK) {
    const tone = shade(paint.floor, PLANK_TONES[row % PLANK_TONES.length] ?? 1);
    // Each row's joints fall at their own place along it.
    let start = x0 - ((row * 1.37) % BOARD);
    for (; start < x1; start += BOARD) {
      const a = Math.max(x0, start);
      const b = Math.min(x1, start + BOARD);
      if (b - a < gap * 4) continue;
      const length = b - a - 2 * gap;
      const g = new PlaneGeometry(
        length,
        PLANK - 2 * gap,
        Math.max(1, Math.ceil(length / LIT_STEP)),
        1,
      );
      g.rotateX(-Math.PI / 2);
      g.translate((a + b) / 2, 0, z + PLANK / 2);
      parts.push(baked(g, paint.light, tone));
    }
  }
  return parts;
}

/** The walls, their panelling, the two windows on the back wall and the open entrance on the right, with the day or evening outside it. */
function wallsGeometry(paint: Paint): BufferGeometry[] {
  const h = WALL_HEIGHT;
  const { wall, panel, frame, wood, window } = paint;
  const door = { z0: 2.6, z1: 4.9, top: 2.85 };
  const parts = [
    box(paint, wall, [0, h / 2, -5.15], [14.6, h, 0.3]),
    box(paint, panel, [0, 0.55, -4.98], [14.2, 1.1, 0.06]),
    box(paint, wall, [-7.15, h / 2, -0.2], [0.3, h, 10.2]),
    box(paint, panel, [-6.98, 0.55, -0.2], [0.06, 1.1, 9.6]),
    box(
      paint,
      wall,
      [7.15, h / 2, (-5.3 + door.z0) / 2],
      [0.3, h, door.z0 + 5.3],
    ),
    box(
      paint,
      panel,
      [6.98, 0.55, (-5 + door.z0) / 2],
      [0.06, 1.1, door.z0 + 5 - 0.1],
    ),
    box(
      paint,
      wall,
      [7.15, (door.top + h) / 2, (door.z0 + door.z1) / 2],
      [0.3, h - door.top, door.z1 - door.z0],
    ),
    // The day, or the evening, past the open door.
    box(
      paint,
      window,
      [7.4, door.top / 2, (door.z0 + door.z1) / 2],
      [0.02, door.top, door.z1 - door.z0],
      undefined,
      false,
    ),
    // The door's frame.
    box(
      paint,
      frame,
      [6.98, door.top / 2, door.z0 + 0.06],
      [0.14, door.top, 0.12],
    ),
    box(paint, frame, [6.98, door.top / 2, 4.42], [0.14, door.top, 0.12]),
    box(paint, frame, [6.98, door.top + 0.05, 3.51], [0.14, 0.12, 1.94]),
  ];
  for (const x of [-0.6, 5.6]) {
    parts.push(
      box(paint, frame, [x, 2.45, -4.97], [1.9, 1.5, 0.05]),
      box(paint, window, [x, 2.45, -4.935], [1.7, 1.3, 0.02], undefined, false),
      box(paint, frame, [x, 2.45, -4.915], [0.06, 1.3, 0.02]),
      box(paint, frame, [x, 2.45, -4.915], [1.7, 0.06, 0.02]),
      box(paint, wood, [x, 1.68, -4.92], [2.05, 0.06, 0.18]),
    );
  }
  // A clock over the entrance.
  parts.push(
    cylinder(
      paint,
      mix(paint.look.paper, wood, 0.08),
      [6.97, 3.25, 1.5],
      0.34,
      0.34,
      0.06,
      14,
      [0, 0, Math.PI / 2],
    ),
    box(paint, paint.metal, [6.93, 3.33, 1.5], [0.02, 0.18, 0.03]),
    box(paint, paint.metal, [6.93, 3.25, 1.57], [0.02, 0.03, 0.15]),
  );
  return parts;
}

/**
 * A hanging lamp, on its own so the camera can leave out one it comes too
 * close to: its cord up past the walls' top, its shade, and its bulb, which
 * glows itself.
 */
export function lampGeometry(look: SceneLook, lamp: number): BufferGeometry {
  const paint = paintOf(look);
  const [x = 0, y = 0, z = 0] = LAMPS[lamp] ?? [];
  const cord = WALL_HEIGHT - y;
  return merged([
    cylinder(paint, paint.metal, [x, y + cord / 2, z], 0.012, 0.012, cord, 5),
    cylinder(paint, paint.teal, [x, y + 0.12, z], 0.1, 0.34, 0.26, 8),
    ball(paint, paint.glow, [x, y - 0.04, z], 0.1, 1, false),
  ]);
}

/** A plant in a pot, `s` its size. */
function plant(paint: Paint, [x, , z]: V3, s: number): BufferGeometry[] {
  return [
    cylinder(paint, paint.pot, [x, 0.22 * s, z], 0.24 * s, 0.18 * s, 0.44 * s),
    ball(paint, paint.leaf, [x, 0.72 * s, z], 0.42 * s),
    ball(
      paint,
      mix(paint.leaf, paint.look.paper, 0.18),
      [x + 0.18 * s, 1.0 * s, z + 0.05 * s],
      0.26 * s,
    ),
  ];
}

/** Everything in the room but the Levels' places: one geometry, never changed while the look holds. */
export function roomGeometry(look: SceneLook): BufferGeometry {
  const paint = paintOf(look);
  const { wood, frame, fabric, teal, leaf, metal } = paint;
  const paper = new Color(look.workshop.paper);
  const accent = new Color(look.workshop.next);
  const parts: BufferGeometry[] = [
    ...floorGeometry(paint),
    ...wallsGeometry(paint),
    // The rug under the workbench.
    floorPiece(paint, fabric, { x0: -2.3, z0: -1.5, x1: 2.3, z1: 1.5 }, 0.006),
    floorPiece(
      paint,
      mix(fabric, paint.glow, 0.55),
      { x0: -2.1, z0: -1.3, x1: 2.1, z1: 1.3 },
      0.009,
    ),
    // The workbench: a lamp under repair, a toaster and a radio waiting, tools.
    box(paint, wood, [0, 0.86, 0], [3.0, 0.12, 1.5]),
    ...[
      [-1.35, -0.62],
      [1.35, -0.62],
      [-1.35, 0.62],
      [1.35, 0.62],
    ].map(([x = 0, z = 0]) =>
      box(paint, frame, [x, 0.4, z], [0.12, 0.8, 0.12]),
    ),
    box(paint, shade(wood, 0.82), [0, 0.25, 0], [2.8, 0.06, 1.3]),
    cylinder(paint, teal, [-0.35, 0.98, 0.05], 0.16, 0.2, 0.12),
    cylinder(paint, metal, [-0.35, 1.28, 0.05], 0.02, 0.02, 0.5),
    cylinder(
      paint,
      mix(accent, paint.glow, 0.5),
      [0, 0.98, 0.25],
      0.12,
      0.28,
      0.18,
      7,
      [0.4, 0, 1.2],
    ),
    box(paint, fabric, [0.75, 1.07, -0.2], [0.5, 0.3, 0.3]),
    box(paint, shade(metal, 0.4), [0.75, 1.225, -0.2], [0.36, 0.02, 0.06]),
    box(paint, shade(leaf, 0.85), [-0.95, 1.08, -0.35], [0.55, 0.32, 0.22]),
    cylinder(paint, paper, [-0.95, 1.08, -0.23], 0.08, 0.08, 0.02, 7, [
      Math.PI / 2,
      0,
      0,
    ]),
    box(paint, metal, [0.25, 0.935, 0.5], [0.4, 0.03, 0.06], [0, 0.4, 0]),
    box(paint, accent, [0.55, 0.935, 0.45], [0.3, 0.03, 0.05], [0, -0.3, 0]),
    // The open shelf on the back wall, with what the group has mended on it.
    box(paint, shade(wood, 0.78), [2.7, 0.9, -4.94], [3.0, 1.8, 0.06]),
    ...[1.25, 4.15].map((x) =>
      box(paint, wood, [x, 0.9, -4.72], [0.1, 1.8, 0.5]),
    ),
    box(paint, shade(wood, 0.85), [2.7, 0.05, -4.72], [2.8, 0.1, 0.5]),
    ...[0.55, 1.15, 1.75].map((y) =>
      box(paint, mix(wood, paper, 0.25), [2.7, y, -4.67], [2.8, 0.05, 0.45]),
    ),
    cylinder(paint, teal, [1.7, 0.75, -4.67], 0.12, 0.18, 0.35),
    box(paint, fabric, [2.2, 1.3, -4.67], [0.4, 0.25, 0.25]),
    cylinder(
      paint,
      mix(accent, paint.glow, 0.5),
      [3.75, 1.32, -4.67],
      0.14,
      0.14,
      0.3,
    ),
    // The solder station in the far corner.
    box(paint, wood, [-6.3, 0.85, -3.5], [1.0, 0.1, 2.0]),
    box(paint, shade(wood, 0.75), [-6.3, 0.42, -3.5], [0.9, 0.8, 1.9]),
    cylinder(paint, shade(metal, 0.5), [-6.2, 1.05, -3.9], 0.06, 0.12, 0.3),
    // The armchair for dozing.
    box(paint, fabric, [-6.25, 0.3, -1.05], [1.0, 0.6, 1.2]),
    box(paint, shade(fabric, 0.9), [-6.63, 0.8, -1.05], [0.25, 1.0, 1.2]),
    box(paint, shade(fabric, 0.9), [-6.2, 0.7, -1.57], [0.9, 0.35, 0.2]),
    box(paint, shade(fabric, 0.9), [-6.2, 0.7, -0.53], [0.9, 0.35, 0.2]),
    // The tea table.
    cylinder(
      paint,
      mix(wood, paper, 0.55),
      [-5.6, 0.72, 2.15],
      0.65,
      0.65,
      0.07,
      12,
    ),
    cylinder(paint, frame, [-5.6, 0.36, 2.15], 0.07, 0.12, 0.72),
    cylinder(paint, paper, [-5.8, 0.86, 2.25], 0.1, 0.09, 0.2),
    cylinder(paint, teal, [-5.38, 0.84, 2.0], 0.07, 0.06, 0.14),
    cylinder(paint, accent, [-5.42, 0.82, 2.4], 0.07, 0.06, 0.12),
    ...plant(paint, [-6.5, 0, 4.0], 1.1),
    ...plant(paint, [6.4, 0, -4.4], 0.9),
    ...plant(paint, [-4.8, 0, -4.5], 0.8),
  ];
  return merged(parts);
}

/** A place's own furniture, without its cards: the noticeboard's frame and cork, the organizer's cabinet and kit box, the release desk. */
export function placeGeometry(
  look: SceneLook,
  place: WorkshopPlaceId,
): BufferGeometry {
  const paint = paintOf(look);
  const { wood, frame, cork, teal } = paint;
  const paper = new Color(look.workshop.paper);
  switch (place) {
    case "noticeboard":
      return merged([
        box(paint, frame, [-3.4, 1.95, -4.97], [2.8, 1.85, 0.08]),
        box(paint, cork, [-3.4, 1.95, -4.93], [2.62, 1.67, 0.04]),
      ]);
    case "organizer":
      return merged([
        box(paint, teal, [6.65, 0.8, -2.2], [0.7, 1.6, 2.1]),
        box(paint, shade(teal, 0.8), [6.65, 0.04, -2.2], [0.74, 0.08, 2.14]),
        // The reusable kit, packed in its box on top.
        box(
          paint,
          mix(teal, paper, 0.4),
          [6.65, 1.79, -2.0],
          [0.55, 0.38, 0.7],
        ),
        box(paint, paper, [6.37, 1.8, -2.0], [0.01, 0.2, 0.4]),
      ]);
    case "release-desk":
      return merged([
        box(paint, wood, [4.5, 0.78, 1.82], [1.8, 0.1, 0.85]),
        box(paint, frame, [3.72, 0.38, 1.82], [0.1, 0.76, 0.75]),
        box(paint, frame, [5.28, 0.38, 1.82], [0.1, 0.76, 0.75]),
        box(paint, frame, [4.5, 0.5, 1.5], [1.46, 0.5, 0.04]),
      ]);
  }
}

/** Where a tag or a line points at a place: just above its furniture. */
export const PLACE_ANCHORS: Readonly<Record<WorkshopPlaceId, V3>> = {
  noticeboard: [-3.4, 3.1, -4.85],
  organizer: [6.3, 2.2, -2.2],
  "release-desk": [4.5, 1.25, 1.85],
};

/** How a card shows: complete (pinned), optional, and whether it is its place's next. */
export interface CardLook {
  lesson: LessonId;
  complete: boolean;
  optional: boolean;
  next: boolean;
}

/** The cards of a place's Lessons from the place, in its order. */
export function cardLooks(
  cards: readonly WorkshopCard[],
  next: LessonId | null,
): CardLook[] {
  return cards.map((c) => ({ ...c, next: c.lesson === next }));
}

/**
 * A place's cards, in its order, as one geometry: a paper card per Lesson
 * with lines written on it, taped up until it is complete, then pinned and
 * coloured as done; an optional Lesson's card in its own colour; the next
 * card edged in the mark's colour. On the kit organizer each card is the
 * label on its own drawer.
 */
export function cardsGeometry(
  look: SceneLook,
  place: WorkshopPlaceId,
  cards: readonly CardLook[],
): BufferGeometry {
  const paint = paintOf(look);
  const w = look.workshop;
  const surface = SURFACES[place];
  const slots = layoutCards(cards.length, surface);
  const basis = new Matrix4().makeBasis(
    new Vector3(...surface.right),
    new Vector3(...surface.up),
    new Vector3(...surface.out),
  );
  const parts: BufferGeometry[] = [];
  // Paper keeps some of its own colour, so a card reads in the evening too.
  const onPaper = (g: BufferGeometry, colour: string | Color) =>
    baked(g, paint.light, colour, true, PAPER_OWN);
  cards.forEach((card, i) => {
    const slot = slots[i];
    if (slot === undefined) return;
    const drawer = place === "organizer" ? 0.05 : 0;
    const at = (g: BufferGeometry, x: number, y: number, lift: number) =>
      onCard(g, surface, basis, slot, x, y, lift + drawer);
    const paper = card.complete ? w.done : card.optional ? w.optional : w.paper;
    const { width: cw, height: ch } = slot;
    if (drawer > 0)
      parts.push(
        baked(
          onCard(
            new BoxGeometry(cw * 1.2, ch * 1.2, drawer),
            surface,
            basis,
            slot,
            0,
            0,
            drawer / 2,
          ),
          paint.light,
          mix(paint.teal, w.paper, 0.22),
        ),
      );
    if (card.next) {
      const edge = Math.min(cw, ch) * 0.12;
      parts.push(
        onPaper(
          at(new PlaneGeometry(cw + edge, ch + edge), 0, 0, 0.004),
          w.next,
        ),
      );
    }
    parts.push(onPaper(at(new PlaneGeometry(cw, ch), 0, 0, 0.008), paper));
    // The lines written on it: a heading, then the text.
    const ink = mix(paper, w.ink, 0.5);
    parts.push(
      onPaper(
        at(
          new PlaneGeometry(cw * 0.56, ch * 0.075),
          -cw * 0.1,
          ch * 0.24,
          0.011,
        ),
        mix(paper, w.ink, 0.7),
      ),
      ...[0.06, -0.08, -0.22].map((y, k) =>
        onPaper(
          at(
            new PlaneGeometry(cw * (k === 2 ? 0.46 : 0.72), ch * 0.04),
            k === 2 ? -cw * 0.13 : 0,
            ch * y,
            0.011,
          ),
          ink,
        ),
      ),
    );
    if (card.complete) {
      // The pin, standing out of the card at its head.
      const pin = shade(w.done, 0.42);
      const head = Math.max(0.022, cw * 0.075);
      parts.push(
        baked(
          at(
            new CylinderGeometry(head * 0.3, head * 0.3, head * 1.6, 5).rotateX(
              Math.PI / 2,
            ),
            0,
            ch * 0.36,
            0.01 + head * 0.8,
          ),
          paint.light,
          pin,
        ),
        baked(
          at(new IcosahedronGeometry(head, 0), 0, ch * 0.36, 0.01 + head * 1.6),
          paint.light,
          pin,
        ),
      );
    } else if (place === "noticeboard") {
      // Taped up until it is done; the next one's tape in the mark's colour.
      const tape = card.next
        ? mix(w.next, w.paper, 0.35)
        : mix(w.paper, w.wood, 0.3);
      parts.push(
        onPaper(
          at(new PlaneGeometry(cw * 0.42, ch * 0.13), 0, ch * 0.5, 0.013),
          tape,
        ),
      );
    }
  });
  return parts.length === 0 ? new BufferGeometry() : merged(parts);
}

/** How much of its own colour paper keeps under the room's light. */
const PAPER_OWN = 0.4;

/** Lays a piece of a card, made about its own centre facing +z, at `x`, `y` on the card and `lift` out of its surface. */
function onCard(
  g: BufferGeometry,
  surface: (typeof SURFACES)[WorkshopPlaceId],
  basis: Matrix4,
  slot: CardSlot,
  x: number,
  y: number,
  lift: number,
): BufferGeometry {
  g.translate(x, y, 0);
  g.rotateZ(slot.lean);
  g.applyMatrix4(basis);
  g.translate(...onSurface(surface, slot.x, slot.y, lift));
  return g;
}

/** The soft shadows the furniture lays on the floor: one geometry, its opacity in its colours. */
export function shadowsGeometry(look: SceneLook): BufferGeometry {
  const colour = new Color(look.shadow);
  const positions: number[] = [];
  const colours: number[] = [];
  // Cast a little away from the windows' side, as the key light falls.
  const away = { x: 0.14, z: -0.1 };
  const corner = (x: number, z: number, alpha: number) => {
    positions.push(x + away.x, SHADOW_Y, z + away.z);
    colours.push(colour.r, colour.g, colour.b, alpha);
  };
  const quad = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
  ) => {
    // Wound to face up: a, b, c and a, c, d, from the -z side round.
    for (const [x, z, alpha] of [a, c, b, a, d, c]) corner(x, z, alpha);
  };
  for (const { rect, soft, strength } of SHADOWS) {
    const { x0, z0, x1, z1 } = rect;
    const core = SHADOW_ALPHA * strength;
    const inner = [
      [x0, z0, core],
      [x1, z0, core],
      [x1, z1, core],
      [x0, z1, core],
    ] as const;
    const outer = [
      [x0 - soft, z0 - soft, 0],
      [x1 + soft, z0 - soft, 0],
      [x1 + soft, z1 + soft, 0],
      [x0 - soft, z1 + soft, 0],
    ] as const;
    quad(inner[0], inner[1], inner[2], inner[3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(
        outer[i] ?? outer[0],
        outer[j] ?? outer[0],
        inner[j] ?? inner[0],
        inner[i] ?? inner[0],
      );
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colours, 4));
  return g;
}

/** The shadows lie just over the rug. */
const SHADOW_Y = 0.012;
/** The darkest a shadow lies, under the middle of what casts it. */
const SHADOW_ALPHA = 0.3;

/** A piece of furniture's footprint from the floor plan, `by` inside its edge. */
function footprint(name: string, by: number): FloorRect {
  const r = FURNITURE[name];
  if (r === undefined) throw new Error(`the floor plan has no ${name}`);
  return { x0: r.x0 + by, z0: r.z0 + by, x1: r.x1 - by, z1: r.z1 - by };
}

const around = (x: number, z: number, r: number): FloorRect => ({
  x0: x - r,
  z0: z - r,
  x1: x + r,
  z1: z + r,
});

/** What lays a shadow, where, how soft its edge and how dark. */
const SHADOWS: readonly { rect: FloorRect; soft: number; strength: number }[] =
  [
    { rect: footprint("bench", 0.1), soft: 0.4, strength: 0.8 },
    { rect: footprint("desk", 0.05), soft: 0.3, strength: 0.8 },
    { rect: footprint("shelf", 0), soft: 0.35, strength: 1 },
    { rect: footprint("solder", 0.05), soft: 0.35, strength: 1 },
    { rect: footprint("armchair", 0.05), soft: 0.3, strength: 1 },
    { rect: around(-5.6, 2.15, 0.45), soft: 0.35, strength: 0.7 },
    { rect: footprint("organizer", 0.02), soft: 0.35, strength: 1 },
    { rect: around(-6.5, 4.0, 0.18), soft: 0.22, strength: 0.9 },
    { rect: around(6.4, -4.4, 0.14), soft: 0.2, strength: 0.9 },
    { rect: around(-4.8, -4.5, 0.12), soft: 0.18, strength: 0.9 },
  ];
