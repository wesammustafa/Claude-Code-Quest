// The 3D Pip's colours and baked light (seam S13): every colour is sRGB
// 0 to 255 until the model is written, where it becomes linear light for
// COLOR_0. The light is turn.ts's own board light (a soft key mostly from
// the viewer), with its side term on Pip's left (+x), the Scene's side, so
// the face reads exactly as the posters and the lit side meets the
// landscape's light. Faces the art does not paint take the board's light by
// their normal (the generator spec's rule 9.2): a part's front gradient,
// times how much brighter or darker that facing is than the front.

export type Rgb = readonly [number, number, number];
export type Vec3 = readonly [number, number, number];

/** An sRGB colour from its hex digits ("FD9D68" or "#FD9D68"). */
export function hex(value: string): Rgb {
  const n = Number.parseInt(value.replace("#", "").slice(-6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

/** One sRGB channel (0 to 255) in linear light (0 to 1). */
export const toLinear = (c: number): number => {
  const v = clamp255(c) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** One linear channel (0 to 1) in sRGB (0 to 255). */
export const toSrgb = (l: number): number => {
  const v = Math.max(0, Math.min(1, l));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** The mix the GPU makes between two vertex colours: in linear light. */
export const mixLinear = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) =>
    toSrgb(
      toLinear(a[i] ?? 0) + (toLinear(b[i] ?? 0) - toLinear(a[i] ?? 0)) * t,
    ),
  ) as unknown as Rgb;

/** A gradient's stops: positions along its axis and their colours. */
export type Stops = readonly (readonly [at: number, colour: Rgb])[];

/** A gradient at a position, as the rig paints it: in sRGB, held past its ends. */
export function gradient(stops: Stops, at: number): Rgb {
  const first = stops[0];
  if (first === undefined) throw new Error("a gradient needs a stop");
  const ascending = (stops[stops.length - 1]?.[0] ?? 0) >= first[0];
  const sorted = ascending ? stops : [...stops].reverse();
  const lo = sorted[0] ?? first;
  const hi = sorted[sorted.length - 1] ?? first;
  if (at <= lo[0]) return lo[1];
  if (at >= hi[0]) return hi[1];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i] ?? lo;
    const b = sorted[i + 1] ?? hi;
    if (at >= a[0] && at <= b[0])
      return b[0] === a[0]
        ? b[1]
        : mix(a[1], b[1], (at - a[0]) / (b[0] - a[0]));
  }
  return hi[1];
}

// The board's light, as turn.ts computes it (`light`, `faceColour`,
// `bandStops`), with the side term on +x.

/** The key's side share: + lights Pip's left (+x), the Scene's side; turn.ts's board has it at -0.18. */
export const KEY_SIDE = 0.18;
const KEY_FRONT = 0.92;

const SHADE_DARK = hex("E0592E");
const SHADE_LIT = hex("FD9A64");
const SHADE_HIGH = hex("FFB884");
const WALL_TINT = hex("FFD6AA");
const WALL_SHADE = hex("B9461F");

export const TOP_BEVEL = hex("FFBA84");
export const TOP = hex("FCB27C");
export const BOTTOM_BEVEL = hex("C85A2F");
export const UNDERSIDE = hex("B4461F");

/** How lit a vertical face is, by its outward normal's horizontal part. */
export function level(nx: number, nz: number): number {
  const n = Math.hypot(nx, nz);
  if (n < 1e-9) return 0;
  return Math.max(0, (KEY_SIDE * nx + KEY_FRONT * nz) / n);
}

function faceColour(lit: number): Rgb {
  if (lit <= KEY_FRONT)
    return mix(SHADE_DARK, SHADE_LIT, Math.max(0, lit) / KEY_FRONT);
  return mix(SHADE_LIT, SHADE_HIGH, Math.min(1, (lit - KEY_FRONT) / 0.2));
}

/** A head wall's top and bottom gradient stops, as turn.ts's `bandStops` writes them into pip.rml. */
export function bandStops(
  nx: number,
  nz: number,
  frontChamfer: boolean,
): [Rgb, Rgb] {
  const base = faceColour(level(nx, nz));
  return [
    mix(base, WALL_TINT, frontChamfer ? 0.1 : 0.05),
    mix(base, WALL_SHADE, 0.22),
  ];
}

/** The front's wall colour, the rule's reference (FD9D68 before rounding). */
const W0 = mix(faceColour(KEY_FRONT), WALL_TINT, 0.05);

/**
 * How a face with this outward normal is lit against the front: the board's
 * wall colour at its facing, toward the bevel and top colours as it turns
 * up, the bottom bevel and underside as it turns down, over the front's.
 */
export function shadeRatio(n: Vec3): Rgb {
  const wall = mix(faceColour(level(n[0], n[2])), WALL_TINT, 0.05);
  const up = n[1];
  const diagonal = Math.SQRT1_2;
  let c: Rgb;
  if (up >= 0)
    c =
      up <= diagonal
        ? mix(wall, TOP_BEVEL, up / diagonal)
        : mix(TOP_BEVEL, TOP, (up - diagonal) / (1 - diagonal));
  else
    c =
      -up <= diagonal
        ? mix(wall, BOTTOM_BEVEL, -up / diagonal)
        : mix(BOTTOM_BEVEL, UNDERSIDE, (-up - diagonal) / (1 - diagonal));
  return [c[0] / W0[0], c[1] / W0[1], c[2] / W0[2]];
}

/** A colour painted on a face with this normal: the rule for every face the art does not paint. */
export function shade(colour: Rgb, n: Vec3): Rgb {
  const r = shadeRatio(n);
  return [
    clamp255(colour[0] * r[0]),
    clamp255(colour[1] * r[1]),
    clamp255(colour[2] * r[2]),
  ];
}
