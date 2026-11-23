// The Badge reveal's choreography (09 9.3): one light per passed Check
// line, each flowing into the Badge before the end, and the end pose the
// formed Badge exactly, which a skip jumps to.
import { describe, expect, test } from "vitest";
import { arrival, revealPose } from "./reveal";

const formed = {
  scale: 1,
  body: 1,
  art: 1,
  glow: 0,
};

describe("the reveal's pose", () => {
  test.each([0, 1, 2, 7])("one light for each of %i passed lines", (n) => {
    for (const p of [0, 0.2, 0.5, 0.9, 1])
      expect(revealPose(p, n).lights).toHaveLength(n);
  });

  test("at its start no Badge shows yet, and no light has left", () => {
    const pose = revealPose(0, 3);
    expect(pose.body).toBe(0);
    expect(pose.art).toBe(0);
    expect(pose.scale).toBeLessThan(1);
    expect(pose.spin).not.toBe(0);
    expect(pose.lights.every((l) => l.opacity === 0)).toBe(true);
  });

  test("each light flows in and is gone before the end, one after another", () => {
    const n = 5;
    const arrivals = Array.from({ length: n }, (_, i) => arrival(i, n));
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    expect(Math.max(...arrivals)).toBeLessThan(1);
    for (const [i, at] of arrivals.entries()) {
      const before = revealPose(at - 0.2, n).lights[i];
      const near = revealPose(at - 0.05, n).lights[i];
      expect(before?.opacity).toBeGreaterThan(0);
      // Nearer the centre as it goes on.
      expect(Math.hypot(near?.x ?? 0, near?.y ?? 0)).toBeLessThan(
        Math.hypot(before?.x ?? 0, before?.y ?? 0),
      );
      expect(revealPose(at + 0.01, n).lights[i]?.opacity).toBe(0);
    }
  });

  test("an arrival warms the Badge for a moment", () => {
    const at = arrival(0, 1);
    expect(revealPose(at + 0.01, 1).glow).toBeGreaterThan(0);
    expect(revealPose(at + 0.3, 1).glow).toBe(0);
  });

  test("its end is the formed Badge exactly, past the end too", () => {
    for (const p of [1, 1.5])
      for (const n of [0, 2, 6]) {
        const pose = revealPose(p, n);
        expect(pose).toMatchObject(formed);
        expect(pose.spin === 0).toBe(true);
        expect(pose.lights.every((l) => l.opacity === 0)).toBe(true);
      }
  });

  test("it forms on the way: bigger and further turned in as it goes", () => {
    const early = revealPose(0.3, 2);
    const late = revealPose(0.7, 2);
    expect(late.scale).toBeGreaterThan(early.scale);
    expect(Math.abs(late.spin)).toBeLessThan(Math.abs(early.spin));
  });
});
