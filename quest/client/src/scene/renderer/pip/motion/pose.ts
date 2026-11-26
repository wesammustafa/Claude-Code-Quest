// Pip's stride over the guide's driver (D6): a pass after PipDrive each
// frame, which gives back what it moved before the driver runs again. The
// driver plays the director's mode and Reaction from the clips; this pass
// then stands him in the room and lays the steps over that pose,
// as much as he moves: his feet where the gait planted them, his legs after
// them, his arms swinging against them, his body bobbing, leaning into the
// run and swaying over the standing foot, and his antennas lagging the
// bounce. Standing still, the clips' pose shows whole, so a Greeting plays
// as the driver plays it; while he travels he looks where he goes, and
// standing, the director's gaze holds. Pure three.js, with no WebGL.
import {
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import {
  PIP_MODEL_GAZE,
  PIP_MODEL_HEAD,
  PIP_MODEL_STRIDE,
} from "../../../../../pip/model/contract";
import {
  restSpot,
  wrapAngle,
  type Gait,
  type GaitOutput,
  type RootState,
  type Side,
} from "./gait";

type Part = (typeof PIP_MODEL_STRIDE)[number];

interface Pose {
  p: Vector3;
  q: Quaternion;
  s: Vector3;
}

/** What the pass needs from the frame beside the gait. */
export interface StrideFrame {
  root: RootState;
  gait: Gait;
  out: GaitOutput;
  /** Where he looks while he travels, in the world; null looks ahead. */
  look: Vector3 | null;
  /** A Reaction plays, so the arms swing less under it. */
  reacting: boolean;
}

/** The parts whose place the stride moves; it turns every part. */
const PLACED: ReadonlySet<Part> = new Set<Part>([
  "Hop",
  "Body",
  "LegLeft",
  "LegRight",
  "FootLeft",
  "FootRight",
]);

/** He stirs once he goes this fast, in his heights a second, or turns this fast, in radians a second. */
const STIRS = { speed: 1e-3, turn: 1e-2 } as const;

/** Within this of the gait's, in his heights, the clips' feet hand over at once: the gait's own settling reach. */
const FEET_MEET = 0.03;

const footOf = (side: Side) => (side === 1 ? "FootLeft" : "FootRight");

/** How far the travelling gaze turns: about 60 degrees to either side, and up or down a little. */
const GAZE_REACH = { yaw: 1.05, up: 0.5, down: 0.45 } as const;

const UP = new Vector3(0, 1, 0);
const v = new Vector3();
const v2 = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const e = new Euler();
const turn = new Euler(0, 0, 0, "YXZ");
const bodyQ = new Quaternion();

export class StridePose {
  private readonly nodes = new Map<Part, Object3D>();
  private readonly rest = new Map<Part, Pose>();
  private readonly clip = new Map<Part, Pose>();
  private readonly gaze: Object3D;
  private readonly gazeRest: Quaternion;
  /** The gaze node as the driver turned it this frame. */
  private readonly gazeFrom = new Quaternion();
  private readonly head: Object3D;
  /** Where the gait stands each foot this frame, in the body's frame: the left, then the right. */
  private readonly feetAt = [new Vector3(), new Vector3()] as const;
  /** Where the clips' feet stand this frame, in the body's frame: as the clips alone stand him, as far off rest as the gait stood them. */
  private readonly feetHeld = [new Vector3(), new Vector3()] as const;
  /** The body as the clips alone place it this frame, before the stride. */
  private readonly clipBody = new Matrix4();
  private readonly clipBodyQ = new Quaternion();
  private bodyW = 0;
  private footW = 0;
  private lean = 0;
  private bank = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private antenna = { a: 0, v: 0 };
  private lastLift = 0;
  private lastLiftV = 0;

  /** Takes the model's parts as they stand now, at rest. */
  constructor(model: Object3D) {
    for (const name of PIP_MODEL_STRIDE) {
      const node = model.getObjectByName(name);
      if (node === undefined) throw new Error(`no node ${name}`);
      this.nodes.set(name, node);
      this.rest.set(name, {
        p: node.position.clone(),
        q: node.quaternion.clone(),
        s: node.scale.clone(),
      });
      this.clip.set(name, {
        p: node.position.clone(),
        q: node.quaternion.clone(),
        s: node.scale.clone(),
      });
    }
    const gaze = model.getObjectByName(PIP_MODEL_GAZE);
    if (gaze === undefined) throw new Error(`no node ${PIP_MODEL_GAZE}`);
    this.gaze = gaze;
    this.gazeRest = gaze.quaternion.clone();
    const head = model.getObjectByName(PIP_MODEL_HEAD);
    if (head === undefined) throw new Error(`no node ${PIP_MODEL_HEAD}`);
    this.head = head;
  }

  private node(name: Part): Object3D {
    const node = this.nodes.get(name);
    if (node === undefined) throw new Error(`no node ${name}`);
    return node;
  }

  private restOf(name: Part): Pose {
    const pose = this.rest.get(name);
    if (pose === undefined) throw new Error(`no node ${name}`);
    return pose;
  }

  private clipOf(name: Part): Pose {
    const pose = this.clip.get(name);
    if (pose === undefined) throw new Error(`no node ${name}`);
    return pose;
  }

  /**
   * Before the driver: what this pass moved last frame back as the clips
   * left it (at rest before the first frame), so the stride never builds
   * on itself. Not to rest: the mixer writes a part only when its clip's
   * value changes, so a part a held pose keeps still (sleep's arms, or
   * every part on the phone, whose mixer clock stands) would show rest.
   * Only what the stride writes comes back: each part's turn, the places
   * of Hop, Body, the legs and feet, and Hop's squash. In the model those
   * are keyed by a clip that always plays (a mode, the still pose or the
   * walk) or by none, so no Reaction starting or stopping writes them
   * between frames; an arm's place, which only Reactions key, the mixer
   * puts back itself when one stops.
   */
  restore(): void {
    for (const name of PIP_MODEL_STRIDE) {
      const node = this.node(name);
      const clip = this.clipOf(name);
      node.quaternion.copy(clip.q);
      if (PLACED.has(name)) node.position.copy(clip.p);
    }
    this.node("Hop").scale.copy(this.clipOf("Hop").s);
  }

  /** How much of the pose is the stride's now: 0 standing, 1 on the move. */
  weight(): number {
    return this.bodyW;
  }

  /**
   * After the driver: stands `container` at his place on the floor, turned
   * his way, and lays the stride over the clips' pose.
   */
  apply(dt: number, container: Object3D, f: StrideFrame): void {
    const { root, gait, out } = f;
    for (const name of PIP_MODEL_STRIDE) {
      const node = this.node(name);
      const clip = this.clipOf(name);
      clip.p.copy(node.position);
      clip.q.copy(node.quaternion);
      clip.s.copy(node.scale);
    }
    this.gazeFrom.copy(this.gaze.quaternion);

    container.position.set(root.pos.x, 0, root.pos.z);
    container.quaternion.setFromAxisAngle(UP, root.yaw);
    const body = this.node("Body");
    container.updateMatrixWorld(true);
    this.clipBody.copy(body.matrixWorld);
    body.getWorldQuaternion(this.clipBodyQ);
    const scale = gait.scale;
    const speed = Math.hypot(root.vel.x, root.vel.z) / scale;
    const k = (rate: number) => 1 - Math.exp(-rate * dt);
    this.bodyW += (Math.min(1, speed / 0.3) - this.bodyW) * k(8);
    const bw = this.bodyW;
    const rw = out.runWeight;

    // The body: the bob, flight and squash on Hop, lean and bank on Lean,
    // sway and twist on Body.
    const hop = this.node("Hop");
    hop.position.y = MathUtils.lerp(
      hop.position.y,
      this.restOf("Hop").p.y + out.lift / scale,
      bw,
    );
    const sq = MathUtils.lerp(1, out.squash, bw);
    hop.scale.set(
      hop.scale.x / Math.sqrt(sq),
      hop.scale.y * sq,
      hop.scale.z / Math.sqrt(sq),
    );

    const leanTarget =
      0.05 * Math.min(1, speed) +
      0.13 * rw +
      MathUtils.clamp(root.accel / scale, -3, 3) * 0.03;
    const bankTarget = MathUtils.clamp(
      -root.yawRate * speed * 0.05,
      -0.18,
      0.18,
    );
    this.lean += (leanTarget - this.lean) * k(6);
    this.bank += (bankTarget - this.bank) * k(6);
    q.setFromEuler(e.set(this.lean * bw, 0, this.bank * bw));
    this.node("Lean").quaternion.multiply(q);

    body.position.x += out.sway / scale;
    const twist =
      0.12 * (out.swingLeft - out.swingRight) * 0.5 * (1 + rw * 0.5);
    q.setFromAxisAngle(UP, twist * bw);
    body.quaternion.multiply(q);

    // The arms swing against the legs: the left arm forward with the right
    // foot, with a small outward pump on the forward swing so it reads
    // head-on too; the hands trail the swing, and tuck in at a run.
    const swing = (out.swingLeft - out.swingRight) * 0.5;
    const amp = 0.85 + 0.55 * rw;
    const armW = bw * (f.reacting ? 0.35 : 1);
    for (const [arm, hand, sign] of [
      ["ArmLeft", "HandLeft", 1],
      ["ArmRight", "HandRight", -1],
    ] as const) {
      const pump = 0.18 * Math.max(0, sign * swing) * (1 + rw);
      q.setFromEuler(e.set(sign * amp * swing, 0, -sign * (0.35 * rw + pump)));
      q2.copy(this.restOf(arm).q).multiply(q);
      this.node(arm).quaternion.copy(this.clipOf(arm).q).slerp(q2, armW);
      q.setFromEuler(e.set(sign * 0.25 * amp * swing, 0, -sign * 0.5 * rw));
      q2.copy(this.restOf(hand).q).multiply(q);
      this.node(hand).quaternion.slerp(q2, armW);
    }

    // The neck keeps the head steadier than the body.
    const neck = this.node("Neck");
    q.setFromEuler(
      e.set(-this.lean * 0.55 * bw, -twist * 0.6 * bw, -this.bank * 0.4 * bw),
    );
    neck.quaternion.multiply(q);

    // The feet: planted in the world, brought into the body's frame; each
    // leg's stub follows its foot. Standing, the clips have them back:
    // each where the clips alone would stand it, never riding the stride's
    // lean and bob as those fade, and as far off its rest as the gait
    // stood it (the gait leaves a foot a little off rather than shuffle
    // it), so handing a foot over never slides it, and a Reaction's hop
    // still lifts them. They are the gait's from the moment he moves or
    // turns, before its first step: at once where the clips' feet stand by
    // the gait's, as they do from a stand, else eased in, as from a hop.
    container.updateMatrixWorld(true);
    body.getWorldQuaternion(bodyQ).invert();
    const feet = [
      [gait.feet[0], this.feetAt[0], this.feetHeld[0]],
      [gait.feet[1], this.feetAt[1], this.feetHeld[1]],
    ] as const;
    let apart = 0;
    for (const [foot, at, held] of feet) {
      at.copy(foot.pos);
      body.worldToLocal(at);
      held
        .copy(this.clipOf(footOf(foot.side)).p)
        .applyMatrix4(this.clipBody)
        .add(foot.pos)
        .sub(restSpot(root, foot.side, scale));
      body.worldToLocal(held);
      apart = Math.max(apart, at.distanceTo(held));
    }
    const stirs =
      out.stepping > 0 ||
      speed > STIRS.speed ||
      Math.abs(root.yawRate) > STIRS.turn;
    if (!stirs) this.footW -= this.footW * k(5);
    else if (apart < FEET_MEET * scale) this.footW = 1;
    else this.footW += (1 - this.footW) * k(30);
    for (const [foot, at, held] of feet) {
      const footName = footOf(foot.side);
      const legName = foot.side === 1 ? "LegLeft" : "LegRight";
      const node = this.node(footName);
      const footClip = this.clipOf(footName);
      node.position.copy(held).lerp(at, this.footW);
      q.setFromAxisAngle(UP, foot.yaw);
      q2.setFromEuler(e.set(foot.pitch, 0, 0));
      q.multiply(q2).premultiply(bodyQ);
      q2.setFromAxisAngle(UP, wrapAngle(foot.yaw - root.yaw))
        .multiply(this.clipBodyQ)
        .multiply(footClip.q)
        .premultiply(bodyQ);
      node.quaternion.copy(q2).slerp(q, this.footW);

      // Each leg after its foot: the gait's from rest, the clips' from theirs.
      const leg = this.node(legName);
      const legRest = this.restOf(legName);
      const legClip = this.clipOf(legName);
      const off = held.sub(footClip.p);
      const d = v.copy(at).sub(this.restOf(footName).p);
      leg.position
        .set(
          legRest.p.x + d.x * 0.8,
          legRest.p.y + d.y * 0.55,
          legRest.p.z + d.z * 0.7,
        )
        .lerp(
          v2.set(
            legClip.p.x + off.x * 0.8,
            legClip.p.y + off.y * 0.55,
            legClip.p.z + off.z * 0.7,
          ),
          1 - this.footW,
        );
      q.setFromEuler(e.set(MathUtils.clamp(d.z * 3.2, -0.6, 0.6), 0, 0));
      q2.setFromEuler(e.set(MathUtils.clamp(off.z * 3.2, -0.6, 0.6), 0, 0));
      leg.quaternion
        .copy(legRest.q)
        .multiply(q)
        .slerp(q2.premultiply(legClip.q), 1 - this.footW);
    }

    // The antennas lag his bounce and his turns.
    const step = Math.max(dt, 1e-4);
    const liftV = (out.lift - this.lastLift) / step;
    const liftA = (liftV - this.lastLiftV) / step;
    this.lastLift = out.lift;
    this.lastLiftV = liftV;
    const force =
      -MathUtils.clamp(liftA, -40, 40) * 0.004 * bw -
      root.yawRate * 0.02 -
      this.antenna.a * 160;
    this.antenna.v += force * dt;
    this.antenna.v *= Math.exp(-dt * 9);
    this.antenna.a = MathUtils.clamp(
      this.antenna.a + this.antenna.v * dt,
      -0.5,
      0.5,
    );
    for (const [name, sign] of [
      ["AntennaLeft", 1],
      ["AntennaRight", -1],
    ] as const) {
      q.setFromEuler(
        e.set(this.antenna.a * 0.8, 0, sign * this.antenna.a * 0.5),
      );
      this.node(name).quaternion.multiply(q);
    }

    // The gaze: toward where he goes, as much as he moves; standing, the
    // director's, as the driver turned it.
    let yaw = 0;
    let pitch = 0;
    if (f.look !== null) {
      neck.updateMatrixWorld(true);
      v.copy(f.look);
      neck.worldToLocal(v);
      v.y -= 0.3;
      yaw = MathUtils.clamp(
        Math.atan2(v.x, v.z),
        -GAZE_REACH.yaw,
        GAZE_REACH.yaw,
      );
      pitch = MathUtils.clamp(
        -Math.atan2(v.y, Math.hypot(v.x, v.z)),
        -GAZE_REACH.up,
        GAZE_REACH.down,
      );
    }
    this.lookYaw += (yaw - this.lookYaw) * k(9);
    this.lookPitch += (pitch - this.lookPitch) * k(9);
    q.setFromEuler(turn.set(this.lookPitch, this.lookYaw, 0));
    q2.copy(this.gazeRest).multiply(q);
    this.gaze.quaternion.copy(this.gazeFrom).slerp(q2, bw);
  }

  /** How high Hop lifts him over its rest, in his heights: a hop's, a bob's or a run's flight. */
  hopLift(): number {
    return this.node("Hop").position.y - this.restOf("Hop").p.y;
  }

  /** Where his head is in the world. */
  headWorld(target: Vector3): Vector3 {
    return this.head.getWorldPosition(target);
  }

  /** Where a foot is drawn in the world (side 1 his left), as the model shows it after the stride. */
  footWorld(side: Side, target: Vector3): Vector3 {
    return this.node(footOf(side)).getWorldPosition(target);
  }
}
