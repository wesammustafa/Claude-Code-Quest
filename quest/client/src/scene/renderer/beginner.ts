// The Beginner landscape (09 9.2 Look, 9.3, ticket 52), built in code with
// no modelled asset: soft low-poly ground, a path that winds across it, six
// Stations along it (one per Lesson, the capstone last and larger) and
// trees and rocks away from the path. Its light is baked into each face's
// colour as a Lambert face lit by the look's hemisphere and key light would
// show it, so the renderer draws it with no light, no shadow map and exact
// colours, which keeps every frame inside the luminance the page's text
// needs over it (apps/web's scene-stills test).
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  Vector3,
} from "three";
import type { LandscapeLook, SceneLook } from "../../mount/types";

/** The path's bends across the ground, left to right as the camera looks (x, z). */
const BENDS: readonly (readonly [number, number])[] = [
  [-17, 2.5],
  [-12.5, -1],
  [-7.5, 1],
  [-2.5, -2.2],
  [2.5, -0.4],
  [7.5, -2.6],
  [12.5, -0.6],
  [17, -3],
];

/** Where the six Stations sit along the path, as shares of its length. */
const STATION_SHARES = [0.09, 0.254, 0.418, 0.582, 0.746, 0.91] as const;

/** The number of Stations on a Level's path. */
export const STATIONS = STATION_SHARES.length;

/** The ground's extent (x and z) and its facets across, in scene units. */
const GROUND = { left: -70, right: 70, near: 30, far: -80, facets: 56 };
const PATH_HALF_WIDTH = 0.62;
/** How far from the path the ground starts to roll, and how far until it rolls fully. */
const FLAT_NEAR = 1.6;
const FLAT_FAR = 7;

/** Where the key light falls from: high, to the right and a little toward the camera. */
const KEY = new Vector3(8, 6, 3).normalize();

/** The beacon's height over its Station's foot, and the capstone's scale. */
export const BEACON_HEIGHT = 1.3;
export const CAPSTONE_SCALE = 1.3;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A small seeded random source, so the trees stand in the same place on every page. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LandscapeLayout {
  /** The path's centre line on the ground. */
  curve: CatmullRomCurve3;
  /** Each Station's foot on the path, in path order. */
  stations: readonly Vector3[];
  /** Each Station's place along the path, as a share of its length. */
  shares: readonly number[];
  /** The ground's height at a point. */
  heightAt: (x: number, z: number) => number;
  /** The middle of the path, which the whole Level's view centres on. */
  centre: Vector3;
  /** How wide and deep the path runs. */
  span: { width: number; depth: number };
}

/** The path's centre line sampled on the ground, for the ground's distance from it. */
function pathSamples(curve: CatmullRomCurve3): Float32Array {
  const n = 240;
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = curve.getPointAt(i / (n - 1));
    out[i * 2] = p.x;
    out[i * 2 + 1] = p.z;
  }
  return out;
}

function distanceTo(samples: Float32Array, x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < samples.length; i += 2) {
    const dx = (samples[i] ?? 0) - x;
    const dz = (samples[i + 1] ?? 0) - z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

let layout: LandscapeLayout | null = null;

/** The Beginner landscape's layout: the same on every call. */
export function beginnerLayout(): LandscapeLayout {
  if (layout !== null) return layout;
  const curve = new CatmullRomCurve3(
    BENDS.map(([x, z]) => new Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const samples = pathSamples(curve);
  // Rolling slopes away from the path, rising into hills behind it.
  const heightAt = (x: number, z: number) => {
    const roll =
      Math.sin(x * 0.19 + z * 0.13) * 0.7 +
      Math.sin(x * 0.07 - z * 0.21 + 1.3) * 1.0 +
      Math.sin(x * 0.41 + 2.1) * Math.cos(z * 0.33) * 0.3;
    const behind = smooth(-6, -40, z) * (6 + Math.sin(x * 0.09) * 3);
    const away = smooth(FLAT_NEAR, FLAT_FAR, distanceTo(samples, x, z));
    return (roll * 0.9 + behind) * away;
  };
  const stations = STATION_SHARES.map((share) => {
    const p = curve.getPointAt(share);
    return new Vector3(p.x, heightAt(p.x, p.z), p.z);
  });
  const xs = BENDS.map(([x]) => x);
  const zs = BENDS.map(([, z]) => z);
  layout = {
    curve,
    stations,
    shares: STATION_SHARES,
    heightAt,
    centre: new Vector3(0, 0, (Math.min(...zs) + Math.max(...zs)) / 2),
    span: {
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...zs) - Math.min(...zs),
    },
  };
  return layout;
}

/** A point on the path at a share of its length, on the ground. */
export function pathPoint(share: number, out = new Vector3()): Vector3 {
  const { curve, heightAt } = beginnerLayout();
  curve.getPointAt(Math.min(1, Math.max(0, share)), out);
  out.y = heightAt(out.x, out.z);
  return out;
}

/** The light a face takes, as a Lambert face under the look's hemisphere and key light: in linear colour, per channel. */
export function shadeOf(look: SceneLook, normal: Vector3): Color {
  const sky = new Color(look.light);
  const ground = new Color(look.ground);
  const up = 0.5 + 0.5 * normal.y;
  const hemi = ground.clone().lerp(sky, up).multiplyScalar(look.ambient);
  const key = sky.multiplyScalar(look.key * Math.max(0, normal.dot(KEY)));
  return hemi.add(key).multiplyScalar(1 / Math.PI);
}

/** The colour a face of `base` shows under the look's light, held to the displayable range. */
export function bakedColour(
  look: SceneLook,
  base: string,
  normal: Vector3,
): Color {
  const c = new Color(base).multiply(shadeOf(look, normal));
  return new Color(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));
}

/**
 * Gives every face of a geometry one colour, baked from its own normal, so
 * the facets read as low-poly: `base` names each face's colour from its
 * centre and normal.
 */
function bakeFaces(
  geometry: BufferGeometry,
  look: SceneLook,
  base: (centre: Vector3, normal: Vector3) => string,
): BufferGeometry {
  const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
  const at = flat.getAttribute("position");
  const colours = new Float32Array(at.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const centre = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i + 2 < at.count; i += 3) {
    a.fromBufferAttribute(at, i);
    b.fromBufferAttribute(at, i + 1);
    c.fromBufferAttribute(at, i + 2);
    normal.subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
    centre
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const colour = bakedColour(look, base(centre, normal), normal);
    for (let k = 0; k < 3; k++) colour.toArray(colours, (i + k) * 3);
  }
  flat.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return flat;
}

/** One geometry of several non-indexed ones with positions and colours, for one draw call. */
function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  let count = 0;
  for (const p of parts) count += p.getAttribute("position").count;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  let offset = 0;
  for (const p of parts) {
    const pos = p.getAttribute("position");
    const col = p.getAttribute("color");
    positions.set(pos.array, offset * 3);
    colours.set(col.array, offset * 3);
    offset += pos.count;
    p.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(positions, 3));
  out.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return out;
}

/** The colours the landscape draws with in one theme. */
export function landscapeOf(look: SceneLook): LandscapeLook {
  return look.landscape;
}

/** The ground: meadow near the path, the look's ground colour on the hills behind. */
export function groundGeometry(look: SceneLook): BufferGeometry {
  const { heightAt } = beginnerLayout();
  const { left, right, near, far, facets } = GROUND;
  const plane = new PlaneGeometry(right - left, near - far, facets, facets);
  plane.rotateX(-Math.PI / 2);
  plane.translate((left + right) / 2, 0, (near + far) / 2);
  const at = plane.getAttribute("position");
  for (let i = 0; i < at.count; i++)
    at.setY(i, heightAt(at.getX(i), at.getZ(i)));
  const { meadow } = landscapeOf(look);
  return bakeFaces(plane, look, (centre) =>
    centre.y > 2.6 ? look.ground : meadow,
  );
}

/** The path: a ribbon over the ground along its centre line. */
export function pathGeometry(look: SceneLook): BufferGeometry {
  const { curve, heightAt } = beginnerLayout();
  const n = 160;
  const positions: number[] = [];
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  const tangent = new Vector3();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent);
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize();
    for (const [list, sign] of [
      [left, 1],
      [right, -1],
    ] as const) {
      const q = p.clone().addScaledVector(side, PATH_HALF_WIDTH * sign);
      q.y = heightAt(q.x, q.z) + 0.03;
      list.push(q);
    }
  }
  for (let i = 0; i + 1 < n; i++) {
    const [a, b, c, d] = [left[i], right[i], left[i + 1], right[i + 1]];
    if (!a || !b || !c || !d) continue;
    // Wound so each face looks up, toward the camera.
    positions.push(...a.toArray(), ...c.toArray(), ...b.toArray());
    positions.push(...b.toArray(), ...c.toArray(), ...d.toArray());
  }
  const ribbon = new BufferGeometry();
  ribbon.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const { path } = landscapeOf(look);
  return bakeFaces(ribbon, look, () => path);
}

/** Trees and rocks, scattered away from the path and the Stations, as one geometry. */
export function propsGeometry(look: SceneLook): BufferGeometry {
  const { heightAt, curve } = beginnerLayout();
  const samples = pathSamples(curve);
  const random = seeded(52);
  const { foliage, stone } = landscapeOf(look);
  const parts: BufferGeometry[] = [];
  let trees = 0;
  for (let tries = 0; trees < 90 && tries < 2000; tries++) {
    const x = -46 + random() * 92;
    const z = -42 + random() * 50;
    const clear = distanceTo(samples, x, z);
    // Clear of the path, and thinner in the foreground the screens sit over.
    if (clear < 3.2 || (z > 1 && random() < 0.75)) continue;
    const y = heightAt(x, z);
    const size = 0.8 + random() * 0.7;
    const crown = new ConeGeometry(0.75 * size, 2.1 * size, 6, 1);
    crown.rotateY(random() * Math.PI);
    crown.translate(x, y + 0.45 * size + 1.05 * size, z);
    const trunk = new CylinderGeometry(0.11 * size, 0.15 * size, 0.6 * size, 5);
    trunk.translate(x, y + 0.3 * size, z);
    parts.push(bakeFaces(crown, look, () => foliage));
    parts.push(bakeFaces(trunk, look, () => stone));
    trees += 1;
  }
  for (let rocks = 0, tries = 0; rocks < 26 && tries < 800; tries++) {
    const x = -30 + random() * 60;
    const z = -24 + random() * 30;
    if (distanceTo(samples, x, z) < 1.6) continue;
    const size = 0.25 + random() * 0.45;
    const rock = new IcosahedronGeometry(size, 0);
    rock.scale(1.3, 0.7, 1);
    rock.rotateY(random() * Math.PI);
    rock.translate(x, heightAt(x, z) + size * 0.25, z);
    parts.push(bakeFaces(rock, look, () => stone));
    rocks += 1;
  }
  return merge(parts);
}

/** Every Station's plinth and pillar, which never change, as one geometry. */
export function plinthsGeometry(look: SceneLook): BufferGeometry {
  const { stations } = beginnerLayout();
  const { stone } = landscapeOf(look);
  const parts = stations.flatMap((foot, i) => {
    const s = i === stations.length - 1 ? CAPSTONE_SCALE : 1;
    const plinth = new CylinderGeometry(0.62 * s, 0.74 * s, 0.24 * s, 8);
    plinth.translate(foot.x, foot.y + 0.12 * s, foot.z);
    const pillar = new CylinderGeometry(0.15 * s, 0.2 * s, 0.8 * s, 6);
    pillar.translate(foot.x, foot.y + 0.64 * s, foot.z);
    return [
      bakeFaces(plinth, look, () => stone),
      bakeFaces(pillar, look, () => stone),
    ];
  });
  return merge(parts);
}

/** A Station's beacon, which lights with its Lesson; the capstone's a little larger. */
export function beaconGeometry(capstone: boolean): BufferGeometry {
  const s = capstone ? CAPSTONE_SCALE : 1;
  const beacon = new OctahedronGeometry(0.3 * s, 0);
  beacon.scale(1, 1.35, 1);
  return beacon;
}

/** The ring of light round a lit Station's foot. */
export function haloGeometry(capstone: boolean): BufferGeometry {
  const s = capstone ? CAPSTONE_SCALE : 1;
  const ring = new RingGeometry(0.85 * s, 1.3 * s, 20);
  ring.rotateX(-Math.PI / 2);
  return ring;
}
