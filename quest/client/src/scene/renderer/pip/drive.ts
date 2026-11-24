// The 3D Pip's driver (seam S13): it plays a loaded model from the PipModel
// alone, as the Rive adapter plays the rig. The mode's clip loops and
// cross-fades into the next; a Reaction plays once, blended over the mode
// at its intensity, each part of Pip at its own share of it (see
// reactionShares); the gaze node turns toward the gaze over the rig's
// 150 ms ease; while Pip travels the Journey's path he walks, turned three
// quarters toward where he goes; reduced motion holds the still pose at the
// resting gaze.
// Pure three.js, with no WebGL: the renderer calls it once a frame.
import {
  AnimationClip,
  AnimationMixer,
  Euler,
  LoopOnce,
  LoopRepeat,
  PropertyBinding,
  Quaternion,
  Vector3,
  type AnimationAction,
  type Object3D,
} from "three";
import {
  PIP_MODES,
  type PipMode,
  type PipModel,
  type PipReactionKind,
} from "../../../../pip/contract";
import {
  PIP_MODEL_GAZE,
  PIP_MODEL_STILL,
  PIP_MODEL_WALK,
} from "../../../../pip/model/contract";
import { NOD } from "../../../pip/reactions";

/** The rig's gaze ease (view-model.rml: EyesX and EyesY eased 150 ms), in seconds. */
export const GAZE_EASE_S = 0.15;
/** How far the gaze node turns at a gaze of 1, in radians: about 30 degrees across, 17 up and down. */
export const GAZE_TURN = { yaw: 0.52, pitch: 0.3 } as const;
/** A mode blends into the next, and a Reaction in and out, over the rig's 160 ms mix. */
export const BLEND_S = 0.16;

const UP = new Vector3(0, 1, 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** The rig's ease-in-out (pip.rml's interpolator 0:780, a cubic 0.42, 0, 0.58, 1), close enough: a smoothstep. */
const ease = (t: number) => t * t * (3 - 2 * t);

/** The walk blends in as Pip sets off, and out as he arrives, over this, in seconds. */
export const WALK_BLEND_S = 0.18;
/** How far Pip turns from the camera toward where he walks, in radians: a three-quarter turn, 60 degrees. */
export const WALK_TURN = Math.PI / 3;
/** The turn eases over this, in seconds, out as he sets off and back as he arrives. */
export const WALK_TURN_S = 0.24;
/** Where the gaze looks while Pip walks: straight ahead along his turned body. */
export const WALK_GAZE = { x: 0, y: 0 } as const;

/** Which way Pip walks across the page: -1 left, 1 right, 0 standing. */
export type WalkDirection = -1 | 0 | 1;

/** The longest step a frame advances Pip by, in seconds, after a stall. */
export const MAX_STEP = 1 / 20;
/** One frame, in seconds: the step of the first frame after Pip rested. */
export const REST_STEP = 1 / 60;

/**
 * How far a frame advances Pip, from the frame loop's `delta` and whether
 * he still moved at the end of the frame before. On a demand loop (the
 * phone tier) the first frame after a rest gets the whole rest as its
 * delta, so it advances by one frame instead, and a gaze or Reaction then
 * starts at the start of its ease rather than partway in.
 */
export function frameStep(delta: number, wasMoving: boolean): number {
  return wasMoving ? Math.min(delta, MAX_STEP) : REST_STEP;
}

/**
 * The parts of Pip a Reaction blends at shares of their own, so a soft
 * Reaction reads as a smaller version of itself, never as a half-made pose:
 * `pose` the body, head and eyes; `nod` the head's and body's bob (Hop,
 * Neck, HeadPose); `limbs` the arms and hands; `shows` the parts that pop
 * in and out by scale (the mouths, cheeks, catchlights and every effect).
 */
export const PIP_PARTS = ["pose", "nod", "limbs", "shows"] as const;
export type PipPart = (typeof PIP_PARTS)[number];

/** A nod's bob plays at this share, about 2.5 times NOD's, so it reads as a nod. */
export const NOD_BOB = 0.5;

const NODDING = new Set(["Hop", "Neck", "HeadPose"]);
const LIMB = /^(Arm|UpperArm|Hand|Pointer)/;
const SHOWN = new Set([
  "MouthSmile",
  "MouthOpen",
  "MouthO",
  "MouthHmm",
  "CheekLeft",
  "CheekRight",
  "CatchlightLeft",
  "CatchlightRight",
]);
/** The node every effect hangs under. */
const EFFECTS = "Effects";

/** The part a node's tracks belong to; `effects` names every node under Effects. */
export function partOf(node: string, effects: ReadonlySet<string>): PipPart {
  if (SHOWN.has(node) || effects.has(node)) return "shows";
  if (LIMB.test(node)) return "limbs";
  if (NODDING.has(node)) return "nod";
  return "pose";
}

const smoothstep = (lo: number, hi: number, v: number) => {
  const u = clamp01((v - lo) / (hi - lo));
  return u * u * (3 - 2 * u);
};

/**
 * Each part's share of the pose for a Reaction at `intensity`, once
 * blended in. The pose follows the intensity; a nod (NOD or less) bobs at
 * NOD_BOB; the arms join only from 0.3 and are fully up from 0.7, so a soft
 * Reaction never half-raises them into a shrug; and a part that shows by
 * scale shows whole from 0.5 or not at all, so two mouths never overlap.
 */
export function reactionShares(intensity: number): Record<PipPart, number> {
  const i = clamp01(intensity);
  return {
    pose: i,
    nod: i <= NOD ? (NOD_BOB * i) / NOD : i,
    limbs: smoothstep(0.3, 0.7, i),
    shows: i >= 0.5 ? 1 : 0,
  };
}

/**
 * The walk's own nodes, which no mode or Reaction keys: the body's bob and
 * sway, the legs and the feet. They keep stepping under a Reaction, which
 * takes only the parts it moves (the arms, head and antennas) at its shares.
 */
const STRIDE = /^(Body$|Leg|Foot)/;

const NO_SHARES: Record<PipPart, number> = {
  pose: 0,
  nod: 0,
  limbs: 0,
  shows: 0,
};

/**
 * A group of a clip's tracks: its part, or `stride` for the walk's own
 * nodes; and whether the walk keys its nodes too, so the walk takes them
 * over as it blends in.
 */
interface Group {
  part: PipPart | "stride";
  walked: boolean;
}

/** A clip split into groups: each group's tracks as a clip of the whole clip's length. */
function splitClip(
  clip: AnimationClip,
  effects: ReadonlySet<string>,
  walked: ReadonlySet<string>,
): Map<string, { group: Group; clip: AnimationClip }> {
  const out = new Map<string, { group: Group; clip: AnimationClip }>();
  const groups = new Map<
    string,
    { group: Group; tracks: typeof clip.tracks }
  >();
  for (const track of clip.tracks) {
    const node = PropertyBinding.parseTrackName(track.name).nodeName;
    const group: Group = {
      part: STRIDE.test(node) ? "stride" : partOf(node, effects),
      walked: walked.has(node),
    };
    const key = `${group.part}${group.walked ? ":walked" : ""}`;
    const entry = groups.get(key) ?? { group, tracks: [] };
    entry.tracks.push(track);
    groups.set(key, entry);
  }
  for (const [key, { group, tracks }] of groups)
    out.set(key, {
      group,
      clip: new AnimationClip(`${clip.name}:${key}`, clip.duration, tracks),
    });
  return out;
}

/** The nodes a clip keys. */
const nodesOf = (clip: AnimationClip) =>
  new Set(
    clip.tracks.map((t) => PropertyBinding.parseTrackName(t.name).nodeName),
  );

/** An action of one group of a clip. */
interface GroupAction {
  group: Group;
  action: AnimationAction;
}

/** A Reaction as the driver plays it. */
export interface Playing {
  id: string;
  kind: PipReactionKind;
  intensity: number;
}

/** What the driver shows now, for the page's marks and the tests. */
export interface Driven {
  mode: PipMode;
  /** The Reaction playing, until its clip ends. */
  reaction: Playing | null;
  /** The gaze the node shows now, and the one it eases toward. */
  gaze: { x: number; y: number };
  gazeTo: { x: number; y: number };
  /** Reduced motion: the still pose. */
  still: boolean;
  /** Which way Pip walks while the walk shows at all, blending out included; 0 standing. */
  walk: WalkDirection;
  /** The walk's share of the pose now. */
  walkShare: number;
  /** How far Pip is turned toward where he walks, in radians (+ toward the page's right). */
  turn: number;
}

export class PipDrive {
  private readonly mixer: AnimationMixer;
  /** Each mode's clip as one action per group, so a Reaction takes each part's own share and the walk the parts it moves. */
  private readonly modes = new Map<PipMode, GroupAction[]>();
  private readonly still: AnimationAction;
  private readonly walkActions: GroupAction[];
  private readonly walkLength: number;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly groups = new Map<
    string,
    Map<string, { group: Group; clip: AnimationClip }>
  >();
  private readonly root: Object3D;
  private readonly rootRest: Quaternion;
  private readonly turnNow = new Quaternion();
  private readonly gazeNode: Object3D;
  private readonly gazeRest: Quaternion;
  private readonly turnBy = new Quaternion();
  private readonly euler = new Euler(0, 0, 0, "YXZ");

  private mode: PipMode = "idle";
  /** Each mode clip's share of the pose before a Reaction takes its part. */
  private readonly weights = new Map<PipMode, number>();
  private reduced = false;
  private hold = false;
  private reaction: {
    playing: Playing;
    actions: GroupAction[];
    duration: number;
    at: number;
  } | null = null;
  /** The way Pip is told he walks, the way the walk shows, its weight (0 to 1) and its own clock. */
  private walkTo: WalkDirection = 0;
  private walking: WalkDirection = 0;
  private walkWeight = 0;
  private walkAt = 0;
  /** The turn toward where he walks, eased like the gaze: from, to, and seconds in. */
  private turn = 0;
  private turnFrom = 0;
  private turnTo = 0;
  private turnAt = WALK_TURN_S;
  /** The gaze the director asks for, which the walk's gaze stands in for while he walks. */
  private asked = { x: 0, y: 0 };
  private gaze = { x: 0, y: 0 };
  private gazeFrom = { x: 0, y: 0 };
  private gazeTo = { x: 0, y: 0 };
  /** Seconds into the gaze's ease; at GAZE_EASE_S or more it rests at gazeTo. */
  private gazeAt = GAZE_EASE_S;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    this.root = root;
    this.rootRest = root.quaternion.clone();
    const effects = new Set<string>();
    root.getObjectByName(EFFECTS)?.traverse((o) => {
      if (o.name !== EFFECTS) effects.add(o.name);
    });
    const walk = clips.find((c) => c.name === PIP_MODEL_WALK);
    if (walk === undefined) throw new Error(`no clip ${PIP_MODEL_WALK}`);
    const walked = nodesOf(walk);
    for (const clip of clips) {
      this.clips.set(clip.name, clip);
      this.groups.set(clip.name, splitClip(clip, effects, walked));
    }
    const gazeNode = root.getObjectByName(PIP_MODEL_GAZE);
    if (gazeNode === undefined) throw new Error(`no node ${PIP_MODEL_GAZE}`);
    this.gazeNode = gazeNode;
    this.gazeRest = gazeNode.quaternion.clone();
    for (const mode of PIP_MODES) {
      const actions = this.actions(mode);
      for (const { action } of actions) {
        action.setLoop(LoopRepeat, Infinity);
        action.setEffectiveWeight(mode === this.mode ? 1 : 0).play();
      }
      this.modes.set(mode, actions);
      this.weights.set(mode, mode === this.mode ? 1 : 0);
    }
    this.walkActions = this.actions(PIP_MODEL_WALK);
    this.walkLength = walk.duration;
    // Paused: the walk keeps its own clock (update sets its time).
    for (const { action } of this.walkActions) {
      action.setLoop(LoopRepeat, Infinity).setEffectiveWeight(0).play();
      action.paused = true;
    }
    const still = this.clips.get(PIP_MODEL_STILL);
    if (still === undefined) throw new Error(`no clip ${PIP_MODEL_STILL}`);
    this.still = this.mixer.clipAction(still);
    this.still.setEffectiveWeight(0).play();
    this.apply();
  }

  /** A clip's actions, one per group of the parts it moves. */
  private actions(name: string): GroupAction[] {
    const groups = this.groups.get(name);
    if (groups === undefined) throw new Error(`no clip ${name}`);
    return [...groups.values()].map(({ group, clip }) => ({
      group,
      action: this.mixer.clipAction(clip),
    }));
  }

  /**
   * Takes the model's mode, gaze and reduced motion. `hold` keeps each
   * mode on its clip's first frame (the phone tier, which draws only when
   * something moves): a mode change still blends, a Reaction still plays.
   */
  set(model: PipModel, hold: boolean): void {
    this.mode = model.mode;
    this.reduced = model.reducedMotion;
    if (hold !== this.hold) {
      this.hold = hold;
      if (hold)
        for (const actions of this.modes.values())
          for (const { action } of actions) action.time = 0;
    }
    // As the Rive adapter reads it (rig.ts rigValues): clamped, and a null
    // gaze faces the Learner.
    this.asked = {
      x: model.gaze === null ? 0 : clamp(model.gaze.x),
      y: model.gaze === null ? 0 : clamp(model.gaze.y),
    };
    if (this.reduced) {
      // Still: no walk and no turn, and the resting gaze, all at once.
      this.walkTo = 0;
      this.walking = 0;
      this.walkWeight = 0;
      this.turn = 0;
      this.turnFrom = 0;
      this.turnTo = 0;
      this.turnAt = WALK_TURN_S;
      const { x, y } = this.asked;
      this.gaze = { x, y };
      this.gazeFrom = { x, y };
      this.gazeTo = { x, y };
      this.gazeAt = GAZE_EASE_S;
    } else this.aim();
  }

  /**
   * Takes which way Pip travels the path now: he walks while it is not 0,
   * turned toward it, and stands once it is. Under reduced motion he never
   * walks or turns.
   */
  walk(direction: WalkDirection): void {
    if (this.reduced || direction === this.walkTo) return;
    this.walkTo = direction;
    if (direction !== 0) {
      // Setting off from a stand, he steps at once: the clip starts on a toe-off.
      if (this.walkWeight === 0) this.walkAt = 0;
      this.walking = direction;
    }
    this.turnFrom = this.turn;
    this.turnTo = direction * WALK_TURN;
    this.turnAt = 0;
    this.aim();
  }

  /** Eases the gaze toward where it should look: ahead while he walks, else where the director asks. */
  private aim(): void {
    const { x, y } = this.walkTo === 0 ? this.asked : WALK_GAZE;
    if (x === this.gazeTo.x && y === this.gazeTo.y) return;
    // A new gaze eases from where the node turns now, as the rig's does.
    this.gazeFrom = { ...this.gaze };
    this.gazeTo = { x, y };
    this.gazeAt = 0;
  }

  /** Plays a Reaction once, at its intensity, over the mode. Under reduced motion it does not play. */
  react(playing: Playing): void {
    if (this.reduced) return;
    this.stopReaction();
    const clip = this.clips.get(playing.kind);
    if (clip === undefined) throw new Error(`no clip ${playing.kind}`);
    const actions = this.actions(playing.kind);
    for (const { action } of actions) {
      action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(0).play();
      action.clampWhenFinished = true;
    }
    this.reaction = { playing, actions, duration: clip.duration, at: 0 };
  }

  private stopReaction(): void {
    if (this.reaction === null) return;
    for (const { action } of this.reaction.actions) action.stop();
    this.reaction = null;
  }

  /** Advances by `dt` seconds. */
  update(dt: number): void {
    const step = Math.max(0, dt);
    // The modes blend toward the one held.
    for (const mode of PIP_MODES) {
      const target = mode === this.mode ? 1 : 0;
      const now = this.weights.get(mode) ?? 0;
      const moved =
        target > now
          ? Math.min(target, now + step / BLEND_S)
          : Math.max(target, now - step / BLEND_S);
      this.weights.set(mode, this.reduced ? target : moved);
    }
    if (this.reaction !== null) {
      this.reaction.at += step;
      if (this.reduced || this.reaction.at >= this.reaction.duration)
        this.stopReaction();
    }
    // The walk blends toward whether he walks, and its clip runs while it shows.
    const walkTarget = this.walkTo === 0 ? 0 : 1;
    this.walkWeight =
      walkTarget > this.walkWeight
        ? Math.min(1, this.walkWeight + step / WALK_BLEND_S)
        : Math.max(0, this.walkWeight - step / WALK_BLEND_S);
    if (this.walkWeight === 0 && this.walkTo === 0) this.walking = 0;
    else this.walkAt = (this.walkAt + step) % this.walkLength;
    this.turnAt = Math.min(WALK_TURN_S, this.turnAt + step);
    this.turn =
      this.turnFrom +
      (this.turnTo - this.turnFrom) * ease(clamp01(this.turnAt / WALK_TURN_S));
    this.gazeAt = Math.min(GAZE_EASE_S, this.gazeAt + step);
    const t = ease(clamp01(this.gazeAt / GAZE_EASE_S));
    this.gaze = {
      x: this.gazeFrom.x + (this.gazeTo.x - this.gazeFrom.x) * t,
      y: this.gazeFrom.y + (this.gazeTo.y - this.gazeFrom.y) * t,
    };
    this.apply();
    // Holding, the mixer's clock stands still and the modes keep their first
    // frame; a Reaction runs on its own clock, so it plays whole there too.
    if (this.hold && this.reaction !== null) {
      const time = Math.min(this.reaction.at, this.reaction.duration);
      for (const { action } of this.reaction.actions) action.time = time;
    }
    // The walk runs on its own clock too, so he walks on the phone as well.
    for (const { action } of this.walkActions) action.time = this.walkAt;
    this.mixer.update(this.hold || this.reduced ? 0 : step);
    this.turnGaze();
    this.turnNow.setFromAxisAngle(UP, this.turn);
    this.root.quaternion.copy(this.rootRest).multiply(this.turnNow);
  }

  /**
   * The actions' weights for this moment: the still pose alone, or each
   * group of the modes under its share of the walk and of the Reaction. The
   * walk takes the parts it moves from the mode, and a Reaction takes its
   * parts from both, so a Reaction that arrives mid-walk plays on his upper
   * body while his legs keep walking.
   */
  private apply(): void {
    this.still.setEffectiveWeight(this.reduced ? 1 : 0);
    const shares = this.reactionShares();
    const share = (g: Group) => (g.part === "stride" ? 0 : shares[g.part]);
    const walk = this.reduced ? 0 : ease(this.walkWeight);
    for (const [mode, actions] of this.modes)
      for (const { group, action } of actions)
        action.setEffectiveWeight(
          this.reduced
            ? 0
            : (this.weights.get(mode) ?? 0) *
                (1 - share(group)) *
                (group.walked ? 1 - walk : 1),
        );
    for (const { group, action } of this.walkActions)
      action.setEffectiveWeight(walk * (1 - share(group)));
    if (this.reaction !== null)
      for (const { group, action } of this.reaction.actions)
        action.setEffectiveWeight(share(group));
  }

  /** Each part's share of the pose: the Reaction's shares at its intensity, blended in and out over BLEND_S. */
  private reactionShares(): Record<PipPart, number> {
    if (this.reaction === null || this.reduced) return NO_SHARES;
    const { at, duration, playing } = this.reaction;
    const blend = ease(
      clamp01(Math.min(at / BLEND_S, (duration - at) / BLEND_S)),
    );
    const full = reactionShares(playing.intensity);
    return {
      pose: full.pose * blend,
      nod: full.nod * blend,
      limbs: full.limbs * blend,
      shows: full.shows * blend,
    };
  }

  /** A mode's share of the pose now, blending in and out; none under reduced motion, which holds the still pose. */
  modeShare(mode: PipMode): number {
    return this.reduced ? 0 : (this.weights.get(mode) ?? 0);
  }

  private turnGaze(): void {
    this.euler.set(
      this.gaze.y * GAZE_TURN.pitch,
      this.gaze.x * GAZE_TURN.yaw,
      0,
    );
    this.turnBy.setFromEuler(this.euler);
    this.gazeNode.quaternion.copy(this.gazeRest).multiply(this.turnBy);
  }

  /** Whether anything moves without a new model: a blend, a Reaction, the gaze's ease, the walk and its turn, or a mode's loop. */
  moving(): boolean {
    if (this.reaction !== null || this.gazeAt < GAZE_EASE_S) return true;
    if (this.walking !== 0 || this.turnAt < WALK_TURN_S) return true;
    for (const mode of PIP_MODES)
      if ((this.weights.get(mode) ?? 0) !== (mode === this.mode ? 1 : 0))
        return true;
    return !this.hold && !this.reduced;
  }

  state(): Driven {
    return {
      mode: this.mode,
      reaction: this.reaction?.playing ?? null,
      gaze: { ...this.gaze },
      gazeTo: { ...this.gazeTo },
      still: this.reduced,
      walk: this.walking,
      walkShare: this.reduced ? 0 : ease(this.walkWeight),
      turn: this.turn,
    };
  }

  /** Stops every clip and gives back the mixer's caches. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
