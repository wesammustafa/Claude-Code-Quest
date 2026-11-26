// @vitest-environment node
// Where Pip can walk in the workshop (D6): over the room's own floor plan,
// a route goes round the furniture, never through it, and a goal he cannot
// stand at (inside the furniture, or past a wall) moves to the nearest
// point he can.
import { describe, expect, test } from "vitest";
import { FURNITURE, PIP_RADIUS, SPOTS } from "../../../workshop/layout";
import { workshopNav } from "./nav";

describe("the workshop's floor", () => {
  test("routes round the bench, each leg clear of the furniture", () => {
    const nav = workshopNav();
    const pts = nav.route({ x: 0, z: 2.5 }, { x: 0, z: -2.5 });
    expect(pts.length, "went straight through the bench").toBeGreaterThan(2);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a === undefined || b === undefined) throw new Error("no point");
      expect(nav.clear(a, b)).toBe(true);
    }
  });

  test("reaches every spot of the room from Pip's start", () => {
    const nav = workshopNav();
    for (const [id, spot] of Object.entries(SPOTS)) {
      expect(nav.freePoint(spot.stand), id).toBe(true);
      const pts = nav.route({ x: 0.4, z: 3 }, spot.stand);
      expect(pts.at(-1), id).toEqual(spot.stand);
    }
  });

  test("moves a goal inside the furniture, or past a wall, to the nearest free point", () => {
    const nav = workshopNav();
    const desk = FURNITURE.desk;
    if (desk === undefined) throw new Error("no desk");
    const inside = { x: (desk.x0 + desk.x1) / 2, z: (desk.z0 + desk.z1) / 2 };
    expect(nav.freePoint(inside)).toBe(false);
    const end = nav.route({ x: 0.4, z: 3 }, inside).at(-1);
    if (end === undefined) throw new Error("no route");
    expect(nav.freePoint(end)).toBe(true);
    // Just off the desk by his radius, a grid cell at most.
    const off = Math.max(
      desk.x0 - end.x,
      end.x - desk.x1,
      desk.z0 - end.z,
      end.z - desk.z1,
    );
    expect(off).toBeGreaterThanOrEqual(PIP_RADIUS);
    expect(off).toBeLessThan(PIP_RADIUS + nav.cell);

    const past = nav.nearestFree({ x: 0, z: 9 });
    expect(nav.freePoint(past)).toBe(true);
    expect(past.z).toBeGreaterThan(4.6 - PIP_RADIUS - nav.cell);
  });
});
