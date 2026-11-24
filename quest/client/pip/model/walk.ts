// The 3D Pip's walk (seam S13), the one clip the Rive rig has no timeline
// for: what Pip does while he travels the Journey's path between Stations.
// A seamless loop of one stride each side, in his chunky, friendly style:
// the feet step in turn, each lifting and rolling from toe-off to heel, the
// short legs following them; the arms swing against the legs; the body bobs
// low after each heel strike and sways over the planted foot, the head
// nodding with the bob and the antennas lagging it. Phase 0 is the left
// foot's toe-off, so a walk started from rest steps at once. clips.ts bakes
// it; the planted foot slides back at one even speed, as on the ground.

/** One stride each side, in seconds: two steps across a Station-to-Station glide and the blend out of it. */
export const WALK_S = 0.5;

/** The walk's sizes: lengths in rig units (Pip is 725 tall), turns in degrees. */
export const WALK = {
  /** Each foot's travel either side of its rest, along his facing. */
  stride: 60,
  /** How high a stepping foot lifts. */
  lift: 36,
  /** The stepping foot's roll: toe down at toe-off, toe up at heel strike. */
  roll: 14,
  /** The share of the stride a foot spends in the air; the rest it stands. */
  swing: 0.45,
  /** The legs follow their feet by these shares (forward and up), the body's bob by `bob`, and tilt with the stride. */
  legFollow: { z: 0.7, y: 0.5, bob: 0.8, tilt: 10 },
  /** The body's bob (twice a stride) and its sway over the planted foot and twist with the arms (once). */
  bob: 14,
  sway: 2.5,
  twist: 5,
  /** The arms' swing forward and back about the shoulder. */
  arm: 34,
  /** The head's nod with the bob, and the antennas' lagging wobble. */
  nod: 2,
  antenna: 8,
} as const;

/** Pip's height in rig units, from his soles to the big antenna's tip. */
const RIG_HEIGHT = 725;

/**
 * How fast a planted foot slides back under him at the clip's own speed,
 * in his heights per second: the renderer steps faster or slower than the
 * clip so that it keeps up with the ground he travels over.
 */
export const WALK_FOOT_SPEED =
  (2 * WALK.stride) / ((1 - WALK.swing) * WALK_S) / RIG_HEIGHT;

/** The foot's half depth (rig units): how far its toe and heel sit from its node. */
const FOOT_HALF_DEPTH = 60;

/** One foot at a moment of the walk: along his facing, its lift, and its roll (+ toe down). */
export interface StepPose {
  z: number;
  lift: number;
  roll: number;
}

/** The walk at one moment, in rig units and degrees, every part relative to its rest. */
export interface WalkPose {
  /** The body's bob up, its sway (a roll about +z) and twist (a turn about +y). */
  body: { y: number; sway: number; twist: number };
  footLeft: StepPose;
  footRight: StepPose;
  /** Each arm's swing about +x: negative carries the hand forward. */
  armLeft: number;
  armRight: number;
  /** The head's nod about +x (+ down). */
  nod: number;
  /** Each antenna's tilt about +z. */
  antennaLeft: number;
  antennaRight: number;
}

const TAU = 2 * Math.PI;
/** A phase wrapped into [0, 1). */
const wrap = (p: number) => p - Math.floor(p);

/** One foot at its own phase: in the air from 0 to `swing`, then standing, sliding back at one speed. */
export function stepAt(phase: number): StepPose {
  const q = wrap(phase);
  const { stride, lift, roll, swing } = WALK;
  if (q < swing) {
    const u = q / swing;
    const r = roll * Math.sin(TAU * u);
    // Lifted at least as far as the roll dips its toe or heel, so it never sinks into the ground.
    const dip = FOOT_HALF_DEPTH * Math.abs(Math.sin((r * Math.PI) / 180));
    return {
      z: -stride + stride * (1 - Math.cos(Math.PI * u)),
      lift: Math.max(lift * Math.sin(Math.PI * u), dip),
      roll: r,
    };
  }
  const v = (q - swing) / (1 - swing);
  return { z: stride - 2 * stride * v, lift: 0, roll: 0 };
}

/** The walk at `phase` (0 to 1 over WALK_S); phase 1 is phase 0 exactly. */
export function walkPose(phase: number): WalkPose {
  const p = wrap(phase);
  const { swing, bob, sway, twist, arm, nod, antenna } = WALK;
  // The left heel strikes at `swing`, the right half a stride later; the
  // body is lowest just after each, and over the left foot mid-stance.
  const low = swing + 0.03;
  const bobAt = -bob * Math.cos(2 * TAU * (p - low));
  // The left arm is furthest forward as the right heel strikes.
  const leftArm = Math.cos(TAU * (p - wrap(swing + 0.5)));
  const wobble = antenna * Math.cos(2 * TAU * (p - low - 0.06));
  return {
    body: {
      y: bobAt,
      sway: -sway * Math.sin(TAU * (p - (swing + 1) / 2 + 0.25)),
      twist: -twist * leftArm,
    },
    footLeft: stepAt(p),
    footRight: stepAt(p + 0.5),
    armLeft: -arm * leftArm,
    armRight: arm * leftArm,
    nod: (nod * bobAt) / -bob,
    antennaLeft: -wobble,
    antennaRight: wobble,
  };
}
