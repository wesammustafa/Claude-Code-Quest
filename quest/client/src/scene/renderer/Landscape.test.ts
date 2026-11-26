// The Beginner landscape's Stations (09 9.3, ticket 52): six along the
// path, left to right as the camera looks, each lit from its Lesson's
// `complete` alone, and the ground and path drawn with baked colours.
import { describe, expect, test } from "vitest";
import type { SceneLook, SceneStation } from "../../mount/types";
import { beginnerLayout, groundGeometry, pathGeometry } from "./beginner";
import { litStations } from "./Landscape";

const LOOK: SceneLook = {
  sky: "#fbf6ef",
  ground: "#fbeee0",
  light: "#fff6ee",
  ambient: 3.15,
  key: 1,
  shadow: "#3a1a10",
  landscape: {
    meadow: "#e4f2cf",
    path: "#fff8ec",
    stone: "#f9f3ec",
    lit: "#ffdfcf",
    foliage: "#e8f8ee",
  },
};

const station = (
  lesson: string,
  complete: boolean,
  level: SceneStation["level"] = "beginner",
  optional = false,
): SceneStation => ({ lesson, level, optional, complete });

describe("the Beginner landscape", () => {
  test("has six Stations along its path, left to right, on the ground", () => {
    const { stations, heightAt } = beginnerLayout();
    expect(stations).toHaveLength(6);
    for (let i = 1; i < stations.length; i++)
      expect(stations[i]?.x).toBeGreaterThan(stations[i - 1]?.x ?? Infinity);
    for (const s of stations) expect(s.y).toBeCloseTo(heightAt(s.x, s.z), 5);
  });

  test("lights a Station when its Lesson is complete, from the snapshot's field alone", () => {
    expect(
      litStations([
        station("b-1", true),
        station("b-2", false),
        station("b-3", true),
        station("i-1", true, "intermediate"),
      ]),
    ).toEqual([true, false, true, false, false, false]);
    expect(litStations([])).toEqual([false, false, false, false, false, false]);
  });

  test("draws no Station for a lab, which sits beside the path", () => {
    expect(
      litStations([
        station("b-1", false),
        station("b-lab", true, "beginner", true),
        station("b-2", true),
      ]),
    ).toEqual([false, true, false, false, false, false]);
  });

  test("bakes a colour into every face of the ground and the path, inside the displayable range", () => {
    for (const geometry of [groundGeometry(LOOK), pathGeometry(LOOK)]) {
      const colours = geometry.getAttribute("color");
      const positions = geometry.getAttribute("position");
      expect(colours.count).toBe(positions.count);
      for (let i = 0; i < colours.array.length; i++) {
        expect(colours.array[i]).toBeGreaterThanOrEqual(0);
        expect(colours.array[i]).toBeLessThanOrEqual(1);
      }
      // Every face is one colour: low-poly, flat.
      for (let f = 0; f + 2 < colours.count; f += 3)
        expect(colours.getX(f)).toBe(colours.getX(f + 2));
    }
  });
});
