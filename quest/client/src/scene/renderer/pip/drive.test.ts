// @vitest-environment node
// The 3D Pip's driver (seam S13) on the committed model, fed by the guide's
// own director and Reaction map, unchanged: every mode plays, every
// Reaction plays once at the map's intensity, the gaze eases over the rig's
// 150 ms, reduced motion holds the still pose, and the phone tier holds
// each mode's first frame and draws only while something moves.
import type { QuestEvent } from "@quest/contract";
import type { Object3D } from "three";
import { beforeEach, describe, expect, test } from "vitest";
import type { PipMode, PipModel } from "../../../../pip/contract";
import { PIP_MODES } from "../../../../pip/contract";
import inline from "../../../../pip/model/pip-stand-in.glb?inline";
import { envelope } from "../../../../test/events";
import { IDLE_SLEEP_MS, createPipDirector } from "../../../pip/director";
import { reactionFor } from "../../../pip/reactions";
import { BLEND_S, GAZE_EASE_S, MAX_STEP, PipDrive, frameStep } from "./drive";
import { parsePipModel, type PipModel3D } from "./load";

const bytes = (): ArrayBuffer => {
  const data = Uint8Array.from(
    atob(inline.slice(inline.indexOf(",") + 1)),
    (c) => c.charCodeAt(0),
  );
  return data.buffer;
};

let model: PipModel3D;
beforeEach(async () => {
  model = await parsePipModel(bytes());
});

/** Every node's pose, rounded, to compare poses. */
function pose(root: Object3D): string {
  const parts: string[] = [];
  root.traverse((o) => {
    const v = [
      ...o.position.toArray(),
      ...o.quaternion.toArray(),
      ...o.scale.toArray(),
    ].map((n) => n.toFixed(4));
    parts.push(`${o.name} ${v.join(",")}`);
  });
  return parts.join("\n");
}

const node = (name: string) => {
  const found = model.scene.getObjectByName(name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};

/** A director on a clock that moves only when the test moves it. */
function director(start: Parameters<typeof createPipDirector>[1] = {}) {
  let t = 0;
  const d = createPipDirector(() => t, start);
  return {
    d,
    at: (ms: number) => {
      t = ms;
    },
    send: (...events: QuestEvent[]) =>
      d.send({ type: "events", events: events.map((e) => envelope(e)) }),
  };
}

describe("the modes, from the director", () => {
  test("each mode the director holds plays, each in a pose of its own", () => {
    const models: Record<PipMode, PipModel> = {
      idle: director().d.model(),
      thinking: director().send({ type: "check.started" }),
      rest: director().d.send({ type: "visibility", hidden: true }),
      sleep: (() => {
        const { d, at } = director();
        at(IDLE_SLEEP_MS);
        return d.send({ type: "tick" });
      })(),
    };
    const poses = new Map<string, PipMode>();
    for (const mode of PIP_MODES) {
      expect(models[mode].mode).toBe(mode);
      const drive = new PipDrive(model.scene, model.clips);
      drive.set(models[mode], true);
      drive.update(1);
      expect(drive.state().mode).toBe(mode);
      const shown = pose(model.scene);
      expect(poses.get(shown), `${mode} shares a pose`).toBeUndefined();
      poses.set(shown, mode);
      drive.dispose();
    }
  });

  test("a new mode blends in over 160 ms", () => {
    const drive = new PipDrive(model.scene, model.clips);
    const { d, send } = director();
    drive.set(d.model(), true);
    drive.update(1);
    const idle = node("head").quaternion.clone();
    drive.set(send({ type: "check.started" }), true);
    drive.update(BLEND_S / 2);
    const half = node("head").quaternion.clone();
    expect(drive.moving()).toBe(true);
    drive.update(BLEND_S / 2);
    const thinking = node("head").quaternion.clone();
    expect(half.angleTo(idle)).toBeGreaterThan(0.01);
    expect(half.angleTo(thinking)).toBeGreaterThan(0.01);
    expect(half.angleTo(idle) + half.angleTo(thinking)).toBeCloseTo(
      idle.angleTo(thinking),
      2,
    );
  });
});

describe("the Reactions, from the director at the Reaction map's intensity", () => {
  const firstLesson: QuestEvent = {
    type: "lesson.completed",
    capstone: false,
    firstTime: true,
  };
  const cases: [string, QuestEvent | null][] = [
    ["greeting", null],
    ["success (first pass)", { type: "check.passed", firstTime: true }],
    ["success (a nod)", { type: "check.passed", firstTime: false }],
    ["retry", { type: "check.notYet", evidence: "no file yet" }],
    ["explaining", { type: "hint.shown", rung: 1 }],
    ["curious", { type: "stepDown.reached", from: "guided", to: "hinted" }],
    ["celebration", firstLesson],
  ];

  test.each(cases)("%s plays once, as far as its intensity", (_name, event) => {
    const { d, send } = director(
      event === null ? { screen: "welcome" } : { screen: "map" },
    );
    const pipModel = event === null ? d.model() : send(event);
    const reaction = pipModel.reaction;
    if (reaction === null) throw new Error("no Reaction");
    if (event !== null) {
      const mapped = reactionFor([envelope(event)], { glanceReady: true });
      expect(reaction.kind).toBe(mapped?.kind);
      expect(reaction.intensity).toBe(mapped?.intensity);
    }

    // The Reaction at its own intensity, and at full, on the phone tier's
    // held mode, so only the Reaction moves Pip.
    const travel = (intensity: number) => {
      const drive = new PipDrive(model.scene, model.clips);
      drive.set(pipModel, true);
      drive.update(1);
      const rest = pose(model.scene);
      const restBody = node("body").position.clone();
      const restArm = node("arm_r").quaternion.clone();
      const restHead = node("head").quaternion.clone();
      drive.react({ ...reaction, intensity });
      const clip = model.clips.find((c) => c.name === reaction.kind);
      if (clip === undefined) throw new Error(reaction.kind);
      drive.update(clip.duration * 0.45);
      expect(drive.state().reaction).toMatchObject({
        id: reaction.id,
        kind: reaction.kind,
        intensity,
      });
      const moved = {
        body: node("body").position.distanceTo(restBody),
        arm: node("arm_r").quaternion.angleTo(restArm),
        head: node("head").quaternion.angleTo(restHead),
      };
      expect(pose(model.scene)).not.toBe(rest);
      drive.update(clip.duration);
      expect(drive.state().reaction).toBeNull();
      expect(pose(model.scene)).toBe(rest);
      drive.dispose();
      return moved;
    };
    const at = travel(reaction.intensity);
    const full = travel(1);
    for (const part of ["body", "arm", "head"] as const)
      if (full[part] > 1e-3)
        expect(at[part] / full[part], part).toBeCloseTo(reaction.intensity, 1);
  });
});

describe("the gaze", () => {
  const looking = (x: number, y: number): PipModel => ({
    ...director().d.model(),
    gaze: { x, y },
  });

  test("eases to a new gaze over the rig's 150 ms", () => {
    expect(GAZE_EASE_S).toBe(0.15);
    const drive = new PipDrive(model.scene, model.clips);
    drive.set(looking(0, 0), false);
    drive.update(0.5);
    const ahead = node("gaze").quaternion.clone();
    drive.set(looking(1, -0.5), false);
    drive.update(0.075);
    const half = drive.state().gaze;
    expect(half.x).toBeCloseTo(0.5, 2);
    expect(half.y).toBeCloseTo(-0.25, 2);
    expect(drive.moving()).toBe(true);
    drive.update(0.075);
    expect(drive.state().gaze).toEqual({ x: 1, y: -0.5 });
    expect(drive.state().gazeTo).toEqual({ x: 1, y: -0.5 });
    expect(node("gaze").quaternion.angleTo(ahead)).toBeGreaterThan(0.3);
  });

  test("a gaze that changes mid-ease starts from where Pip looks", () => {
    const drive = new PipDrive(model.scene, model.clips);
    drive.set(looking(0, 0), false);
    drive.update(0.5);
    drive.set(looking(1, 0), false);
    drive.update(0.075);
    drive.set(looking(-1, 0), false);
    drive.update(0);
    expect(drive.state().gaze.x).toBeCloseTo(0.5, 2);
    drive.update(0.15);
    expect(drive.state().gaze.x).toBe(-1);
  });

  test("a null gaze faces the Learner, and the gaze is clamped", () => {
    const drive = new PipDrive(model.scene, model.clips);
    drive.set({ ...looking(3, -2) }, false);
    drive.update(1);
    expect(drive.state().gaze).toEqual({ x: 1, y: -1 });
    drive.set({ ...looking(0, 0), gaze: null }, false);
    drive.update(1);
    expect(drive.state().gaze).toEqual({ x: 0, y: 0 });
  });
});

describe("reduced motion", () => {
  test("holds the still pose at the resting gaze, at once, and plays no Reaction", () => {
    const { d } = director({ screen: "map", reducedMotion: true });
    const still = d.model();
    expect(still.reducedMotion).toBe(true);
    const drive = new PipDrive(model.scene, model.clips);
    drive.set({ ...still, gaze: { x: 0.4, y: 0 } }, false);
    drive.update(0);
    expect(drive.state()).toMatchObject({
      still: true,
      gaze: { x: 0.4, y: 0 },
    });
    const held = pose(model.scene);
    drive.react({ id: "r", kind: "celebration", intensity: 1 });
    for (let i = 0; i < 5; i++) {
      drive.update(0.3);
      expect(pose(model.scene)).toBe(held);
    }
    expect(drive.state().reaction).toBeNull();
    expect(drive.moving()).toBe(false);
  });
});

describe("the phone tier's hold", () => {
  test("a held mode stays on its first frame and asks for no frame at rest", () => {
    const drive = new PipDrive(model.scene, model.clips);
    drive.set(director().d.model(), true);
    drive.update(1);
    expect(drive.moving()).toBe(false);
    const held = pose(model.scene);
    drive.update(1.2);
    expect(pose(model.scene)).toBe(held);
  });

  test("the first frame after a rest moves Pip by one frame, not by the rest's length", () => {
    const drive = new PipDrive(model.scene, model.clips);
    const { d } = director();
    drive.set(d.model(), true);
    drive.update(1);
    // The last frame drawn left Pip at rest.
    const wasMoving = drive.moving();
    expect(wasMoving).toBe(false);
    // Seconds at rest on the demand loop: R3F's next delta is all of them.
    drive.set({ ...d.model(), gaze: { x: 1, y: 0 } }, true);
    drive.update(frameStep(3, wasMoving));
    // One frame of the 150 ms ease: a smoothstep of a ninth, about 3%.
    expect(drive.state().gaze.x).toBeGreaterThan(0);
    expect(drive.state().gaze.x).toBeLessThan(0.05);
    // While Pip moves, a frame advances by its own length, capped.
    expect(frameStep(0.016, true)).toBe(0.016);
    expect(frameStep(2, true)).toBe(MAX_STEP);
  });

  test("the desktop's mode loops, so it always moves", () => {
    const drive = new PipDrive(model.scene, model.clips);
    drive.set(director().d.model(), false);
    drive.update(0.1);
    const first = pose(model.scene);
    drive.update(1.1);
    expect(pose(model.scene)).not.toBe(first);
    expect(drive.moving()).toBe(true);
  });
});
