// The Journey path's shared state and its control mapping (09 9.3, ticket
// 52): which Station the arrow keys, a swipe or a drag, a pinch and a
// scroll lead to, and which Station a tap lands on.
import { describe, expect, test, vi } from "vitest";
import { createSceneHub } from "./context";
import {
  createJourneyPath,
  journeyPathOf,
  lessonOfScreen,
  pinchWhole,
  stationAt,
  stationForKey,
  stepStation,
  SWIPE_PX,
  swipeStep,
  wheelWhole,
} from "./path";

const IDS = ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"];

describe("the path's state", () => {
  test("tells its listeners only of a change, and the renderer's views apart", () => {
    const path = createJourneyPath();
    const changed = vi.fn();
    const drawn = vi.fn();
    path.subscribe(changed);
    path.subscribeView(drawn);
    path.setAt("b-2");
    path.setAt("b-2");
    path.setWhole(false);
    path.setBand({ left: 0, top: 10, width: 100, height: 50 });
    path.setBand({ left: 0, top: 10, width: 100, height: 50 });
    path.setReady(true);
    expect(changed).toHaveBeenCalledTimes(3);
    expect(drawn).not.toHaveBeenCalled();
    path.setView({ points: [], pip: { x: 1, y: 2 } });
    expect(drawn).toHaveBeenCalledTimes(1);
    expect(path.view().pip).toEqual({ x: 1, y: 2 });
  });

  test("is one per page's Scene", () => {
    const hub = createSceneHub();
    expect(journeyPathOf(hub)).toBe(journeyPathOf(hub));
    expect(journeyPathOf(createSceneHub())).not.toBe(journeyPathOf(hub));
  });

  test("a screen's Lesson is its overview, step or complete route's", () => {
    expect(lessonOfScreen({ path: "/lesson/b-2", screen: "intro" })).toBe(
      "b-2",
    );
    expect(lessonOfScreen({ path: "/lesson/b-2/step", screen: "step" })).toBe(
      "b-2",
    );
    expect(
      lessonOfScreen({
        path: "/lesson/b-capstone/complete",
        screen: "complete",
      }),
    ).toBe("b-capstone");
    expect(lessonOfScreen({ path: "/journey", screen: "map" })).toBeNull();
    expect(
      lessonOfScreen({
        path: "/level/beginner/complete",
        screen: "levelComplete",
      }),
    ).toBeNull();
  });
});

describe("the controls", () => {
  test("the arrow keys move one Station along, held at either end; other keys do nothing", () => {
    expect(stationForKey(IDS, "b-2", "ArrowRight")).toBe("b-3");
    expect(stationForKey(IDS, "b-2", "ArrowDown")).toBe("b-3");
    expect(stationForKey(IDS, "b-2", "ArrowLeft")).toBe("b-1");
    expect(stationForKey(IDS, "b-2", "ArrowUp")).toBe("b-1");
    expect(stationForKey(IDS, "b-1", "ArrowLeft")).toBe("b-1");
    expect(stationForKey(IDS, "b-capstone", "ArrowRight")).toBe("b-capstone");
    for (const key of ["Enter", " ", "Tab", "Home", "End", "a"])
      expect(stationForKey(IDS, "b-2", key), key).toBeNull();
  });

  test("a step from no Station, or one off the path, starts at the first", () => {
    expect(stepStation(IDS, null, 1)).toBe("b-1");
    expect(stepStation(IDS, "i-1", -1)).toBe("b-1");
    expect(stepStation([], "b-1", 1)).toBeNull();
  });

  test("a swipe or a drag sideways moves one Station: leftward on, rightward back; a tap or an up and down travel moves none", () => {
    expect(swipeStep(-SWIPE_PX, 0)).toBe(1);
    expect(swipeStep(SWIPE_PX + 10, 4)).toBe(-1);
    expect(swipeStep(-(SWIPE_PX - 1), 0)).toBe(0);
    expect(swipeStep(-60, 80)).toBe(0);
    expect(swipeStep(0, 0)).toBe(0);
  });

  test("a pinch closing pulls back, opening goes back in, and a small change keeps the view", () => {
    expect(pinchWhole(200, 150, false)).toBe(true);
    expect(pinchWhole(200, 250, true)).toBe(false);
    expect(pinchWhole(200, 190, false)).toBe(false);
    expect(pinchWhole(200, 210, true)).toBe(true);
    expect(pinchWhole(0, 100, true)).toBe(true);
  });

  test("a scroll down pulls back and up goes back in", () => {
    expect(wheelWhole(40, false)).toBe(true);
    expect(wheelWhole(-40, true)).toBe(false);
    expect(wheelWhole(0, true)).toBe(true);
  });

  test("a tap lands on the nearest Station whose reach holds it", () => {
    const points = [
      { lesson: "b-1", x: 100, y: 100, r: 30, lit: true },
      { lesson: "b-2", x: 140, y: 100, r: 30, lit: false },
    ];
    expect(stationAt(points, 105, 100)?.lesson).toBe("b-1");
    expect(stationAt(points, 130, 100)?.lesson).toBe("b-2");
    expect(stationAt(points, 100, 200)).toBeNull();
  });
});
