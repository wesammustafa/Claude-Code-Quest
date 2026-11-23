// The 3D Pip's driver (seam S13): it plays a loaded model from the PipModel
// alone, as the Rive adapter plays the rig. The mode's clip loops and
// cross-fades into the next; a Reaction plays once, blended over the mode
// at its intensity, each part of Pip at its own share of it (see
// reactionShares); the gaze node turns toward the gaze over the rig's
// 150 ms ease; reduced motion holds the still pose at the resting gaze.
// Pure three.js, with no WebGL: the renderer calls it once a frame.
import {
  AnimationClip,
  AnimationMixer,
  Euler,
  LoopOnce,
  LoopRepeat,
  PropertyBinding,
  Quaternion,
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
} from "../../../../pip/model/contract";
import { NOD } from "../../../pip/reactions";

/** The rig's gaze ease (view-model.rml: EyesX and EyesY eased 150 ms), in seconds. */
export const GAZE_EASE_S = 0.15;
/** How far the gaze node turns at a gaze of 1, in radians: about 30 degrees across, 17 up and down. */
export const GAZE_TURN = { yaw: 0.52, pitch: 0.3 } as const;
/** A mode blends into the next, and a Reaction in and out, over the rig's 160 ms mix. */
export const BLEND_S = 0.16;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** The rig's ease-in-out (pip.rml's interpolator 0:780, a cubic 0.42, 0, 0.58, 1), close enough: a smoothstep. */
const ease = (t: number) => t * t * (3 - 2 * t);

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

const NO_SHARES: Record<PipPart, number> = {
  pose: 0,
  nod: 0,
  limbs: 0,
  shows: 0,
};

/** A clip split by part: each part's tracks as a clip of the whole clip's length. */
function splitClip(
  clip: AnimationClip,
  effects: ReadonlySet<string>,
): Map<PipPart, AnimationClip> {
  const out = new Map<PipPart, AnimationClip>();
  for (const part of PIP_PARTS) {
    const tracks = clip.tracks.filter(
      (track) =>
        partOf(PropertyBinding.parseTrackName(track.name).nodeName, effects) ===
        part,
    );
    if (tracks.length > 0)
      out.set(
        part,
        new AnimationClip(`${clip.name}:${part}`, clip.duration, tracks),
      );
  }
  return out;
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
}

export class PipDrive {
  private readonly mixer: AnimationMixer;
  /** Each mode's clip as one action per part, so a Reaction takes each part's own share. */
  private readonly modes = new Map<PipMode, Map<PipPart, AnimationAction>>();
  private readonly still: AnimationAction;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly parts = new Map<string, Map<PipPart, AnimationClip>>();
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
    actions: Map<PipPart, AnimationAction>;
    duration: number;
    at: number;
  } | null = null;
  private gaze = { x: 0, y: 0 };
  private gazeFrom = { x: 0, y: 0 };
  private gazeTo = { x: 0, y: 0 };
  /** Seconds into the gaze's ease; at GAZE_EASE_S or more it rests at gazeTo. */
  private gazeAt = GAZE_EASE_S;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    const effects = new Set<string>();
    root.getObjectByName(EFFECTS)?.traverse((o) => {
      if (o.name !== EFFECTS) effects.add(o.name);
    });
    for (const clip of clips) {
      this.clips.set(clip.name, clip);
      this.parts.set(clip.name, splitClip(clip, effects));
    }
    const gazeNode = root.getObjectByName(PIP_MODEL_GAZE);
    if (gazeNode === undefined) throw new Error(`no node ${PIP_MODEL_GAZE}`);
    this.gazeNode = gazeNode;
    this.gazeRest = gazeNode.quaternion.clone();
    for (const mode of PIP_MODES) {
      const actions = this.actions(mode);
      for (const action of actions.values()) {
        action.setLoop(LoopRepeat, Infinity);
        action.setEffectiveWeight(mode === this.mode ? 1 : 0).play();
      }
      this.modes.set(mode, actions);
      this.weights.set(mode, mode === this.mode ? 1 : 0);
    }
    const still = this.clips.get(PIP_MODEL_STILL);
    if (still === undefined) throw new Error(`no clip ${PIP_MODEL_STILL}`);
    this.still = this.mixer.clipAction(still);
    this.still.setEffectiveWeight(0).play();
    this.apply();
  }

  /** A clip's actions, one per part it moves. */
  private actions(name: string): Map<PipPart, AnimationAction> {
    const parts = this.parts.get(name);
    if (parts === undefined) throw new Error(`no clip ${name}`);
    const out = new Map<PipPart, AnimationAction>();
    for (const [part, clip] of parts)
      out.set(part, this.mixer.clipAction(clip));
    return out;
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
          for (const action of actions.values()) action.time = 0;
    }
    // As the Rive adapter reads it (rig.ts rigValues): clamped, and a null
    // gaze faces the Learner.
    const x = model.gaze === null ? 0 : clamp(model.gaze.x);
    const y = model.gaze === null ? 0 : clamp(model.gaze.y);
    if (this.reduced) {
      // Still: the resting gaze at once, with no ease.
      this.gaze = { x, y };
      this.gazeFrom = { x, y };
      this.gazeTo = { x, y };
      this.gazeAt = GAZE_EASE_S;
    } else if (x !== this.gazeTo.x || y !== this.gazeTo.y) {
      // A new gaze eases from where the node turns now, as the rig's does.
      this.gazeFrom = { ...this.gaze };
      this.gazeTo = { x, y };
      this.gazeAt = 0;
    }
  }

  /** Plays a Reaction once, at its intensity, over the mode. Under reduced motion it does not play. */
  react(playing: Playing): void {
    if (this.reduced) return;
    this.stopReaction();
    const clip = this.clips.get(playing.kind);
    if (clip === undefined) throw new Error(`no clip ${playing.kind}`);
    const actions = this.actions(playing.kind);
    for (const action of actions.values()) {
      action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(0).play();
      action.clampWhenFinished = true;
    }
    this.reaction = { playing, actions, duration: clip.duration, at: 0 };
  }

  private stopReaction(): void {
    if (this.reaction === null) return;
    for (const action of this.reaction.actions.values()) action.stop();
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
      for (const action of this.reaction.actions.values()) action.time = time;
    }
    this.mixer.update(this.hold || this.reduced ? 0 : step);
    this.turnGaze();
  }

  /** The actions' weights for this moment: the still pose alone, or each part of the modes under its share of the Reaction. */
  private apply(): void {
    this.still.setEffectiveWeight(this.reduced ? 1 : 0);
    const shares = this.reactionShares();
    for (const [mode, actions] of this.modes)
      for (const [part, action] of actions)
        action.setEffectiveWeight(
          this.reduced ? 0 : (this.weights.get(mode) ?? 0) * (1 - shares[part]),
        );
    if (this.reaction !== null)
      for (const [part, action] of this.reaction.actions)
        action.setEffectiveWeight(shares[part]);
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

  /** Whether anything moves without a new model: a blend, a Reaction, the gaze's ease, or a mode's loop. */
  moving(): boolean {
    if (this.reaction !== null || this.gazeAt < GAZE_EASE_S) return true;
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
    };
  }

  /** Stops every clip and gives back the mixer's caches. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
