// The Badge reveal's choreography (09 9.3, ticket 53), as a pose for each
// moment of it: one light for each passed Check line flows in from around
// the Badge, and the Badge forms in 3D as they arrive, turning in to face
// the Learner. Its length is the reveal's (`--duration-reveal`); this file
// says only where each part stands at a fraction of it, so the end pose is
// the formed Badge exactly, and a skip lands there at once.

/** One light: where it stands in Badge widths about the Badge's centre, its size and its opacity. */
export interface LightPose {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
}

/** The Badge and its lights at one moment of the reveal. */
export interface RevealPose {
  /** The Badge's size, as a share of its formed size. */
  scale: number;
  /** Its turn still to come, in radians about the upright axis. */
  spin: number;
  /** The solid's opacity, and the raised art's, which forms last. */
  body: number;
  art: number;
  /** The warmth the lights leave in it as they arrive, from 0. */
  glow: number;
  lights: LightPose[];
}

/** Where the lights start, in Badge widths from its centre. */
const START = 1.8;
/** The lights leave one after another over this share of the reveal, and each travels for this share. */
const LEAVE = 0.3;
const TRAVEL = 0.42;
const FIRST = 0.06;
/** The Badge forms from this share on, from this size, turning in from this far round. */
const FORM_FROM = 0.12;
const SMALL = 0.55;
const TURN_IN = Math.PI * 1.5;
/** How long an arrival's warmth lasts, as a share of the reveal. */
const GLOW_FOR = 0.14;
const GLOW = 0.55;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Eases out, as the motion tokens' --ease-out does: fast, then settling. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** When light `i` of `n` arrives, as a share of the reveal. */
export function arrival(i: number, n: number): number {
  return FIRST + (n > 1 ? (LEAVE * i) / (n - 1) : 0) + TRAVEL;
}

/** The pose at `p`, the share of the reveal played (0 to 1), with `n` lights. */
export function revealPose(p: number, n: number): RevealPose {
  const t = clamp(p);
  const form = easeOut(clamp((t - FORM_FROM) / (1 - FORM_FROM)));
  const lights: LightPose[] = [];
  let glow = 0;
  for (let i = 0; i < n; i++) {
    const leaves = arrival(i, n) - TRAVEL;
    const u = clamp((t - leaves) / TRAVEL);
    const angle = Math.PI / 2 + (2 * Math.PI * i) / n + u * 1.4;
    const r = START * (1 - easeOut(u));
    const shown = u > 0 && u < 1 ? Math.min(1, u * 6, (1 - u) * 8) : 0;
    lights.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      z: 0.4 * (1 - u),
      size: 0.6 + 0.4 * (1 - u),
      opacity: shown,
    });
    const since = t - arrival(i, n);
    if (since >= 0 && t < 1) glow += GLOW * clamp(1 - since / GLOW_FOR);
  }
  return {
    scale: SMALL + (1 - SMALL) * form,
    spin: (1 - form) * -TURN_IN,
    body: clamp((t - FORM_FROM) / 0.3),
    art: clamp((t - 0.55) / 0.3),
    glow,
    lights,
  };
}
