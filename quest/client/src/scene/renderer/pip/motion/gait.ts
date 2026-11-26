// Pip's steps in the workshop (D6): where his feet stand, when they step,
// and how his body rides over them. Pure maths on three's vectors, with no
// scene, so it runs in the tests as in the browser.
//
// The feet are planted in world space: a standing foot never moves until it
// lifts, so it cannot slide or sink whatever the body does above it. A
// moving Pip steps on a gait phase that advances with his speed. Each foot
// swings during its own share of the cycle toward a spot predicted from his
// velocity and turn, so a change of direction mid-stride bends the very
// next step. Walking keeps a share of the cycle on both feet; running
// shortens each foot's stance until both are off the ground at once (the
// flight). A stopped Pip takes small settling steps, one foot at a time,
// until each is back under its hip, which is also how he shuffles round
// when he turns on the spot.
import { Vector3 } from "three";

/** Pip's proportions at scale 1, where he stands about 1 tall. */
export const BODY = {
  /** Each foot's distance to the side of his centre line. */
  hipX: 0.108,
  /** Each foot's rest offset along his facing. */
  footZ: 0.014,
  /** The furthest a foot reaches from his centre while it swings. */
  reach: 0.62,
} as const;

/** Walking and running speeds, in units a second at scale 1. */
export const SPEED = { walk: 1.05, run: 2.7 } as const;

/** 1 is Pip's own left (+x in his model), -1 his right. */
export type Side = 1 | -1;

export interface Foot {
  side: Side;
  planted: boolean;
  /** Where the sole's centre is in the world; y is its lift. */
  pos: Vector3;
  /** The foot's turn in the world. */
  yaw: number;
  /** The foot's roll in radians: toe down (+) or toe up (-). */
  pitch: number;
  from: Vector3;
  fromYaw: number;
  target: Vector3;
  targetYaw: number;
  /** A settling step, which runs on time rather than on the phase. */
  settle: { t: number; length: number; lift: number } | null;
}

/** Where Pip's centre is on the floor and how it moves. */
export interface RootState {
  pos: Vector3;
  yaw: number;
  vel: Vector3;
  /** The signed turn rate, in radians a second. */
  yawRate: number;
  /** The signed acceleration along his facing, in units a second squared. */
  accel: number;
}

export interface GaitOutput {
  /** 0 while he stands settled, 1 while a foot steps. */
  stepping: number;
  /** A walk (0) to a run (1). */
  runWeight: number;
  /** The body's lift over the ground: the bob, the push-off and the flight. */
  lift: number;
  /** The body's squash: under 1 on a landing, over 1 in the air. */
  squash: number;
  /** The body's shift to the side over the standing foot. */
  sway: number;
  /** Each foot's place along his facing from his centre, over a step's length. */
  swingLeft: number;
  swingRight: number;
  /** The feet that landed in this update. */
  landed: Side[];
  /** Both feet off the ground. */
  airborne: boolean;
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (u: number) => u * u * (3 - 2 * u);
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/** An angle brought into -pi to pi. */
export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

const lerpAngle = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t;

/** A point at (x, z) in Pip's frame, placed in the world at `pos` turned by `yaw`. */
export function toWorld(pos: Vector3, yaw: number, x: number, z: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return new Vector3(pos.x + x * c + z * s, 0, pos.z - x * s + z * c);
}

/** A foot's resting spot under its hip. */
export function restSpot(
  root: { pos: Vector3; yaw: number },
  side: Side,
  scale: number,
): Vector3 {
  return toWorld(
    root.pos,
    root.yaw,
    side * BODY.hipX * scale,
    BODY.footZ * scale,
  );
}

/** Steps a second at a speed (his heights a second), from the walk's cadence to the run's. */
export function cadence(speed: number, runWeight: number): number {
  const walk = 2.3 + 1.25 * Math.min(speed, 1.3);
  const run = 4.3 + 0.35 * Math.max(0, speed - 1.6);
  return walk + (run - walk) * runWeight;
}

/** The share of the cycle each foot stands, from a walk's to a run's. */
const dutyAt = (runWeight: number) => 0.62 + (0.34 - 0.62) * runWeight;

export class Gait {
  feet: [Foot, Foot];
  /** 0 to 1 over a full cycle of two steps: the left foot lifts at 0, the right at 0.5. */
  phase = 0;
  runWeight = 0;
  stepCount = 0;
  readonly scale: number;
  private moving = false;
  private swayNow = 0;
  private squashNow = 1;
  private landingKick = 0;

  constructor(root: { pos: Vector3; yaw: number }, scale = 1) {
    this.scale = scale;
    const make = (side: Side): Foot => {
      const p = restSpot(root, side, scale);
      return {
        side,
        planted: true,
        pos: p.clone(),
        yaw: root.yaw,
        pitch: 0,
        from: p.clone(),
        fromYaw: root.yaw,
        target: p.clone(),
        targetYaw: root.yaw,
        settle: null,
      };
    };
    this.feet = [make(1), make(-1)];
  }

  /** Puts each foot under its hip at once: a jump cut. */
  snap(root: { pos: Vector3; yaw: number }): void {
    for (const f of this.feet) {
      const p = restSpot(root, f.side, this.scale);
      f.pos.copy(p);
      f.from.copy(p);
      f.target.copy(p);
      f.yaw = f.fromYaw = f.targetYaw = root.yaw;
      f.pitch = 0;
      f.planted = true;
      f.settle = null;
    }
    this.moving = false;
  }

  update(dt: number, root: RootState): GaitOutput {
    const s = this.scale;
    const speed = Math.hypot(root.vel.x, root.vel.z) / s;
    const landed: Side[] = [];
    // Walk to run: the blend follows the speed, eased so duty and cadence never jump.
    const runTarget = clamp((speed - 1.35) / 0.55, 0, 1);
    this.runWeight += (runTarget - this.runWeight) * Math.min(1, dt * 5);
    const rw = this.runWeight;

    const wasMoving = this.moving;
    this.moving = wasMoving ? speed > 0.05 : speed > 0.12;

    if (this.moving) {
      if (!wasMoving) this.startPhase(root);
      const hz = cadence(speed, rw) / 2;
      const duty = dutyAt(rw);
      const swingFrac = 1 - duty;
      this.phase = (this.phase + hz * dt) % 1;
      for (const f of this.feet) {
        f.settle = null;
        const local = (this.phase - (f.side === 1 ? 0 : 0.5) + 1) % 1;
        if (local < swingFrac) {
          const u = local / swingFrac;
          if (f.planted) {
            f.planted = false;
            f.from.copy(f.pos).setY(0);
            f.fromYaw = f.yaw;
          }
          // Aim where his hip will be halfway through this foot's next stance.
          const remaining = ((1 - u) * swingFrac) / hz;
          const stance = duty / hz;
          const lead = remaining + stance * 0.5;
          const futureYaw = root.yaw + clamp(root.yawRate, -6, 6) * remaining;
          const centre = root.pos.clone().addScaledVector(root.vel, lead);
          const t = toWorld(
            centre,
            futureYaw,
            f.side * BODY.hipX * s,
            BODY.footZ * s,
          );
          // Never further than the leg reaches.
          const off = t.clone().sub(root.pos).setY(0);
          const max = BODY.reach * s;
          if (off.length() > max) off.setLength(max);
          f.target.copy(root.pos).add(off).setY(0);
          f.targetYaw = futureYaw;
          const e = smoother(u);
          f.pos.lerpVectors(f.from, f.target, e);
          const height = (0.055 + 0.05 * rw) * s * clamp(speed / 0.6, 0.35, 1);
          f.pos.y = height * Math.sin(Math.PI * u);
          f.yaw = lerpAngle(f.fromYaw, f.targetYaw, e);
          // Toe-off rolls the toe down, the heel strike lifts it.
          f.pitch = (0.32 + 0.25 * rw) * Math.sin(TAU * u) * clamp(speed, 0, 1);
        } else if (!f.planted) {
          f.planted = true;
          f.pos.set(f.target.x, 0, f.target.z);
          f.yaw = f.targetYaw;
          f.pitch = 0;
          landed.push(f.side);
          this.stepCount += 1;
          this.landingKick = 1;
        }
      }
    } else {
      this.updateSettling(dt, root, landed);
    }

    // The body rides the steps.
    const [left, right] = this.feet;
    const stepping =
      !left.planted || !right.planted || this.unsettled(root) ? 1 : 0;
    const airborne = !left.planted && !right.planted && this.moving;
    let lift = 0;
    let squashTarget = 1;
    if (this.moving) {
      const duty = dutyAt(rw);
      // The step's own phase: 0 at a heel strike, 1 at the next.
      const strike = 1 - duty;
      const q = ((((this.phase - strike) * 2) % 1) + 1) % 1;
      const amp = clamp(speed / 0.9, 0, 1);
      // Walking: lowest just after each strike, highest over the standing foot.
      const walkLift =
        -0.026 * s * amp * Math.cos(TAU * (q - 0.12)) - 0.012 * s * amp;
      // Running: down through the stance, push off, fly, land. Each foot
      // stands for `duty` of the cycle, so for twice that of a step.
      const stanceShare = Math.min(0.97, duty * 2);
      const runLift =
        q < stanceShare
          ? -0.045 * s * Math.sin(Math.PI * (q / stanceShare))
          : 0.075 *
            s *
            Math.sin(Math.PI * ((q - stanceShare) / (1 - stanceShare)));
      lift = walkLift + (runLift - walkLift) * rw;
      squashTarget = 1 + (lift / s) * (0.9 + 1.4 * rw);
    }
    // A landing squashes him briefly, more from the air.
    this.landingKick *= Math.exp(-dt * 14);
    squashTarget -= this.landingKick * (0.015 + 0.04 * rw);
    this.squashNow += (squashTarget - this.squashNow) * Math.min(1, dt * 18);

    // His weight moves over whichever foot stands alone.
    let swayTarget = 0;
    if (left.planted && !right.planted) swayTarget = 1;
    else if (right.planted && !left.planted) swayTarget = -1;
    swayTarget *= (0.024 - 0.012 * rw) * s;
    this.swayNow += (swayTarget - this.swayNow) * Math.min(1, dt * 9);

    const along = (f: Foot) => {
      const dx = f.pos.x - root.pos.x;
      const dz = f.pos.z - root.pos.z;
      return (
        (dx * Math.sin(root.yaw) + dz * Math.cos(root.yaw)) / s - BODY.footZ
      );
    };
    const norm = 0.18 + 0.12 * rw;
    return {
      stepping,
      runWeight: rw,
      lift,
      squash: this.squashNow,
      sway: this.swayNow,
      swingLeft: clamp(along(left) / norm, -1.4, 1.4),
      swingRight: clamp(along(right) / norm, -1.4, 1.4),
      landed,
      airborne,
    };
  }

  /** Starts a walk with the foot furthest behind where it needs to be. */
  private startPhase(root: RootState): void {
    const ahead = (f: Foot) =>
      (f.pos.x - root.pos.x) * root.vel.x + (f.pos.z - root.pos.z) * root.vel.z;
    const [l, r] = this.feet;
    this.phase = ahead(l) <= ahead(r) ? 0 : 0.5;
    for (const f of this.feet) {
      if (!f.planted) {
        f.planted = true;
        f.pos.setY(0);
      }
      f.settle = null;
    }
  }

  private footError(f: Foot, root: { pos: Vector3; yaw: number }) {
    const spot = restSpot(root, f.side, this.scale);
    return {
      dist: Math.hypot(spot.x - f.pos.x, spot.z - f.pos.z) / this.scale,
      turn: Math.abs(wrapAngle(root.yaw - f.yaw)),
    };
  }

  private unsettled(root: { pos: Vector3; yaw: number }): boolean {
    return this.feet.some((f) => {
      const e = this.footError(f, root);
      return e.dist > 0.03 || e.turn > 0.3;
    });
  }

  private updateSettling(dt: number, root: RootState, landed: Side[]): void {
    // A foot caught mid-swing as he stops finishes its step under its hip.
    for (const f of this.feet) {
      if (!f.planted && f.settle === null) {
        f.from.copy(f.pos).setY(0);
        f.fromYaw = f.yaw;
        f.settle = {
          t: 0,
          length: 0.16,
          lift: Math.max(f.pos.y, 0.02 * this.scale),
        };
      }
    }
    if (!this.feet.some((f) => f.settle !== null)) {
      // One settling step at a time, the worse foot first.
      let worst: Foot | null = null;
      let score = 0;
      for (const f of this.feet) {
        const e = this.footError(f, root);
        const sc = e.dist / 0.03 + e.turn / 0.3;
        if ((e.dist > 0.03 || e.turn > 0.3) && sc > score) {
          worst = f;
          score = sc;
        }
      }
      if (worst !== null) {
        worst.planted = false;
        worst.from.copy(worst.pos).setY(0);
        worst.fromYaw = worst.yaw;
        worst.settle = { t: 0, length: 0.2, lift: 0.04 * this.scale };
      }
    }
    for (const f of this.feet) {
      if (f.settle === null) continue;
      const spot = restSpot(root, f.side, this.scale);
      f.target.copy(spot);
      f.targetYaw = root.yaw;
      f.settle.t += dt;
      const u = clamp(f.settle.t / f.settle.length, 0, 1);
      const e = smooth(u);
      f.pos.lerpVectors(f.from, f.target, e);
      f.pos.y = f.settle.lift * Math.sin(Math.PI * u);
      f.yaw = lerpAngle(f.fromYaw, f.targetYaw, e);
      f.pitch = 0.15 * Math.sin(TAU * u);
      if (u >= 1) {
        f.settle = null;
        f.planted = true;
        f.pos.set(spot.x, 0, spot.z);
        f.yaw = root.yaw;
        f.pitch = 0;
        landed.push(f.side);
        this.stepCount += 1;
      }
    }
  }
}
