// @vitest-environment node
// Pip's stride over the guide's driver (D6), on the committed model: as
// drawn, a planted foot stays where the gait planted it while he walks and
// runs, with the model's own walk clip off; standing still, the stride lets
// go, so the clips' pose (a Reaction's arms included) shows whole, his feet
// easing back under the clips by a few millimetres at most.
import { Group, Quaternion, Vector3, type Object3D } from "three";
import { beforeEach, describe, expect, test } from "vitest";
import type { PipModel } from "../../../../../pip/contract";
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

let model: PipModel3D;
beforeEach(async () => {
  const data = Uint8Array.from(
    atob(inline.slice(inline.indexOf(",") + 1)),
    (c) => c.charCodeAt(0),
  );
  model = await parsePipModel(data.buffer);
});

/** Pip in the room, a frame at a time, as WorkshopPip draws him. */
function inRoom() {
  const container = new Group();
  container.add(model.scene);
  const driver = new PipDrive(model.scene, model.clips);
  driver.set(IDLE, false);
  const stride = new StridePose(model.scene);
  const walker = new Walker(workshopNav(), { x: 0.4, z: 3 });
  /** One frame; `clips` sees the driver's pose before the stride lays over it. */
  const frame = (clips?: () => void) => {
    stride.reset();
    driver.walk(0);
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
  test("as drawn, a planted foot stays where the gait planted it, walking and running", () => {
    const { driver, walker, frame } = inRoom();
    walker.goTo({ spot: "noticeboard" });
    const held = new Map<number, Vector3>();
    let slide = 0;
    let planted = 0;
    let ran = false;
    const at = new Vector3();
    for (let i = 0; i < 8 * 60; i++) {
      const f = frame();
      ran ||= f.out.runWeight > 0.5;
      expect(driver.state().walkShare).toBe(0);
      // Past the stride taking the feet from the clips, and while he
      // travels: standing, the clips take them back.
      if (i < 30 || !f.travelling) continue;
      for (const foot of walker.gait.feet) {
        node(foot.side === 1 ? "FootLeft" : "FootRight").getWorldPosition(at);
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
});
