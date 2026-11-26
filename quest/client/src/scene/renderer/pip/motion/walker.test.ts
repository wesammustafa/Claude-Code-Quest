// @vitest-environment node
// Pip in the workshop (D6), on his legs: sent to a place he arrives facing
// what it looks at and stands there; a greet turns him to the Learner
// before the director plays it; Explore alone steers him, and leaving it
// sends him back to the screen's goal; and what he is doing reads from his
// legs first, then from the director.
import { describe, expect, test } from "vitest";
import { SPOTS, type FloorPoint } from "../../../workshop/layout";
import { wrapAngle } from "./gait";
import { workshopNav } from "./nav";
import { Walker, activityOf, yawTo } from "./walker";

const DT = 1 / 60;

function run(walker: Walker, seconds: number) {
  const frames = [];
  for (let i = 0; i < seconds * 60; i++) frames.push(walker.update(DT));
  return frames;
}

/** The frame the greet comes due, within `seconds`: how far he is off facing `camera` then, and whether he moves. */
function untilGreet(walker: Walker, camera: FloorPoint, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    const f = walker.update(DT);
    if (f.greet)
      return {
        frame: i,
        off: Math.abs(wrapAngle(f.root.yaw - yawTo(f.root.pos, camera))),
        moving: f.moving,
      };
  }
  return null;
}

describe("Pip's walk in the workshop", () => {
  test("sent to a place, he runs the long way, arrives facing what it looks at, and stands there", () => {
    const walker = new Walker(workshopNav(), { x: 0.4, z: 3 });
    walker.goTo({ spot: "noticeboard" });
    const frames = run(walker, 8);
    expect(frames.some((f) => f.out.runWeight > 0.5)).toBe(true);
    expect(frames.some((f) => f.travelling)).toBe(true);
    const last = frames.at(-1);
    expect(last?.travelling).toBe(false);
    expect(walker.at).toBe("noticeboard");
    const { stand, look } = SPOTS.noticeboard;
    const root = walker.motor.root;
    expect(Math.hypot(root.pos.x - stand.x, root.pos.z - stand.z)).toBeLessThan(
      0.05,
    );
    const facing = yawTo(stand, { x: look[0], z: look[2] });
    expect(Math.abs(wrapAngle(root.yaw - facing))).toBeLessThan(0.05);
    for (const f of walker.gait.feet) expect(f.planted).toBe(true);
  });

  test("a greet turns him to the Learner first, and is due once he faces them", () => {
    const walker = new Walker(workshopNav(), "noticeboard");
    const camera = { x: 0, z: 9 };
    walker.greet(camera);
    const due = untilGreet(walker, camera, 1.5);
    expect(due?.frame).toBeGreaterThan(0);
    expect(due?.off).toBeLessThan(0.7);
    expect(run(walker, 1.5).filter((f) => f.greet)).toHaveLength(0);
    const toCamera = yawTo(walker.motor.root.pos, camera);
    expect(Math.abs(wrapAngle(walker.motor.root.yaw - toCamera))).toBeLessThan(
      0.05,
    );
    expect(walker.at, "a greet keeps him at his place").toBe("noticeboard");
  });

  test("greeted as he runs away from the Learner, he brakes and turns round before the greet is due", () => {
    const walker = new Walker(workshopNav(), { x: -5, z: 3.6 });
    walker.goTo({ floor: { x: 6, z: 3.6 } }, "run");
    run(walker, 2);
    expect(walker.motor.currentSpeed).toBeGreaterThan(2);
    const camera = { x: -30, z: 3.6 };
    walker.greet(camera);
    const due = untilGreet(walker, camera, 2.5);
    expect(due?.moving).toBe(false);
    expect(due?.off).toBeLessThan(0.7);
  });

  test("steers only while Explore is on, stops on no steer, and goes back to the goal when it ends", () => {
    const walker = new Walker(workshopNav(), { x: 0.4, z: 3 });
    walker.steer(1, 0, false);
    expect(run(walker, 0.5).some((f) => f.moving)).toBe(false);

    walker.setExplore(true, "bench");
    walker.steer(1, 0, true);
    const steered = run(walker, 1);
    expect(steered.some((f) => f.moving)).toBe(true);
    expect(walker.motor.root.pos.x).toBeGreaterThan(1);
    walker.steer(0, 0, false);
    expect(run(walker, 1).at(-1)?.travelling).toBe(false);

    walker.setExplore(false, "bench");
    run(walker, 6);
    expect(walker.at).toBe("bench");
  });

  test("reads what he is doing from his legs, then the director's Reaction, then its mode", () => {
    const still = {
      moving: false,
      runWeight: 0,
      greeting: false,
      reaction: null,
    } as const;
    expect(activityOf({ ...still, moving: true, mode: "sleep" })).toBe(
      "walking",
    );
    expect(
      activityOf({ ...still, moving: true, runWeight: 0.9, mode: "idle" }),
    ).toBe("running");
    expect(activityOf({ ...still, greeting: true, mode: "sleep" })).toBe(
      "greeting",
    );
    expect(
      activityOf({ ...still, reaction: "celebration", mode: "thinking" }),
    ).toBe("celebrating");
    expect(activityOf({ ...still, mode: "sleep" })).toBe("asleep");
    expect(activityOf({ ...still, mode: "rest" })).toBe("resting");
    expect(activityOf({ ...still, mode: "thinking" })).toBe("thinking");
    expect(activityOf({ ...still, reaction: "curious", mode: "idle" })).toBe(
      "idle",
    );
  });
});
