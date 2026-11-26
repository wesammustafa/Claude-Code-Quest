// @vitest-environment node
// Where Pip's centre goes (D6): a new goal mid-stride turns him toward it
// at once, with no stop and no queue; a pace of walk never runs however
// long the trip; steering moves him and slides him along the furniture
// rather than into it, and no steer stops him.
import { describe, expect, test } from "vitest";
import { Gait, SPEED, wrapAngle } from "./gait";
import { Motor } from "./motor";
import { workshopNav } from "./nav";

const DT = 1 / 60;

describe("Pip's motor", () => {
  test("a new goal mid-stride turns him toward it at once and drops the old one", () => {
    const nav = workshopNav();
    const motor = new Motor(nav, { x: -4, z: 3 }, Math.PI / 2);
    const gait = new Gait(motor.root);
    const first = motor.goTo({ x: 4.5, z: 3.4 }, "walk");
    for (let i = 0; i < 60; i++) gait.update(DT, motor.update(DT));
    expect(motor.currentSpeed).toBeGreaterThan(SPEED.walk * 0.8);
    // Mid-stride: a foot is in the air.
    for (let i = 0; i < 60 && gait.feet.every((f) => f.planted); i++)
      gait.update(DT, motor.update(DT));
    expect(gait.feet.some((f) => !f.planted)).toBe(true);

    const second = motor.goTo({ x: -3.4, z: -3.95 }, "walk");
    expect(second.id).not.toBe(first.id);
    const corner = motor.heading();
    if (corner === null) throw new Error("no route");
    const want = Math.atan2(
      corner.x - motor.root.pos.x,
      corner.z - motor.root.pos.z,
    );
    const before = Math.abs(wrapAngle(want - motor.root.yaw));
    for (let i = 0; i < 6; i++) gait.update(DT, motor.update(DT));
    // Within a tenth of a second he turns toward the new goal, still moving.
    expect(Math.abs(wrapAngle(want - motor.root.yaw))).toBeLessThan(before);
    expect(motor.currentSpeed).toBeGreaterThan(0);
    expect(motor.goal.kind === "route" && motor.goal.id).toBe(second.id);
    for (let i = 0; i < 600 && motor.arrivedId === null; i++)
      gait.update(DT, motor.update(DT));
    expect(motor.arrivedId).toBe(second.id);
    expect(
      Math.hypot(motor.root.pos.x + 3.4, motor.root.pos.z + 3.95),
    ).toBeLessThan(0.1);
  });

  test("a walking pace never runs, however long the trip", () => {
    const motor = new Motor(workshopNav(), { x: -5, z: 3.5 }, 0);
    motor.goTo({ x: 5, z: -3.6 }, "walk");
    let top = 0;
    for (let i = 0; i < 900; i++) {
      motor.update(DT);
      top = Math.max(top, motor.currentSpeed);
    }
    expect(top).toBeLessThanOrEqual(SPEED.walk + 1e-6);
    expect(motor.arrivedId).not.toBeNull();
  });

  test("steered into the bench he slides along it, never into it", () => {
    const nav = workshopNav();
    const motor = new Motor(nav, { x: 0.2, z: 2 }, Math.PI);
    for (let i = 0; i < 240; i++) {
      motor.drive(-0.3, -1, false);
      motor.update(DT);
      expect(nav.freePoint(motor.root.pos)).toBe(true);
    }
    expect(motor.root.pos.x).toBeLessThan(0);
    motor.drive(0, 0, false);
    for (let i = 0; i < 60; i++) motor.update(DT);
    expect(motor.currentSpeed).toBe(0);
  });
});
