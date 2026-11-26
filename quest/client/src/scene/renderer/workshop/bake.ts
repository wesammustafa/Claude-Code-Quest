// The workshop's light, baked into its colours (09 9.2 Look): each face
// takes the colour a Lambert face would show under the room's light (the
// look's light from above and the windows' side, bounced off the floor),
// plus the warm glow of the hanging lamps near it. The renderer then draws
// every face unlit, so no tier needs a light or a shadow map for the room.
// Plain Three.js geometry, with no renderer, so a test can build it.
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";
import type { SceneLook } from "../../../mount/types";

/** Where the key light falls from: high, from the left and toward the camera, as the windows' daylight. */
const KEY = new Vector3(-5, 9, 6).normalize();

/** The hanging lamps' bulbs, in the Scene's units: high enough that a framing of a place sees them above it, not in front of it. */
export const LAMPS: readonly (readonly [number, number, number])[] = [
  [0, 3.9, 0.2],
  [-3.4, 3.95, -2.1],
  [4.2, 3.95, -1.2],
];

/** How far a lamp's light reaches before it has halved, and where it ends. */
const LAMP_REACH = 2.8;
const LAMP_END = 7;

/** The room's light on one face, per channel, in linear colour, held to the displayable range. */
export interface Lighting {
  /** The colour a face of `base` shows at `at` with this `normal`. */
  colour: (base: Color, at: Vector3, normal: Vector3, out: Color) => Color;
}

/** The room's light for a look. */
export function lightingOf(look: SceneLook): Lighting {
  const { ambient, key, lamp, floor, glow } = look.workshop;
  const sky = new Color(look.light);
  const bounce = new Color(floor);
  const lampColour = new Color(glow);
  const hemi = new Color();
  const light = new Color();
  const toLamp = new Vector3();
  return {
    colour: (base, at, normal, out) => {
      const up = 0.5 + 0.5 * normal.y;
      hemi.copy(bounce).lerp(sky, up).multiplyScalar(ambient);
      light
        .copy(sky)
        .multiplyScalar(key * Math.max(0, normal.dot(KEY)))
        .add(hemi);
      if (lamp > 0)
        for (const [x, y, z] of LAMPS) {
          toLamp.set(x - at.x, y - at.y, z - at.z);
          const d = toLamp.length();
          if (d >= LAMP_END || d === 0) continue;
          const facing = 0.35 + 0.65 * Math.max(0, normal.dot(toLamp) / d);
          const fade = 1 - d / LAMP_END;
          const reach = 1 / (1 + (d / LAMP_REACH) ** 2);
          light.add(
            hemi.copy(lampColour).multiplyScalar(lamp * facing * fade * reach),
          );
        }
      out
        .copy(base)
        .multiply(light)
        .multiplyScalar(1 / Math.PI);
      return out.setRGB(
        Math.min(1, out.r),
        Math.min(1, out.g),
        Math.min(1, out.b),
      );
    },
  };
}

/**
 * A geometry with every vertex coloured: `base`'s colour under the room's
 * light at the vertex, by its face's normal, so the facets read as low-poly
 * and the lamps' glow falls softly across a large face; with `lit` false,
 * `base` as given, for what glows itself (a bulb, a window); and between
 * the two by `own`, for paper that catches what light there is.
 */
export function baked(
  geometry: BufferGeometry,
  lighting: Lighting,
  base: string | Color,
  lit = true,
  own = 0,
): BufferGeometry {
  const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
  if (flat !== geometry) geometry.dispose();
  const at = flat.getAttribute("position");
  const colours = new Float32Array(at.count * 3);
  const colour = typeof base === "string" ? new Color(base) : base;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  const side = new Vector3();
  const out = new Color();
  for (let i = 0; i + 2 < at.count; i += 3) {
    a.fromBufferAttribute(at, i);
    b.fromBufferAttribute(at, i + 1);
    c.fromBufferAttribute(at, i + 2);
    normal.subVectors(c, b).cross(side.subVectors(a, b)).normalize();
    for (const [k, p] of [a, b, c].entries()) {
      if (lit) lighting.colour(colour, p, normal, out).lerp(colour, own);
      else out.copy(colour);
      out.toArray(colours, (i + k) * 3);
    }
  }
  flat.deleteAttribute("normal");
  flat.deleteAttribute("uv");
  flat.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return flat;
}

/** One geometry of several baked ones (positions and colours), for one draw call; the parts are disposed. */
export function merged(parts: readonly BufferGeometry[]): BufferGeometry {
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
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** A colour between two, `t` of the way from `a` to `b`. */
export function mix(a: string | Color, b: string | Color, t: number): Color {
  return new Color(a).lerp(new Color(b), t);
}

/** A colour scaled toward black: `k` 1 keeps it. */
export function shade(a: string | Color, k: number): Color {
  return new Color(a).multiplyScalar(k);
}
