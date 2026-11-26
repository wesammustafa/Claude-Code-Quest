// Where Pip's centre goes in the workshop (D6): along a route to a spot,
// under the Learner's steering in Explore, or turning where he stands to
// face something. One goal at a time: a new one replaces the old at once,
// from wherever he is and however fast he goes, so nothing ever queues.
import { Vector3 } from "three";
import type { FloorPoint } from "../../../workshop/layout";
import { SPEED, wrapAngle, type RootState } from "./gait";
import { pathLength, type NavGrid } from "./nav";

/** How Pip goes to a spot: walking, running, or running only on a long trip. */
export type Pace = "walk" | "run" | "auto";

/** A trip longer than this, in his heights, he runs when the pace is auto. */
export const RUN_AFTER = 3.3;

export type Goal =
  | { kind: "none" }
  | {
      kind: "route";
      pts: FloorPoint[];
      leg: number;
      runAllowed: boolean;
      id: number;
    }
  | { kind: "drive"; x: number; z: number; run: boolean };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export class Motor {
  readonly root: RootState;
  goal: Goal = { kind: "none" };
  /** The turn he takes standing: toward what he arrived at, or the Learner he greets. */
  faceYaw: number | null = null;
  /** The id of the last route he finished. */
  arrivedId: number | null = null;
  readonly nav: NavGrid;
  readonly scale: number;
  private speed = 0;
  private routeId = 0;

  constructor(nav: NavGrid, start: FloorPoint, yaw: number, scale = 1) {
    this.nav = nav;
    this.scale = scale;
    const at = nav.nearestFree(start);
    this.root = {
      pos: new Vector3(at.x, 0, at.z),
      yaw,
      vel: new Vector3(),
      yawRate: 0,
      accel: 0,
    };
  }

  get currentSpeed(): number {
    return this.speed;
  }

  /** Sends him to a point, replacing any goal at once: the route's id, corners and length. */
  goTo(
    to: FloorPoint,
    pace: Pace = "auto",
  ): { id: number; pts: FloorPoint[]; length: number } {
    const pts = this.nav.route({ x: this.root.pos.x, z: this.root.pos.z }, to);
    const length = pathLength(pts);
    this.routeId += 1;
    this.goal = {
      kind: "route",
      pts,
      leg: 1,
      runAllowed:
        pace === "run" || (pace === "auto" && length > RUN_AFTER * this.scale),
      id: this.routeId,
    };
    this.faceYaw = null;
    this.arrivedId = null;
    return { id: this.routeId, pts, length };
  }

  /** Steers him by a way across the floor (its length 0 to 1), running or not. */
  drive(x: number, z: number, run: boolean): void {
    this.goal = { kind: "drive", x, z, run };
    this.faceYaw = null;
  }

  /** Drops the goal: he brakes where he is. */
  stop(): void {
    this.goal = { kind: "none" };
  }

  /** How far he has left to go along his route. */
  remaining(): number {
    const g = this.goal;
    if (g.kind !== "route") return 0;
    const leg = g.pts[g.leg];
    if (leg === undefined) return 0;
    return (
      Math.hypot(leg.x - this.root.pos.x, leg.z - this.root.pos.z) +
      pathLength(g.pts.slice(g.leg))
    );
  }

  /** The corner he heads for now, or null with no route. */
  heading(): FloorPoint | null {
    const g = this.goal;
    return g.kind === "route" ? (g.pts[g.leg] ?? null) : null;
  }

  update(dt: number): RootState {
    const r = this.root;
    const s = this.scale;
    let wantSpeed = 0;
    let wantYaw: number | null = null;
    let turnRate = 7;
    const g = this.goal;

    if (g.kind === "route") {
      // Past the corners he has reached.
      let corner = g.pts[g.leg];
      while (
        corner !== undefined &&
        g.leg < g.pts.length - 1 &&
        Math.hypot(corner.x - r.pos.x, corner.z - r.pos.z) < 0.35 * s
      ) {
        g.leg += 1;
        corner = g.pts[g.leg];
      }
      const rem = this.remaining();
      const target = g.pts[g.leg] ?? { x: r.pos.x, z: r.pos.z };
      if (rem < 0.04 * s && this.speed < 0.25 * s) {
        this.arrivedId = g.id;
        this.goal = { kind: "none" };
      } else {
        wantYaw = Math.atan2(target.x - r.pos.x, target.z - r.pos.z);
        const top = (g.runAllowed ? SPEED.run : SPEED.walk) * s;
        const brake = 2.3 * s;
        // Easing into the stop: the speed from which he brakes within what is left.
        wantSpeed = Math.min(
          top,
          Math.sqrt(2 * brake * Math.max(0, rem - 0.02 * s)),
        );
        // A sharp change of heading slows him to turn, rather than circle.
        const off = Math.abs(wrapAngle(wantYaw - r.yaw));
        wantSpeed *= off > 1.7 ? 0.08 : clamp(Math.cos(off) * 1.15, 0.2, 1);
      }
    } else if (g.kind === "drive") {
      const m = Math.min(1, Math.hypot(g.x, g.z));
      if (m > 0.08) {
        wantYaw = Math.atan2(g.x, g.z);
        wantSpeed = m * (g.run ? SPEED.run : SPEED.walk) * s;
        const off = Math.abs(wrapAngle(wantYaw - r.yaw));
        wantSpeed *= off > 1.7 ? 0.1 : clamp(Math.cos(off) * 1.15, 0.25, 1);
      }
    }
    if (wantYaw === null && this.faceYaw !== null && this.speed < 0.3 * s) {
      wantYaw = this.faceYaw;
      turnRate = 5;
    }

    // Speeding up and braking within what his legs can do.
    const accel = (this.speed < SPEED.walk * s ? 3.0 : 2.6) * s;
    const brake = 4.2 * s;
    const before = this.speed;
    if (wantSpeed > this.speed)
      this.speed = Math.min(wantSpeed, this.speed + accel * dt);
    else this.speed = Math.max(wantSpeed, this.speed - brake * dt);
    r.accel = (this.speed - before) / Math.max(dt, 1e-4);

    // Turning, slower at a run.
    const prevYaw = r.yaw;
    if (wantYaw !== null) {
      const rate = turnRate - 3.2 * clamp(this.speed / (SPEED.run * s), 0, 1);
      const d = wrapAngle(wantYaw - r.yaw);
      r.yaw = wrapAngle(r.yaw + clamp(d, -rate * dt, rate * dt));
    }
    r.yawRate = wrapAngle(r.yaw - prevYaw) / Math.max(dt, 1e-4);

    // Along his facing; steered, he slides along furniture rather than into it.
    const nx = r.pos.x + Math.sin(r.yaw) * this.speed * dt;
    const nz = r.pos.z + Math.cos(r.yaw) * this.speed * dt;
    let moved = { x: nx, z: nz };
    if (!this.nav.freePoint(moved)) {
      if (this.nav.freePoint({ x: nx, z: r.pos.z }))
        moved = { x: nx, z: r.pos.z };
      else if (this.nav.freePoint({ x: r.pos.x, z: nz }))
        moved = { x: r.pos.x, z: nz };
      else {
        moved = { x: r.pos.x, z: r.pos.z };
        if (g.kind === "drive") this.speed *= 0.5;
      }
    }
    const step = Math.max(dt, 1e-4);
    r.vel.set((moved.x - r.pos.x) / step, 0, (moved.z - r.pos.z) / step);
    r.pos.set(moved.x, 0, moved.z);
    return r;
  }
}
