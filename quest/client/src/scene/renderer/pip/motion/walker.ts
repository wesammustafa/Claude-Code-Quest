// Pip in the workshop (D6): what he does with what the screens ask, on his
// legs only. The one director keeps his modes and Reactions; this walks
// him to a spot or a point of the floor, turns him to face what he arrived
// at, turns him to the Learner for a greet or a celebration before the
// director plays it, and moves him while Explore steers him. One goal at a time: each command
// replaces the last at once, mid-stride included, so nothing queues.
import { Vector3 } from "three";
import type { PipMode, PipReactionKind } from "../../../../../pip/contract";
import { SPOTS, type FloorPoint, type SpotId } from "../../../workshop/layout";
import type { PipActivity } from "../../../workshop/store";
import { Gait, wrapAngle, type GaitOutput, type RootState } from "./gait";
import { Motor, type Pace } from "./motor";
import type { NavGrid } from "./nav";

/** Faster than this, in his heights a second, he is on the move. */
export const MOVING = 0.1;
/** A run shows from this share of the walk-to-run blend. */
const RUNNING = 0.5;
/** A greet waits for his turn to the Learner until he faces them within this, in radians... */
const GREET_TURN = 0.7;
/**
 * ...or once he has stood this many seconds: greeted at a run, he brakes
 * first and only then turns round, so the wait starts once he stands.
 */
const GREET_WAIT = 0.8;
/** On the move he looks at the corner ahead, at about this height. */
const LOOK_HEIGHT = 0.6;
/** A steer shorter than this is no steer: he stops. */
const DEAD_STEER = 0.08;

/** Where a command sends him: a spot of the room or a point of its floor. */
export type WalkTo = { spot: SpotId } | { floor: FloorPoint };

/** What a frame of the walk gives the stride and the screens. */
export interface WalkFrame {
  root: RootState;
  out: GaitOutput;
  /** On the move: the corner ahead he looks at, in the world; else null. */
  look: Vector3 | null;
  /** He moves now. */
  moving: boolean;
  /** He travels: a route or a steer holds him, or he still moves. */
  travelling: boolean;
  /** The greet is due: he has turned to the Learner, so the director may play it. */
  greet: boolean;
  /** The celebration is due: he stands and has turned to the Learner, so it may play. */
  cheer: boolean;
}

/** The turn that faces from `from` to `to` on the floor. */
export const yawTo = (from: FloorPoint, to: FloorPoint): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

export class Walker {
  readonly motor: Motor;
  readonly gait: Gait;
  private exploring = false;
  /** The spot his route goes to, until he arrives. */
  private bound: SpotId | null = null;
  /** Arrived at `bound`, he turns to the Learner rather than to what the spot looks at. */
  private facesLearner = false;
  /** The spot he stands at, from his arrival until he sets off again. */
  private standing: SpotId | null = null;
  private greeting: { waited: number } | null = null;
  /** A celebration waiting for him to stand and turn to the Learner at `camera`. */
  private cheering: { waited: number; camera: FloorPoint } | null = null;
  private readonly ahead = new Vector3();

  /** Stands him at `start` (a spot, facing what it looks at, or a point, facing the room's front). */
  constructor(nav: NavGrid, start: SpotId | FloorPoint) {
    const spot = typeof start === "string" ? SPOTS[start] : null;
    const at = spot?.stand ?? (start as FloorPoint);
    const yaw =
      spot === null ? 0 : yawTo(at, { x: spot.look[0], z: spot.look[2] });
    this.motor = new Motor(nav, at, yaw);
    this.gait = new Gait(this.motor.root);
    if (typeof start === "string") this.standing = start;
  }

  /** The spot he stands at, or null on the move or away from any. */
  get at(): SpotId | null {
    return this.standing;
  }

  get explore(): boolean {
    return this.exploring;
  }

  /** A greet is waiting for his turn to the Learner. */
  get greetPending(): boolean {
    return this.greeting !== null;
  }

  /** A celebration is waiting for his turn to the Learner. */
  get cheerPending(): boolean {
    return this.cheering !== null;
  }

  /**
   * Sends him to a spot or a point of the floor; at a spot he faces what it
   * looks at on arrival, or with `facesLearner` the Learner.
   */
  goTo(to: WalkTo, pace: Pace = "auto", facesLearner = false): void {
    this.greeting = null;
    this.cheering = null;
    this.standing = null;
    if ("spot" in to) {
      this.bound = to.spot;
      this.facesLearner = facesLearner;
      this.motor.goTo(SPOTS[to.spot].stand, pace);
    } else {
      this.bound = null;
      this.motor.goTo(to.floor, pace);
    }
  }

  /** Stops him and turns him to the Learner at `camera`; the greet is due once he has turned. */
  greet(camera: FloorPoint): void {
    this.motor.stop();
    this.bound = null;
    this.cheering = null;
    this.motor.faceYaw = yawTo(this.motor.root.pos, camera);
    this.greeting = { waited: 0 };
  }

  /**
   * Turns him to the Learner at `camera` for a celebration, once he stands:
   * a walk he is on ends first, where it was going; the celebration is due
   * once he has turned. Any other command drops it, and so does null.
   */
  cheer(camera: FloorPoint | null): void {
    this.cheering = camera === null ? null : { waited: 0, camera };
  }

  /** Steers him while Explore is on: a way across the floor (length 0 to 1), running or not; none stops him. */
  steer(x: number, z: number, run: boolean): void {
    if (!this.exploring) return;
    this.greeting = null;
    this.cheering = null;
    this.bound = null;
    if (Math.hypot(x, z) < DEAD_STEER) {
      this.motor.stop();
      return;
    }
    this.standing = null;
    this.motor.drive(x, z, run);
  }

  /** Explore on stops him for steering; off sends him back to the screen's goal, if any. */
  setExplore(on: boolean, goal: SpotId | null): void {
    if (on === this.exploring) return;
    this.exploring = on;
    if (on) this.stop();
    else if (goal !== null) this.goTo({ spot: goal });
    else this.stop();
  }

  /** Drops whatever he was doing: he brakes where he is. */
  stop(): void {
    this.motor.stop();
    this.bound = null;
    this.greeting = null;
    this.cheering = null;
  }

  /** One frame of his walk; `learner` is where the Learner looks from, on the floor, which he turns to on arriving when sent so. */
  update(dt: number, learner: FloorPoint | null = null): WalkFrame {
    const motor = this.motor;
    const before = motor.arrivedId;
    const root = motor.update(dt);
    if (motor.arrivedId !== null && motor.arrivedId !== before) {
      if (this.bound !== null) {
        const look = SPOTS[this.bound].look;
        motor.faceYaw =
          this.facesLearner && learner !== null
            ? yawTo(root.pos, learner)
            : yawTo(root.pos, { x: look[0], z: look[2] });
        this.standing = this.bound;
      }
      this.bound = null;
    }
    const out = this.gait.update(dt, root);

    const moving = motor.currentSpeed > MOVING * motor.scale;
    let greet = false;
    if (this.greeting !== null) {
      if (!moving) this.greeting.waited += dt;
      const off =
        motor.faceYaw === null
          ? 0
          : Math.abs(wrapAngle(motor.faceYaw - root.yaw));
      if (off < GREET_TURN || this.greeting.waited >= GREET_WAIT) {
        greet = true;
        this.greeting = null;
      }
    }

    let cheer = false;
    if (this.cheering !== null && !moving && motor.goal.kind === "none") {
      // Standing, after any turn to what he arrived at: round to the Learner.
      motor.faceYaw = yawTo(root.pos, this.cheering.camera);
      this.cheering.waited += dt;
      const off = Math.abs(wrapAngle(motor.faceYaw - root.yaw));
      if (off < GREET_TURN || this.cheering.waited >= GREET_WAIT) {
        cheer = true;
        this.cheering = null;
      }
    }

    const corner = moving ? motor.heading() : null;
    const look =
      corner === null ? null : this.ahead.set(corner.x, LOOK_HEIGHT, corner.z);
    return {
      root,
      out,
      look,
      moving,
      travelling: motor.goal.kind !== "none" || moving,
      greet,
      cheer,
    };
  }
}

/** What Pip is doing, for the screens: on the move, else the director's Reaction or mode. */
export function activityOf(o: {
  moving: boolean;
  runWeight: number;
  greeting: boolean;
  mode: PipMode;
  reaction: PipReactionKind | null;
}): PipActivity {
  if (o.moving) return o.runWeight > RUNNING ? "running" : "walking";
  if (o.greeting || o.reaction === "greeting") return "greeting";
  if (o.reaction === "celebration") return "celebrating";
  switch (o.mode) {
    case "sleep":
      return "asleep";
    case "rest":
      return "resting";
    case "thinking":
      return "thinking";
    case "idle":
      return "idle";
  }
}
