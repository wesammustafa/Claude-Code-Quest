// The 3D Pip's driver (seam S13): it plays a loaded model from the PipModel
// alone, as the Rive adapter plays the rig. The mode's clip loops and
// cross-fades into the next; a Reaction plays once, blended over the mode
// at its intensity; the gaze node turns toward the gaze over the rig's
// 150 ms ease; reduced motion holds the still pose at the resting gaze.
// Pure three.js, with no WebGL: the renderer calls it once a frame.
import {
  AnimationMixer,
  Euler,
  LoopOnce,
  LoopRepeat,
  Quaternion,
  type AnimationAction,
  type AnimationClip,
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

/** The rig's gaze ease (view-model.rml: EyesX and EyesY eased 150 ms), in seconds. */
export const GAZE_EASE_S = 0.15;
/** How far the gaze node turns at a gaze of 1, in radians: about 30 degrees across, 17 up and down. */
export const GAZE_TURN = { yaw: 0.52, pitch: 0.3 } as const;
/** A mode blends into the next, and a Reaction in and out, over the rig's 160 ms mix. */
export const BLEND_S = 0.16;

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** The rig's ease-in-out (pip.rml's interpolator 0:780, a cubic 0.42, 0, 0.58, 1), close enough: a smoothstep. */
const ease = (t: number) => t * t * (3 - 2 * t);

export class PipDrive {
  private readonly mixer: AnimationMixer;
  private readonly modes = new Map<PipMode, AnimationAction>();
  private readonly still: AnimationAction;
  private readonly clips = new Map<string, AnimationClip>();
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
    action: AnimationAction;
    at: number;
  } | null = null;
  private gaze = { x: 0, y: 0 };
  private gazeFrom = { x: 0, y: 0 };
  private gazeTo = { x: 0, y: 0 };
  /** Seconds into the gaze's ease; at GAZE_EASE_S or more it rests at gazeTo. */
  private gazeAt = GAZE_EASE_S;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) this.clips.set(clip.name, clip);
    const gazeNode = root.getObjectByName(PIP_MODEL_GAZE);
    if (gazeNode === undefined) throw new Error(`no node ${PIP_MODEL_GAZE}`);
    this.gazeNode = gazeNode;
    this.gazeRest = gazeNode.quaternion.clone();
    for (const mode of PIP_MODES) {
      const action = this.action(mode);
      action.setLoop(LoopRepeat, Infinity);
      action.setEffectiveWeight(mode === this.mode ? 1 : 0).play();
      this.modes.set(mode, action);
      this.weights.set(mode, mode === this.mode ? 1 : 0);
    }
    this.still = this.action(PIP_MODEL_STILL);
    this.still.setEffectiveWeight(0).play();
    this.apply();
  }

  private action(name: string): AnimationAction {
    const clip = this.clips.get(name);
    if (clip === undefined) throw new Error(`no clip ${name}`);
    return this.mixer.clipAction(clip);
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
      if (hold) for (const action of this.modes.values()) action.time = 0;
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
    this.reaction?.action.stop();
    const action = this.action(playing.kind);
    action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(0).play();
    action.clampWhenFinished = true;
    this.reaction = { playing, action, at: 0 };
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
      if (
        this.reduced ||
        this.reaction.at >= this.reaction.action.getClip().duration
      ) {
        this.reaction.action.stop();
        this.reaction = null;
      }
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
    if (this.hold && this.reaction !== null)
      this.reaction.action.time = Math.min(
        this.reaction.at,
        this.reaction.action.getClip().duration,
      );
    this.mixer.update(this.hold || this.reduced ? 0 : step);
    this.turnGaze();
  }

  /** The actions' weights for this moment: the still pose alone, or the modes under the Reaction's blend. */
  private apply(): void {
    this.still.setEffectiveWeight(this.reduced ? 1 : 0);
    const share = this.reactionShare();
    for (const [mode, action] of this.modes)
      action.setEffectiveWeight(
        this.reduced ? 0 : (this.weights.get(mode) ?? 0) * (1 - share),
      );
    this.reaction?.action.setEffectiveWeight(share);
  }

  /** The Reaction's share of the pose: its intensity, blended in and out over BLEND_S. */
  private reactionShare(): number {
    if (this.reaction === null || this.reduced) return 0;
    const { at, action, playing } = this.reaction;
    const left = action.getClip().duration - at;
    const blend = clamp01(Math.min(at / BLEND_S, left / BLEND_S));
    return clamp01(playing.intensity) * ease(blend);
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
