// @vitest-environment node
// Pip's stride over the guide's driver (D6), on the committed model: as
// drawn, a planted foot stays where the gait planted it from his first move
// to his last, with the model's own walk clip off, and as the clips take
// the feet back once he stands; standing still, the stride lets go, so the
// clips' pose (a Reaction's arms included) shows whole, as the
// driver alone draws it, a pose its clips hold still and the phone's held
// mixer included.
import { Group, Quaternion, Vector3, type Object3D } from "three";
import { beforeEach, describe, expect, test } from "vitest";
import type { PipModel } from "../../../../../pip/contract";
import { PIP_MODEL_STRIDE } from "../../../../../pip/model/contract";
import inline from "../../../../../pip/model/pip.glb?inline";
import { PipDrive } from "../drive";
import { parsePipModel, type PipModel3D } from "../load";
import { workshopNav } from "./nav";
import { StridePose } from "./pose";
import { Walker } from "./walker";

const DT = 1 / 60;
const IDLE: PipModel = {
  mode: "idle",
  reaction: null,
  gaze: null,
  restingGaze: { x: 0, y: 0 },
  reducedMotion: false,
  size: "beside",
};

function loadModel(): Promise<PipModel3D> {
  const data = Uint8Array.from(
    atob(inline.slice(inline.indexOf(",") + 1)),
    (c) => c.charCodeAt(0),
  );
  return parsePipModel(data.buffer);
}

let model: PipModel3D;
beforeEach(async () => {
  model = await loadModel();
});

/** Pip in the room, a frame at a time, as WorkshopPip draws him; `hold` as the phone holds the clips. */
function inRoom(pip: PipModel = IDLE, hold = false) {
  const container = new Group();
  container.add(model.scene);
  const driver = new PipDrive(model.scene, model.clips);
  driver.set(pip, hold);
  const stride = new StridePose(model.scene);
  const walker = new Walker(workshopNav(), { x: 0.4, z: 3 });
  /** One frame; `clips` sees the driver's pose before the stride lays over it. */
  const frame = (clips?: () => void) => {
    stride.restore();
    driver.update(DT);
    clips?.();
    const f = walker.update(DT);
    stride.apply(DT, container, {
      root: f.root,
      gait: walker.gait,
      out: f.out,
      look: f.look,
      reacting: driver.state().reaction !== null,
    });
    return f;
  };
  return { driver, stride, walker, frame };
}

const node = (name: string): Object3D => {
  const found = model.scene.getObjectByName(name);
  if (found === undefined) throw new Error(name);
  return found;
};

describe("the stride over the driver", () => {
  test("as drawn, a planted foot stays where the gait planted it, from setting off, walking and running, to the clips taking it back as he stands", () => {
    const { stride, walker, frame } = inRoom();
    walker.goTo({ spot: "noticeboard" });
    const held = new Map<number, Vector3>();
    let slide = 0;
    let planted = 0;
    let ran = false;
    const at = new Vector3();
    for (let i = 0; i < 8 * 60; i++) {
      const f = frame();
      ran ||= f.out.runWeight > 0.5;
      for (const foot of walker.gait.feet) {
        stride.footWorld(foot.side, at);
        if (!foot.planted) {
          held.delete(foot.side);
          continue;
        }
        planted++;
        const was = held.get(foot.side);
        if (was === undefined) held.set(foot.side, at.clone());
        else slide = Math.max(slide, was.distanceTo(at));
      }
    }
    expect(ran).toBe(true);
    expect(planted).toBeGreaterThan(100);
    // Under a millimetre, at Pip's metre.
    expect(slide).toBeLessThan(1e-3);
  });

  test("standing still, the clips' pose shows whole: a Greeting's arms play as the driver plays them", () => {
    const { driver, stride, frame } = inRoom();
    for (let i = 0; i < 90; i++) frame();
    expect(stride.weight()).toBeLessThan(1e-3);
    driver.react({ id: "greeting", kind: "greeting", intensity: 1 });
    const arms = [node("ArmLeft"), node("ArmRight")];
    const rest = arms.map((a) => a.quaternion.clone());
    const clips = arms.map(() => new Quaternion());
    let raised = 0;
    let changed = 0;
    for (let i = 0; i < 60; i++) {
      frame(() => {
        arms.forEach((a, k) => clips[k]?.copy(a.quaternion));
      });
      arms.forEach((a, k) => {
        raised = Math.max(
          raised,
          a.quaternion.angleTo(rest[k] ?? a.quaternion),
        );
        changed = Math.max(
          changed,
          a.quaternion.angleTo(clips[k] ?? a.quaternion),
        );
      });
    }
    expect(raised).toBeGreaterThan(0.2);
    expect(changed).toBeLessThan(1e-3);
  });

  test.each([
    { mode: "sleep", hold: false },
    { mode: "rest", hold: false },
    { mode: "thinking", hold: true },
  ] as const)(
    "standing in $mode (held $hold), he is drawn as the driver alone draws him, the parts the clips keep still included",
    async ({ mode, hold }) => {
      const gap = await gapToDriverAlone({ ...IDLE, mode }, hold);
      expect(gap.angle).toBeLessThan(1e-4);
      expect(gap.distance).toBeLessThan(1e-5);
    },
  );

  test("standing, a Greeting cut short by another Reaction leaves his arms as the driver alone leaves them", async () => {
    const gap = await gapToDriverAlone(IDLE, false, (i, driver) => {
      if (i === 30)
        driver.react({ id: "greeting", kind: "greeting", intensity: 1 });
      if (i === 50)
        driver.react({ id: "curious", kind: "curious", intensity: 1 });
    });
    expect(gap.angle).toBeLessThan(1e-4);
    expect(gap.distance).toBeLessThan(1e-5);
  });
});

/**
 * The widest gap, over three seconds standing, between each part the
 * stride moves as WorkshopPip draws it and as the driver alone draws a
 * second copy of the model; `script`, if any, runs on both drivers before
 * each frame.
 */
async function gapToDriverAlone(
  pip: PipModel,
  hold: boolean,
  script?: (frame: number, driver: PipDrive) => void,
): Promise<{ angle: number; distance: number }> {
  const alone = await loadModel();
  const reference = new PipDrive(alone.scene, alone.clips);
  reference.set(pip, hold);
  const { driver, frame } = inRoom(pip, hold);
  const gap = { angle: 0, distance: 0 };
  const turn = new Quaternion();
  const wanted = new Quaternion();
  for (let i = 0; i < 3 * 60; i++) {
    script?.(i, reference);
    script?.(i, driver);
    reference.update(DT);
    frame();
    for (const name of PIP_MODEL_STRIDE) {
      const drawn = node(name);
      const want = alone.scene.getObjectByName(name);
      if (want === undefined) throw new Error(name);
      // The mixer's blends leave turns a little off unit length.
      turn.copy(drawn.quaternion).normalize();
      gap.angle = Math.max(
        gap.angle,
        turn.angleTo(wanted.copy(want.quaternion).normalize()),
      );
      gap.distance = Math.max(
        gap.distance,
        drawn.position.distanceTo(want.position),
        drawn.scale.distanceTo(want.scale),
      );
    }
  }
  return gap;
}
