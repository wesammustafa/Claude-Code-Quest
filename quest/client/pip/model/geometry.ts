// The 3D Pip's solids (seam S13): flat-faced, low-poly blocks built the way
// turn.ts builds the head (an octagon of walls with chamfered vertical
// edges and bevelled top and bottom edges), extruded outlines for the face's
// features, and flat discs that fade into the face. Every face keeps its
// own vertices, so each carries its own baked colour and reads as a crisp
// facet; each is wound counter-clockwise seen from outside.
import { mix, type Rgb, type Vec3 } from "./palette.ts";

export type Vec2 = readonly [number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const scale = (a: Vec3, k: number): Vec3 => [
  a[0] * k,
  a[1] * k,
  a[2] * k,
];
export const dot = (a: Vec3, b: Vec3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n < 1e-12 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
};

/** A rigid map of points: a rotation (row-major 3 by 3) then a move. */
export interface Place {
  m: readonly number[];
  t: Vec3;
}
export const IDENTITY: Place = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

export const rotate = (m: readonly number[], v: Vec3): Vec3 => [
  (m[0] ?? 0) * v[0] + (m[1] ?? 0) * v[1] + (m[2] ?? 0) * v[2],
  (m[3] ?? 0) * v[0] + (m[4] ?? 0) * v[1] + (m[5] ?? 0) * v[2],
  (m[6] ?? 0) * v[0] + (m[7] ?? 0) * v[1] + (m[8] ?? 0) * v[2],
];
export const apply = (p: Place, v: Vec3): Vec3 => add(rotate(p.m, v), p.t);

/** Two rotations, row-major: `a` after `b`. */
export const multiply = (
  a: readonly number[],
  b: readonly number[],
): number[] => {
  const out: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++)
        s += (a[r * 3 + k] ?? 0) * (b[k * 3 + c] ?? 0);
      out.push(s);
    }
  return out;
};
export const turnZ = (a: number): readonly number[] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
export const turnX = (a: number): readonly number[] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
export const at = (t: Vec3, m: readonly number[] = IDENTITY.m): Place => ({
  m,
  t,
});
/** Mirrors x: Pip's right side from his left. */
export const MIRROR_X: Place = {
  m: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
  t: [0, 0, 0],
};
/** A solid built along y, laid along x: canonical +y becomes +x. */
export const ALONG_X: readonly number[] = turnZ(-Math.PI / 2);
/** A solid built along y, laid flat along z (a slab facing the viewer): canonical +y becomes +z. */
export const ALONG_Z: readonly number[] = turnX(Math.PI / 2);

/** What a face of a solid is, for painting it. */
export type FaceKind =
  | "wall"
  | "top bevel"
  | "bottom bevel"
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "side";

/** One flat face, as built (canonical frame), before it is placed. */
export interface Face {
  kind: FaceKind;
  points: Vec3[];
  /** A wall band's span along the solid's axis. */
  span?: readonly [number, number];
}

/** A face as painted: its kind and span, the vertex as built, and the face's normal in Pip's frame at rest. */
export interface Painting {
  kind: FaceKind;
  span: readonly [number, number] | undefined;
  /** The vertex in the solid's own (canonical) frame. */
  local: Vec3;
  /** The face's outward normal in Pip's frame at rest. */
  normal: Vec3;
}
export type Paint = (p: Painting) => Rgb;

/** One mesh's vertices, colours and triangles, in its node's frame and rig units. */
export class MeshBuilder {
  readonly positions: Vec3[] = [];
  readonly colours: Rgb[] = [];
  readonly indices: number[] = [];
  /** Each vertex by its place and colour: with no normals (the material is unlit), two faces that meet in one colour share it. */
  private readonly known = new Map<string, number>();

  private vertex(p: Vec3, c: Rgb): number {
    const key = [...p, ...c].map((v) => v.toFixed(6)).join(",");
    const found = this.known.get(key);
    if (found !== undefined) return found;
    this.positions.push(p);
    this.colours.push(c);
    this.known.set(key, this.positions.length - 1);
    return this.positions.length - 1;
  }

  /** A flat polygon, fanned from its first corner; it turns to face `outward`. */
  polygon(
    points: readonly Vec3[],
    colours: readonly Rgb[],
    outward: Vec3,
  ): void {
    const n = newell(points);
    const flip = dot(n, outward) < 0;
    const order = points.map((_, i) => (flip ? points.length - 1 - i : i));
    const at = order.map((i) =>
      this.vertex(points[i] ?? [0, 0, 0], colours[i] ?? [0, 0, 0]),
    );
    for (let i = 1; i + 1 < at.length; i++)
      this.indices.push(at[0] ?? 0, at[i] ?? 0, at[i + 1] ?? 0);
  }

  get triangles(): number {
    return this.indices.length / 3;
  }
}

/** A polygon's normal (Newell's method), unnormalised. */
export function newell(points: readonly Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i] ?? [0, 0, 0];
    const b = points[(i + 1) % points.length] ?? a;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}

const centroid = (points: readonly Vec3[]): Vec3 => {
  let c: Vec3 = [0, 0, 0];
  for (const p of points) c = add(c, p);
  return scale(c, 1 / Math.max(1, points.length));
};

/**
 * Adds a convex solid's faces to a mesh: each placed (`place`, into the
 * node's frame), turned outward from the solid's centre, and painted with
 * its normal in Pip's frame (`toModel`, the node's rest rotation in Pip).
 */
export function addSolid(
  mesh: MeshBuilder,
  faces: readonly Face[],
  o: { place?: Place; toModel?: readonly number[]; paint: Paint },
): void {
  const place = o.place ?? IDENTITY;
  const toModel = o.toModel ?? IDENTITY.m;
  const all = faces.flatMap((f) => f.points);
  const centre = apply(place, centroid(all));
  for (const face of faces) {
    const placed = face.points.map((p) => apply(place, p));
    const outward = sub(centroid(placed), centre);
    let n = unit(newell(placed));
    if (dot(n, outward) < 0) n = scale(n, -1);
    const normal = unit(rotate(toModel, n));
    const colours = face.points.map((local) =>
      o.paint({ kind: face.kind, span: face.span, local, normal }),
    );
    mesh.polygon(placed, colours, n);
  }
}

/** The octagon of a chamfered rectangle in a plane (turn.ts's `octagon`): zero-length edges dropped. */
export function octagon(hw: number, hd: number, c: number): Vec2[] {
  const corners: Vec2[] = [
    [-hw + c, hd],
    [hw - c, hd],
    [hw, hd - c],
    [hw, -hd + c],
    [hw - c, -hd],
    [-hw + c, -hd],
    [-hw, -hd + c],
    [-hw, hd - c],
  ];
  return corners.filter((p, i) => {
    const q = corners[(i + 1) % corners.length] ?? p;
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9;
  });
}

/** A convex polygon (round the origin) with each edge moved in by `by` (turn.ts's INSET). */
export function inset(ring: readonly Vec2[], by: number): Vec2[] {
  if (by === 0) return [...ring];
  const n = ring.length;
  const lines = ring.map((p, i) => {
    const q = ring[(i + 1) % n] ?? p;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let nx = (q[1] - p[1]) / len;
    let ny = -(q[0] - p[0]) / len;
    if (nx * (p[0] + q[0]) + ny * (p[1] + q[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    // The edge's line, moved in: nx x + ny y = k.
    return { nx, ny, k: nx * p[0] + ny * p[1] - by };
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n] ?? l;
    const det = m.nx * l.ny - m.ny * l.nx;
    return [(m.k * l.ny - l.k * m.ny) / det, (m.nx * l.k - l.nx * m.k) / det];
  });
}

/**
 * The bevelled octagonal prism, turn.ts's head construction: walls round
 * `octagon(hw, hd, c)` in x and z from y -(hh - b) to hh - b (split at
 * `rows`), 45 degree bevels up to the inset top and bottom at +-hh.
 */
export function bop(o: {
  hw: number;
  hd: number;
  c: number;
  hh: number;
  b: number;
  rows?: readonly number[];
}): Face[] {
  const ring = octagon(o.hw, o.hd, o.c);
  const top = inset(ring, o.b);
  const wall = o.hh - o.b;
  const ys = [
    -wall,
    ...(o.rows ?? [])
      .filter((y) => y > -wall + 1e-9 && y < wall - 1e-9)
      .sort((a, b) => a - b),
    wall,
  ];
  const p3 = (p: Vec2, y: number): Vec3 => [p[0], y, p[1]];
  const faces: Face[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length] ?? p;
    for (let k = 0; k + 1 < ys.length; k++) {
      const lo = ys[k] ?? 0;
      const hi = ys[k + 1] ?? 0;
      faces.push({
        kind: "wall",
        span: [lo, hi],
        points: [p3(p, lo), p3(q, lo), p3(q, hi), p3(p, hi)],
      });
    }
    if (o.b > 0) {
      const P = top[i] ?? p;
      const Q = top[(i + 1) % ring.length] ?? q;
      faces.push({
        kind: "top bevel",
        points: [p3(p, wall), p3(q, wall), p3(Q, o.hh), p3(P, o.hh)],
      });
      faces.push({
        kind: "bottom bevel",
        points: [p3(p, -wall), p3(q, -wall), p3(Q, -o.hh), p3(P, -o.hh)],
      });
    }
  });
  faces.push({ kind: "top", points: top.map((p) => p3(p, o.hh)) });
  faces.push({ kind: "bottom", points: top.map((p) => p3(p, -o.hh)) });
  return faces;
}

/**
 * A soft block: every edge rounded by `r` in two flat segments, walls round
 * a 12-sided outline in x and z from y -(hh - r) to hh - r (split at
 * `rows`), then two rings each way up to a flat top and bottom. Where a
 * corner's ring closes to a point its band face is a triangle.
 */
export function roundedBlock(o: {
  hw: number;
  hd: number;
  hh: number;
  r: number;
  rows?: readonly number[];
}): Face[] {
  const wall = o.hh - o.r;
  const ring = (inset: number): Vec2[] =>
    roundedRect(2 * (o.hw - inset), 2 * (o.hd - inset), o.r - inset, 2);
  const p3 = (p: Vec2, y: number): Vec3 => [p[0], y, p[1]];
  const ys = [
    -wall,
    ...(o.rows ?? [])
      .filter((y) => y > -wall + 1e-9 && y < wall - 1e-9)
      .sort((a, b) => a - b),
    wall,
  ];
  const side = ring(0);
  const half = ring(o.r * (1 - Math.SQRT1_2));
  const cap = ring(o.r);
  const out = o.r * Math.SQRT1_2;
  const faces: Face[] = [];
  const band = (
    kind: FaceKind,
    a: readonly Vec2[],
    ay: number,
    b: readonly Vec2[],
    by: number,
    span?: readonly [number, number],
  ) => {
    a.forEach((p, i) => {
      const j = (i + 1) % a.length;
      const q = a[j] ?? p;
      const P = b[i] ?? p;
      const Q = b[j] ?? q;
      const points = [p3(p, ay), p3(q, ay), p3(Q, by), p3(P, by)].filter(
        (v, k, all) => {
          const w = all[(k + 1) % all.length] ?? v;
          return Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]) > 1e-9;
        },
      );
      if (points.length >= 3)
        faces.push(
          span === undefined ? { kind, points } : { kind, span, points },
        );
    });
  };
  for (let k = 0; k + 1 < ys.length; k++) {
    const lo = ys[k] ?? 0;
    const hi = ys[k + 1] ?? 0;
    band("wall", side, lo, side, hi, [lo, hi]);
  }
  band("top bevel", side, wall, half, wall + out);
  band("top bevel", half, wall + out, cap, o.hh);
  band("bottom bevel", side, -wall, half, -wall - out);
  band("bottom bevel", half, -wall - out, cap, -o.hh);
  const flatCap = cap.filter((p, i) => {
    const q = cap[(i + 1) % cap.length] ?? p;
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9;
  });
  faces.push({ kind: "top", points: flatCap.map((p) => p3(p, o.hh)) });
  faces.push({ kind: "bottom", points: flatCap.map((p) => p3(p, -o.hh)) });
  return faces;
}

/** A rounded rectangle's outline (w by h, radius r, `arc` segments a corner), counter-clockwise from its right edge's bottom. */
export function roundedRect(w: number, h: number, r: number, arc = 4): Vec2[] {
  const hw = w / 2;
  const hh = h / 2;
  const out: Vec2[] = [];
  const corners: [number, number, number][] = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
    [hw - r, -hh + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, from] of corners)
    for (let i = 0; i <= arc; i++) {
      const a = from + (i / arc) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return out;
}

/** An ellipse's outline, counter-clockwise from +x. */
export function ellipse(
  rx: number,
  ry: number,
  segments: number,
  centre: Vec2 = [0, 0],
): Vec2[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * 2 * Math.PI;
    return [
      centre[0] + rx * Math.cos(a),
      centre[1] + ry * Math.sin(a),
    ] as const;
  });
}

/** Twice a closed outline's signed area: + when it runs counter-clockwise. */
const area2 = (outline: readonly Vec2[]) =>
  outline.reduce((s, p, i) => {
    const q = outline[(i + 1) % outline.length] ?? p;
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);

/**
 * An outline extruded along z from z0 to z1: the front cap (`caps`, flat
 * polygons that tile the outline) at z1, the same at z0 facing back, and a
 * side quad per outline edge. Each vertex is painted by `paint` with its
 * kind ("front", "back", "side").
 */
export function addPrism(
  mesh: MeshBuilder,
  o: {
    outline: readonly Vec2[];
    caps: readonly (readonly Vec2[])[];
    /** The back cap's tiles, when they differ from the front's. */
    backCaps?: readonly (readonly Vec2[])[];
    z0: number;
    z1: number;
    paint: (kind: FaceKind, p: Vec3) => Rgb;
    place?: Place;
  },
): void {
  const place = o.place ?? IDENTITY;
  const put = (p: Vec3) => apply(place, p);
  const face = (kind: FaceKind, points: Vec3[], outward: Vec3) => {
    mesh.polygon(
      points.map(put),
      points.map((p) => o.paint(kind, p)),
      rotate(place.m, outward),
    );
  };
  for (const cap of o.caps)
    face(
      "front",
      cap.map((p) => [p[0], p[1], o.z1] as const),
      [0, 0, 1],
    );
  for (const cap of o.backCaps ?? o.caps)
    face(
      "back",
      cap.map((p) => [p[0], p[1], o.z0] as const),
      [0, 0, -1],
    );
  const ccw = area2(o.outline) > 0;
  o.outline.forEach((p, i) => {
    const q = o.outline[(i + 1) % o.outline.length] ?? p;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    if (Math.hypot(dx, dy) < 1e-9) return;
    const outward: Vec3 = ccw ? [dy, -dx, 0] : [-dy, dx, 0];
    face(
      "side",
      [
        [p[0], p[1], o.z0],
        [q[0], q[1], o.z0],
        [q[0], q[1], o.z1],
        [p[0], p[1], o.z1],
      ],
      outward,
    );
  });
}

/** A convex outline's cap: the outline itself. */
export const convexCap = (outline: readonly Vec2[]): Vec2[][] => [[...outline]];

/**
 * A flat disc that fades into the face under it: rings of the same point
 * count, each vertex painted by `paint(ring, point)`, joined by quads, with
 * a fan in the middle; it faces +z at `z`.
 */
export function addFadeDisc(
  mesh: MeshBuilder,
  o: {
    rings: readonly (readonly Vec2[])[];
    centre: Vec2;
    z: number;
    paint: (ring: number, p: Vec2) => Rgb;
  },
): void {
  const first = o.rings[0] ?? [];
  const p3 = (p: Vec2): Vec3 => [p[0], p[1], o.z];
  const front: Vec3 = [0, 0, 1];
  first.forEach((p, i) => {
    const q = first[(i + 1) % first.length] ?? p;
    mesh.polygon(
      [p3(o.centre), p3(p), p3(q)],
      [o.paint(-1, o.centre), o.paint(0, p), o.paint(0, q)],
      front,
    );
  });
  for (let r = 0; r + 1 < o.rings.length; r++) {
    const inner = o.rings[r] ?? [];
    const outer = o.rings[r + 1] ?? [];
    inner.forEach((p, i) => {
      const q = inner[(i + 1) % inner.length] ?? p;
      const P = outer[i] ?? p;
      const Q = outer[(i + 1) % outer.length] ?? q;
      mesh.polygon(
        [p3(p), p3(P), p3(Q), p3(q)],
        [o.paint(r, p), o.paint(r + 1, P), o.paint(r + 1, Q), o.paint(r, q)],
        front,
      );
    });
  }
}

/** A cubic Bezier's point. */
export function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, s: number): Vec2 {
  const u = 1 - s;
  const a = u * u * u;
  const b = 3 * u * u * s;
  const c = 3 * u * s * s;
  const d = s * s * s;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * A stroked line with round caps, as an outline and its cap tiles: the
 * path's points offset by half the width either side (strip quads), and
 * a half disc of `capSegments` at each end.
 */
export function ribbon(
  path: readonly Vec2[],
  width: number,
  capSegments = 6,
): { outline: Vec2[]; caps: Vec2[][] } {
  const half = width / 2;
  const normals = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)] ?? p;
    const b = path[Math.min(path.length - 1, i + 1)] ?? p;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    return [-dy / n, dx / n] as const;
  });
  const left = path.map((p, i) => {
    const n = normals[i] ?? [0, 1];
    return [p[0] + n[0] * half, p[1] + n[1] * half] as const;
  });
  const right = path.map((p, i) => {
    const n = normals[i] ?? [0, 1];
    return [p[0] - n[0] * half, p[1] - n[1] * half] as const;
  });
  const capArc = (centre: Vec2, from: Vec2): Vec2[] => {
    const a0 = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
    return Array.from({ length: capSegments - 1 }, (_, k) => {
      const a = a0 + ((k + 1) / capSegments) * Math.PI;
      return [
        centre[0] + half * Math.cos(a),
        centre[1] + half * Math.sin(a),
      ] as const;
    });
  };
  const start = path[0] ?? [0, 0];
  const end = path[path.length - 1] ?? start;
  // Round the end from the left side to the right, and the start from the right to the left.
  const endCap = capArc(end, left[left.length - 1] ?? end);
  const startCap = capArc(start, right[0] ?? start);
  const fixArc = (arc: Vec2[], centre: Vec2, toward: Vec2): Vec2[] => {
    // The cap bulges away from the path: flip it if it bulges back along it.
    const mid = arc[Math.floor(arc.length / 2)] ?? centre;
    const out =
      (mid[0] - centre[0]) * (centre[0] - toward[0]) +
      (mid[1] - centre[1]) * (centre[1] - toward[1]);
    return out >= 0
      ? arc
      : arc
          .map((p) => [2 * centre[0] - p[0], 2 * centre[1] - p[1]] as const)
          .reverse();
  };
  const endArc = fixArc(endCap, end, path[path.length - 2] ?? start);
  const startArc = fixArc(startCap, start, path[1] ?? end);
  const outline: Vec2[] = [
    ...left,
    ...endArc,
    ...[...right].reverse(),
    ...startArc,
  ];
  const caps: Vec2[][] = [];
  for (let i = 0; i + 1 < path.length; i++)
    caps.push([
      left[i] ?? start,
      left[i + 1] ?? end,
      right[i + 1] ?? end,
      right[i] ?? start,
    ]);
  caps.push([
    end,
    left[left.length - 1] ?? end,
    ...endArc,
    right[right.length - 1] ?? end,
  ]);
  caps.push([start, right[0] ?? start, ...startArc, left[0] ?? start]);
  return { outline, caps };
}

/** Colours a whole solid one colour, lit by its normals. */
export const flat =
  (colour: Rgb, shadeBy: (c: Rgb, n: Vec3) => Rgb): Paint =>
  (p) =>
    shadeBy(colour, p.normal);

export { mix };
