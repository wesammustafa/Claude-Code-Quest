// A 3D Badge's meshes, made in code from its SVG art (09 9.3, ticket 53):
// nothing is modelled by hand. An earned Badge is its Level's shape as a
// solid with a bevelled edge, its outline, a capstone's inner ring and its
// symbol raised on both faces; an unearned one is the outlines alone, its
// shape and ring dashed as the SVG dashes them, never a lock. The art is
// badge-art.ts's model, parsed by Three.js's SVG loader, so every curve,
// arc and rounded corner is the SVG's own.
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  Vector2,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  BADGE_CENTRE,
  BADGE_GRID,
  markupOf,
  type ArtElement,
  type BadgeModel,
} from "../../badge-art";

/** The solid's thickness and its bevel, in Badge widths (the 64 grid is one). */
export const BODY_DEPTH = 0.07;
const BEVEL = 0.016;
/** How far the raised art stands off a face, so it never fights the face for depth. */
const RAISE = 0.004;
/** Points along each curve of the art: enough that a 25-unit circle reads round at its largest. */
const CURVE_POINTS = 48;
/** Arc divisions of a stroke's round caps and joins. */
const JOIN_POINTS = 6;
/** Points of a run closer than this, in Badge widths, are one. */
const MERGE = 0.00001;

/** A run a stroke can follow: two points at least, apart. */
const drawable = (run: readonly Vector2[]) =>
  run.some((p) => run[0] !== undefined && p.distanceTo(run[0]) > MERGE);

/** The meshes' geometry for one Badge, in Badge widths, centred, facing +z. */
export interface BadgeGeometry {
  /** The solid (earned only), its front face at `face` and its back at `-face`. */
  body: BufferGeometry | null;
  /** The outline, the ring and the symbol, as strokes on the plane z = 0. */
  art: BufferGeometry;
  /** Where the solid's faces stand, so the art is raised onto both. */
  face: number;
}

/** A point of the 64 grid in Badge widths: centred, y up. */
const toBadge = (x: number, y: number) =>
  new Vector2((x - BADGE_CENTRE) / BADGE_GRID, (BADGE_CENTRE - y) / BADGE_GRID);

/** Each closed or open run of points one SVG element draws, on its own grid. */
export function pointsOf(element: ArtElement): Vector2[][] {
  const { paths } = new SVGLoader().parse(markupOf(element));
  return paths.flatMap((path) =>
    path.subPaths.map((sub) => sub.getPoints(CURVE_POINTS)),
  );
}

/** A run of points cut into dashes of `on`, with gaps of `off`, along its length. */
export function dashed(
  points: readonly Vector2[],
  [on, off]: readonly [number, number],
): Vector2[][] {
  if (on <= 0 || off <= 0) return [[...points]];
  const out: Vector2[][] = [];
  let dash: Vector2[] = [];
  let drawing = true;
  let left = on;
  const first = points[0];
  if (first === undefined) return out;
  dash.push(first.clone());
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (from === undefined || to === undefined) continue;
    let at = from.clone();
    let rest = at.distanceTo(to);
    while (rest > 0) {
      const step = Math.min(rest, left);
      at = at.clone().lerp(to, step / rest);
      rest -= step;
      left -= step;
      if (drawing) dash.push(at.clone());
      if (left <= 0) {
        if (drawing && dash.length > 1) out.push(dash);
        drawing = !drawing;
        left = drawing ? on : off;
        dash = drawing ? [at.clone()] : [];
      }
    }
  }
  if (drawing && dash.length > 1) out.push(dash);
  return out;
}

/** Points on the 64 grid moved as the SVG's transform moves them: a scale about the centre, then an offset. */
function placed(
  points: readonly Vector2[],
  { scale = 1, at = 0 }: { scale?: number; at?: number },
): Vector2[] {
  return points.map((p) =>
    toBadge(
      BADGE_CENTRE + (p.x - BADGE_CENTRE) * scale + at,
      BADGE_CENTRE + (p.y - BADGE_CENTRE) * scale + at,
    ),
  );
}

/** One stroke of a part: its runs of points and its width, both in Badge widths. */
export interface Stroke {
  runs: Vector2[][];
  width: number;
}

/** The strokes the SVG draws for a Badge, earned or not, in Badge widths. */
export function strokesOf(model: BadgeModel, earned: boolean): Stroke[] {
  const dash = (runs: Vector2[][]) =>
    earned ? runs : runs.flatMap((run) => dashed(run, model.dash));
  const outline = model.outline.flatMap(pointsOf);
  const strokes: Stroke[] = [
    {
      runs: dash(outline).map((run) => placed(run, {})),
      width: model.outlineStroke / BADGE_GRID,
    },
  ];
  if (model.ring !== null)
    strokes.push({
      runs: dash(outline).map((run) => placed(run, { scale: model.ring ?? 1 })),
      // The SVG's ring scales its inherited stroke with its transform.
      width: (model.outlineStroke * model.ring) / BADGE_GRID,
    });
  strokes.push({
    runs: model.symbol
      .flatMap(pointsOf)
      .map((run) => placed(run, { at: model.symbolAt })),
    width: model.symbolStroke / BADGE_GRID,
  });
  return strokes;
}

/** Every stroke as flat triangles on z = 0, in one geometry, run after run. */
export function strokeGeometry(strokes: readonly Stroke[]): BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const { runs, width } of strokes) {
    const style = SVGLoader.getStrokeStyle(width, "", "round", "round");
    // Each run is stroked into buffers of its own, then appended: Three.js
    // 0.187's stroker writes a closed run's last join over the buffers'
    // first vertices whatever offset it is given, which would stretch the
    // first run's first triangle to every later closed run.
    for (const run of runs.filter(drawable)) {
      const v: number[] = [];
      const n: number[] = [];
      const u: number[] = [];
      SVGLoader.pointsToStrokeWithBuffers(
        run,
        style,
        JOIN_POINTS,
        MERGE,
        v,
        n,
        u,
      );
      for (const x of v) vertices.push(x);
      for (const x of n) normals.push(x);
      for (const x of u) uvs.push(x);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** The Level's shape as a solid: the outline extruded, its bevel inside the outline. */
function bodyGeometry(model: BadgeModel): ExtrudeGeometry {
  const outline = model.outline.flatMap(pointsOf).map((run) => placed(run, {}));
  const shapes = outline.map((run) => new Shape(run));
  const body = new ExtrudeGeometry(shapes, {
    depth: BODY_DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 3,
    curveSegments: CURVE_POINTS,
  });
  body.translate(0, 0, -BODY_DEPTH / 2);
  return body;
}

/** A Badge's geometry: the solid and its raised art when earned, the outlines alone when not. */
export function badgeGeometry(
  model: BadgeModel,
  earned: boolean,
): BadgeGeometry {
  return {
    body: earned ? bodyGeometry(model) : null,
    art: strokeGeometry(strokesOf(model, earned)),
    face: earned ? BODY_DEPTH / 2 + BEVEL + RAISE : 0,
  };
}
